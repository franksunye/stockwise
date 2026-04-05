#!/usr/bin/env python3
"""
Print stock_meta name_en coverage for the current DB (local SQLite or Turso per DB_SOURCE).

Usage (from repo root):
  DB_SOURCE=local python backend/scripts/verify_local_stock_meta_name_en_stats.py
"""
from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND = os.path.join(ROOT, "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


def main() -> None:
    from database import get_connection

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN name_en IS NOT NULL AND TRIM(name_en) != '' THEN 1 ELSE 0 END) AS with_en
            FROM stock_meta
            """
        )
        total, with_en = cur.fetchone()
        total = int(total or 0)
        with_en = int(with_en or 0)

        def block(market: str) -> tuple[int, int, float | None]:
            cur.execute(
                """
                SELECT COUNT(*),
                       SUM(CASE WHEN name_en IS NOT NULL AND TRIM(name_en) != '' THEN 1 ELSE 0 END)
                FROM stock_meta WHERE market = ?
                """,
                (market,),
            )
            t, w = cur.fetchone()
            t, w = int(t or 0), int(w or 0)
            pct = round(100.0 * w / t, 2) if t else None
            return t, w, pct

        hk_t, hk_w, hk_pct = block("HK")
        cn_t, cn_w, cn_pct = block("CN")

        cur.execute(
            """
            SELECT symbol, name, name_en, market FROM stock_meta
            WHERE symbol IN ('00700', '09988', '600519', '000001', '300015')
            ORDER BY market, symbol
            """
        )
        samples = cur.fetchall()

        db_path = os.path.join(ROOT, "data", "stockwise.db")
        src = os.getenv("DB_SOURCE", "cloud")
        print(f"DB_SOURCE={src}")
        if src == "local":
            print(f"SQLite: {db_path} (exists={os.path.isfile(db_path)})")
        print()
        print(f"stock_meta total:        {total}")
        print(f"with non-empty name_en:  {with_en} ({round(100.0 * with_en / total, 2) if total else 0}%)")
        print()
        print(f"HK rows: {hk_t}, with name_en: {hk_w} ({hk_pct}% )" if hk_pct is not None else f"HK rows: {hk_t}")
        print(f"CN rows: {cn_t}, with name_en: {cn_w} ({cn_pct}% )" if cn_pct is not None else f"CN rows: {cn_t}")
        print()
        print("Sample rows:")
        for row in samples:
            sym, name, ne, mkt = row
            ne_s = (ne or "").strip() or "(empty)"
            print(f"  {sym} [{mkt}] {name} -> {ne_s}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
