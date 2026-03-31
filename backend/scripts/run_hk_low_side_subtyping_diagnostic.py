#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("DB_SOURCE", "local")

from backend.management.policies.policy_registry import build_default_policies
from backend.management.research.path_classifier import (
    build_early_path_features,
    bucket_early_risk_score,
    classify_low_side_subtype,
    score_early_path_risk,
)
from backend.management.simulation.engine import simulate_policy
from backend.management.state.snapshot_builder import build_position_snapshots


def main() -> int:
    parser = argparse.ArgumentParser(description="Diagnose HK low-side subtyping and policy fit")
    parser.add_argument("--cases-file", required=True)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    cases = json.loads(Path(args.cases_file).read_text(encoding="utf-8"))
    policies = build_default_policies()
    subtype_counts: Counter[str] = Counter()
    subtype_best_counts: dict[str, Counter[str]] = defaultdict(Counter)
    subtype_avg_returns: dict[str, dict[str, float]] = defaultdict(dict)
    subtype_case_rows: list[dict[str, object]] = []
    grouped_returns: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))

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
        features = build_early_path_features(snapshots, lookahead_days=3)
        score = score_early_path_risk(features)
        if bucket_early_risk_score(score) != "score_low":
            continue

        subtype = classify_low_side_subtype(features)
        subtype_counts[subtype] += 1

        results = [simulate_policy(policy, [s for s in snapshots]) for policy in policies]
        result_by_policy = {result.policy_id: (result.realized_pnl_pct or 0.0) for result in results}
        best_policy = max(result_by_policy.items(), key=lambda item: item[1])[0]
        subtype_best_counts[subtype][best_policy] += 1
        for policy_id, realized in result_by_policy.items():
            grouped_returns[subtype][policy_id].append(realized)

        subtype_case_rows.append(
            {
                "label": str(case.get("label") or f"{case['symbol']}:{case['entry_date']}"),
                "symbol": str(case["symbol"]),
                "entry_date": str(case["entry_date"]),
                "score_low_subtype": subtype,
                "best_policy": best_policy,
                "best_return_pct": round(result_by_policy[best_policy], 6),
            }
        )

    for subtype, returns_by_policy in grouped_returns.items():
        subtype_avg_returns[subtype] = {
            policy_id: round(sum(values) / len(values), 6)
            for policy_id, values in returns_by_policy.items()
            if values
        }

    payload = {
        "as_of": date.today().isoformat(),
        "diagnostic_id": "hk_low_side_subtyping_v1",
        "cases_file": Path(args.cases_file).name,
        "score_low_case_count": sum(subtype_counts.values()),
        "subtype_counts": dict(subtype_counts),
        "subtype_best_policy_counts": {key: dict(value) for key, value in subtype_best_counts.items()},
        "subtype_avg_policy_returns": subtype_avg_returns,
        "preview_cases": subtype_case_rows[:30],
    }

    print(json.dumps(payload, ensure_ascii=False, indent=2))
    if args.output:
        Path(args.output).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n# wrote {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
