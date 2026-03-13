import argparse
import math
import os
import sys
from collections import defaultdict

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger


NUMERIC_COLUMNS = [
    "open",
    "high",
    "low",
    "close",
    "volume",
    "change_percent",
    "ma5",
    "ma10",
    "ma20",
    "ma60",
    "macd",
    "macd_signal",
    "macd_hist",
    "boll_upper",
    "boll_mid",
    "boll_lower",
    "rsi",
    "kdj_k",
    "kdj_d",
    "kdj_j",
]


def _is_non_finite(value) -> bool:
    return isinstance(value, float) and not math.isfinite(value)


def scan(limit: int, start_date: str | None, end_date: str | None, apply: bool) -> int:
    conn = get_connection()
    cur = conn.cursor()
    try:
        where_parts = []
        params = []
        if start_date:
            where_parts.append("date >= ?")
            params.append(start_date)
        if end_date:
            where_parts.append("date <= ?")
            params.append(end_date)

        where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
        sql = f"""
            SELECT symbol, date, {", ".join(NUMERIC_COLUMNS)}
            FROM daily_prices
            {where_sql}
            ORDER BY date DESC, symbol
            LIMIT ?
        """
        params.append(limit)
        rows = cur.execute(sql, tuple(params)).fetchall()

        bad_rows = []
        by_column = defaultdict(int)
        for row in rows:
            symbol, date, *values = row
            dirty_cols = []
            for idx, value in enumerate(values):
                if _is_non_finite(value):
                    col = NUMERIC_COLUMNS[idx]
                    dirty_cols.append(col)
                    by_column[col] += 1
            if dirty_cols:
                bad_rows.append((symbol, date, dirty_cols))

        logger.info(f"Scanned rows={len(rows)} nonfinite_rows={len(bad_rows)} apply={apply}")
        for symbol, date, cols in bad_rows[:50]:
            logger.warning(f"Non-finite daily_prices row: symbol={symbol} date={date} cols={','.join(cols)}")

        if by_column:
            logger.info(f"Column hit summary: {dict(sorted(by_column.items()))}")

        if apply and bad_rows:
            updated = 0
            for symbol, date, cols in bad_rows:
                assignments = ", ".join(f"{col} = NULL" for col in cols)
                cur.execute(
                    f"UPDATE daily_prices SET {assignments} WHERE symbol = ? AND date = ?",
                    (symbol, date),
                )
                updated += 1
            conn.commit()
            logger.info(f"Applied NULL normalization to rows={updated}")
        elif apply:
            logger.info("No non-finite rows found; nothing to update.")

        return len(bad_rows)
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Scan daily_prices for NaN/Inf numeric values.")
    parser.add_argument("--limit", type=int, default=5000, help="Max rows to scan after filters.")
    parser.add_argument("--start-date", type=str, default=None, help="Inclusive start date YYYY-MM-DD.")
    parser.add_argument("--end-date", type=str, default=None, help="Inclusive end date YYYY-MM-DD.")
    parser.add_argument("--apply", action="store_true", help="Normalize non-finite values to NULL.")
    args = parser.parse_args()

    bad_rows = scan(
        limit=args.limit,
        start_date=args.start_date,
        end_date=args.end_date,
        apply=args.apply,
    )
    return 1 if bad_rows and not args.apply else 0


if __name__ == "__main__":
    raise SystemExit(main())
