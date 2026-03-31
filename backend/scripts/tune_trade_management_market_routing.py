#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("DB_SOURCE", "local")

from backend.management.research.market_routing import (
    build_market_routing_config,
    get_market_routing_config,
    market_routing_config_to_dict,
)
from backend.scripts.build_trade_management_portfolio_baseline import (
    _build_portfolio_metrics,
    _load_cases,
    _round_tree,
)


def _score_candidate(metrics: dict[str, object]) -> float:
    routed = metrics["routed"]
    baseline = metrics["baseline"]
    routed_return = float(routed["total_return"])
    baseline_return = float(baseline["total_return"])
    routed_drawdown = abs(float(routed["max_drawdown"]))
    baseline_drawdown = abs(float(baseline["max_drawdown"]))

    improvement = routed_return - baseline_return
    drawdown_gain = baseline_drawdown - routed_drawdown
    return improvement * 10000 + drawdown_gain * 4000


def main() -> int:
    parser = argparse.ArgumentParser(description="Tune trade management market routing thresholds")
    parser.add_argument("--market", default="HK", choices=["CN", "HK"])
    parser.add_argument("--cases-file", required=True)
    parser.add_argument("--takeover-min", type=int, default=8)
    parser.add_argument("--takeover-max", type=int, default=10)
    parser.add_argument("--reduce-min", type=int, default=6)
    parser.add_argument("--reduce-max", type=int, default=8)
    parser.add_argument("--exit-min", type=int, default=10)
    parser.add_argument("--exit-max", type=int, default=12)
    parser.add_argument("--top-k", type=int, default=10)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    cases = _load_cases(args)
    base_config = get_market_routing_config(args.market)
    base_metrics = _build_portfolio_metrics(cases, routing_config_overrides={args.market: base_config})

    candidates: list[dict[str, object]] = []
    for takeover in range(args.takeover_min, args.takeover_max + 1):
        for reduce_threshold in range(args.reduce_min, args.reduce_max + 1):
            for exit_threshold in range(args.exit_min, args.exit_max + 1):
                if exit_threshold <= reduce_threshold:
                    continue
                config = build_market_routing_config(
                    args.market,
                    config_version=f"tm_{args.market.lower()}_tuning_v1",
                    second_pass_takeover_score_threshold=takeover,
                    reduce_50_threshold=reduce_threshold,
                    exit_all_threshold=exit_threshold,
                    rationale=f"{args.market} tuning grid search candidate",
                )
                metrics = _build_portfolio_metrics(cases, routing_config_overrides={args.market: config})
                candidates.append(
                    {
                        "config": market_routing_config_to_dict(config),
                        "score": round(_score_candidate(metrics), 6),
                        "metrics": _round_tree(metrics),
                    }
                )

    ranked = sorted(candidates, key=lambda row: row["score"], reverse=True)
    payload = {
        "as_of": date.today().isoformat(),
        "tuning_id": "trade_management_market_routing_tuning_v1",
        "market": args.market,
        "cases_file": Path(args.cases_file).name,
        "baseline_config": market_routing_config_to_dict(base_config),
        "baseline_metrics": _round_tree(base_metrics),
        "candidate_count": len(candidates),
        "top_candidates": ranked[: args.top_k],
    }

    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if args.output:
        Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n# wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
