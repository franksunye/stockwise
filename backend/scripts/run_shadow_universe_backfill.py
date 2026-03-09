"""
Run local shadow-universe backfill for a manifest using rule-engine only.

Purpose:
- Avoid external LLM calls
- Materialize prediction rows in ai_predictions_v2 for a curated expansion list
- Validate that the shadow universe can improve coverage with real prediction rows
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from backend.analysis.backfill import _analyze_stocks_for_date
from backend.engine import register_all_models


def _load_symbols(manifest_path: str) -> list[str]:
    payload = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    symbols = [str(item["symbol"]) for item in payload.get("symbols") or [] if item.get("symbol")]
    if not symbols:
        raise ValueError(f"No symbols found in manifest: {manifest_path}")
    return symbols


def _date_range(start_date: str, end_date: str) -> list[str]:
    from datetime import date, timedelta

    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    out: list[str] = []
    cur = start
    while cur <= end:
        out.append(cur.isoformat())
        cur += timedelta(days=1)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill shadow-universe prediction rows with rule-engine only.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--start-date", required=True)
    parser.add_argument("--end-date", required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    symbols = _load_symbols(args.manifest)
    register_all_models()
    conn = get_connection()
    try:
        total_success = 0
        processed_dates = []
        for date_str in _date_range(args.start_date, args.end_date):
            logger.info(f"Shadow universe backfill date={date_str}, symbols={len(symbols)}")
            success = _analyze_stocks_for_date(
                conn,
                symbols,
                date_str,
                model_filter="rule-engine",
                force=args.force,
                tracker=None,
            )
            total_success += int(success or 0)
            processed_dates.append(date_str)
        print(
            json.dumps(
                {
                    "manifest": args.manifest,
                    "symbols": len(symbols),
                    "dates": processed_dates,
                    "success_rows": total_success,
                    "model_filter": "rule-engine",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
