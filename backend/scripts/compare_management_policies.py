#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from pathlib import Path


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("DB_SOURCE", "local")

from backend.management.policies.policy_registry import build_default_policies
from backend.management.research.case_sets import get_case_set
from backend.management.research.evaluator import summarize_results
from backend.management.research.lanes import route_case_lanes
from backend.management.research.path_classifier import (
    build_early_path_features,
    bucket_early_risk_score,
    classify_early_path_risk,
    compute_recovery_quality_score,
    recommend_policy_for_early_score,
    recommend_policy_for_thresholds,
    score_early_path_risk,
)
from backend.management.simulation.engine import simulate_policy
from backend.management.state.snapshot_builder import build_position_snapshots
from backend.management.storage.repo import persist_run_and_results, persist_snapshots


def _load_cases(args) -> list[dict]:
    if args.cases_file:
        with open(args.cases_file, "r", encoding="utf-8") as f:
            payload = json.load(f)
        if not isinstance(payload, list):
            raise ValueError("cases file must be a JSON array")
        return payload
    return get_case_set(args.preset)


def _build_path_signature(snapshots) -> str:
    signature = []
    for snapshot in snapshots:
        if not signature or signature[-1] != snapshot.state_id:
            signature.append(snapshot.state_id)
    return " -> ".join(signature)


def _classify_path_type(snapshots) -> str:
    states = [snapshot.state_id for snapshot in snapshots]
    latest_state = snapshots[-1].state_id
    has_failure = "FailureRisk" in states
    has_profit = "ProfitProtection" in states
    has_breakout = "BreakoutPending" in states or "TrendHolding" in states

    if has_failure and latest_state in {"FailureRisk", "EntryTriggered"}:
        return "risk_dominant"
    if has_failure and latest_state in {"BreakoutPending", "TrendHolding", "ProfitProtection"}:
        return "risk_then_recovery"
    if has_profit and not has_failure:
        return "profit_protection_clean"
    if has_breakout and not has_failure and not has_profit:
        return "breakout_observation"
    return "mixed_other"


def _round_or_none(value):
    return round(value, 4) if value is not None else None


def _build_summary_row(policy_id: str, results: list) -> dict:
    summary = summarize_results(results)
    return {
        "policy_id": policy_id,
        "sample_size": summary.get("sample_size"),
        "avg_return": _round_or_none(summary.get("avg_return")),
        "median_return": _round_or_none(summary.get("median_return")),
        "win_rate": _round_or_none(summary.get("win_rate")),
        "avg_max_drawdown": _round_or_none(summary.get("avg_max_drawdown")),
        "avg_profit_giveback": _round_or_none(summary.get("avg_profit_giveback")),
    }


def _evaluate_threshold_grid(case_evaluations: list[dict]) -> list[dict]:
    rows = []
    for exit_all_threshold in [8, 9, 10, 11, 12]:
        for reduce_threshold in [4, 5, 6, 7, 8, 9]:
            if exit_all_threshold <= reduce_threshold:
                continue
            recommended_returns = []
            baseline_returns = []
            best_returns = []
            for case in case_evaluations:
                policy_id = recommend_policy_for_thresholds(
                    score=case["early_risk_score"],
                    exit_all_threshold=exit_all_threshold,
                    reduce_threshold=reduce_threshold,
                )
                recommended_returns.append(case["result_by_policy"][policy_id])
                baseline_returns.append(case["result_by_policy"]["buy_and_hold_baseline"])
                best_returns.append(max(case["result_by_policy"].values()))
            rows.append(
                {
                    "rule": f"score>={exit_all_threshold} => exit_all; score>={reduce_threshold} => reduce_50; else => hold",
                    "exit_all_threshold": exit_all_threshold,
                    "reduce_threshold": reduce_threshold,
                    "avg_recommended_return": _round_or_none(sum(recommended_returns) / len(recommended_returns)),
                    "avg_baseline_return": _round_or_none(sum(baseline_returns) / len(baseline_returns)),
                    "avg_best_case_return": _round_or_none(sum(best_returns) / len(best_returns)),
                    "improvement_vs_baseline": _round_or_none((sum(recommended_returns) - sum(baseline_returns)) / len(recommended_returns)),
                }
            )
    rows.sort(key=lambda row: (row["avg_recommended_return"] is None, -(row["avg_recommended_return"] or -999)))
    return rows


