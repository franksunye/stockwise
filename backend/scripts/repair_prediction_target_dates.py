"""
Repair prediction target_date when it falls on a non-trading day.

Default scope is latest predictions per symbol (all models on latest date).
Use --scope all to scan all predictions.
"""
import argparse
import os
import sys
from typing import List, Tuple

# Add backend to path (legacy support)
backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
# Add project root to path (support 'backend.*' imports)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from trading_calendar import is_trading_day, get_next_trading_day_str


PredictionRow = Tuple[str, str, str, str, str]


def fetch_candidates(cursor, scope: str, include_finalized: bool) -> List[PredictionRow]:
    status_filter = "" if include_finalized else "AND p.validation_status IN ('Pending', 'Verifying')"
    status_filter_all = "" if include_finalized else "AND validation_status IN ('Pending', 'Verifying')"

    if scope == "latest":
        cursor.execute(
            f"""
            SELECT p.symbol, p.date, p.model_id, p.target_date, p.validation_status
            FROM ai_predictions_v2 p
            JOIN (
              SELECT symbol, MAX(date) AS max_date
              FROM ai_predictions_v2
              GROUP BY symbol
            ) t ON p.symbol = t.symbol AND p.date = t.max_date
            WHERE p.target_date IS NOT NULL
            {status_filter}
            ORDER BY p.symbol, p.model_id
            """
        )
    else:
        cursor.execute(
            f"""
            SELECT symbol, date, model_id, target_date, validation_status
            FROM ai_predictions_v2
            WHERE target_date IS NOT NULL
            {status_filter_all}
            ORDER BY date DESC
            """
        )
    return cursor.fetchall()


def detect_invalid_targets(rows: List[PredictionRow]):
    invalid = []
    for symbol, pred_date, model_id, target_date, status in rows:
        market = "HK" if len(symbol) == 5 else "CN"
        if not is_trading_day(target_date, market=market):
            fixed = get_next_trading_day_str(target_date, market=market)
            invalid.append((symbol, pred_date, model_id, target_date, fixed, status, market))
    return invalid


def apply_repairs(cursor, invalid_rows) -> int:
    updated = 0
    for symbol, pred_date, model_id, old_target, new_target, _status, _market in invalid_rows:
        if new_target == old_target:
            continue
        cursor.execute(
            """
            UPDATE ai_predictions_v2
            SET target_date = ?,
                validation_status = 'Pending',
                actual_change = NULL,
                validation_data = NULL,
                max_perf_in_window = NULL,
                updated_at = datetime('now', '+8 hours')
            WHERE symbol = ? AND date = ? AND model_id = ?
            """,
            (new_target, symbol, pred_date, model_id),
        )
        updated += cursor.rowcount if hasattr(cursor, "rowcount") else 1
    return updated


def main():
    parser = argparse.ArgumentParser(description="Repair invalid prediction target dates")
    parser.add_argument(
        "--scope",
        choices=["latest", "all"],
        default="latest",
        help="latest: latest prediction date per symbol; all: full table scan",
    )
    parser.add_argument(
        "--include-finalized",
        action="store_true",
        help="Include Correct/Incorrect records. By default only Pending/Verifying are scanned.",
    )
    parser.add_argument("--apply", action="store_true", help="Apply updates to DB")
    args = parser.parse_args()

    conn = get_connection()
    try:
        cursor = conn.cursor()
        rows = fetch_candidates(cursor, args.scope, args.include_finalized)
        invalid = detect_invalid_targets(rows)

        logger.info(f"🔎 Scope={args.scope} scanned={len(rows)} invalid={len(invalid)}")
        for item in invalid[:20]:
            symbol, pred_date, model_id, old_target, new_target, status, market = item
            logger.info(
                f"   {symbol} [{model_id}] {pred_date}: {old_target} -> {new_target} ({market}, {status})"
            )

        if not args.apply:
            logger.info("🧪 Dry-run only. Use --apply to persist changes.")
            return

        updated = apply_repairs(cursor, invalid)
        conn.commit()
        logger.info(f"✅ Updated rows: {updated}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
