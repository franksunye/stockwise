import json
import os
from typing import Any

import pandas as pd

from config import LLM_CONFIG
from database import get_connection
from logger import logger
from trading_calendar import get_next_trading_day_str
from .llm_client import get_llm_client
from .layer1_state import build_layer1_snapshot
from .prompts import prepare_stock_analysis_prompt

try:
    from backend.db_repo.queries import SAVE_PREDICTION_V2_QUERY
except ImportError:
    from db_repo.queries import SAVE_PREDICTION_V2_QUERY


def generate_ai_prediction(symbol: str, today_data: pd.Series, mode: str = 'ai', as_of_date: str = None):
    """
    Generate T+1 prediction from today's data.

    This function is kept for legacy compatibility. New production pipeline uses
    backend.engine.runner.PredictionRunner.
    """
    today_str = today_data.get('date')
    if not today_str:
        return None

    is_llm_enabled = LLM_CONFIG.get("enabled", False)
    if is_llm_enabled and mode == 'ai':
        try:
            logger.info(f"   🤖 正在为 {symbol} 调用 {LLM_CONFIG.get('provider', 'LLM').upper()} 进行分析...")
            system_prompt, user_prompt = prepare_stock_analysis_prompt(symbol, as_of_date=as_of_date)

            client = get_llm_client()
            ai_result = client.generate_stock_prediction(system_prompt, user_prompt, symbol=symbol)

            if ai_result and "signal" in ai_result:
                ai_result["is_llm"] = True

                ai_result = _apply_directional_guardrail(ai_result, symbol)

                model_name = ai_result.get("model") or LLM_CONFIG.get("model", "unknown-llm")
                return _process_and_store_prediction(symbol, today_str, ai_result, model=model_name)

            logger.warning("   ⚠️ LLM 返回结果无效 (缺失 signal)，将退回到规则引擎。")
        except Exception as e:
            logger.error(f"   ❌ LLM 调用异常: {e}，将退回到规则引擎。")
    else:
        reason = "LLM 已禁用" if not is_llm_enabled else "分析模式非 AI"
        logger.info(f"   ⚪ 跳过 LLM 分析 ({reason})，正在进入规则引擎...")

    return _generate_rule_based_prediction(symbol, today_data)


def _model_exists(cursor, model_id: str) -> bool:
    cursor.execute("SELECT 1 FROM prediction_models WHERE model_id = ? LIMIT 1", (model_id,))
    return cursor.fetchone() is not None

def _get_guardrail_config() -> tuple[float, str]:
    """
    Directional guardrail config.
    - AI_DIRECTIONAL_CONFIDENCE_THRESHOLD: low-confidence threshold for Long/Short signals.
    - AI_CIRCUIT_MODE:
      - warn (default): log low-confidence directional signal, keep original signal.
      - force_side: legacy mode, downgrade low-confidence Long/Short to Side.
      - off: disable guardrail.
    """
    threshold_raw = os.getenv("AI_DIRECTIONAL_CONFIDENCE_THRESHOLD", "0.75")
    mode = os.getenv("AI_CIRCUIT_MODE", "warn").strip().lower()
    if mode not in {"warn", "force_side", "off"}:
        mode = "warn"
    try:
        threshold = float(threshold_raw)
    except Exception:
        threshold = 0.75
    return threshold, mode


def _apply_directional_guardrail(ai_result: dict[str, Any], symbol: str) -> dict[str, Any]:
    threshold, mode = _get_guardrail_config()
    if mode == "off":
        return ai_result

    raw_signal = ai_result.get("signal", "Side")
    raw_confidence = ai_result.get("confidence", 0.0)
    try:
        confidence = float(raw_confidence)
    except Exception:
        confidence = 0.0

    if raw_signal in ["Long", "Short"] and confidence < threshold:
        logger.warning(
            f"   🛡️ 风控提示: {symbol} 原始信号 {raw_signal} "
            f"(置信度 {confidence:.2f} < {threshold:.2f}) [mode={mode}]"
        )
        if mode == "force_side":
            ai_result["signal"] = "Side"
            ai_result["confidence"] = 0.5
            original_summary = ai_result.get("summary", "")
            ai_result["summary"] = (
                f"[系统风控] 原始信心不足({confidence:.0%})，强制防御。{original_summary}"
            )

    return ai_result


