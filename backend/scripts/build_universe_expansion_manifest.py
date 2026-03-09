"""
Build a local shadow universe expansion manifest from recent TriggeredLong signals.

Selection rule:
- Market-specific
- Exclude current global_stock_pool symbols
- Rank by recent TriggeredLong days in quant_tradeability_signals
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "stockwise.db"


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def build_manifest(*, market: str, strategy_version: str, week_start: str, week_end: str, limit: int) -> dict:
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT q.symbol, m.name, COUNT(*) AS triggered_days
            FROM quant_tradeability_signals q
            JOIN stock_meta m ON m.symbol = q.symbol
            WHERE q.market = ?
              AND q.strategy_version = ?
              AND q.setup_state = 'TriggeredLong'
              AND q.date BETWEEN ? AND ?
              AND q.symbol NOT IN (SELECT symbol FROM global_stock_pool)
            GROUP BY q.symbol, m.name
            ORDER BY triggered_days DESC, q.symbol ASC
            LIMIT ?
            """,
            (market, strategy_version, week_start, week_end, limit),
        ).fetchall()
        return {
            "market": market,
            "purpose": "local_universe_expansion_experiment",
            "window": {"start": week_start, "end": week_end},
            "selection_rule": "top non-global-pool symbols by recent TriggeredLong days",
            "strategy_version": strategy_version,
            "expected_added_triggered_symbol_days": sum(int(row["triggered_days"] or 0) for row in rows),
            "symbols": [
                {
                    "symbol": str(row["symbol"]),
                    "name": str(row["name"]),
                    "triggered_days": int(row["triggered_days"] or 0),
                }
                for row in rows
            ],
        }
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a shadow universe expansion manifest from recent TriggeredLong signals.")
    parser.add_argument("--market", choices=["CN", "HK"], default="CN")
    parser.add_argument("--strategy-version", default="tradeability_v2")
    parser.add_argument("--week-start", required=True)
    parser.add_argument("--week-end", required=True)
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--output-json", required=True)
    args = parser.parse_args()

    manifest = build_manifest(
        market=args.market,
        strategy_version=args.strategy_version,
        week_start=args.week_start,
        week_end=args.week_end,
        limit=args.limit,
    )
    output_path = Path(args.output_json)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
