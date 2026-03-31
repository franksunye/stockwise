#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import date
import json
import os
import sys
from collections import Counter
from pathlib import Path


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("DB_SOURCE", "local")

from backend.management.research.lanes import route_case_lanes
from backend.management.research.market_routing import (
    get_market_routing_config,
    market_routing_config_to_dict,
)
from backend.management.state.snapshot_builder import build_position_snapshots


def _load_cases(path: str) -> list[dict]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"{path} must be a JSON array")
    return payload


def _summarize_market(cases: list[dict], market: str) -> dict[str, object]:
    legacy_market = "CN"
    lane_counts_before: Counter[str] = Counter()
    lane_counts_after: Counter[str] = Counter()
    policy_counts_before: Counter[str] = Counter()
    policy_counts_after: Counter[str] = Counter()
    changed_cases: list[dict[str, object]] = []
    processed = 0

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

        processed += 1
        legacy_route = route_case_lanes(snapshots, market=legacy_market)
        market_route = route_case_lanes(snapshots, market=market)

        legacy_lane = str(legacy_route["final"]["lane_id"])
        market_lane = str(market_route["final"]["lane_id"])
        legacy_policy = str(legacy_route["final"]["recommended_policy"])
        market_policy = str(market_route["final"]["recommended_policy"])

        lane_counts_before[legacy_lane] += 1
        lane_counts_after[market_lane] += 1
        policy_counts_before[legacy_policy] += 1
        policy_counts_after[market_policy] += 1

        if legacy_lane != market_lane or legacy_policy != market_policy:
            changed_cases.append(
                {
                    "label": label,
                    "symbol": symbol,
                    "entry_date": entry_date,
                    "baseline_bucket": legacy_route["baseline"]["early_risk_bucket"],
                    "legacy_final_lane": legacy_lane,
                    "legacy_policy": legacy_policy,
                    "market_final_lane": market_lane,
                    "market_policy": market_policy,
                    "legacy_takeover": legacy_route["takeover_applied"],
                    "market_takeover": market_route["takeover_applied"],
                }
            )

    return {
        "market": market,
        "sample_size": processed,
        "legacy_reference_market": legacy_market,
        "routing_config": market_routing_config_to_dict(get_market_routing_config(market)),
        "lane_counts_before": dict(lane_counts_before),
        "lane_counts_after": dict(lane_counts_after),
        "policy_counts_before": dict(policy_counts_before),
        "policy_counts_after": dict(policy_counts_after),
        "changed_case_count": len(changed_cases),
        "changed_cases_preview": changed_cases[:20],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Diagnose CN/HK market-aware trade-management routing")
    parser.add_argument("--cn-cases-file", required=True)
    parser.add_argument("--hk-cases-file", required=True)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    payload = {
        "as_of": date.today().isoformat(),
        "diagnostic_id": "trade_management_market_aware_routing_v2",
        "markets": {
            "CN": _summarize_market(_load_cases(args.cn_cases_file), "CN"),
            "HK": _summarize_market(_load_cases(args.hk_cases_file), "HK"),
        },
    }

    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if args.output:
        Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n# wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
