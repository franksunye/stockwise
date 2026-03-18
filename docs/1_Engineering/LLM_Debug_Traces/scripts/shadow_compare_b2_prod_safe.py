import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

WORKSPACE_ROOT = "/Users/yesun/Code/stockwise"
sys.path.insert(0, WORKSPACE_ROOT)

from backend.database import get_connection
from backend.engine.layer1_state import build_layer1_snapshot
from backend.engine.llm_client import LLMClient
from backend.engine.parsers import parse_ai_response_with_diagnostics
from backend.engine.prompts import fetch_ai_history_for_model, prepare_stock_analysis_prompt
from backend.engine.schema_normalizer import normalize_ai_response


BASE_DIR = Path(WORKSPACE_ROOT) / "docs" / "7_Debug_Traces"
RESULTS_DIR = BASE_DIR / "results" / "shadow_runs"


def _load_local_context(symbol: str, as_of_date: str) -> Dict[str, Any]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM daily_prices WHERE symbol = ? AND date <= ? ORDER BY date DESC LIMIT 30",
            (symbol, as_of_date),
        )
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        daily = [dict(zip(cols, r)) for r in rows][::-1]
        if not daily:
            raise RuntimeError(f"No local daily data for {symbol} <= {as_of_date}")

        latest = daily[-1]

        cur.execute(
            """
            SELECT date, open, high, low, close, change_percent, volume, ma20, rsi, macd_hist
            FROM weekly_prices
            WHERE symbol = ? AND date <= ?
            ORDER BY date DESC LIMIT 12
            """,
            (symbol, as_of_date),
        )
        weekly = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]

        cur.execute(
            """
            SELECT date, open, high, low, close, change_percent, volume, ma20, rsi, macd_hist
            FROM monthly_prices
            WHERE symbol = ? AND date <= ?
            ORDER BY date DESC LIMIT 12
            """,
            (symbol, as_of_date),
        )
        monthly = [dict(zip([d[0] for d in cur.description], r)) for r in cur.fetchall()]
    finally:
        conn.close()

    layer1 = build_layer1_snapshot(symbol=symbol, daily_history=daily)
    hist = fetch_ai_history_for_model(symbol, latest["date"], model_id="gemini-3-flash")
    return {
        "name": symbol,
        "latest_data": latest,
        "daily_prices": daily,
        "weekly_prices": weekly,
        "monthly_prices": monthly,
        "profile": {"industry": "未知", "main_business": "暂无", "description": "shadow validation"},
        "market_context": "本地 shadow validation",
        "altitude_context": {"short_term_20d": "-", "medium_term_60d": "-", "long_term_250d": "-"},
        "macro_context": {},
        "market_flow_context": {},
        "stock_flow_context": {},
        "ai_history": hist.get("ai_history", []),
        "accuracy": hist.get("accuracy", {"total": 0, "rate": 0}),
        "layer1": {
            "status": layer1.setup_state,
            "score": layer1.opportunity_score,
            "trigger_rule_hit": layer1.trigger_rule_hit,
            "risk_off_hit": layer1.risk_off_hit,
            "strategy_version": layer1.strategy_version,
            "payload": layer1.payload,
        },
    }


def _eval_content(content: str, meta: Dict[str, Any]) -> Dict[str, Any]:
    try:
        parsed_model, diag = parse_ai_response_with_diagnostics(content or "")
        raw = parsed_model.model_dump(mode="json") if parsed_model else {}
        normalized = normalize_ai_response(dict(raw)) if raw else {}
        parse_success = True
        parse_error = None
        diagnostics = diag.__dict__
    except Exception as exc:
        raw = {}
        normalized = {}
        parse_success = False
        parse_error = str(exc)
        diagnostics = None
    return {
        "meta": meta,
        "parser": {
            "parse_success": parse_success,
            "parse_error": parse_error,
            "diagnostics": diagnostics,
        },
        "raw_signal": raw.get("signal"),
        "raw_confidence": raw.get("confidence"),
        "normalized_signal": normalized.get("signal"),
        "summary": raw.get("summary"),
        "normalized_tactics_keys": list((normalized.get("tactics") or {}).keys()),
        "normalized_key_levels": normalized.get("key_levels"),
        "raw_content_head": (content or "")[:1500],
    }