def _summarize_rows(rows: list[dict]) -> dict:
    if not rows:
        return {"sample_size": 0}
    baseline = [row["baseline_return_pct"] for row in rows if row.get("baseline_return_pct") is not None]
    best_case = [row["best_return_pct"] for row in rows if row.get("best_return_pct") is not None]
    recommended = [row["recommended_return_pct"] for row in rows if row.get("recommended_return_pct") is not None]
    return {
        "sample_size": len(rows),
        "avg_baseline_return": _round_or_none(sum(baseline) / len(baseline)) if baseline else None,
        "avg_best_return": _round_or_none(sum(best_case) / len(best_case)) if best_case else None,
        "avg_recommended_return": _round_or_none(sum(recommended) / len(recommended)) if recommended else None,
    }


def _build_high_bucket_audit(case_rows: list[dict]) -> dict:
    score_high = [row for row in case_rows if row.get("early_risk_bucket") == "score_high"]
    if not score_high:
        return {"sample_size": 0}

    true_high = [row for row in score_high if row.get("path_type") == "risk_dominant"]
    false_high = [row for row in score_high if row.get("path_type") == "risk_then_recovery"]
    harmful_false_high = [
        row
        for row in false_high
        if row.get("recommended_return_pct") is not None
        and row.get("baseline_return_pct") is not None
        and row["recommended_return_pct"] < row["baseline_return_pct"]
    ]
    harmful_gap = [
        row["recommended_return_pct"] - row["baseline_return_pct"]
        for row in harmful_false_high
        if row.get("recommended_return_pct") is not None and row.get("baseline_return_pct") is not None
    ]

    return {
        "sample_size": len(score_high),
        "risk_dominant_count": len(true_high),
        "risk_then_recovery_count": len(false_high),
        "risk_dominant_precision": _round_or_none(len(true_high) / len(score_high)),
        "harmful_false_positive_count": len(harmful_false_high),
        "harmful_false_positive_rate": _round_or_none(len(harmful_false_high) / len(score_high)),
        "avg_harmful_false_positive_gap": _round_or_none(sum(harmful_gap) / len(harmful_gap)) if harmful_gap else None,
    }


def _build_harmful_high_pattern_audit(case_rows: list[dict]) -> dict:
    harmful_rows = [
        row
        for row in case_rows
        if row.get("early_risk_bucket") == "score_high"
        and row.get("path_type") == "risk_then_recovery"
        and row.get("recommended_return_pct") is not None
        and row.get("baseline_return_pct") is not None
        and row["recommended_return_pct"] < row["baseline_return_pct"]
    ]
    if not harmful_rows:
        return {"sample_size": 0}

    path_signature_counts = defaultdict(int)
    recovery_quality_counts = defaultdict(int)
    latest_signal_counts = defaultdict(int)
    latest_state_counts = defaultdict(int)
    for row in harmful_rows:
        path_signature_counts[row.get("path_signature", "unknown")] += 1
        recovery_quality_counts[str(row.get("recovery_quality_score", "unknown"))] += 1
        latest_signal_counts[row.get("latest_signal", "unknown")] += 1
        latest_state_counts[row.get("latest_state", "unknown")] += 1

    gaps = [
        row["recommended_return_pct"] - row["baseline_return_pct"]
        for row in harmful_rows
        if row.get("recommended_return_pct") is not None and row.get("baseline_return_pct") is not None
    ]

    return {
        "sample_size": len(harmful_rows),
        "avg_gap_vs_baseline": _round_or_none(sum(gaps) / len(gaps)) if gaps else None,
        "path_signatures": dict(sorted(path_signature_counts.items(), key=lambda item: (-item[1], item[0]))),
        "recovery_quality_scores": dict(sorted(recovery_quality_counts.items(), key=lambda item: (int(item[0]), item[0]))),
        "latest_signals": dict(sorted(latest_signal_counts.items(), key=lambda item: (-item[1], item[0]))),
        "latest_states": dict(sorted(latest_state_counts.items(), key=lambda item: (-item[1], item[0]))),
        "labels": [row["label"] for row in harmful_rows],
    }


