import argparse
import os
import sys
from typing import List, Set

import pandas as pd

# Add project root + backend path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)
backend_path = os.path.join(project_root, "backend")
if backend_path not in sys.path:
    sys.path.append(backend_path)

from backend.database import get_connection
from backend.sync.prices import _normalize_period_ohlcv, _calculate_indicators_safe
from backend.db_repo.queries import get_save_prices_sql


WEEKLY_LEAK_QUERY = """
WITH gaps AS (
    SELECT
        symbol,
        (julianday(date) - julianday(LAG(date) OVER (PARTITION BY symbol ORDER BY date))) AS gap_days
    FROM weekly_prices
),
agg AS (
    SELECT
        symbol,
        SUM(CASE WHEN gap_days IS NOT NULL AND gap_days < 4 THEN 1 ELSE 0 END) AS bad_cnt,
        SUM(CASE WHEN gap_days IS NOT NULL THEN 1 ELSE 0 END) AS total_cnt
    FROM gaps
    GROUP BY symbol
)
SELECT symbol
FROM agg
WHERE total_cnt > 0
  AND bad_cnt >= 5
  AND (bad_cnt * 1.0 / total_cnt) > 0.15
"""

MONTHLY_LEAK_QUERY = """
WITH gaps AS (
    SELECT
        symbol,
        (julianday(date) - julianday(LAG(date) OVER (PARTITION BY symbol ORDER BY date))) AS gap_days
    FROM monthly_prices
),
agg AS (
    SELECT
        symbol,
        SUM(CASE WHEN gap_days IS NOT NULL AND gap_days < 20 THEN 1 ELSE 0 END) AS bad_cnt,
        SUM(CASE WHEN gap_days IS NOT NULL THEN 1 ELSE 0 END) AS total_cnt
    FROM gaps
    GROUP BY symbol
)
SELECT symbol
FROM agg
WHERE total_cnt > 0
  AND bad_cnt >= 5
  AND (bad_cnt * 1.0 / total_cnt) > 0.15
"""


def _detect_corrupted_symbols(cursor) -> Set[str]:
    cursor.execute(WEEKLY_LEAK_QUERY)
    weekly_symbols = {row[0] for row in cursor.fetchall()}

    cursor.execute(MONTHLY_LEAK_QUERY)
    monthly_symbols = {row[0] for row in cursor.fetchall()}

    return weekly_symbols.union(monthly_symbols)


def _purge_periodic_rows(cursor, symbol: str) -> None:
    cursor.execute("DELETE FROM weekly_prices WHERE symbol = ?", (symbol,))
    cursor.execute("DELETE FROM monthly_prices WHERE symbol = ?", (symbol,))


def _build_period_records_from_daily(cursor, symbol: str, period: str):
    cursor.execute(
        """
        SELECT date, open, high, low, close, volume, change_percent
        FROM daily_prices
        WHERE symbol = ?
        ORDER BY date ASC
        """,
        (symbol,),
    )
    rows = cursor.fetchall()
    if not rows:
        return []

    df = pd.DataFrame(rows, columns=["date", "open", "high", "low", "close", "volume", "change_percent"])
    df = _normalize_period_ohlcv(df, period)
    if df.empty:
        return []

    df = _calculate_indicators_safe(df)

    def r2(x):
        return round(float(x), 2) if x else 0

    def r3(x):
        return round(float(x), 3) if x else 0

    def r1(x):
        return round(float(x), 1) if x else 0

    records = []
    for _, row in df.iterrows():
        records.append(
            (
                symbol,
                row["date"],
                r2(row["open"]),
                r2(row["high"]),
                r2(row["low"]),
                r2(row["close"]),
                int(row["volume"]),
                r2(row["change_percent"]),
                r2(row["ma5"]),
                r2(row["ma10"]),
                r2(row["ma20"]),
                r2(row["ma60"]),
                r3(row["macd"]),
                r3(row["macd_signal"]),
                r3(row["macd_hist"]),
                r2(row["boll_upper"]),
                r2(row["boll_mid"]),
                r2(row["boll_lower"]),
                r1(row["rsi"]),
                r1(row["kdj_k"]),
                r1(row["kdj_d"]),
                r1(row["kdj_j"]),
                None,
            )
        )
    return records


def repair(symbols: List[str] = None, dry_run: bool = False) -> int:
    conn = get_connection()
    cursor = conn.cursor()

    target_symbols = set(symbols) if symbols else _detect_corrupted_symbols(cursor)
    if not target_symbols:
        print("✅ No periodic contamination detected.")
        conn.close()
        return 0

    print(f"⚠️ Found {len(target_symbols)} symbols to repair.")
    if dry_run:
        print("🔍 Dry run mode. Symbols:")
        for sym in sorted(target_symbols):
            print(f" - {sym}")
        conn.close()
        return 0

    repaired = 0
    failed = 0
    for symbol in sorted(target_symbols):
        try:
            print(f"🧹 Purging periodic tables for {symbol} ...")
            _purge_periodic_rows(cursor, symbol)

            weekly_records = _build_period_records_from_daily(cursor, symbol, "weekly")
            monthly_records = _build_period_records_from_daily(cursor, symbol, "monthly")
            if not weekly_records and not monthly_records:
                failed += 1
                print(f"❌ No daily source to rebuild {symbol}")
                continue

            if weekly_records:
                cursor.executemany(get_save_prices_sql("weekly_prices"), weekly_records)
            if monthly_records:
                cursor.executemany(get_save_prices_sql("monthly_prices"), monthly_records)

            conn.commit()
            repaired += 1
            print(f"✅ Rebuilt {symbol}: weekly={len(weekly_records)}, monthly={len(monthly_records)}")
        except Exception as exc:
            try:
                if hasattr(conn, "rollback"):
                    conn.rollback()
            except Exception:
                pass
            failed += 1
            print(f"❌ Repair failed for {symbol}: {exc}")

    conn.close()
    print(f"\n✅ Repair finished. repaired={repaired}, failed={failed}, total={len(target_symbols)}")
    return 0 if failed == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Repair contaminated weekly/monthly period tables.")
    parser.add_argument("--symbol", action="append", help="Repair specific symbol(s). Repeatable.")
    parser.add_argument("--dry-run", action="store_true", help="Only detect and print symbols.")
    args = parser.parse_args()
    return repair(symbols=args.symbol, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