def _normalize_model_id(raw_model: str, is_llm: bool) -> str:
    model = (raw_model or "").strip()
    lowered = model.lower()

    if lowered in {"rule", "rule-engine", "rule_engine", "rule-based", "rule_based"}:
        return "rule-engine"

    if not model:
        return "legacy-ai" if is_llm else "rule-engine"

    return model


def _ensure_model_exists(cursor, model_id: str) -> None:
    if _model_exists(cursor, model_id):
        return

    display_name = "量化规则引擎 (Legacy Path)" if model_id == "rule-engine" else f"Legacy {model_id}"
    provider = "rule-engine" if model_id == "rule-engine" else "legacy"
    priority = 50 if model_id == "rule-engine" else 0

    # New schema includes roles. Fallback for older schema.
    try:
        cursor.execute(
            """
            INSERT OR IGNORE INTO prediction_models
            (model_id, display_name, provider, is_active, priority, roles, config_json, capabilities_json)
            VALUES (?, ?, ?, 0, ?, ?, '{}', '{}')
            """,
            (model_id, display_name, provider, priority, '["prediction"]')
        )
    except Exception:
        cursor.execute(
            """
            INSERT OR IGNORE INTO prediction_models
            (model_id, display_name, provider, is_active, priority, config_json, capabilities_json)
            VALUES (?, ?, ?, 0, ?, '{}', '{}')
            """,
            (model_id, display_name, provider, priority)
        )


def _resolve_model_id(cursor, raw_model: str, is_llm: bool) -> str:
    model_id = _normalize_model_id(raw_model, is_llm)
    if _model_exists(cursor, model_id):
        return model_id

    # Rule path must remain visible to free-tier filters.
    if not is_llm:
        return "rule-engine"

    # Prefer existing stable fallback to avoid FK issues.
    if _model_exists(cursor, "legacy-ai"):
        return "legacy-ai"
    if _model_exists(cursor, "rule-engine"):
        return "rule-engine"

    return model_id


def _to_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(value)
    except Exception:
        return default