def _build_harmful_low_pattern_audit(case_rows: list[dict]) -> dict:
    harmful_rows = [
        row
        for row in case_rows
        if row.get("early_risk_bucket") == "score_low"
        and row.get("path_type") == "risk_dominant"
        and row.get("best_policy") in {"failure_risk_exit_all", "failure_risk_reduce_50"}
        and row.get("best_return_pct") is not None
        and row.get("baseline_return_pct") is not None
        and row["best_return_pct"] > row["baseline_return_pct"]
    ]
    if not harmful_rows:
        return {"sample_size": 0}

    path_signature_counts = defaultdict(int)
    recovery_quality_counts = defaultdict(int)
    latest_signal_counts = defaultdict(int)
    latest_state_counts = defaultdict(int)
    for row in harmful_rows:
        path_signature_counts[row.get("path_signature", "unknown")] += 1
        recovery_quality_counts[str(row.get("recovery_quality_score", "unknown"))] += 1
        latest_signal_counts[row.get("latest_signal", "unknown")] += 1
        latest_state_counts[row.get("latest_state", "unknown")] += 1

    gains = [
        row["best_return_pct"] - row["baseline_return_pct"]
        for row in harmful_rows
        if row.get("best_return_pct") is not None and row.get("baseline_return_pct") is not None
    ]

    return {
        "sample_size": len(harmful_rows),
        "avg_best_policy_gain_vs_baseline": _round_or_none(sum(gains) / len(gains)) if gains else None,
        "path_signatures": dict(sorted(path_signature_counts.items(), key=lambda item: (-item[1], item[0]))),
        "recovery_quality_scores": dict(sorted(recovery_quality_counts.items(), key=lambda item: (int(item[0]), item[0]))),
        "latest_signals": dict(sorted(latest_signal_counts.items(), key=lambda item: (-item[1], item[0]))),
        "latest_states": dict(sorted(latest_state_counts.items(), key=lambda item: (-item[1], item[0]))),
        "labels": [row["label"] for row in harmful_rows],
    }


def _build_feature_candidate_audit(case_rows: list[dict], feature_key: str) -> dict:
    flagged_rows = [row for row in case_rows if row.get(feature_key) == 1]
    if not flagged_rows:
        return {"feature_key": feature_key, "sample_size": 0}

    path_type_counts = defaultdict(int)
    latest_state_counts = defaultdict(int)
    recommended_policy_counts = defaultdict(int)
    baseline_returns = []
    recommended_returns = []
    for row in flagged_rows:
        path_type_counts[row.get("path_type", "unknown")] += 1
        latest_state_counts[row.get("latest_state", "unknown")] += 1
        recommended_policy_counts[row.get("recommended_policy", "unknown")] += 1
        if row.get("baseline_return_pct") is not None:
            baseline_returns.append(row["baseline_return_pct"])
        if row.get("recommended_return_pct") is not None:
            recommended_returns.append(row["recommended_return_pct"])

    return {
        "feature_key": feature_key,
        "sample_size": len(flagged_rows),
        "avg_baseline_return": _round_or_none(sum(baseline_returns) / len(baseline_returns)) if baseline_returns else None,
        "avg_recommended_return": _round_or_none(sum(recommended_returns) / len(recommended_returns)) if recommended_returns else None,
        "path_types": dict(sorted(path_type_counts.items(), key=lambda item: (-item[1], item[0]))),
        "latest_states": dict(sorted(latest_state_counts.items(), key=lambda item: (-item[1], item[0]))),
        "recommended_policies": dict(sorted(recommended_policy_counts.items(), key=lambda item: (-item[1], item[0]))),
    }


