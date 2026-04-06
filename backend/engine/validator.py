import json
import math
from typing import Any, Dict, List, Optional

from backend.database import get_connection
from backend.engine.signal_semantics import CANONICAL_SIGNAL_STATES, normalize_signal_value
from backend.logger import logger
from backend.trading_calendar import get_market_from_symbol, get_next_trading_day_str, is_trading_day

BULL_THRESHOLD = 2.0
BEAR_THRESHOLD = -2.0
NOISE_THRESHOLD = 1.0
HARD_ADVERSE_LONG = -3.0
VALIDATION_WINDOW = 3


def validate_previous_prediction(symbol: str, today_data: Any):
    """
    Legacy compatibility wrapper.
    New multi-day validation is handled by verify_all_pending().
    """
    pass


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        num = float(value)
        return num if math.isfinite(num) else default
    except Exception:
        return default


def _resolve_signal(layer1_status: Optional[str], raw_signal: Optional[str]) -> Dict[str, str]:
    normalized_layer1 = normalize_signal_value(layer1_status, "")
    if normalized_layer1 in CANONICAL_SIGNAL_STATES:
        return {
            "signal_family": "canonical",
            "effective_signal": normalized_layer1,
            "normalized_signal": normalize_signal_value(raw_signal, "Side"),
        }

    normalized_signal = normalize_signal_value(raw_signal, "Side")
    if normalized_signal in CANONICAL_SIGNAL_STATES:
        return {
            "signal_family": "canonical",
            "effective_signal": normalized_signal,
            "normalized_signal": normalized_signal,
        }

    legacy_signal = normalized_signal if normalized_signal in {"Long", "Short", "Side"} else "Side"
    return {
        "signal_family": "legacy",
        "effective_signal": legacy_signal,
        "normalized_signal": legacy_signal,
    }


def _market_thresholds(market: str) -> Dict[str, float]:
    # Phase-1: shared defaults, while keeping a market-aware structure for future tuning.
    _ = market
    return {
        "bull_threshold": BULL_THRESHOLD,
        "bear_threshold": BEAR_THRESHOLD,
        "noise_threshold": NOISE_THRESHOLD,
        "hard_adverse_long": HARD_ADVERSE_LONG,
    }


def _build_summary(
    signal_meta: Dict[str, str],
    market: str,
    trajectory: List[Dict[str, float]],
    days_evaluated: int,
    semantic_verdict: str,
    outcome_verdict: str,
    reason_code: str,
) -> Dict[str, Any]:
    t1_change = trajectory[0]["change"] if trajectory else 0.0
    cum_change = trajectory[-1]["cum_change"] if trajectory else 0.0
    max_cum = max((item["cum_change"] for item in trajectory), default=0.0)
    min_cum = min((item["cum_change"] for item in trajectory), default=0.0)

    return {
        "window": VALIDATION_WINDOW,
        "days_evaluated": days_evaluated,
        "trajectory": trajectory,
        "t1_change": round(t1_change, 2),
        "cum_change": round(cum_change, 2),
        "max_cum_change": round(max_cum, 2),
        "min_cum_change": round(min_cum, 2),
        "signal_family": signal_meta["signal_family"],
        "normalized_signal": signal_meta["normalized_signal"],
        "effective_signal": signal_meta["effective_signal"],
        "market": market,
        "semantic_verdict": semantic_verdict,
        "outcome_verdict": outcome_verdict,
        "reason_code": reason_code,
    }


def _max_favorable(signal_meta: Dict[str, str], trajectory: List[Dict[str, float]]) -> float:
    max_cum = max((item["cum_change"] for item in trajectory), default=0.0)
    min_cum = min((item["cum_change"] for item in trajectory), default=0.0)
    effective_signal = signal_meta["effective_signal"]
    if effective_signal in {"RiskOff", "Short"}:
        return round(min_cum, 2)
    return round(max_cum, 2)