def _fetch_daily_history_for_layer1(cursor, symbol: str, date: str) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT date, high, low, close, volume, ma5, ma10, ma20, macd_hist, change_percent
        FROM daily_prices
        WHERE symbol = ? AND date <= ?
        ORDER BY date DESC
        LIMIT 30
        """,
        (symbol, date),
    )
    rows = cursor.fetchall()
    rows = list(reversed(rows))
    history: list[dict[str, Any]] = []
    for row in rows:
        history.append(
            {
                "date": row[0],
                "high": row[1],
                "low": row[2],
                "close": row[3],
                "volume": row[4],
                "ma5": row[5],
                "ma10": row[6],
                "ma20": row[7],
                "macd_hist": row[8],
                "change_percent": row[9],
            }
        )
    return history


def _process_and_store_prediction(symbol, date, ai_result, model="rule-based"):
    """Store prediction to ai_predictions_v2 only (legacy table write frozen)."""
    conn = get_connection()
    cursor = conn.cursor()

    signal = ai_result.get("signal", "Side")
    confidence = ai_result.get("confidence", 0.5)
    key_levels = ai_result.get("key_levels", {}) or {}
    support_price = key_levels.get("support", 0)
    pressure_price = key_levels.get("resistance", 0)

    target_date = get_next_trading_day_str(date, symbol=symbol)
    reasoning = json.dumps(ai_result, ensure_ascii=False)

    model_id = _resolve_model_id(cursor, model, is_llm=bool(ai_result.get("is_llm")))
    _ensure_model_exists(cursor, model_id)
    layer1_snapshot = build_layer1_snapshot(
        symbol=symbol,
        daily_history=_fetch_daily_history_for_layer1(cursor, symbol=symbol, date=date),
    )
    layer1_payload_json = json.dumps(layer1_snapshot.payload, ensure_ascii=False)

    trace_id = str(ai_result.get("trace_id") or f"legacy-{symbol}-{date}-{model_id}")

    # Legacy path yields one result; keep primary ownership deterministic.
    cursor.execute("UPDATE ai_predictions_v2 SET is_primary = 0 WHERE symbol = ? AND date = ?", (symbol, date))
    cursor.execute(
        SAVE_PREDICTION_V2_QUERY,
        (
            symbol,
            date,
            model_id,
            target_date,
            signal,
            confidence,
            support_price,
            pressure_price,
            reasoning,
            "legacy-ai-service-v2",
            _to_int(ai_result.get("token_usage_input"), 0),
            _to_int(ai_result.get("token_usage_output"), 0),
            _to_int(ai_result.get("execution_time_ms"), 0),
            1,
            trace_id,
            layer1_snapshot.setup_state,
            layer1_snapshot.opportunity_score,
            layer1_snapshot.trigger_rule_hit,
            layer1_snapshot.risk_off_hit,
            layer1_snapshot.strategy_version,
            layer1_payload_json,
        ),
    )

    conn.commit()
    conn.close()

    source = "AI" if ai_result.get("is_llm") else "Rule"
    print(f"   🔮 {source} 建议 ({date}): 信号={signal}, 置信度={confidence:.0%}, 模型={model_id}")

    return ai_result


def _generate_rule_based_prediction(symbol: str, today_data: pd.Series):
    """Rule-engine fallback prediction logic."""
    today_str = today_data.get('date')

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM monthly_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
    m_row = cursor.fetchone()
    if m_row:
        m_cols = [d[0] for d in cursor.description]
        monthly_series = pd.Series(dict(zip(m_cols, m_row)))
    else:
        monthly_series = None

    cursor.execute("SELECT * FROM weekly_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1", (symbol,))
    w_row = cursor.fetchone()
    if w_row:
        w_cols = [d[0] for d in cursor.description]
        weekly_series = pd.Series(dict(zip(w_cols, w_row)))
    else:
        weekly_series = None

    conn.close()

    from backend.quant.engine import QuantEngine

    engine = QuantEngine()
    context = {
        'daily_row': today_data,
        'weekly_row': weekly_series,
        'monthly_row': monthly_series,
    }

    analysis_result = engine.run(symbol, context, strategy_name="trend")
    sig = analysis_result.signal

    monthly_trend = sig.factors.get('monthly_trend', '未知')
    weekly_trend = sig.factors.get('weekly_trend', '未知')
    resonance_count = sig.factors.get('resonance', 0)
    rsi = sig.factors.get('rsi', 0)
    macd_hist = sig.factors.get('macd_hist', 0)
    macd_status = "金叉" if macd_hist > 0 else "死叉"

    ai_result = {
        "signal": sig.action,
        "confidence": sig.confidence,
        "summary": "缩量震荡，维持观望" if sig.action == 'Side' else ("顺势做多" if sig.action == 'Long' else "避险为主"),
        "reasoning_trace": [
            {
                "step": "trend",
                "data": f"月:{monthly_trend} | 周:{weekly_trend}",
                "conclusion": "周期共振" if resonance_count == 2 else "长短博弈",
            },
            {
                "step": "momentum",
                "data": f"日线 RSI({rsi:.0f}) | MACD {macd_status}",
                "conclusion": "动能健康" if 40 <= rsi <= 60 else "行情极端",
            },
            {
                "step": "decision",
                "data": f"量化引擎 ({sig.source_model})",
                "conclusion": f"{sig.reason}",
            },
        ],
        "tactics": {
            "holding": [
                {
                    "priority": "P1",
                    "action": "持仓待涨" if sig.action == 'Long' else "分批减仓",
                    "trigger": "均线支撑",
                    "reason": "跟随趋势",
                }
            ],
            "empty": [
                {
                    "priority": "P1",
                    "action": "小仓试错" if sig.action != 'Short' else "观望",
                    "trigger": "跌破点位",
                    "reason": "风控",
                }
            ],
            "general": [
                {
                    "priority": "P3",
                    "action": "关注板块",
                    "trigger": "整体行情",
                    "reason": "大盘环境",
                }
            ],
        },
        "key_levels": {
            "support": round(float(sig.factors.get('ma20', 0)), 3),
            "resistance": round(float(sig.factors.get('ma20', 0)) * 1.05, 3),
            "stop_loss": round(float(sig.factors.get('ma20', 0)) * 0.97, 3),
        },
        "is_llm": False,
    }

    return _process_and_store_prediction(symbol, today_str, ai_result)
