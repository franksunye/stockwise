from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional


StateId = Literal[
    "EntryTriggered",
    "BreakoutPending",
    "TrendHolding",
    "ProfitProtection",
    "FailureRisk",
    "ExitCompleted",
]

ActionId = Literal["HOLD", "SELL_PART", "EXIT_ALL", "ADD", "MOVE_STOP"]


@dataclass
class PositionState:
    symbol: str
    trade_date: str
    entry_date: str
    entry_price: float
    position_size: float
    holding_days: int
    close: float
    high: float
    low: float
    volume: float
    unrealized_pnl_pct: float
    mfe_pct: float
    mae_pct: float
    signal_state: str
    confidence: Optional[float]
    support_price: Optional[float]
    resistance_price: Optional[float]
    discipline_price: Optional[float]
    breakout_confirmed: bool
    near_resistance: bool
    failed_breakout_risk: bool
    volume_followthrough: bool
    partial_exit_done: bool = False
    state_id: StateId = "EntryTriggered"
    feature_payload: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ManagementAction:
    action: ActionId
    trigger_reason: str
    size_ratio: Optional[float] = None
    stop_price: Optional[float] = None
    target_price: Optional[float] = None
    payload: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PolicyResult:
    policy_id: str
    symbol: str
    entry_date: str
    exit_date: Optional[str]
    entry_price: float
    exit_price: Optional[float]
    realized_pnl_pct: Optional[float]
    max_drawdown_pct: Optional[float]
    profit_giveback_pct: Optional[float]
    holding_days: int
    win_flag: Optional[bool]
    action_count: int
    final_position_size: float
    action_log: List[Dict[str, Any]] = field(default_factory=list)
    result_payload: Dict[str, Any] = field(default_factory=dict)

