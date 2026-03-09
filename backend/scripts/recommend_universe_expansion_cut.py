"""
Recommend the best local shadow universe expansion cut.

The recommendation balances:
- TriggeredLong coverage entering the target gate range
- Watch -> Triggered entering the target gate range
- Smallest possible expansion size once quality gates are met
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from backend.scripts.build_universe_expansion_manifest import build_manifest
from backend.scripts.evaluate_shadow_universe_expansion import evaluate_shadow_universe


def _score(result: Dict[str, object]) -> tuple[int, float, int]:
    triggered = float(result.get("projected_triggered_coverage_pct") or 0.0)
    watch_to_trigger = float(((result.get("watch_projection") or {}).get("projected_watch_to_trigger_pct")) or 0.0)
    added_symbols = int(result.get("added_symbols") or 0)

    triggered_ok = 5.0 <= triggered <= 20.0
    watch_ok = 15.0 <= watch_to_trigger <= 40.0
    gate_hits = int(triggered_ok) + int(watch_ok)

    # Prefer hitting both target bands, then being close to their midpoints, then smaller cut.
    proximity = abs(triggered - 12.5) + abs(watch_to_trigger - 27.5)
    return (gate_hits, -proximity, -added_symbols)


def recommend_cut(
    *,
    market: str,
    strategy_version: str,
    week_start: str,
    week_end: str,
    cuts: List[int],
    manifest_dir: str,
) -> Dict[str, object]:
    evaluations: List[Dict[str, object]] = []
    manifest_root = Path(manifest_dir)
    manifest_root.mkdir(parents=True, exist_ok=True)

    for cut in cuts:
        manifest_path = manifest_root / f"{market.lower()}_universe_expansion_top{cut}.json"
        if not manifest_path.exists():
            manifest = build_manifest(
                market=market,
                strategy_version=strategy_version,
                week_start=week_start,
                week_end=week_end,
                limit=cut,
            )
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

        result = evaluate_shadow_universe(
            market=market,
            strategy_version=strategy_version,
            week_start=week_start,
            week_end=week_end,
            manifest_path=str(manifest_path),
        )
        evaluations.append(result)

    ranked = sorted(evaluations, key=_score, reverse=True)
    recommended = ranked[0] if ranked else {}
    return {
        "market": market,
        "strategy_version": strategy_version,
        "window": {"start": week_start, "end": week_end},
        "cuts": cuts,
        "recommended_cut": int(recommended.get("added_symbols") or 0),
        "recommended_manifest": str(recommended.get("manifest_path") or ""),
        "recommended_metrics": {
            "projected_triggered_coverage_pct": recommended.get("projected_triggered_coverage_pct"),
            "projected_watch_to_trigger_pct": (recommended.get("watch_projection") or {}).get("projected_watch_to_trigger_pct"),
        },
        "evaluations": [
            {
                "added_symbols": int(item.get("added_symbols") or 0),
                "manifest_path": str(item.get("manifest_path") or ""),
                "projected_triggered_coverage_pct": item.get("projected_triggered_coverage_pct"),
                "projected_watch_to_trigger_pct": (item.get("watch_projection") or {}).get("projected_watch_to_trigger_pct"),
            }
            for item in sorted(evaluations, key=lambda item: int(item.get("added_symbols") or 0))
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Recommend the best shadow universe expansion cut.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--strategy-version", default="tradeability_v2")
    parser.add_argument("--week-start", required=True)
    parser.add_argument("--week-end", required=True)
    parser.add_argument("--cuts", default="10,20,30")
    parser.add_argument("--manifest-dir", default="tmp/experiment_candidates")
    parser.add_argument("--output-json", default="")
    args = parser.parse_args()

    cuts = [int(item.strip()) for item in args.cuts.split(",") if item.strip()]
    result = recommend_cut(
        market=args.market,
        strategy_version=args.strategy_version,
        week_start=args.week_start,
        week_end=args.week_end,
        cuts=cuts,
        manifest_dir=args.manifest_dir,
    )

    if args.output_json:
        output_path = Path(args.output_json)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
