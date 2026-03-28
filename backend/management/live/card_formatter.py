from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from backend.management.domain.live_advice import TradeAdviceRecord, UserTradePosition
from backend.management.domain.position_state import PositionState
from backend.management.state.state_machine import get_state_description


@dataclass
class ActionPlan:
    summary: str
    detail: str


def format_pct(value: Optional[float]) -> str:
    if value is None:
        return "-"
    return f"{value * 100:+.1f}%"


def format_price(value: Optional[float]) -> str:
    if value is None:
        return "-"
    return f"{value:.2f}"


def resolve_observation_price(snapshot: PositionState) -> Optional[float]:
    candidates = [value for value in [snapshot.resistance_price, snapshot.high] if value is not None and value > 0]
    if not candidates:
        return snapshot.resistance_price
    return max(candidates)


def build_action_plan(snapshot: PositionState, recommended_policy: str) -> ActionPlan:
    discipline = format_price(snapshot.discipline_price)
    resistance = format_price(resolve_observation_price(snapshot))

    if snapshot.state_id == "FailureRisk":
        if recommended_policy == "failure_risk_exit_all":
            return ActionPlan(
                summary="优先退出，避免继续硬扛",
                detail=f"下一交易日如果仍然偏弱，以退出为主；若有反抽，也优先借反抽离场。纪律线参考 {discipline}。",
            )
        return ActionPlan(
            summary="先减仓一半，保留观察仓",
            detail=f"当前风险已经抬升，先减仓 1/2，剩余仓位继续观察；若再次转弱或失守 {discipline}，再继续退出。",
        )

    if snapshot.state_id == "ProfitProtection":
        if snapshot.near_resistance and snapshot.resistance_price:
            return ActionPlan(
                summary="继续持有，不追高",
                detail=f"若下一交易日能站稳 {resistance} 上方，继续持有；若冲高后站不稳，先止盈 1/3。持仓保护线参考 {discipline}。",
            )
        return ActionPlan(
            summary="继续持有，优先保护利润",
            detail=f"当前仓位已进入盈利保护期，优先保住已有浮盈；若后续失守 {discipline}，再明显减仓或退出。",
        )

    if snapshot.state_id == "TrendHolding":
        return ActionPlan(
            summary="继续持有，让趋势先走",
            detail=f"趋势仍在，先避免过早下车；如后续失守 {discipline}，再把仓位收紧。",
        )

    if snapshot.state_id == "BreakoutPending":
        if snapshot.resistance_price:
            return ActionPlan(
                summary="先观察突破是否确认",
                detail=f"下一交易日重点看 {resistance} 一带是否有效站稳；若站稳可继续持有，若重新转弱则优先防守，纪律线参考 {discipline}。",
            )
        return ActionPlan(
            summary="继续观察，不急着重动作",
            detail=f"当前更像待确认阶段，先看是否延续；若后续结构转弱，再按纪律线 {discipline} 处理。",
        )

    return ActionPlan(
        summary="持有观察，先确认结构",
        detail=f"这笔仓还在早期确认阶段，暂不激进加仓；若后续转弱，纪律线参考 {discipline}。",
    )


def build_trade_card_markdown(
    position: UserTradePosition,
    snapshot: PositionState,
    next_trade_date: Optional[str],
    lane_id: str,
    recommended_policy: str,
) -> str:
    plan = build_action_plan(snapshot, recommended_policy)
    stock_label = position.stock_name or position.symbol
    next_label = next_trade_date or "下一交易日"
    state_desc = get_state_description(snapshot.state_id)

    lines = [
        f"### 交易管理卡 | {stock_label} `{position.symbol}`",
        f"> **用户**: {position.user_id}",
        f"> **持仓**: {position.remaining_size:.0f}股 @ {position.entry_price:.2f}",
        f"> **建仓日**: {position.entry_date}",
        f"> **最新交易日**: {snapshot.trade_date}",
        f"> **下一交易日**: {next_label}",
        "",
        f"- **当前状态**: {snapshot.state_id} / {state_desc}",
        f"- **信号状态**: {snapshot.signal_state}",
        f"- **最新收盘**: {snapshot.close:.2f}",
        f"- **浮盈**: {format_pct(snapshot.unrealized_pnl_pct)}",
        f"- **默认动作**: {plan.summary}",
        f"- **执行说明**: {plan.detail}",
        f"- **纪律线**: {format_price(snapshot.discipline_price)}",
        f"- **观察位**: {format_price(resolve_observation_price(snapshot))}",
        f"- **研究路由**: {lane_id} -> {recommended_policy}",
    ]
    if position.note:
        lines.append(f"- **备注**: {position.note}")
    return "\n".join(lines)


def build_advice_record(
    position: UserTradePosition,
    snapshot: PositionState,
    next_trade_date: Optional[str],
    lane_id: str,
    recommended_policy: str,
    advice_id: str,
) -> TradeAdviceRecord:
    plan = build_action_plan(snapshot, recommended_policy)
    observation_price = resolve_observation_price(snapshot)
    card_markdown = build_trade_card_markdown(
        position=position,
        snapshot=snapshot,
        next_trade_date=next_trade_date,
        lane_id=lane_id,
        recommended_policy=recommended_policy,
    )
    return TradeAdviceRecord(
        advice_id=advice_id,
        position_id=position.position_id,
        user_id=position.user_id,
        symbol=position.symbol,
        market=position.market,
        latest_trade_date=snapshot.trade_date,
        next_trade_date=next_trade_date,
        latest_close=snapshot.close,
        signal_state=snapshot.signal_state,
        state_id=snapshot.state_id,
        lane_id=lane_id,
        recommended_policy=recommended_policy,
        action_summary=plan.summary,
        discipline_price=snapshot.discipline_price,
        resistance_price=observation_price,
        unrealized_pnl_pct=snapshot.unrealized_pnl_pct,
        card_markdown=card_markdown,
        extra_payload={
            "symbol": position.symbol,
            "latest_trade_date": snapshot.trade_date,
            "next_trade_date": next_trade_date,
            "state_id": snapshot.state_id,
            "signal_state": snapshot.signal_state,
            "lane_id": lane_id,
            "recommended_policy": recommended_policy,
        },
    )
