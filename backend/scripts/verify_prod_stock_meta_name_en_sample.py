#!/usr/bin/env python3
"""
Sample check: print stock_meta.name_en for a few known symbols on the current DB target.

Usage (production Turso):
  export TURSO_DB_URL=...
  export TURSO_AUTH_TOKEN=...
  python backend/scripts/verify_prod_stock_meta_name_en_sample.py

DB_SOURCE=local forces SQLite (see backend/config.py).
Exit code 0 always; prints WARNING lines for empty name_en on sample HK symbols.
"""

from __future__ import annotations

import os
import sys

# Repo root on path (same pattern as validate_prod_schema.py)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_connection  # noqa: E402


SAMPLE_SYMBOLS = ("00700", "09988", "600519", "688256")


def main() -> None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        print("symbol\tname\tname_en")
        for sym in SAMPLE_SYMBOLS:
            try:
                row = cur.execute(
                    "SELECT symbol, name, name_en FROM stock_meta WHERE symbol = ?",
                    (sym,),
                ).fetchone()
            except Exception as e:
                print(f"ERROR: query failed ({e}). Is column name_en present? Run validate_prod_schema.py / init_db.")
                sys.exit(2)
            if not row:
                print(f"{sym}\t<missing row>\t")
                continue
            s, name, name_en = row[0], row[1], row[2]
            ne = (name_en or "").strip()
            print(f"{s}\t{name}\t{ne or '(null)'}")
            if sym == "00700" and not ne:
                print(
                    "  WARNING: 00700 name_en empty — run production --sync-meta after HK Sina + curated JSON.",
                )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
