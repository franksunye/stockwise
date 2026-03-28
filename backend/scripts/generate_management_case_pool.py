#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict, deque
from pathlib import Path


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("DB_SOURCE", "local")

from backend.database import get_connection


def _load_manifest_symbols(path: str | None) -> list[str]:
    if not path:
        return []
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)
    symbols = []
    for item in payload.get("symbols", []):
        if isinstance(item, dict):
            symbol = str(item.get("symbol", "")).strip()
            latest_close = item.get("latest_close")
            priced_days_20d = int(item.get("priced_days_20d", 0) or 0)
            if latest_close is None and priced_days_20d <= 0:
                continue
        else:
            symbol = str(item).strip()
        if symbol:
            symbols.append(symbol)
    return symbols


def _build_in_clause(symbols: list[str]) -> tuple[str, list[str]]:
    placeholders = ",".join("?" for _ in symbols)
    return placeholders, symbols


def fetch_candidates(
    date_from: str,
    date_to: str,
    *,
    manifest_path: str | None = None,
    market: str | None = None,
    model_id: str = "rule-engine",
    strategy_version: str = "tradeability_v2",
    min_price_days: int = 50,
    full_stack_window_from: str = "2025-12-27",
    full_stack_window_to: str = "2026-03-27",
) -> list[dict]:
    manifest_symbols = _load_manifest_symbols(manifest_path)
    conn = get_connection()
    try:
        cur = conn.cursor()
        where_clauses = [
            "ap.date BETWEEN ? AND ?",
            "ap.is_primary = 1",
            "ap.model_id = ?",
        ]
        params: list[object] = [date_from, date_to, model_id]

        if market:
            where_clauses.append("sm.market = ?")
            params.append(market)

        if manifest_symbols:
            placeholders, symbol_params = _build_in_clause(manifest_symbols)
            where_clauses.append(f"ap.symbol IN ({placeholders})")
            params.extend(symbol_params)

        sql = f"""
            WITH price_cov AS (
              SELECT symbol, COUNT(DISTINCT date) AS dcnt
              FROM daily_prices
              WHERE date BETWEEN ? AND ?
              GROUP BY symbol
            ),
            pred_cov AS (
              SELECT DISTINCT symbol
              FROM ai_predictions_v2
              WHERE is_primary = 1
                AND model_id = ?
                AND date BETWEEN ? AND ?
            ),
            trade_cov AS (
              SELECT DISTINCT symbol
              FROM quant_tradeability_signals
              WHERE strategy_version = ?
                AND date BETWEEN ? AND ?
            )
            SELECT
              ap.symbol,
              ap.date,
              COALESCE(sm.name, '') AS name,
              COALESCE(sm.market, '') AS market,
              dp.close,
              COALESCE(ap.layer1_status, ap.signal, 'NoSetup') AS signal_state
            FROM ai_predictions_v2 ap
            JOIN daily_prices dp
              ON dp.symbol = ap.symbol AND dp.date = ap.date
            LEFT JOIN stock_meta sm
              ON sm.symbol = ap.symbol
            JOIN price_cov pc
              ON pc.symbol = ap.symbol AND pc.dcnt >= ?
            JOIN pred_cov pr
              ON pr.symbol = ap.symbol
            JOIN trade_cov tr
              ON tr.symbol = ap.symbol
            WHERE {" AND ".join(where_clauses)}
            ORDER BY ap.date ASC, ap.symbol ASC
            """
        cur.execute(
            sql,
            [
                full_stack_window_from,
                full_stack_window_to,
                model_id,
                full_stack_window_from,
                full_stack_window_to,
                strategy_version,
                full_stack_window_from,
                full_stack_window_to,
                min_price_days,
                *params,
            ],
        )
        rows = cur.fetchall()
    finally:
        conn.close()

    candidates = []
    for symbol, trade_date, name, market, close, signal_state in rows:
        candidates.append(
            {
                "symbol": str(symbol),
                "entry_date": str(trade_date),
                "entry_price": float(close),
                "position_size": 3000.0,
                "name": str(name or ""),
                "market": str(market or ""),
                "signal_state": str(signal_state or "NoSetup"),
            }
        )
    return candidates


def round_robin_by_date(candidates: list[dict], limit: int) -> list[dict]:
    buckets: dict[str, deque] = defaultdict(deque)
    for case in candidates:
        buckets[case["entry_date"]].append(case)

    ordered_dates = sorted(buckets)
    results = []
    while ordered_dates and len(results) < limit:
        next_dates = []
        for date_key in ordered_dates:
            bucket = buckets[date_key]
            if bucket and len(results) < limit:
                results.append(bucket.popleft())
            if bucket:
                next_dates.append(date_key)
        ordered_dates = next_dates
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a management research case pool JSON file")
    parser.add_argument("--date-from", default="2026-03-18")
    parser.add_argument("--date-to", default="2026-03-25")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--market", default=None)
    parser.add_argument("--research-pool-manifest", default=None)
    parser.add_argument("--model-id", default="rule-engine")
    parser.add_argument("--strategy-version", default="tradeability_v2")
    parser.add_argument("--min-price-days", type=int, default=50)
    parser.add_argument("--full-stack-window-from", default="2025-12-27")
    parser.add_argument("--full-stack-window-to", default="2026-03-27")
    parser.add_argument(
        "--output",
        default="backend/management/research/cases/poc_100_cases_20260328.json",
    )
    args = parser.parse_args()

    candidates = fetch_candidates(
        args.date_from,
        args.date_to,
        manifest_path=args.research_pool_manifest,
        market=args.market,
        model_id=args.model_id,
        strategy_version=args.strategy_version,
        min_price_days=args.min_price_days,
        full_stack_window_from=args.full_stack_window_from,
        full_stack_window_to=args.full_stack_window_to,
    )
    selected = round_robin_by_date(candidates, args.limit)

    for case in selected:
        case["label"] = f"{case['symbol']}_{case['entry_date'].replace('-', '')}"
        case["note"] = "auto-generated management case pool from full-stack universe"

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(selected, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        json.dumps(
            {
                "output": str(output_path),
                "date_from": args.date_from,
                "date_to": args.date_to,
                "market": args.market,
                "research_pool_manifest": args.research_pool_manifest,
                "model_id": args.model_id,
                "strategy_version": args.strategy_version,
                "min_price_days": args.min_price_days,
                "full_stack_window_from": args.full_stack_window_from,
                "full_stack_window_to": args.full_stack_window_to,
                "candidate_count": len(candidates),
                "selected_count": len(selected),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