def _evaluate_legacy(signal_meta: Dict[str, str], trajectory: List[Dict[str, float]], market: str) -> Dict[str, str]:
    thresholds = _market_thresholds(market)
    cumulative_change = trajectory[-1]["cum_change"] if trajectory else 0.0
    max_cum = max((item["cum_change"] for item in trajectory), default=0.0)
    min_cum = min((item["cum_change"] for item in trajectory), default=0.0)
    signal = signal_meta["effective_signal"]

    if signal == "Long":
        if max_cum >= thresholds["bull_threshold"]:
            return {"semantic_verdict": "Validated", "outcome_verdict": "Strong", "reason_code": "legacy_long_confirmed"}
        if cumulative_change > 0:
            return {"semantic_verdict": "WeakValidated", "outcome_verdict": "Weak", "reason_code": "legacy_long_weak_followthrough"}
        if min_cum <= thresholds["hard_adverse_long"] or cumulative_change <= 0:
            return {"semantic_verdict": "Invalidated", "outcome_verdict": "Adverse", "reason_code": "legacy_long_failed"}
    elif signal == "Short":
        if min_cum <= thresholds["bear_threshold"]:
            return {"semantic_verdict": "Validated", "outcome_verdict": "Strong", "reason_code": "legacy_short_confirmed"}
        if cumulative_change < 0:
            return {"semantic_verdict": "WeakValidated", "outcome_verdict": "Weak", "reason_code": "legacy_short_weak_followthrough"}
        if max_cum >= thresholds["bull_threshold"] or cumulative_change >= 0:
            return {"semantic_verdict": "Invalidated", "outcome_verdict": "Adverse", "reason_code": "legacy_short_failed"}
    else:
        if abs(cumulative_change) <= thresholds["noise_threshold"]:
            return {"semantic_verdict": "Validated", "outcome_verdict": "Neutral", "reason_code": "legacy_side_neutral"}
        return {"semantic_verdict": "Invalidated", "outcome_verdict": "Adverse", "reason_code": "legacy_side_broken"}

    return {"semantic_verdict": "WeakValidated", "outcome_verdict": "Neutral", "reason_code": "legacy_inconclusive"}


def _evaluate_canonical(signal_meta: Dict[str, str], trajectory: List[Dict[str, float]], market: str) -> Dict[str, str]:
    thresholds = _market_thresholds(market)
    t1_change = trajectory[0]["change"] if trajectory else 0.0
    cumulative_change = trajectory[-1]["cum_change"] if trajectory else 0.0
    max_cum = max((item["cum_change"] for item in trajectory), default=0.0)
    min_cum = min((item["cum_change"] for item in trajectory), default=0.0)
    signal = signal_meta["effective_signal"]

    if signal == "TriggeredLong":
        if max_cum >= thresholds["bull_threshold"]:
            return {"semantic_verdict": "Validated", "outcome_verdict": "Strong", "reason_code": "triggered_confirmed"}
        if cumulative_change > 0:
            return {"semantic_verdict": "WeakValidated", "outcome_verdict": "Weak", "reason_code": "triggered_weak_followthrough"}
        return {"semantic_verdict": "Invalidated", "outcome_verdict": "Adverse", "reason_code": "triggered_stopped_out" if min_cum <= thresholds["hard_adverse_long"] else "triggered_failed"}

    if signal == "RiskOff":
        if min_cum <= thresholds["bear_threshold"]:
            return {"semantic_verdict": "Validated", "outcome_verdict": "Strong", "reason_code": "riskoff_confirmed"}
        if max_cum >= thresholds["bull_threshold"]:
            return {"semantic_verdict": "Invalidated", "outcome_verdict": "Adverse", "reason_code": "riskoff_overdefensive"}
        return {"semantic_verdict": "WeakValidated", "outcome_verdict": "Neutral", "reason_code": "riskoff_flat_but_safe"}

    if signal == "Watch":
        if t1_change >= thresholds["bull_threshold"]:
            return {"semantic_verdict": "Invalidated", "outcome_verdict": "Strong", "reason_code": "watch_too_conservative"}
        if t1_change <= thresholds["bear_threshold"]:
            return {"semantic_verdict": "Invalidated", "outcome_verdict": "Adverse", "reason_code": "watch_missed_risk"}
        if len(trajectory) > 1 and max_cum >= thresholds["bull_threshold"]:
            return {"semantic_verdict": "Validated", "outcome_verdict": "Strong", "reason_code": "watch_delayed_breakout"}
        if min_cum <= thresholds["bear_threshold"]:
            return {"semantic_verdict": "Invalidated", "outcome_verdict": "Adverse", "reason_code": "watch_missed_risk"}
        return {"semantic_verdict": "WeakValidated" if abs(cumulative_change) <= thresholds["noise_threshold"] else "Validated", "outcome_verdict": "Neutral", "reason_code": "watch_still_unconfirmed"}

    if max_cum >= thresholds["bull_threshold"]:
        return {"semantic_verdict": "Invalidated", "outcome_verdict": "Strong", "reason_code": "nosetup_missed_opportunity"}
    if min_cum <= thresholds["bear_threshold"]:
        return {"semantic_verdict": "Invalidated", "outcome_verdict": "Adverse", "reason_code": "nosetup_missed_risk"}
    if abs(cumulative_change) <= thresholds["noise_threshold"]:
        return {"semantic_verdict": "Validated", "outcome_verdict": "Neutral", "reason_code": "nosetup_true_neutral"}
    return {"semantic_verdict": "WeakValidated", "outcome_verdict": "Weak", "reason_code": "nosetup_low_value_noise"}


def _evaluate_final(signal_meta: Dict[str, str], trajectory: List[Dict[str, float]], market: str) -> Dict[str, str]:
    if signal_meta["signal_family"] == "canonical":
        verdict = _evaluate_canonical(signal_meta, trajectory, market)
    else:
        verdict = _evaluate_legacy(signal_meta, trajectory, market)

    verdict["validation_status"] = "Incorrect" if verdict["semantic_verdict"] == "Invalidated" else "Correct"
    return verdict


