"""
Build a research-pool manifest for online tradeability experiments.

Current policy:
1) Prefer liquid names with recent turnover history.
2) Keep board exposure diversified.
3) Keep price-band coverage diversified.
4) Fill remaining slots from the wider stock_meta universe when recent prices are missing.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection


def board_group(symbol: str) -> str:
    if symbol.startswith(("688", "689")):
        return "star"
    if symbol.startswith(("300", "301")):
        return "chinext"
    if symbol.startswith(("002", "003")):
        return "sz_growth"
    if symbol.startswith(("000", "001")):
        return "sz_main"
    if symbol.startswith(("600", "601", "603", "605")):
        return "sh_main"
    return "other"


def price_band(close_price: float | None) -> str:
    if close_price is None:
        return "unknown"
    if close_price < 10:
        return "lt10"
    if close_price < 30:
        return "10to30"
    if close_price < 80:
        return "30to80"
    return "ge80"


def build_manifest(market: str, target_size: int) -> dict[str, Any]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        latest_date_row = cur.execute(
            """
            SELECT MAX(dp.date)
            FROM daily_prices dp
            JOIN stock_meta sm ON sm.symbol = dp.symbol
            WHERE sm.market = ?
            """,
            (market,),
        ).fetchone()
        latest_date = str(latest_date_row[0]) if latest_date_row and latest_date_row[0] else None

        rows = cur.execute(
            """
            WITH latest AS (
                SELECT
                    dp.symbol,
                    sm.name,
                    COALESCE(NULLIF(sm.industry, ''), '未知') AS industry,
                    dp.close AS latest_close,
                    ROW_NUMBER() OVER (PARTITION BY dp.symbol ORDER BY dp.date DESC) AS rn
                FROM stock_meta sm
                LEFT JOIN daily_prices dp ON dp.symbol = sm.symbol
                WHERE sm.market = ?
                  AND sm.name NOT LIKE '%ST%'
                  AND sm.name NOT LIKE '*ST%'
                  AND sm.name NOT LIKE '%退%'
            ),
            turnover AS (
                SELECT
                    dp.symbol,
                    AVG(dp.close * dp.volume) AS avg_turnover_20d,
                    COUNT(*) AS priced_days_20d
                FROM daily_prices dp
                JOIN stock_meta sm ON sm.symbol = dp.symbol
                WHERE sm.market = ?
                  AND sm.name NOT LIKE '%ST%'
                  AND sm.name NOT LIKE '*ST%'
                  AND sm.name NOT LIKE '%退%'
                  AND dp.date >= date(?, '-29 day')
                GROUP BY dp.symbol
            )
            SELECT
                sm.symbol,
                sm.name,
                COALESCE(NULLIF(sm.industry, ''), '未知') AS industry,
                l.latest_close,
                t.avg_turnover_20d,
                COALESCE(t.priced_days_20d, 0) AS priced_days_20d
            FROM stock_meta sm
            LEFT JOIN latest l ON l.symbol = sm.symbol AND l.rn = 1
            LEFT JOIN turnover t ON t.symbol = sm.symbol
            WHERE sm.market = ?
              AND sm.name NOT LIKE '%ST%'
              AND sm.name NOT LIKE '*ST%'
              AND sm.name NOT LIKE '%退%'
            ORDER BY COALESCE(t.avg_turnover_20d, 0) DESC, sm.symbol ASC
            """,
            (market, market, latest_date or "1970-01-01", market),
        ).fetchall()
    finally:
        conn.close()

    candidates: list[dict[str, Any]] = []
    for row in rows:
        symbol = str(row[0])
        latest_close = float(row[3]) if row[3] is not None else None
        avg_turnover = float(row[4]) if row[4] is not None else 0.0
        priced_days = int(row[5] or 0)
        candidates.append(
            {
                "symbol": symbol,
                "name": str(row[1]),
                "industry": str(row[2]),
                "board_group": board_group(symbol),
                "price_band": price_band(latest_close),
                "latest_close": latest_close,
                "avg_turnover_20d": round(avg_turnover, 2),
                "priced_days_20d": priced_days,
                "has_recent_pricing": priced_days > 0,
            }
        )

    recent = [c for c in candidates if c["has_recent_pricing"]]
    no_price = [c for c in candidates if not c["has_recent_pricing"]]

    # Core liquid set first.
    selected: list[dict[str, Any]] = []
    selected_symbols: set[str] = set()
    core_target = min(len(recent), max(300, int(target_size * 0.6)))
    for item in recent[:core_target]:
        selected.append(item)
        selected_symbols.add(item["symbol"])

    # Stratified fill by board x price band.
    board_counts = defaultdict(int)
    band_counts = defaultdict(int)
    for item in selected:
        board_counts[item["board_group"]] += 1
        band_counts[item["price_band"]] += 1

    remaining = [c for c in recent[core_target:] + no_price if c["symbol"] not in selected_symbols]
    board_caps = {
        "sh_main": int(target_size * 0.38),
        "sz_main": int(target_size * 0.22),
        "sz_growth": int(target_size * 0.16),
        "chinext": int(target_size * 0.14),
        "star": int(target_size * 0.08),
        "other": max(10, int(target_size * 0.02)),
    }
    band_floors = {
        "lt10": max(40, int(target_size * 0.16)),
        "10to30": max(90, int(target_size * 0.24)),
        "30to80": max(60, int(target_size * 0.14)),
        "ge80": max(20, int(target_size * 0.06)),
        "unknown": 0,
    }

    def desirability(item: dict[str, Any]) -> tuple[int, int, float, str]:
        board_need = board_counts[item["board_group"]] < board_caps.get(item["board_group"], target_size)
        band_need = band_counts[item["price_band"]] < band_floors.get(item["price_band"], 0)
        return (
            0 if board_need else 1,
            0 if band_need else 1,
            -float(item["avg_turnover_20d"]),
            str(item["symbol"]),
        )

    remaining.sort(key=desirability)
    for item in remaining:
        if len(selected) >= target_size:
            break
        selected.append(item)
        selected_symbols.add(item["symbol"])
        board_counts[item["board_group"]] += 1
        band_counts[item["price_band"]] += 1

    output_symbols = []
    for index, item in enumerate(selected[:target_size], start=1):
        output_symbols.append(
            {
                "symbol": item["symbol"],
                "name": item["name"],
                "industry": item["industry"],
                "board_group": item["board_group"],
                "price_band": item["price_band"],
                "latest_close": item["latest_close"],
                "avg_turnover_20d": item["avg_turnover_20d"],
                "priced_days_20d": item["priced_days_20d"],
                "rank": index,
            }
        )

    return {
        "market": market,
        "purpose": "online_research_pool",
        "pool_name": f"{market.lower()}_research_pool_core_{target_size}",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "selection_rule": "liquidity-first with board and price-band diversification",
        "target_size": target_size,
        "actual_size": len(output_symbols),
        "latest_reference_date": latest_date,
        "symbols": output_symbols,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a research-pool manifest.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--target-size", type=int, default=500)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    payload = build_manifest(args.market, args.target_size)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(output_path), "actual_size": payload["actual_size"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
