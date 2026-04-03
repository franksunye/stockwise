"""
Lightweight shadow-universe backfill.

Compared with PredictionRunner-based backfill, this script:
- does not fetch macro/news/context providers
- uses local daily/weekly/monthly prices only
- evaluates Layer-1 locally
- runs RuleAdapter locally

This is intended for fast local lab iterations on expansion manifests.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path

backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_path)
sys.path.insert(0, os.path.dirname(backend_path))

from database import get_connection
from backend.db_repo.queries import SAVE_PREDICTION_V2_QUERY
from backend.engine.layer1_state import build_layer1_snapshot
from backend.engine.models.rule_based import RuleAdapter
from backend.trading_calendar import get_next_trading_day_str


DEFAULT_MODEL_ID = "rule-engine-shadow"
DEFAULT_MODE_ID = "balanced_v1"


def _load_symbols(manifest_path: str) -> list[str]:
    payload = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    symbols = [str(item["symbol"]) for item in payload.get("symbols") or [] if item.get("symbol")]
    if not symbols:
        raise ValueError(f"No symbols found in manifest: {manifest_path}")
    return symbols


def _date_range(start_date: str, end_date: str) -> list[str]:
    from datetime import date, timedelta

    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    out: list[str] = []
    cur = start
    while cur <= end:
        out.append(cur.isoformat())
        cur += timedelta(days=1)
    return out


def _load_history(cur, symbol: str, date_str: str) -> list[dict]:
    rows = cur.execute(
        """
        SELECT date, open, high, low, close, volume, ma5, ma10, ma20, macd_hist, change_percent
        FROM daily_prices
        WHERE symbol = ? AND date <= ?
        ORDER BY date ASC
        """,
        (symbol, date_str),
    ).fetchall()
    return [
        {
            "date": str(row[0]),
            "open": float(row[1]) if row[1] is not None else 0.0,
            "high": float(row[2]) if row[2] is not None else 0.0,
            "low": float(row[3]) if row[3] is not None else 0.0,
            "close": float(row[4]) if row[4] is not None else 0.0,
            "volume": float(row[5]) if row[5] is not None else 0.0,
            "ma5": float(row[6]) if row[6] is not None else 0.0,
            "ma10": float(row[7]) if row[7] is not None else 0.0,
            "ma20": float(row[8]) if row[8] is not None else 0.0,
            "macd_hist": float(row[9]) if row[9] is not None else 0.0,
            "change_percent": float(row[10]) if row[10] is not None else 0.0,
        }
        for row in rows
    ]


async def _predict(rule_model: RuleAdapter, symbol: str, date_str: str, daily_history: list[dict]) -> dict | None:
    layer1 = build_layer1_snapshot(symbol=symbol, daily_history=daily_history)
    prediction = await rule_model.predict(
        symbol,
        date_str,
        {
            "daily_prices": daily_history,
            "layer1": {
                "status": layer1.setup_state,
                "score": layer1.opportunity_score,
                "trigger_rule_hit": layer1.trigger_rule_hit,
                "risk_off_hit": layer1.risk_off_hit,
                "strategy_version": layer1.strategy_version,
                "payload": layer1.payload,
            },
        },
    )
    if not prediction:
        return None
    prediction["layer1"] = layer1
    prediction["target_date"] = get_next_trading_day_str(date_str, symbol=symbol)
    return prediction


def main() -> None:
    parser = argparse.ArgumentParser(description="Lightweight local shadow backfill with rule-engine only.")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--start-date", required=True)
    parser.add_argument("--end-date", required=True)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--model-id", default=DEFAULT_MODEL_ID)
    parser.add_argument("--mode-id", default=DEFAULT_MODE_ID)
    parser.add_argument("--set-primary", action="store_true")
    args = parser.parse_args()

    symbols = _load_symbols(args.manifest)
    conn = get_connection()
    cur = conn.cursor()
    model = RuleAdapter(args.model_id, {"display_name": "Rule Engine Shadow", "capabilities_json": {}})

    success_rows = 0
    skipped_rows = 0
    processed = []
    now_text = datetime.now().isoformat(timespec="seconds")

    try:
        for date_str in _date_range(args.start_date, args.end_date):
            for symbol in symbols:
                day_row = cur.execute(
                    "SELECT 1 FROM daily_prices WHERE symbol = ? AND date = ? LIMIT 1",
                    (symbol, date_str),
                ).fetchone()
                if not day_row:
                    skipped_rows += 1
                    continue

                if not args.force:
                    exists = cur.execute(
                        "SELECT 1 FROM ai_predictions_v2 WHERE symbol = ? AND date = ? AND model_id = ? LIMIT 1",
                        (symbol, date_str, args.model_id),
                    ).fetchone()
                    if exists:
                        skipped_rows += 1
                        continue

                history = _load_history(cur, symbol, date_str)
                if len(history) < 20:
                    skipped_rows += 1
                    continue

                prediction = asyncio.run(_predict(model, symbol, date_str, history))
                if not prediction:
                    skipped_rows += 1
                    continue

                layer1 = prediction["layer1"]
                content_locale = prediction.get("content_locale", "cn")
                if args.set_primary:
                    cur.execute(
                        "UPDATE ai_predictions_v2 SET is_primary = 0 WHERE symbol = ? AND date = ? AND COALESCE(content_locale, 'cn') = ?",
                        (symbol, date_str, content_locale),
                    )
                cur.execute(
                    SAVE_PREDICTION_V2_QUERY,
                    (
                        symbol,
                        date_str,
                        args.model_id,
                        prediction.get("target_date"),
                        prediction.get("signal"),
                        prediction.get("confidence"),
                        prediction.get("support_price"),
                        prediction.get("pressure_price"),
                        prediction.get("reasoning"),
                        prediction.get("prompt_version", "shadow_v1"),
                        prediction.get("token_usage_input", 0),
                        prediction.get("token_usage_output", 0),
                        prediction.get("execution_time_ms", 0),
                        1 if args.set_primary else 0,
                        f"{args.model_id}-{symbol}-{date_str}",
                        layer1.setup_state,
                        layer1.opportunity_score,
                        layer1.trigger_rule_hit,
                        layer1.risk_off_hit,
                        layer1.strategy_version,
                        json.dumps(layer1.payload, ensure_ascii=False),
                        args.mode_id,
                        content_locale,
                    ),
                )
                success_rows += 1
                processed.append({"symbol": symbol, "date": date_str, "setup_state": layer1.setup_state})

        conn.commit()
    finally:
        conn.close()

    print(
        json.dumps(
            {
                "manifest": args.manifest,
                "symbols": len(symbols),
                "success_rows": success_rows,
                "skipped_rows": skipped_rows,
                "processed_preview": processed[:20],
                "model_id": args.model_id,
                "set_primary": args.set_primary,
                "mode_id": args.mode_id,
                "run_at": now_text,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
