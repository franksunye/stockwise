#!/usr/bin/env python3
"""
Export Layer-1 replay data for VCP POC hardcoded usage.

Usage:
  ./.venv/bin/python backend/scripts/export_vcp_poc_data.py \
    --symbol 02171 --start 2026-01-01 --end 2026-03-24
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List

from backend.engine.layer1_state import build_layer1_snapshot


def _load_bars(db_path: str, symbol: str, start: str, end: str) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT date, open, high, low, close, volume, change_percent, ma5, ma10, ma20, macd_hist
        FROM daily_prices
        WHERE symbol = ? AND date >= ? AND date <= ?
        ORDER BY date ASC
        """,
        (symbol, start, end),
    ).fetchall()
    conn.close()
    return [{k: row[k] for k in row.keys()} for row in rows]


def _build_replay(symbol: str, bars: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    replay: List[Dict[str, Any]] = []
    for i, bar in enumerate(bars):
        history = bars[: i + 1]
        snapshot = build_layer1_snapshot(symbol=symbol, daily_history=history, strategy_version="tradeability_v2")
        replay.append(
            {
                "date": bar["date"],
                "setup_state": snapshot.setup_state,
                "score": snapshot.opportunity_score,
                "trigger_rule_hit": snapshot.trigger_rule_hit,
                "risk_off_hit": snapshot.risk_off_hit,
                "watch": bool(snapshot.payload.get("watch")),
                "trigger": bool(snapshot.payload.get("trigger")),
                "risk_off": bool(snapshot.payload.get("risk_off")),
                "close": bar["close"],
                "volume": bar["volume"],
            }
        )
    return replay


def _build_segments(replay: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    segments: List[Dict[str, Any]] = []
    for item in replay:
        if not segments or segments[-1]["setup_state"] != item["setup_state"]:
            segments.append(
                {
                    "setup_state": item["setup_state"],
                    "start_date": item["date"],
                    "end_date": item["date"],
                    "days": 1,
                }
            )
        else:
            segments[-1]["end_date"] = item["date"]
            segments[-1]["days"] += 1
    return segments


def _build_price_data(bars: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "time": bar["date"],
            "open": float(bar["open"]),
            "high": float(bar["high"]),
            "low": float(bar["low"]),
            "close": float(bar["close"]),
            "volume": int(float(bar["volume"] or 0)),
        }
        for bar in bars
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Export VCP POC data from local SQLite + Layer1 replay.")
    parser.add_argument("--symbol", required=True)
    parser.add_argument("--start", required=True, help="YYYY-MM-DD")
    parser.add_argument("--end", required=True, help="YYYY-MM-DD")
    parser.add_argument("--db-path", default="data/stockwise.db")
    parser.add_argument("--out-dir", default="poc/shen-ce-vcp/data")
    args = parser.parse_args()

    bars = _load_bars(args.db_path, args.symbol, args.start, args.end)
    if not bars:
        raise SystemExit(f"No bars found for symbol={args.symbol} between {args.start} and {args.end}")

    replay = _build_replay(args.symbol, bars)
    segments = _build_segments(replay)
    price_data = _build_price_data(bars)

    payload = {
        "symbol": args.symbol,
        "start": args.start,
        "end": args.end,
        "bar_count": len(price_data),
        "priceData": price_data,
        "layer1Replay": replay,
        "layer1Segments": segments,
    }

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = f"{args.symbol}_{args.start.replace('-', '')}_{args.end.replace('-', '')}_layer1_replay"
    json_path = out_dir / f"{stem}.json"
    js_path = out_dir / f"{stem}.js"

    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    js_path.write_text(
        "window.VCP_POC_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )

    print(f"Exported JSON: {json_path}")
    print(f"Exported JS:   {js_path}")
    print(f"Bars: {len(price_data)} | Segments: {len(segments)} | Last date: {price_data[-1]['time']}")


if __name__ == "__main__":
    main()

