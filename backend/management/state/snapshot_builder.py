from __future__ import annotations

from collections import deque
from datetime import datetime
from typing import Any, Dict, List, Optional

from backend.database import get_connection
from backend.management.domain.position_state import PositionState
from backend.management.state.state_machine import DEFAULT_THRESHOLDS, resolve_state_id


def _safe_float(value: Any) -> float:
    try:
        if value is None:
            return 0.0
        return float(value)
    except Exception:
        return 0.0


def _parse_date(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d")


def build_position_snapshots(
    symbol: str,
    entry_date: str,
    entry_price: float,
    position_size: float,
    end_date: Optional[str] = None,
    thresholds: Optional[Dict[str, Any]] = None,
) -> List[PositionState]:
    cfg = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    conn = get_connection()
    try:
        cur = conn.cursor()
        params: List[Any] = [symbol, entry_date]
        sql = """
            SELECT dp.date, dp.open, dp.high, dp.low, dp.close, dp.volume,
                   ap.layer1_status, ap.signal, ap.confidence,
                   ap.support_price, ap.pressure_price
            FROM daily_prices dp
            LEFT JOIN ai_predictions_v2 ap
              ON ap.symbol = dp.symbol AND ap.date = dp.date AND ap.is_primary = 1
            WHERE dp.symbol = ? AND dp.date >= ?
        """
        if end_date:
            sql += " AND dp.date <= ?"
            params.append(end_date)
        sql += " ORDER BY dp.date ASC"
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()

        snapshots: List[PositionState] = []
        volume_window: deque[float] = deque(maxlen=5)
        max_high = entry_price
        min_low = entry_price
        partial_exit_done = False

        for row in rows:
            trade_date, _open, high, low, close, volume, layer1_status, signal, confidence, support, pressure = row
            high_f = _safe_float(high)
            low_f = _safe_float(low)
            close_f = _safe_float(close)
            volume_f = _safe_float(volume)
            max_high = max(max_high, high_f if high_f > 0 else close_f)
            min_low = min(min_low, low_f if low_f > 0 else close_f)

            avg_prev_volume = sum(volume_window) / len(volume_window) if volume_window else 0.0
            volume_followthrough = avg_prev_volume > 0 and volume_f >= float(cfg["followthrough_volume_mult"]) * avg_prev_volume

            resistance = float(pressure) if pressure is not None else None
            support_price = float(support) if support is not None else None
            near_resistance = bool(
                resistance and resistance > 0 and close_f >= resistance * float(cfg["near_resistance_buffer"])
            )
            breakout_confirmed = bool(resistance and resistance > 0 and close_f >= resistance)

            discipline_candidates = [x for x in [support_price] if x and x > 0]
            discipline_price = max(discipline_candidates) if discipline_candidates else None
            failed_breakout_risk = bool(discipline_price and close_f < discipline_price)

            holding_days = max(0, (_parse_date(trade_date) - _parse_date(entry_date)).days)
            unrealized_pnl_pct = (close_f - entry_price) / entry_price if entry_price > 0 else 0.0
            mfe_pct = (max_high - entry_price) / entry_price if entry_price > 0 else 0.0
            mae_pct = (min_low - entry_price) / entry_price if entry_price > 0 else 0.0

            state = PositionState(
                symbol=symbol,
                trade_date=trade_date,
                entry_date=entry_date,
                entry_price=entry_price,
                position_size=position_size,
                holding_days=holding_days,
                close=close_f,
                high=high_f,
                low=low_f,
                volume=volume_f,
                unrealized_pnl_pct=unrealized_pnl_pct,
                mfe_pct=mfe_pct,
                mae_pct=mae_pct,
                signal_state=str(layer1_status or signal or "NoSetup"),
                confidence=float(confidence) if confidence is not None else None,
                support_price=support_price,
                resistance_price=resistance,
                discipline_price=discipline_price,
                breakout_confirmed=breakout_confirmed,
                near_resistance=near_resistance,
                failed_breakout_risk=failed_breakout_risk,
                volume_followthrough=volume_followthrough,
                partial_exit_done=partial_exit_done,
                feature_payload={"avg_prev_volume": avg_prev_volume},
            )
            state.state_id = resolve_state_id(state, cfg)
            snapshots.append(state)
            volume_window.append(volume_f)

        return snapshots
    finally:
        conn.close()

