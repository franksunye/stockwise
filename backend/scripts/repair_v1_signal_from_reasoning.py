"""
Repair ai_predictions_v2.signal to match ai_reasoning JSON signal.

Use case:
- v1 product mode where LLM output is the public truth.
- Historical rows may have DB `signal` overwritten by Layer-1 enforcement.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Optional

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from backend.engine.signal_semantics import normalize_signal_value


def repair_signals(
    *,
    start_date: Optional[str],
    end_date: Optional[str],
    symbol: Optional[str],
    locale: Optional[str],
    dry_run: bool,
) -> dict:
    conn = get_connection()
    try:
        cur = conn.cursor()
        sql = """
            SELECT symbol, date, model_id, COALESCE(content_locale, 'cn') AS content_locale, ai_reasoning, signal
            FROM ai_predictions_v2
            WHERE (? IS NULL OR date >= ?)
              AND (? IS NULL OR date <= ?)
              AND (? IS NULL OR symbol = ?)
              AND (? IS NULL OR COALESCE(content_locale, 'cn') = ?)
        """
        rows = cur.execute(
            sql,
            (start_date, start_date, end_date, end_date, symbol, symbol, locale, locale),
        ).fetchall()

        touched = 0
        mismatched = 0
        skipped_invalid_json = 0
        skipped_no_signal = 0

        for row in rows:
            s, d, model_id, loc, reasoning, db_signal = row
            if not isinstance(reasoning, str) or not reasoning.strip().startswith("{"):
                skipped_invalid_json += 1
                continue
            try:
                payload = json.loads(reasoning)
            except Exception:
                skipped_invalid_json += 1
                continue
            if not isinstance(payload, dict):
                skipped_invalid_json += 1
                continue

            json_signal_raw = payload.get("signal")
            if not json_signal_raw:
                skipped_no_signal += 1
                continue
            json_signal = normalize_signal_value(json_signal_raw, str(db_signal or "NoSetup"))
            db_norm = normalize_signal_value(db_signal, "NoSetup")

            if db_norm == json_signal:
                continue

            mismatched += 1
            if dry_run:
                logger.info(
                    f"[DRY] {s} {d} {model_id} {loc}: db={db_norm} -> json={json_signal}"
                )
                continue

            cur.execute(
                """
                UPDATE ai_predictions_v2
                SET signal = ?, updated_at = datetime('now', '+8 hours')
                WHERE symbol = ? AND date = ? AND model_id = ? AND COALESCE(content_locale, 'cn') = ?
                """,
                (json_signal, s, d, model_id, loc),
            )
            touched += 1

        if not dry_run:
            conn.commit()

        return {
            "scanned": len(rows),
            "mismatched": mismatched,
            "updated": touched,
            "skipped_invalid_json": skipped_invalid_json,
            "skipped_no_signal": skipped_no_signal,
            "dry_run": dry_run,
        }
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Repair v1 signals from ai_reasoning JSON signal.")
    parser.add_argument("--start-date", default=None, help="YYYY-MM-DD")
    parser.add_argument("--end-date", default=None, help="YYYY-MM-DD")
    parser.add_argument("--symbol", default=None)
    parser.add_argument("--locale", choices=["cn", "en"], default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    stats = repair_signals(
        start_date=args.start_date,
        end_date=args.end_date,
        symbol=args.symbol,
        locale=args.locale,
        dry_run=args.dry_run,
    )
    logger.info(f"repair_v1_signal_from_reasoning stats: {stats}")
    print(stats)


if __name__ == "__main__":
    main()