def _build_feature_overlap_audit(case_rows: list[dict], feature_keys: list[str]) -> dict:
    combo_counts = defaultdict(int)
    combo_labels = defaultdict(list)
    for row in case_rows:
        active = tuple(key for key in feature_keys if row.get(key) == 1)
        combo_counts[active] += 1
        combo_labels[active].append(row["label"])

    rows = []
    for combo, count in sorted(combo_counts.items(), key=lambda item: (-item[1], item[0])):
        rows.append(
            {
                "active_features": list(combo),
                "sample_size": count,
                "labels": combo_labels[combo][:20],
            }
        )

    return {
        "feature_keys": feature_keys,
        "rows": rows,
    }


def _evaluate_temporal_split(case_evaluations: list[dict], split_date: str) -> dict:
    train = [case for case in case_evaluations if case["entry_date"] <= split_date]
    holdout = [case for case in case_evaluations if case["entry_date"] > split_date]
    if not train or not holdout:
        return {
            "split_date": split_date,
            "train_size": len(train),
            "holdout_size": len(holdout),
            "status": "insufficient_split",
        }

    best_row = None
    for row in _evaluate_threshold_grid(train):
        if best_row is None or (row["avg_recommended_return"] or -999) > (best_row["avg_recommended_return"] or -999):
            best_row = row

    if best_row is None:
        return {
            "split_date": split_date,
            "train_size": len(train),
            "holdout_size": len(holdout),
            "status": "no_grid_result",
        }

    holdout_recommended = []
    holdout_baseline = []
    holdout_bucket_counts = defaultdict(int)
    holdout_policy_counts = defaultdict(int)
    for case in holdout:
        policy_id = recommend_policy_for_thresholds(
            score=case["early_risk_score"],
            exit_all_threshold=best_row["exit_all_threshold"],
            reduce_threshold=best_row["reduce_threshold"],
        )
        holdout_recommended.append(case["result_by_policy"][policy_id])
        holdout_baseline.append(case["result_by_policy"]["buy_and_hold_baseline"])
        holdout_bucket_counts[case["early_risk_bucket"]] += 1
        holdout_policy_counts[policy_id] += 1

    return {
        "split_date": split_date,
        "train_size": len(train),
        "holdout_size": len(holdout),
        "best_train_rule": best_row["rule"],
        "best_train_exit_all_threshold": best_row["exit_all_threshold"],
        "best_train_reduce_threshold": best_row["reduce_threshold"],
        "train_recommended_return": best_row["avg_recommended_return"],
        "train_baseline_return": best_row["avg_baseline_return"],
        "train_improvement_vs_baseline": best_row["improvement_vs_baseline"],
        "holdout_recommended_return": _round_or_none(sum(holdout_recommended) / len(holdout_recommended)),
        "holdout_baseline_return": _round_or_none(sum(holdout_baseline) / len(holdout_baseline)),
        "holdout_improvement_vs_baseline": _round_or_none(
            (sum(holdout_recommended) - sum(holdout_baseline)) / len(holdout_recommended)
        ),
        "holdout_early_risk_buckets": dict(sorted(holdout_bucket_counts.items())),
        "holdout_recommended_policies": dict(sorted(holdout_policy_counts.items())),
    }


