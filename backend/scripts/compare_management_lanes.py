#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("DB_SOURCE", "local")

from backend.management.policies.policy_registry import build_default_policies
from backend.management.research.case_sets import get_case_set
from backend.management.research.lanes import get_lane, lane_to_dict, list_lanes
from backend.management.research.path_classifier import (
    build_early_path_features,
    bucket_early_risk_score,
    classify_early_path_risk,
    compute_recovery_quality_score,
    recommend_policy_for_early_score,
    score_early_path_risk,
)
from backend.management.simulation.engine import simulate_policy
from backend.management.state.snapshot_builder import build_position_snapshots
from backend.scripts.compare_management_policies import (
    _build_harmful_low_pattern_audit,
    _classify_path_type,
    _evaluate_all_temporal_splits,
)


def _load_cases(preset: str, cases_file: str | None) -> list[dict]:
    if cases_file:
        with open(cases_file, "r", encoding="utf-8") as f:
            payload = json.load(f)
        if not isinstance(payload, list):
            raise ValueError("cases file must be a JSON array")
        return payload
    return get_case_set(preset)


def _round_or_none(value):
    return round(value, 4) if value is not None else None


def _evaluate_lane(cases: list[dict], lane_id: str) -> dict:
    lane = get_lane(lane_id)
    lookahead_days = lane.lookahead_days
    policies = build_default_policies()
    case_rows = []
    case_evaluations = []
    recommended_returns = []
    baseline_returns = []
    best_returns = []

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
            continue

        latest = snapshots[-1]
        path_type = _classify_path_type(snapshots)
        early_features = build_early_path_features(snapshots, lookahead_days=lookahead_days)
        early_risk_type = classify_early_path_risk(early_features)
        early_risk_score = score_early_path_risk(early_features)
        early_risk_bucket = bucket_early_risk_score(early_risk_score)
        recovery_quality_score = compute_recovery_quality_score(early_features)

        results = [simulate_policy(policy, [s for s in snapshots]) for policy in policies]
        result_by_policy = {result.policy_id: result for result in results}
        baseline = result_by_policy["buy_and_hold_baseline"]
        best = max(
            results,
            key=lambda r: r.realized_pnl_pct if r.realized_pnl_pct is not None else float("-inf"),
        )
        recommended_policy = recommend_policy_for_early_score(early_risk_score)
        recommended_result = result_by_policy[recommended_policy]

        recommended_returns.append(recommended_result.realized_pnl_pct or 0.0)
        baseline_returns.append(baseline.realized_pnl_pct or 0.0)
        best_returns.append(best.realized_pnl_pct or 0.0)

        case_rows.append(
            {
                "label": label,
                "symbol": symbol,
                "entry_date": entry_date,
                "latest_state": latest.state_id,
                "latest_signal": latest.signal_state,
                "path_type": path_type,
                "early_risk_type": early_risk_type,
                "early_risk_score": early_risk_score,
                "early_risk_bucket": early_risk_bucket,
                "recovery_quality_score": recovery_quality_score,
                "recommended_policy": recommended_policy,
                "recommended_return_pct": _round_or_none(recommended_result.realized_pnl_pct),
                "baseline_return_pct": _round_or_none(baseline.realized_pnl_pct),
                "best_policy": best.policy_id,
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

    return {
        "lane": lane_to_dict(lane),
        "lookahead_days": lookahead_days,
        "sample_size": len(case_rows),
        "avg_recommended_return": _round_or_none(sum(recommended_returns) / len(recommended_returns)) if recommended_returns else None,
        "avg_baseline_return": _round_or_none(sum(baseline_returns) / len(baseline_returns)) if baseline_returns else None,
        "avg_best_case_return": _round_or_none(sum(best_returns) / len(best_returns)) if best_returns else None,
        "improvement_vs_baseline": _round_or_none((sum(recommended_returns) - sum(baseline_returns)) / len(recommended_returns)) if recommended_returns else None,
        "harmful_low_audit": _build_harmful_low_pattern_audit(case_rows),
        "temporal_splits": _evaluate_all_temporal_splits(case_evaluations),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare trade management research lanes")
    parser.add_argument("--preset", default="poc_baseline")
    parser.add_argument("--cases-file", default=None)
    parser.add_argument("--lane-ids", default="baseline_3d,low_risk_5d")
    args = parser.parse_args()

    cases = _load_cases(args.preset, args.cases_file)
    lane_ids = [part.strip() for part in str(args.lane_ids).split(",") if part.strip()]

    print(
        f"# Management Lane Compare | preset={args.preset} cases={len(cases)} "
        f"lane_ids={lane_ids}"
    )
    print("## Lane Registry")
    for lane_meta in list_lanes():
        if lane_meta.lane_id in lane_ids:
            print(json.dumps(lane_to_dict(lane_meta), ensure_ascii=False))

    for lane_id in lane_ids:
        lane = _evaluate_lane(cases, lane_id)
        print(f"## Lane {lane['lane']['label']}")
        print(
            json.dumps(
                {
                    "lane_id": lane["lane"]["lane_id"],
                    "role": lane["lane"]["role"],
                    "lookahead_days": lane["lookahead_days"],
                    "sample_size": lane["sample_size"],
                    "avg_recommended_return": lane["avg_recommended_return"],
                    "avg_baseline_return": lane["avg_baseline_return"],
                    "avg_best_case_return": lane["avg_best_case_return"],
                    "improvement_vs_baseline": lane["improvement_vs_baseline"],
                },
                ensure_ascii=False,
            )
        )
        print("### Harmful Low Audit")
        print(json.dumps(lane["harmful_low_audit"], ensure_ascii=False))
        print("### Temporal Splits")
        for row in lane["temporal_splits"]:
            print(json.dumps(row, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
