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
from backend.management.research.evaluator import summarize_results
from backend.management.research.lanes import route_case_lanes
from backend.management.research.path_classifier import (
    build_early_path_features,
    bucket_early_risk_score,
    classify_early_path_risk,
    compute_recovery_quality_score,
    score_early_path_risk,
)
from backend.management.simulation.engine import simulate_policy
from backend.management.state.snapshot_builder import build_position_snapshots
from backend.management.state.state_machine import get_state_description
from backend.management.storage.repo import persist_run_and_results, persist_snapshots
from backend.trading_calendar import get_market_from_symbol


def main() -> int:
    parser = argparse.ArgumentParser(description="Run trade management research POC")
    parser.add_argument("--symbol", default="02171")
    parser.add_argument("--entry-date", default="2026-03-24")
    parser.add_argument("--entry-price", type=float, default=15.0)
    parser.add_argument("--position-size", type=float, default=3000.0)
    parser.add_argument("--end-date", default=None)
    parser.add_argument("--persist", action="store_true")
    parser.add_argument("--show-timeline", action="store_true", default=True)
    parser.add_argument("--lookahead-days", type=int, default=3)
    args = parser.parse_args()

    snapshots = build_position_snapshots(
        symbol=args.symbol,
        entry_date=args.entry_date,
        entry_price=args.entry_price,
        position_size=args.position_size,
        end_date=args.end_date,
    )
    if not snapshots:
        print("No snapshots found.")
        return 1

    policies = build_default_policies()
    results = [simulate_policy(policy, [s for s in snapshots]) for policy in policies]
    early_features = build_early_path_features(snapshots, lookahead_days=args.lookahead_days)
    early_risk_score = score_early_path_risk(early_features)
    lane_route = route_case_lanes(snapshots, market=get_market_from_symbol(args.symbol))
    by_policy = defaultdict(list)
    for result in results:
        by_policy[result.policy_id].append(result)

    print(
        f"# Trade Management POC | symbol={args.symbol} entry_date={args.entry_date} "
        f"entry_price={args.entry_price} lookahead_days={args.lookahead_days}"
    )
    print("## Latest State")
    latest = snapshots[-1]
    print(
        json.dumps(
            {
                "trade_date": latest.trade_date,
                "state_id": latest.state_id,
                "state_desc": get_state_description(latest.state_id),
                "signal_state": latest.signal_state,
                "unrealized_pnl_pct": round(latest.unrealized_pnl_pct, 4),
                "discipline_price": latest.discipline_price,
                "resistance_price": latest.resistance_price,
                "near_resistance": latest.near_resistance,
                "failed_breakout_risk": latest.failed_breakout_risk,
            },
            ensure_ascii=False,
            indent=2,
        )
    )

    if args.show_timeline:
        print("## State Timeline")
        for s in snapshots:
            print(
                json.dumps(
                    {
                        "date": s.trade_date,
                        "state_id": s.state_id,
                        "state_desc": get_state_description(s.state_id),
                        "signal_state": s.signal_state,
                        "close": round(s.close, 2),
                        "unrealized_pnl_pct": round(s.unrealized_pnl_pct, 4),
                        "discipline_price": round(s.discipline_price, 2) if s.discipline_price else None,
                        "resistance_price": round(s.resistance_price, 2) if s.resistance_price else None,
                        "failed_breakout_risk": s.failed_breakout_risk,
                    },
                    ensure_ascii=False,
                )
            )

    print("## Early Risk")
    print(
        json.dumps(
            {
                "lookahead_days": args.lookahead_days,
                "early_risk_type": classify_early_path_risk(early_features),
                "early_risk_score": early_risk_score,
                "early_risk_bucket": bucket_early_risk_score(early_risk_score),
                "recovery_quality_score": compute_recovery_quality_score(early_features),
                "early_features": {
                    key: round(value, 4) if isinstance(value, float) else value
                    for key, value in early_features.items()
                },
            },
            ensure_ascii=False,
            indent=2,
        )
    )

    print("## Lane Route")
    print(
        json.dumps(
            {
                "active_lane_ids": lane_route["active_lane_ids"],
                "baseline_lane": {
                    "lane_id": lane_route["baseline"]["lane_id"],
                    "lookahead_days": lane_route["baseline"]["lookahead_days"],
                    "early_risk_bucket": lane_route["baseline"]["early_risk_bucket"],
                    "recommended_policy": lane_route["baseline"]["recommended_policy"],
                },
                "second_pass_lane": (
                    {
                        "lane_id": lane_route["second_pass"]["lane_id"],
                        "lookahead_days": lane_route["second_pass"]["lookahead_days"],
                        "early_risk_score": lane_route["second_pass"]["early_risk_score"],
                        "early_risk_bucket": lane_route["second_pass"]["early_risk_bucket"],
                        "recommended_policy": lane_route["second_pass"]["recommended_policy"],
                    }
                    if lane_route["second_pass"]
                    else None
                ),
                "takeover_applied": lane_route["takeover_applied"],
                "takeover_score_threshold": lane_route["takeover_score_threshold"],
                "final_recommendation": {
                    "lane_id": lane_route["final"]["lane_id"],
                    "recommended_policy": lane_route["final"]["recommended_policy"],
                },
            },
            ensure_ascii=False,
            indent=2,
        )
    )

    print("## Policy Comparison")
    for policy_id, policy_results in by_policy.items():
        summary = summarize_results(policy_results)
        result = policy_results[0]
        print(
            json.dumps(
                {
                    "policy_id": policy_id,
                    "summary": summary,
                    "realized_pnl_pct": round(result.realized_pnl_pct, 4) if result.realized_pnl_pct is not None else None,
                    "max_drawdown_pct": round(result.max_drawdown_pct, 4) if result.max_drawdown_pct is not None else None,
                    "profit_giveback_pct": round(result.profit_giveback_pct, 4) if result.profit_giveback_pct is not None else None,
                    "action_log": result.action_log,
                },
                ensure_ascii=False,
                indent=2,
            )
        )

    if args.persist:
        persist_snapshots(snapshots)
        run_id = persist_run_and_results(
            policy_results=results,
            universe=f"single:{args.symbol}",
            date_from=snapshots[0].trade_date,
            date_to=snapshots[-1].trade_date,
            triggered_by="run_management_research",
        )
        print(f"## Persisted run_id={run_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
