"""
Validate research-pool coverage against cloud/local DB.

Purpose:
1) Ensure research pool symbols exist in stock_meta for the target market.
2) Ensure sufficient price coverage on latest market date.
3) Ensure enough symbols have at least N historical bars for sidecar/calibration.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection


def load_manifest_symbols(manifest_path: str) -> List[str]:
    payload = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    symbols = [str(item.get("symbol")) for item in payload.get("symbols") or [] if item.get("symbol")]
    if not symbols:
        raise ValueError(f"No symbols found in manifest: {manifest_path}")
    deduped: List[str] = []
    seen = set()
    for symbol in symbols:
        if symbol not in seen:
            seen.add(symbol)
            deduped.append(symbol)
    return deduped


def _ratio(numerator: int, denominator: int) -> float:
    if denominator <= 0:
        return 0.0
    return float(numerator) / float(denominator)


def _scalar(cur, sql: str, args: List[object]) -> int:
    row = cur.execute(sql, tuple(args)).fetchone()
    if not row:
        return 0
    return int(row[0] or 0)


def evaluate_coverage(market: str, symbols: List[str], min_history_bars: int) -> Dict[str, object]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        latest_row = cur.execute(
            """
            SELECT MAX(dp.date)
            FROM daily_prices dp
            JOIN stock_meta sm ON sm.symbol = dp.symbol
            WHERE sm.market = ?
            """,
            (market,),
        ).fetchone()
        latest_date = str(latest_row[0]) if latest_row and latest_row[0] else ""
        placeholders = ",".join(["?"] * len(symbols))

        in_meta = _scalar(
            cur,
            f"SELECT COUNT(*) FROM stock_meta WHERE market = ? AND symbol IN ({placeholders})",
            [market, *symbols],
        )
        with_any_price = _scalar(
            cur,
            f"""
            SELECT COUNT(DISTINCT sm.symbol)
            FROM stock_meta sm
            JOIN daily_prices dp ON dp.symbol = sm.symbol
            WHERE sm.market = ? AND sm.symbol IN ({placeholders})
            """,
            [market, *symbols],
        )
        with_latest_price = _scalar(
            cur,
            f"""
            SELECT COUNT(DISTINCT sm.symbol)
            FROM stock_meta sm
            JOIN daily_prices dp ON dp.symbol = sm.symbol
            WHERE sm.market = ? AND dp.date = ? AND sm.symbol IN ({placeholders})
            """,
            [market, latest_date, *symbols],
        ) if latest_date else 0
        with_min_history = _scalar(
            cur,
            f"""
            SELECT COUNT(*)
            FROM (
                SELECT dp.symbol, COUNT(*) AS bars
                FROM daily_prices dp
                JOIN stock_meta sm ON sm.symbol = dp.symbol
                WHERE sm.market = ? AND sm.symbol IN ({placeholders})
                GROUP BY dp.symbol
            ) t
            WHERE t.bars >= ?
            """,
            [market, *symbols, int(min_history_bars)],
        )
    finally:
        conn.close()

    manifest_count = len(symbols)
    return {
        "market": market,
        "manifest_count": manifest_count,
        "latest_market_date": latest_date or None,
        "in_stock_meta": in_meta,
        "with_any_price": with_any_price,
        "with_latest_price": with_latest_price,
        "with_min_history": with_min_history,
        "rates": {
            "in_meta": round(_ratio(in_meta, manifest_count), 6),
            "latest_price": round(_ratio(with_latest_price, manifest_count), 6),
            "min_history": round(_ratio(with_min_history, manifest_count), 6),
        },
        "requirements": {
            "min_history_bars": int(min_history_bars),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Check research-pool coverage against DB.")
    parser.add_argument("--market", choices=["CN", "HK"], required=True)
    parser.add_argument("--research-pool-manifest", required=True)
    parser.add_argument("--min-in-meta-rate", type=float, default=0.99)
    parser.add_argument("--min-latest-price-rate", type=float, default=0.90)
    parser.add_argument("--min-history-rate", type=float, default=0.85)
    parser.add_argument("--min-history-bars", type=int, default=20)
    parser.add_argument("--output-json", default="")
    args = parser.parse_args()

    symbols = load_manifest_symbols(args.research_pool_manifest)
    report = evaluate_coverage(args.market, symbols, args.min_history_bars)
    rates = report["rates"]
    thresholds = {
        "in_meta": float(args.min_in_meta_rate),
        "latest_price": float(args.min_latest_price_rate),
        "min_history": float(args.min_history_rate),
    }
    gates = {
        "in_meta": float(rates["in_meta"]) >= thresholds["in_meta"],
        "latest_price": float(rates["latest_price"]) >= thresholds["latest_price"],
        "min_history": float(rates["min_history"]) >= thresholds["min_history"],
    }
    report["thresholds"] = thresholds
    report["gates"] = gates
    report["ok"] = all(gates.values())

    if args.output_json:
        os.makedirs(os.path.dirname(args.output_json), exist_ok=True)
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
            f.write("\n")

    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