def verify_all_pending(force: bool = False, target_date: str = None, market_filter: str = None):
    """
    Batch verify predictions using four-state semantics when available.
    Legacy Long/Short/Side rows are still supported for historical compatibility.
    """
    conn = get_connection()
    try:
        cursor = conn.cursor()

        conditions = []
        params: List[Any] = []
        if not force:
            conditions.append("(validation_status = 'Pending' OR validation_status = 'Verifying' OR validation_status = 'Incorrect')")

        if target_date:
            conditions.append("target_date = ?")
            params.append(target_date)
            logger.info(f"🔍 Verifying V2 predictions for target date: {target_date}...")
        else:
            conditions.append("date >= date('now', '-10 days')")
            logger.info("🔍 Verifying recent V2 predictions (T+3 mode)...")

        if market_filter:
            # Market filtering is applied safely per-row using get_market_from_symbol,
            # which supports CN/HK/US consistently.
            logger.info(f"📍 Limiting verification to market: {market_filter}")

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        pending_v2 = cursor.execute(
            f"""
            SELECT symbol, date, target_date, model_id, signal, confidence, layer1_status
            FROM ai_predictions_v2
            WHERE {where_clause}
        """,
            params,
        ).fetchall()

        validated_count = 0

        for row in pending_v2:
            symbol, p_date, t0_date, model_id, signal, confidence, layer1_status = row
            market = get_market_from_symbol(symbol)
            if market_filter and market != market_filter:
                continue
            signal_meta = _resolve_signal(layer1_status, signal)

            start_date = t0_date
            if not is_trading_day(start_date, market=market):
                start_date = get_next_trading_day_str(start_date, market=market)

            window_dates = [start_date]
            current_t = start_date
            for _ in range(VALIDATION_WINDOW - 1):
                current_t = get_next_trading_day_str(current_t, market=market)
                window_dates.append(current_t)

            trajectory: List[Dict[str, float]] = []
            cumulative_change = 0.0
            for d in window_dates:
                p_row = cursor.execute(
                    "SELECT change_percent, close FROM daily_prices WHERE symbol=? AND date=?",
                    (symbol, d),
                ).fetchone()
                if not p_row:
                    break
                day_change = _safe_float(p_row[0], 0.0)
                cumulative_change += day_change
                trajectory.append(
                    {
                        "date": d,
                        "change": round(day_change, 2),
                        "close": _safe_float(p_row[1], 0.0),
                        "cum_change": round(cumulative_change, 2),
                    }
                )

            if not trajectory:
                continue

            days_evaluated = len(trajectory)
            is_final = days_evaluated == VALIDATION_WINDOW
            if is_final:
                verdict_meta = _evaluate_final(signal_meta, trajectory, market)
                validation_status = verdict_meta["validation_status"]
            else:
                verdict_meta = {
                    "semantic_verdict": "PendingWindow",
                    "outcome_verdict": "PendingWindow",
                    "reason_code": "waiting_for_full_window",
                }
                validation_status = "Verifying"

            val_data = _build_summary(
                signal_meta=signal_meta,
                market=market,
                trajectory=trajectory,
                days_evaluated=days_evaluated,
                semantic_verdict=verdict_meta["semantic_verdict"],
                outcome_verdict=verdict_meta["outcome_verdict"],
                reason_code=verdict_meta["reason_code"],
            )
            max_perf = _max_favorable(signal_meta, trajectory)
            t1_change = val_data["t1_change"]

            cursor.execute(
                """
                UPDATE ai_predictions_v2
                SET validation_status = ?,
                    actual_change = ?,
                    validation_data = ?,
                    max_perf_in_window = ?,
                    updated_at = datetime('now', '+8 hours')
                WHERE symbol = ? AND date = ? AND model_id = ?
            """,
                (validation_status, t1_change, json.dumps(val_data), max_perf, symbol, p_date, model_id),
            )

            validated_count += 1
            if validation_status != "Verifying":
                logger.info(
                    f"   ✅ {symbol} ({p_date}) [{signal_meta['effective_signal']}] -> "
                    f"{validation_status} ({verdict_meta['reason_code']}, Peak: {max_perf}%, Days: {days_evaluated})"
                )

        conn.commit()
        logger.info(f"✨ Validation Complete: {validated_count} predictions updated.")

        return {
            "validated_count": validated_count,
            "target_date_filter": target_date or "Recent 10 Days",
            "market_filter": market_filter or "ALL",
            "condition": "Pending/Verifying" if not force else "All",
            "window": VALIDATION_WINDOW,
        }

    except Exception as e:
        logger.error(f"❌ Batch verification failed: {e}")
        import traceback

        traceback.print_exc()
        raise e
    finally:
        conn.close()
