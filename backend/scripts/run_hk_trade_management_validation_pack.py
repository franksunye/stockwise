#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import date
import json
import os
import sys
from pathlib import Path


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("DB_SOURCE", "local")

from backend.management.policies.policy_registry import build_default_policies
from backend.management.research.lanes import route_case_lanes
from backend.management.research.validation import (
    build_rolling_windows,
    evaluate_hk_validation_gate,
    slice_cases_by_window,
    summarize_rolling_metrics,
    summarize_subtype_outcomes,
)
from backend.management.simulation.engine import simulate_policy
from backend.management.state.snapshot_builder import build_position_snapshots
from backend.scripts.build_trade_management_portfolio_baseline import _build_portfolio_metrics, _round_tree


def _load_cases(path: str) -> list[dict]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"{path} must be a JSON array")
    return payload


def _build_window_payload(case_file: str, baseline_id: str) -> dict[str, object]:
    cases = _load_cases(case_file)
    metrics = _round_tree(_build_portfolio_metrics(cases))
    return {
        "as_of": date.today().isoformat(),
        "baseline_id": baseline_id,
        "scope": {
            "case_file": Path(case_file).name,
            "capital_method": "equal_notional_per_case_with_idle_cash_before_entry",
            "interpretation": "HK-only long-window validation baseline over the formal case pool.",
            "routing_mode": "market_aware_v2",
        },
        "regions": {
            "HK": metrics,
        },
    }


def _build_subtype_policy_outcomes(cases: list[dict]) -> tuple[list[dict], dict[str, dict[str, object]]]:
    policies = {policy.policy_id: policy for policy in build_default_policies()}
    rows: list[dict] = []

    for case in cases:
        snapshots = build_position_snapshots(
            symbol=str(case["symbol"]),
            entry_date=str(case["entry_date"]),
            entry_price=float(case["entry_price"]),
            position_size=float(case.get("position_size", 3000.0)),
            end_date=str(case.get("end_date")) if case.get("end_date") else None,
        )
        if not snapshots:
            continue

        lane_route = route_case_lanes(snapshots, market="HK")
        subtype = lane_route.get("low_side_subtype")
        if not subtype:
            continue

        chosen_policy = str(lane_route["final"]["recommended_policy"])
        result = simulate_policy(policies[chosen_policy], [s for s in snapshots])
        rows.append(
            {
                "label": str(case.get("label") or f"{case['symbol']}:{case['entry_date']}"),
                "symbol": str(case["symbol"]),
                "entry_date": str(case["entry_date"]),
                "subtype": str(subtype),
                "chosen_policy": chosen_policy,
                "realized_pnl_pct": round(float(result.realized_pnl_pct or 0.0), 6),
            }
        )

    return rows, summarize_subtype_outcomes(rows)


def _build_rolling_summary(cases: list[dict], *, window_months: int, step_months: int, min_cases: int) -> dict[str, object]:
    windows = build_rolling_windows(cases, window_months=window_months, step_months=step_months, min_cases=min_cases)
    rows: list[dict] = []
    for window in windows:
        subset = slice_cases_by_window(cases, window.start_date, window.end_date)
        metrics = _build_portfolio_metrics(subset)
        rows.append(
            {
                "start_date": window.start_date,
                "end_date": window.end_date,
                "case_count": window.case_count,
                "improvement_vs_baseline": round(float(metrics["improvement_vs_baseline"]), 6),
                "baseline_total_return": round(float(metrics["baseline"]["total_return"]), 6),
                "routed_total_return": round(float(metrics["routed"]["total_return"]), 6),
                "baseline_max_drawdown": round(float(metrics["baseline"]["max_drawdown"]), 6)
                if metrics["baseline"]["max_drawdown"] is not None
                else None,
                "routed_max_drawdown": round(float(metrics["routed"]["max_drawdown"]), 6)
                if metrics["routed"]["max_drawdown"] is not None
                else None,
            }
        )

    return {
        "window_months": window_months,
        "step_months": step_months,
        "windows": rows,
        "summary": summarize_rolling_metrics(rows),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build HK path-aware validation pack for trade management")
    parser.add_argument("--hk-12m-cases-file", required=True)
    parser.add_argument("--hk-24m-cases-file", required=True)
    parser.add_argument("--hk-36m-cases-file", required=True)
    parser.add_argument("--rolling-window-months", type=int, default=6)
    parser.add_argument("--rolling-step-months", type=int, default=1)
    parser.add_argument("--rolling-min-cases", type=int, default=24)
    parser.add_argument("--live-observation-file", default=None)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    twelve_payload = _build_window_payload(args.hk_12m_cases_file, "trade_management_portfolio_baseline_hk180_12m_market_aware_v1")
    twenty_four_payload = _build_window_payload(args.hk_24m_cases_file, "trade_management_portfolio_baseline_hk180_24m_market_aware_v1")
    thirty_six_payload = _build_window_payload(args.hk_36m_cases_file, "trade_management_portfolio_baseline_hk180_36m_market_aware_v1")

    rolling = _build_rolling_summary(
        _load_cases(args.hk_36m_cases_file),
        window_months=args.rolling_window_months,
        step_months=args.rolling_step_months,
        min_cases=args.rolling_min_cases,
    )
    subtype_rows, subtype_summary = _build_subtype_policy_outcomes(_load_cases(args.hk_36m_cases_file))

    live_observation = None
    live_active_count = 0
    focus_review_count = 0
    if args.live_observation_file:
        live_observation = json.loads(Path(args.live_observation_file).read_text(encoding="utf-8"))
        live_active_count = int(live_observation.get("active_position_count") or 0)
        focus_review_count = len(live_observation.get("focus_reviews") or [])
        if int(live_observation.get("summary_mismatch_count") or 0) > 0:
            live_active_count = 0

    gate = evaluate_hk_validation_gate(
        window_metrics={
            "24m": twenty_four_payload["regions"]["HK"],
            "36m": thirty_six_payload["regions"]["HK"],
        },
        rolling_summary=rolling["summary"],
        live_active_count=live_active_count,
        focus_review_count=focus_review_count,
    )

    payload = {
        "as_of": date.today().isoformat(),
        "validation_id": "hk_trade_management_path_aware_validation_v1",
        "frozen_observation_config_version": "tm_market_routing_v5",
        "frozen_baseline_reference": Path(args.hk_12m_cases_file).name,
        "long_windows": {
            "12m": twelve_payload["regions"]["HK"],
            "24m": twenty_four_payload["regions"]["HK"],
            "36m": thirty_six_payload["regions"]["HK"],
        },
        "rolling_6m": rolling,
        "subtype_policy_outcomes": {
            "case_count": len(subtype_rows),
            "summary": subtype_summary,
            "preview": subtype_rows[:30],
        },
        "live_observation": live_observation,
        "next_phase_gate": gate,
    }

    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if args.output:
        Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n# wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