async def _run_variant(
    *,
    client: LLMClient,
    symbol: str,
    as_of_date: str,
    ctx: Dict[str, Any],
    variant: str,
    temperature: float,
    max_tokens: int,
) -> Dict[str, Any]:
    previous = os.environ.get("STOCK_ANALYSIS_PROMPT_VARIANT")
    try:
        os.environ["STOCK_ANALYSIS_PROMPT_VARIANT"] = variant
        result = prepare_stock_analysis_prompt(symbol, as_of_date, ctx=ctx)
        if len(result) == 3:
            system_prompt, user_prompt, prompt_version = result
        else:
            system_prompt, user_prompt = result
            prompt_version = "unknown"

        started = time.time()
        content, meta = await client.chat_async(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        elapsed = round(time.time() - started, 3)
        payload = _eval_content(content or "", meta or {})
        payload.update(
            {
                "variant": variant,
                "prompt_version": prompt_version,
                "latency_s": elapsed,
                "prompt_preview": {
                    "system_head": system_prompt.splitlines()[:6],
                    "user_head": user_prompt.splitlines()[:12],
                },
            }
        )
        return payload
    finally:
        if previous is None:
            os.environ.pop("STOCK_ANALYSIS_PROMPT_VARIANT", None)
        else:
            os.environ["STOCK_ANALYSIS_PROMPT_VARIANT"] = previous


async def main() -> int:
    parser = argparse.ArgumentParser(description="Shadow compare legacy vs B2_PROD_SAFE without writing DB.")
    parser.add_argument("--symbol", default="300502")
    parser.add_argument("--date", default="2026-03-12")
    parser.add_argument("--provider", default="gemini_local")
    parser.add_argument("--model", default="gemini-3-flash")
    parser.add_argument("--base-url", default="http://127.0.0.1:8045")
    parser.add_argument("--api-key", default="dummy")
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--max-tokens", type=int, default=12000)
    parser.add_argument("--cooldown-s", type=float, default=5.0)
    args = parser.parse_args()

    ctx = _load_local_context(args.symbol, args.date)
    client = LLMClient(args.provider, base_url=args.base_url, model=args.model, api_key=args.api_key)

    legacy = await _run_variant(
        client=client,
        symbol=args.symbol,
        as_of_date=args.date,
        ctx=ctx,
        variant="legacy",
        temperature=args.temperature,
        max_tokens=args.max_tokens,
    )
    if args.cooldown_s > 0:
        await asyncio.sleep(args.cooldown_s)
    b2_prod_safe = await _run_variant(
        client=client,
        symbol=args.symbol,
        as_of_date=args.date,
        ctx=ctx,
        variant="b2",
        temperature=args.temperature,
        max_tokens=args.max_tokens,
    )

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = RESULTS_DIR / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    summary = {
        "symbol": args.symbol,
        "date": args.date,
        "layer1_status": (ctx.get("layer1") or {}).get("status"),
        "legacy": {
            "prompt_version": legacy["prompt_version"],
            "latency_s": legacy["latency_s"],
            "total_tokens": legacy["meta"].get("total_tokens"),
            "raw_signal": legacy["raw_signal"],
            "normalized_signal": legacy["normalized_signal"],
            "summary": legacy["summary"],
        },
        "b2_prod_safe": {
            "prompt_version": b2_prod_safe["prompt_version"],
            "latency_s": b2_prod_safe["latency_s"],
            "total_tokens": b2_prod_safe["meta"].get("total_tokens"),
            "raw_signal": b2_prod_safe["raw_signal"],
            "normalized_signal": b2_prod_safe["normalized_signal"],
            "summary": b2_prod_safe["summary"],
        },
    }
    payload = {"summary": summary, "legacy": legacy, "b2_prod_safe": b2_prod_safe}

    (output_dir / "comparison.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"\nSaved shadow compare to {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
