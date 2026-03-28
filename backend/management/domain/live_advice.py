from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class TradePositionEvent:
    event_id: str
    position_id: str
    user_id: str
    symbol: str
    market: Optional[str]
    event_date: str
    event_type: str
    quantity: float
    price: Optional[float] = None
    note: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass
class UserTradePosition:
    position_id: str
    user_id: str
    symbol: str
    market: str
    entry_date: str
    entry_price: float
    position_size: float
    remaining_size: float
    direction: str = "long"
    status: str = "active"
    source: str = "manual"
    note: Optional[str] = None
    stock_name: Optional[str] = None
    sold_quantity: float = 0.0
    latest_sell_date: Optional[str] = None
    latest_sell_price: Optional[float] = None
    latest_sell_quantity: Optional[float] = None
    latest_event_date: Optional[str] = None
    latest_event_type: Optional[str] = None
    latest_event_price: Optional[float] = None
    latest_event_quantity: Optional[float] = None
    event_count: int = 0
    buy_event_count: int = 0
    sell_event_count: int = 0


@dataclass
class TradeAdviceRecord:
    advice_id: str
    position_id: str
    user_id: str
    symbol: str
    market: str
    latest_trade_date: str
    next_trade_date: Optional[str]
    latest_close: Optional[float]
    signal_state: Optional[str]
    state_id: Optional[str]
    lane_id: Optional[str]
    recommended_policy: Optional[str]
    action_summary: str
    discipline_price: Optional[float]
    resistance_price: Optional[float]
    unrealized_pnl_pct: Optional[float]
    card_markdown: str
    webhook_delivery_status: str = "pending"
    webhook_delivery_error: Optional[str] = None
    source_ref: Optional[str] = None
    extra_payload: Dict[str, Any] = field(default_factory=dict)
