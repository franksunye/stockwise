from __future__ import annotations

from typing import Any, Dict

from backend.management.domain.position_state import PositionState, StateId


DEFAULT_THRESHOLDS: Dict[str, float] = {
    "profit_protection_pnl_pct": 0.12,
    "near_resistance_buffer": 0.985,
    "followthrough_volume_mult": 1.10,
}

STATE_DESCRIPTIONS: Dict[StateId, str] = {
    "EntryTriggered": "新信号刚成立，优先确认初始错误是否可控。",
    "BreakoutPending": "接近或刚触及关键确认位，先防假突破。",
    "TrendHolding": "趋势延续条件仍在，核心任务是避免过早下车。",
    "ProfitProtection": "已有明确浮盈，核心任务转为保护利润。",
    "FailureRisk": "结构开始失真或风险抬升，优先降风险。",
    "ExitCompleted": "本轮仓位管理结束，转入观察或复盘。",
}


def resolve_state_id(state: PositionState, thresholds: Dict[str, Any] | None = None) -> StateId:
    cfg = {**DEFAULT_THRESHOLDS, **(thresholds or {})}
    if state.position_size <= 0:
        return "ExitCompleted"
    if state.failed_breakout_risk or state.signal_state == "RiskOff":
        return "FailureRisk"
    if state.unrealized_pnl_pct >= float(cfg["profit_protection_pnl_pct"]):
        return "ProfitProtection"
    if state.breakout_confirmed and (state.volume_followthrough or state.signal_state == "TriggeredLong"):
        return "TrendHolding"
    if state.near_resistance or state.signal_state in {"TriggeredLong", "Watch"}:
        return "BreakoutPending"
    return "EntryTriggered"


def get_state_description(state_id: StateId) -> str:
    return STATE_DESCRIPTIONS[state_id]
