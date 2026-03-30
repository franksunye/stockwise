from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from backend.management.domain.position_state import PositionState, StateId


DEFAULT_THRESHOLDS: Dict[str, float] = {
    "profit_protection_pnl_pct": 0.12,
    "near_resistance_buffer": 0.985,
    "followthrough_volume_mult": 1.10,
}

_STATE_CATALOG_PATH = Path(__file__).resolve().parents[3] / "frontend" / "src" / "shared" / "trade-management-states.json"


def _load_state_descriptions() -> Dict[StateId, str]:
    rows = json.loads(_STATE_CATALOG_PATH.read_text(encoding="utf-8"))
    return {str(row["id"]): str(row["description_zh"]) for row in rows}


STATE_DESCRIPTIONS: Dict[StateId, str] = _load_state_descriptions()


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
