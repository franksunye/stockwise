"""
Backfill local comparison rows in ai_predictions_v2 for alternate Layer-1 strategy versions.

Purpose:
1) Recompute Layer-1 status from daily_prices history for existing prediction rows.
2) Insert non-primary mirror rows with version-specific model_id suffixes.
3) Enable local acceptance/promotion comparisons across tradeability versions.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Sequence, Tuple

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from logger import logger
from backend.engine.layer1_state import evaluate_layer1_state, list_supported_strategy_versions, load_market_params


INSERT_SQL = """
INSERT INTO ai_predictions_v2
(symbol, date, model_id, target_date, signal, confidence, layer1_status, layer1_score, layer1_trigger_hit,
 layer1_risk_off_hit, layer1_strategy_version, layer1_payload, mode_id, support_price, pressure_price,
 ai_reasoning, prompt_version, token_usage_input, token_usage_output, execution_time_ms, validation_status,
 actual_change, validation_data, max_perf_in_window, is_primary, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
ON CONFLICT(symbol, date, model_id) DO UPDATE SET
  signal=excluded.signal,
  confidence=excluded.confidence,
  layer1_status=excluded.layer1_status,
  layer1_score=excluded.layer1_score,
  layer1_trigger_hit=excluded.layer1_trigger_hit,
  layer1_risk_off_hit=excluded.layer1_risk_off_hit,
  layer1_strategy_version=excluded.layer1_strategy_version,
  layer1_payload=excluded.layer1_payload,
  target_date=excluded.target_date,
  mode_id=excluded.mode_id,
  support_price=excluded.support_price,
  pressure_price=excluded.pressure_price,
  ai_reasoning=excluded.ai_reasoning,
  prompt_version=excluded.prompt_version,
  token_usage_input=excluded.token_usage_input,
  token_usage_output=excluded.token_usage_output,
  execution_time_ms=excluded.execution_time_ms,
  validation_status=excluded.validation_status,
  actual_change=excluded.actual_change,
  validation_data=excluded.validation_data,
  max_perf_in_window=excluded.max_perf_in_window,
  updated_at=excluded.updated_at
"""


def _parse_versions(raw: str) -> List[str]:
    versions = [x.strip() for x in raw.split(",") if x.strip()]
    valid = set(list_supported_strategy_versions())
    unknown = [x for x in versions if x not in valid]
    if unknown:
        raise ValueError(f"Unsupported strategy versions: {unknown}. Supported: {sorted(valid)}")
    return versions


def _fetch_prediction_rows(start_date: str | None, end_date: str | None, market: str | None) -> List[Dict[str, object]]:
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
        rows = cur.execute(
            f"""
            SELECT
              p.symbol, p.date, p.model_id, p.target_date, p.signal, p.confidence,
              p.mode_id, p.support_price, p.pressure_price, p.ai_reasoning, p.prompt_version,
              p.token_usage_input, p.token_usage_output, p.execution_time_ms, p.validation_status,
              p.actual_change, p.validation_data, p.max_perf_in_window, p.created_at, p.updated_at,
              sm.market
            FROM ai_predictions_v2 p
            JOIN stock_meta sm ON sm.symbol = p.symbol
            WHERE {' AND '.join(where)}
            ORDER BY p.symbol, p.date, p.model_id
            """,
            tuple(params),
        ).fetchall()
        out: List[Dict[str, object]] = []
        for row in rows:
            out.append(
                {
                    "symbol": str(row[0]),
                    "date": str(row[1]),
                    "model_id": str(row[2]),
                    "target_date": str(row[3]),
                    "signal": row[4],
                    "confidence": row[5],
                    "mode_id": row[6],
                    "support_price": row[7],
                    "pressure_price": row[8],
                    "ai_reasoning": row[9],
                    "prompt_version": row[10],
                    "token_usage_input": row[11],
                    "token_usage_output": row[12],
                    "execution_time_ms": row[13],
                    "validation_status": row[14],
                    "actual_change": row[15],
                    "validation_data": row[16],
                    "max_perf_in_window": row[17],
                    "created_at": row[18],
                    "updated_at": row[19],
                    "market": str(row[20]),
                }
            )
        return out
    finally:
        conn.close()


def _load_histories(rows: Sequence[Dict[str, object]]) -> Dict[str, List[Dict[str, float]]]:
    requests: Dict[str, Tuple[str, str]] = {}
    for row in rows:
        symbol = str(row["symbol"])
        end_date = str(row["date"])
        current = requests.get(symbol)
        if current is None or end_date > current[1]:
            requests[symbol] = (symbol, end_date)

    conn = get_connection()
    try:
        cur = conn.cursor()
        out: Dict[str, List[Dict[str, float]]] = {}
        for symbol, (_, max_date) in requests.items():
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


def _history_slice(history: Sequence[Dict[str, float]], target_date: str) -> List[Dict[str, float]]:
    return [item for item in history if str(item["date"]) <= target_date]


def backfill_prediction_variants(
    *,
    strategy_versions: Sequence[str],
    start_date: str | None,
    end_date: str | None,
    market: str | None,
) -> Dict[str, object]:
    base_rows = _fetch_prediction_rows(start_date=start_date, end_date=end_date, market=market)
    if not base_rows:
        raise RuntimeError("No primary prediction rows found for the requested window.")

    histories = _load_histories(base_rows)
    params_by_market: Dict[Tuple[str, str], Dict[str, float]] = {}
    pending: List[tuple] = []
    inserted_counts = defaultdict(int)
    skipped_short_history = 0

    now_text = datetime.now().isoformat(timespec="seconds")
    for row in base_rows:
        symbol = str(row["symbol"])
        date_str = str(row["date"])
        market_code = str(row["market"])
        history = _history_slice(histories.get(symbol, []), date_str)
        if len(history) < 20:
            skipped_short_history += 1
            continue

        for version in strategy_versions:
            params = params_by_market.get((market_code, version))
            if params is None:
                _, params = load_market_params(market=market_code, strategy_version=version)
                params_by_market[(market_code, version)] = params
            snapshot = evaluate_layer1_state(history, params=params, strategy_version=version)
            variant_model_id = f"{row['model_id']}__{version}"
            pending.append(
                (
                    symbol,
                    date_str,
                    variant_model_id,
                    row["target_date"],
                    row["signal"],
                    row["confidence"],
                    snapshot.setup_state,
                    float(snapshot.opportunity_score),
                    int(snapshot.trigger_rule_hit),
                    int(snapshot.risk_off_hit),
                    version,
                    json.dumps(snapshot.payload, ensure_ascii=False),
                    row["mode_id"],
                    row["support_price"],
                    row["pressure_price"],
                    row["ai_reasoning"],
                    row["prompt_version"],
                    row["token_usage_input"],
                    row["token_usage_output"],
                    row["execution_time_ms"],
                    row["validation_status"],
                    row["actual_change"],
                    row["validation_data"],
                    row["max_perf_in_window"],
                    row["created_at"] or now_text,
                    now_text,
                )
            )
            inserted_counts[version] += 1

    conn = get_connection()
    try:
        cur = conn.cursor()
        batch_size = 2000
        for idx in range(0, len(pending), batch_size):
            cur.executemany(INSERT_SQL, pending[idx : idx + batch_size])
            conn.commit()
    finally:
        conn.close()

    return {
        "strategy_versions": list(strategy_versions),
        "rows_considered": len(base_rows),
        "rows_upserted": len(pending),
        "rows_upserted_by_version": dict(inserted_counts),
        "skipped_short_history": skipped_short_history,
        "market": market or "ALL",
        "start_date": start_date,
        "end_date": end_date,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill local ai_predictions_v2 mirror rows for Layer-1 strategy versions.")
    parser.add_argument("--strategy-versions", default="tradeability_v1")
    parser.add_argument("--start-date", default="")
    parser.add_argument("--end-date", default="")
    parser.add_argument("--market", choices=["CN", "HK"], default="")
    args = parser.parse_args()

    payload = backfill_prediction_variants(
        strategy_versions=_parse_versions(args.strategy_versions),
        start_date=args.start_date or None,
        end_date=args.end_date or None,
        market=args.market or None,
    )
    payload["run_at"] = datetime.now().isoformat(timespec="seconds")
    logger.info(f"Layer1 prediction variant backfill done: {payload}")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
