"""
Backfill missing Layer-1 fields for existing primary predictions.

Purpose:
1) Recompute Layer-1 state for primary ai_predictions_v2 rows from daily_prices history.
2) Fill layer1_status/layer1_score/layer1_trigger_hit/layer1_risk_off_hit/layer1_strategy_version/layer1_payload.
3) Repair local validation datasets where historical predictions lack structured Layer-1 metadata.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Tuple

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from backend.engine.layer1_state import DEFAULT_STRATEGY_VERSION, evaluate_layer1_state, load_market_params


UPDATE_SQL = """
UPDATE ai_predictions_v2
SET layer1_status = ?,
    layer1_score = ?,
    layer1_trigger_hit = ?,
    layer1_risk_off_hit = ?,
    layer1_strategy_version = ?,
    layer1_payload = ?,
    updated_at = ?
WHERE symbol = ? AND date = ? AND model_id = ? AND is_primary = 1
"""


def _fetch_target_rows(
    *,
    start_date: str | None,
    end_date: str | None,
    market: str | None,
    strategy_version: str,
    fill_only_missing: bool,
) -> List[Dict[str, object]]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        where = ["p.is_primary = 1"]
        params: List[object] = []
        if start_date:
            where.append("p.date >= ?")
            params.append(start_date)
        if end_date:
            where.append("p.date <= ?")
            params.append(end_date)
        if market:
            where.append("sm.market = ?")
            params.append(market)
        if fill_only_missing:
            where.append("(p.layer1_status IS NULL OR p.layer1_status = '' OR COALESCE(NULLIF(p.layer1_strategy_version, ''), ?) <> ?)")
            params.extend([strategy_version, strategy_version])
        rows = cur.execute(
            f"""
            SELECT p.symbol, p.date, p.model_id, sm.market
            FROM ai_predictions_v2 p
            JOIN stock_meta sm ON sm.symbol = p.symbol
            WHERE {' AND '.join(where)}
            ORDER BY p.date ASC, p.symbol ASC, p.model_id ASC
            """,
            tuple(params),
        ).fetchall()
        return [
            {
                "symbol": str(row[0]),
                "date": str(row[1]),
                "model_id": str(row[2]),
                "market": str(row[3]),
            }
            for row in rows
        ]
    finally:
        conn.close()


def _load_histories(rows: List[Dict[str, object]]) -> Dict[str, List[Dict[str, float]]]:
    requests: Dict[str, str] = {}
    for row in rows:
        symbol = str(row["symbol"])
        date_str = str(row["date"])
        current = requests.get(symbol)
        if current is None or date_str > current:
            requests[symbol] = date_str

    conn = get_connection()
    try:
        cur = conn.cursor()
        out: Dict[str, List[Dict[str, float]]] = {}
        for symbol, max_date in requests.items():
            hist_rows = cur.execute(
                """
                SELECT date, high, low, close, volume, ma5, ma10, ma20, macd_hist, change_percent
                FROM daily_prices
                WHERE symbol = ? AND date <= ?
                ORDER BY date ASC
                """,
                (symbol, max_date),
            ).fetchall()
            out[symbol] = [
                {
                    "date": str(item[0]),
                    "high": float(item[1]) if item[1] is not None else 0.0,
                    "low": float(item[2]) if item[2] is not None else 0.0,
                    "close": float(item[3]) if item[3] is not None else 0.0,
                    "volume": float(item[4]) if item[4] is not None else 0.0,
                    "ma5": float(item[5]) if item[5] is not None else 0.0,
                    "ma10": float(item[6]) if item[6] is not None else 0.0,
                    "ma20": float(item[7]) if item[7] is not None else 0.0,
                    "macd_hist": float(item[8]) if item[8] is not None else 0.0,
                    "change_percent": float(item[9]) if item[9] is not None else 0.0,
                }
                for item in hist_rows
            ]
        return out
    finally:
        conn.close()


def backfill_primary_layer1_fields(
    *,
    strategy_version: str,
    start_date: str | None,
    end_date: str | None,
    market: str | None,
    fill_only_missing: bool,
    params_file: str | None = None,
) -> Dict[str, object]:
    rows = _fetch_target_rows(
        start_date=start_date,
        end_date=end_date,
        market=market,
        strategy_version=strategy_version,
        fill_only_missing=fill_only_missing,
    )
    if not rows:
        return {
            "strategy_version": strategy_version,
            "rows_considered": 0,
            "rows_updated": 0,
            "market": market or "ALL",
            "start_date": start_date,
            "end_date": end_date,
        }

    histories = _load_histories(rows)
    params_by_market: Dict[str, Dict[str, float]] = {}
    updates: List[Tuple[object, ...]] = []
    skipped_short_history = 0
    now_text = datetime.now().isoformat(timespec="seconds")

    for row in rows:
        market_code = str(row["market"])
        params = params_by_market.get(market_code)
        if params is None:
            _, params = load_market_params(
                market=market_code,
                strategy_version=strategy_version,
                params_file=params_file,
            )
            params_by_market[market_code] = params
        symbol = str(row["symbol"])
        date_str = str(row["date"])
        history = [item for item in histories.get(symbol, []) if str(item["date"]) <= date_str]
        if len(history) < 20:
            skipped_short_history += 1
            continue
        snapshot = evaluate_layer1_state(history, params=params, strategy_version=strategy_version)
        updates.append(
            (
                snapshot.setup_state,
                float(snapshot.opportunity_score),
                int(snapshot.trigger_rule_hit),
                int(snapshot.risk_off_hit),
                strategy_version,
                json.dumps(snapshot.payload, ensure_ascii=False),
                now_text,
                symbol,
                date_str,
                str(row["model_id"]),
            )
        )

    conn = get_connection()
    try:
        cur = conn.cursor()
        batch_size = 2000
        for idx in range(0, len(updates), batch_size):
            cur.executemany(UPDATE_SQL, updates[idx : idx + batch_size])
            conn.commit()
    finally:
        conn.close()

    return {
        "strategy_version": strategy_version,
        "rows_considered": len(rows),
        "rows_updated": len(updates),
        "skipped_short_history": skipped_short_history,
        "market": market or "ALL",
        "start_date": start_date,
        "end_date": end_date,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill missing Layer-1 fields for primary predictions.")
    parser.add_argument("--strategy-version", default=DEFAULT_STRATEGY_VERSION)
    parser.add_argument("--start-date", default="")
    parser.add_argument("--end-date", default="")
    parser.add_argument("--market", choices=["CN", "HK"], default="")
    parser.add_argument("--fill-only-missing", action="store_true", help="Only update rows with missing/mismatched Layer-1 fields.")
    parser.add_argument("--params-file", default="", help="Optional local params file override.")
    args = parser.parse_args()

    payload = backfill_primary_layer1_fields(
        strategy_version=args.strategy_version.strip() or DEFAULT_STRATEGY_VERSION,
        start_date=args.start_date or None,
        end_date=args.end_date or None,
        market=args.market or None,
        fill_only_missing=args.fill_only_missing,
        params_file=args.params_file or None,
    )
    payload["run_at"] = datetime.now().isoformat(timespec="seconds")
    logger.info(f"Primary Layer1 backfill done: {payload}")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