def _evaluate_all_temporal_splits(case_evaluations: list[dict]) -> list[dict]:
    split_dates = sorted({case["entry_date"] for case in case_evaluations})
    rows = []
    for split_date in split_dates[:-1]:
        row = _evaluate_temporal_split(case_evaluations, split_date)
        if row.get("status") != "insufficient_split":
            rows.append(row)
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch compare management policies across research cases")
    parser.add_argument("--preset", default="poc_baseline")
    parser.add_argument("--cases-file", default=None)
    parser.add_argument("--persist", action="store_true")
    parser.add_argument("--show-cases", action="store_true")
    parser.add_argument("--show-actions", action="store_true")
    parser.add_argument("--show-groups", action="store_true")
    parser.add_argument("--show-early-risk", action="store_true")
    parser.add_argument("--show-threshold-grid", action="store_true")
    parser.add_argument("--show-misclass-audit", action="store_true")
    parser.add_argument("--show-high-bucket-audit", action="store_true")
    parser.add_argument("--show-harmful-high-patterns", action="store_true")
    parser.add_argument("--show-harmful-low-patterns", action="store_true")
    parser.add_argument("--show-feature-candidates", action="store_true")
    parser.add_argument("--show-feature-overlaps", action="store_true")
    parser.add_argument("--show-temporal-split", action="store_true")
    parser.add_argument("--show-all-temporal-splits", action="store_true")
    parser.add_argument("--show-lane-routing", action="store_true")
    parser.add_argument("--split-date", default="2026-03-20")
    parser.add_argument("--lookahead-days", type=int, default=3)
    args = parser.parse_args()

    cases = _load_cases(args)
    policies = build_default_policies()
    all_results = []
    all_snapshots = []
    policy_buckets = defaultdict(list)
    case_rows = []
    grouped_policy_buckets = defaultdict(lambda: defaultdict(list))
    threshold_recommendation_rows = []
    lane_routing_rows = []
    case_evaluations = []

    for case in cases:
        symbol = str(case["symbol"])
        entry_date = str(case["entry_date"])
        entry_price = float(case["entry_price"])
        position_size = float(case.get("position_size", 3000.0))
        end_date = case.get("end_date")
        label = str(case.get("label", f"{symbol}:{entry_date}"))

        snapshots = build_position_snapshots(
            symbol=symbol,
            entry_date=entry_date,
            entry_price=entry_price,
            position_size=position_size,
            end_date=str(end_date) if end_date else None,
        )
        if not snapshots:
            case_rows.append(
                {
                    "label": label,
                    "symbol": symbol,
                    "entry_date": entry_date,
                    "status": "no_data",
                }
            )
            continue

        all_snapshots.extend(snapshots)
        latest = snapshots[-1]
        path_signature = _build_path_signature(snapshots)
        path_type = _classify_path_type(snapshots)
        early_features = build_early_path_features(snapshots, lookahead_days=args.lookahead_days)
        early_risk_type = classify_early_path_risk(early_features)
        early_risk_score = score_early_path_risk(early_features)
        early_risk_bucket = bucket_early_risk_score(early_risk_score)
        recovery_quality_score = compute_recovery_quality_score(early_features)
        lane_route = route_case_lanes(snapshots)
        per_case_results = []
        for policy in policies:
            result = simulate_policy(policy, [s for s in snapshots])
            all_results.append(result)
            policy_buckets[result.policy_id].append(result)
            grouped_policy_buckets[f"latest_state:{latest.state_id}"][result.policy_id].append(result)
            grouped_policy_buckets[f"path_type:{path_type}"][result.policy_id].append(result)
            grouped_policy_buckets[f"early_risk:{early_risk_type}"][result.policy_id].append(result)
            grouped_policy_buckets[f"early_score:{early_risk_bucket}"][result.policy_id].append(result)
            per_case_results.append(result)

        result_by_policy = {result.policy_id: result for result in per_case_results}

        baseline = next((r for r in per_case_results if r.policy_id == "buy_and_hold_baseline"), None)
        best = max(
            per_case_results,
            key=lambda r: r.realized_pnl_pct if r.realized_pnl_pct is not None else float("-inf"),
        )
        recommended_policy = recommend_policy_for_early_score(early_risk_score)
        recommended_result = result_by_policy[recommended_policy]
        lane_policy = str(lane_route["final"]["recommended_policy"])
        lane_result = result_by_policy[lane_policy]
        threshold_recommendation_rows.append(
            {
                "label": label,
                "recommended_policy": recommended_policy,
                "recommended_return_pct": _round_or_none(recommended_result.realized_pnl_pct),
                "best_policy": best.policy_id,
                "best_return_pct": _round_or_none(best.realized_pnl_pct),
                "baseline_return_pct": _round_or_none(baseline.realized_pnl_pct if baseline else None),
            }
        )
        lane_routing_rows.append(
            {
                "label": label,
                "active_lane_ids": lane_route["active_lane_ids"],
                "baseline_lane_bucket": lane_route["baseline"]["early_risk_bucket"],
                "baseline_lane_policy": lane_route["baseline"]["recommended_policy"],
                "takeover_applied": lane_route["takeover_applied"],
                "takeover_score_threshold": lane_route["takeover_score_threshold"],
                "final_lane_id": lane_route["final"]["lane_id"],
                "final_lane_policy": lane_policy,
                "recommended_return_pct": _round_or_none(lane_result.realized_pnl_pct),
                "baseline_return_pct": _round_or_none(baseline.realized_pnl_pct if baseline else None),
                "best_return_pct": _round_or_none(best.realized_pnl_pct),
            }
        )
        case_evaluations.append(
            {
                "label": label,
                "entry_date": entry_date,
                "early_risk_score": early_risk_score,
                "early_risk_bucket": early_risk_bucket,
                "result_by_policy": {
                    policy_id: (
                        result.realized_pnl_pct if result.realized_pnl_pct is not None else 0.0
                    )
                    for policy_id, result in result_by_policy.items()
                },
            }
        )
        case_rows.append(
            {
                "label": label,
                "symbol": symbol,
                "entry_date": entry_date,
                "latest_state": latest.state_id,
                "latest_signal": latest.signal_state,
                "path_signature": path_signature,
                "path_type": path_type,
                "early_risk_type": early_risk_type,
                "early_risk_score": early_risk_score,
                "early_risk_bucket": early_risk_bucket,
                "recovery_quality_score": recovery_quality_score,
                "shallow_risk_repair_candidate": early_features.get("shallow_risk_repair_candidate", 0),
                "contained_rebuild_candidate": early_features.get("contained_rebuild_candidate", 0),
                "late_rebuild_seed_candidate": early_features.get("late_rebuild_seed_candidate", 0),
                "secondary_failure_loop_candidate": early_features.get("secondary_failure_loop_candidate", 0),
                "persistent_risk_but_positive_pnl_candidate": early_features.get("persistent_risk_but_positive_pnl_candidate", 0),
                "no_confirmation_entry_drift_candidate": early_features.get("no_confirmation_entry_drift_candidate", 0),
                "recommended_policy": recommended_policy,
                "recommended_return_pct": round(recommended_result.realized_pnl_pct, 4)
                if recommended_result.realized_pnl_pct is not None
                else None,
                "latest_pnl_pct": round(latest.unrealized_pnl_pct, 4),
                "baseline_return_pct": round(baseline.realized_pnl_pct, 4) if baseline and baseline.realized_pnl_pct is not None else None,
                "best_policy": best.policy_id,
                "best_return_pct": round(best.realized_pnl_pct, 4) if best.realized_pnl_pct is not None else None,
            }
        )

        if args.show_early_risk:
            print(f"## Early Risk | {label}")
            print(
                json.dumps(
                    {
                        "label": label,
                        "early_risk_type": early_risk_type,
                        "early_risk_score": early_risk_score,
                        "early_risk_bucket": early_risk_bucket,
                        "recovery_quality_score": recovery_quality_score,
                        "early_features": {
                            key: _round_or_none(value) if isinstance(value, float) else value
                            for key, value in early_features.items()
                        },
                        "final_path_type": path_type,
                        "latest_state": latest.state_id,
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )

        if args.show_actions:
            print(f"## Case Actions | {label}")
            for result in per_case_results:
                print(
                    json.dumps(
                        {
                            "policy_id": result.policy_id,
                            "realized_pnl_pct": round(result.realized_pnl_pct, 4) if result.realized_pnl_pct is not None else None,
                            "action_log": result.action_log,
                        },
                        ensure_ascii=False,
                        indent=2,
                    )
                )

    print(f"# Management Policy Batch Compare | preset={args.preset} cases={len(cases)} lookahead_days={args.lookahead_days}")

    if args.show_cases:
        print("## Case Summary")
        for row in case_rows:
            print(json.dumps(row, ensure_ascii=False))

    print("## Policy Summary")
    summary_rows = []
    for policy_id, results in policy_buckets.items():
        summary_rows.append(_build_summary_row(policy_id, results))

    summary_rows.sort(key=lambda row: (row["avg_return"] is None, -(row["avg_return"] or -999)))
    for row in summary_rows:
        print(json.dumps(row, ensure_ascii=False))

    if args.show_groups:
        print("## Grouped Policy Summary")
        for group_key in sorted(grouped_policy_buckets):
            print(f"### {group_key}")
            group_rows = []
            for policy_id, results in grouped_policy_buckets[group_key].items():
                group_rows.append(_build_summary_row(policy_id, results))
            group_rows.sort(key=lambda row: (row["avg_return"] is None, -(row["avg_return"] or -999)))
            for row in group_rows:
                print(json.dumps(row, ensure_ascii=False))

    if threshold_recommendation_rows:
        print("## Early Score Threshold Recommendation")
        recommended_returns = [
            row["recommended_return_pct"] for row in threshold_recommendation_rows if row["recommended_return_pct"] is not None
        ]
        baseline_returns = [
            row["baseline_return_pct"] for row in threshold_recommendation_rows if row["baseline_return_pct"] is not None
        ]
        best_returns = [row["best_return_pct"] for row in threshold_recommendation_rows if row["best_return_pct"] is not None]
        print(
            json.dumps(
                {
                    "rule": "score>=10 => failure_risk_exit_all; score>=6 => failure_risk_reduce_50; else => buy_and_hold_baseline",
                    "sample_size": len(threshold_recommendation_rows),
                    "avg_recommended_return": _round_or_none(sum(recommended_returns) / len(recommended_returns)) if recommended_returns else None,
                    "avg_baseline_return": _round_or_none(sum(baseline_returns) / len(baseline_returns)) if baseline_returns else None,
                    "avg_best_case_return": _round_or_none(sum(best_returns) / len(best_returns)) if best_returns else None,
                },
                ensure_ascii=False,
            )
        )

    if lane_routing_rows:
        print("## Lane Routed Recommendation")
        lane_recommended_returns = [
            row["recommended_return_pct"] for row in lane_routing_rows if row["recommended_return_pct"] is not None
        ]
        lane_baseline_returns = [
            row["baseline_return_pct"] for row in lane_routing_rows if row["baseline_return_pct"] is not None
        ]
        lane_best_returns = [row["best_return_pct"] for row in lane_routing_rows if row["best_return_pct"] is not None]
        print(
            json.dumps(
                {
                    "rule": "baseline_3d first pass; if baseline bucket=score_low then run low_risk_5d; only let second pass take over when 5-day score>=8",
                    "sample_size": len(lane_routing_rows),
                    "avg_recommended_return": _round_or_none(sum(lane_recommended_returns) / len(lane_recommended_returns)) if lane_recommended_returns else None,
                    "avg_baseline_return": _round_or_none(sum(lane_baseline_returns) / len(lane_baseline_returns)) if lane_baseline_returns else None,
                    "avg_best_case_return": _round_or_none(sum(lane_best_returns) / len(lane_best_returns)) if lane_best_returns else None,
                    "improvement_vs_baseline": _round_or_none((sum(lane_recommended_returns) - sum(lane_baseline_returns)) / len(lane_recommended_returns)) if lane_recommended_returns else None,
                    "takeover_count": sum(1 for row in lane_routing_rows if row.get("takeover_applied")),
                },
                ensure_ascii=False,
            )
        )
        if args.show_lane_routing:
            for row in lane_routing_rows:
                print(json.dumps(row, ensure_ascii=False))

    if args.show_threshold_grid and case_evaluations:
        print("## Early Score Threshold Grid")
        for row in _evaluate_threshold_grid(case_evaluations)[:10]:
            print(json.dumps(row, ensure_ascii=False))

    if args.show_temporal_split and case_evaluations:
        print("## Temporal Split Validation")
        print(json.dumps(_evaluate_temporal_split(case_evaluations, args.split_date), ensure_ascii=False))

    if args.show_all_temporal_splits and case_evaluations:
        print("## All Temporal Splits")
        for row in _evaluate_all_temporal_splits(case_evaluations):
            print(json.dumps(row, ensure_ascii=False))

    if args.show_high_bucket_audit:
        print("## High Bucket Audit")
        print(json.dumps(_build_high_bucket_audit(case_rows), ensure_ascii=False))

    if args.show_harmful_high_patterns:
        print("## Harmful High Pattern Audit")
        print(json.dumps(_build_harmful_high_pattern_audit(case_rows), ensure_ascii=False))

    if args.show_harmful_low_patterns:
        print("## Harmful Low Pattern Audit")
        print(json.dumps(_build_harmful_low_pattern_audit(case_rows), ensure_ascii=False))

    if args.show_feature_candidates:
        print("## Feature Candidate Audit")
        print(json.dumps(_build_feature_candidate_audit(case_rows, "shallow_risk_repair_candidate"), ensure_ascii=False))
        print(json.dumps(_build_feature_candidate_audit(case_rows, "contained_rebuild_candidate"), ensure_ascii=False))
        print(json.dumps(_build_feature_candidate_audit(case_rows, "late_rebuild_seed_candidate"), ensure_ascii=False))
        print(json.dumps(_build_feature_candidate_audit(case_rows, "secondary_failure_loop_candidate"), ensure_ascii=False))
        print(json.dumps(_build_feature_candidate_audit(case_rows, "persistent_risk_but_positive_pnl_candidate"), ensure_ascii=False))
        print(json.dumps(_build_feature_candidate_audit(case_rows, "no_confirmation_entry_drift_candidate"), ensure_ascii=False))

    if args.show_feature_overlaps:
        print("## Feature Overlap Audit")
        print(
            json.dumps(
                _build_feature_overlap_audit(
                    case_rows,
                    [
                        "secondary_failure_loop_candidate",
                        "persistent_risk_but_positive_pnl_candidate",
                        "no_confirmation_entry_drift_candidate",
                    ],
                ),
                ensure_ascii=False,
            )
        )

    if args.show_misclass_audit:
        false_positive_high = [
            row for row in case_rows if row.get("early_risk_bucket") == "score_high" and row.get("path_type") == "risk_then_recovery"
        ]
        false_negative_low = [
            row for row in case_rows if row.get("early_risk_bucket") == "score_low" and row.get("path_type") == "risk_dominant"
        ]
        print("## Misclassification Audit")
        print(
            json.dumps(
                {
                    "false_positive_high_summary": _summarize_rows(false_positive_high),
                    "false_negative_low_summary": _summarize_rows(false_negative_low),
                },
                ensure_ascii=False,
            )
        )
        print("### False Positive High")
        for row in false_positive_high[:20]:
            print(json.dumps(row, ensure_ascii=False))
        print("### False Negative Low")
        for row in false_negative_low[:20]:
            print(json.dumps(row, ensure_ascii=False))

    if args.persist and all_results:
        persist_snapshots(all_snapshots)
        date_from = min(s.trade_date for s in all_snapshots)
        date_to = max(s.trade_date for s in all_snapshots)
        universe = f"preset:{args.preset}" if not args.cases_file else f"file:{Path(args.cases_file).name}"
        run_id = persist_run_and_results(
            policy_results=all_results,
            universe=universe,
            date_from=date_from,
            date_to=date_to,
            triggered_by="compare_management_policies",
        )
        print(f"## Persisted run_id={run_id}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
