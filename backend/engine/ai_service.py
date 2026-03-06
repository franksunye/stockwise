import os
from typing import Any

from backend.logger import logger


def _get_guardrail_config() -> tuple[float, str]:
    """
    Directional guardrail config.
    - AI_DIRECTIONAL_CONFIDENCE_THRESHOLD: low-confidence threshold for Long/Short signals.
    - AI_CIRCUIT_MODE:
      - warn (default): log low-confidence directional signal, keep original signal.
      - force_side: legacy-compatible mode, downgrade low-confidence Long/Short to Side.
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
    """
    Apply confidence guardrail for directional signals.
    This helper is retained for adapter-level defensive checks.
    """
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
