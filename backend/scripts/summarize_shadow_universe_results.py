"""
Summarize current primary metrics after a shadow-universe experiment.

Outputs:
- per-model primary counts
- overall primary state distribution
- Watch -> Triggered conversion in the requested window
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection


def summarize(*, market: str, start_date: str, end_date: str) -> dict:
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT p.symbol, p.date, p.model_id, p.layer1_status
            FROM ai_predictions_v2 p
            JOIN stock_meta m ON m.symbol = p.symbol
            WHERE p.is_primary = 1
              AND p.date BETWEEN ? AND ?
              AND m.market = ?
            ORDER BY p.symbol, p.date
            """,
            (start_date, end_date, market),
        ).fetchall()

        by_model = defaultdict(lambda: defaultdict(int))
        state_counts = defaultdict(int)
        by_symbol = defaultdict(list)
        for row in rows:
            model_id = str(row["model_id"])
            state = str(row["layer1_status"] or "")
            by_model[model_id]["total"] += 1
            by_model[model_id][state] += 1
            state_counts[state] += 1
            by_symbol[str(row["symbol"])].append((str(row["date"]), state))

        watch = 0
        converted = 0
        for seq in by_symbol.values():
            for idx, (_, state) in enumerate(seq):
                if state != "Watch":
                    continue
                watch += 1
                for _, next_state in seq[idx + 1 : idx + 4]:
                    if next_state == "TriggeredLong":
                        converted += 1
                        break

        total = len(rows)
        return {
            "window": {"start": start_date, "end": end_date},
            "market": market,
            "total_primary_rows": total,
            "triggered_coverage_pct": round(state_counts["TriggeredLong"] * 100.0 / total, 2) if total else 0.0,
            "watch_coverage_pct": round(state_counts["Watch"] * 100.0 / total, 2) if total else 0.0,
            "riskoff_coverage_pct": round(state_counts["RiskOff"] * 100.0 / total, 2) if total else 0.0,
            "nosetup_coverage_pct": round(state_counts["NoSetup"] * 100.0 / total, 2) if total else 0.0,
            "watch_to_trigger_pct": round(converted * 100.0 / watch, 2) if watch else 0.0,
            "watch_count": watch,
            "converted_count": converted,
            "by_model": {model_id: dict(counts) for model_id, counts in by_model.items()},
        }
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize primary results after shadow-universe backfill.")
    parser.add_argument("--market", choices=["CN", "HK"], required=True)
    parser.add_argument("--start-date", required=True)
    parser.add_argument("--end-date", required=True)
    parser.add_argument("--output-json", default="")
    args = parser.parse_args()

    result = summarize(market=args.market, start_date=args.start_date, end_date=args.end_date)
    if args.output_json:
        output_path = Path(args.output_json)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
