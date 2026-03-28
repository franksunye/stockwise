from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Optional

from backend.admin_notifications import get_admin_mobiles
from backend.database import init_db
from backend.management.live.card_formatter import build_action_plan, build_advice_record, format_pct, format_price, resolve_observation_price
from backend.management.research.lanes import route_case_lanes
from backend.management.state.snapshot_builder import build_position_snapshots
from backend.management.storage.live_repo import (
    build_advice_id,
    fetch_latest_trade_advice,
    insert_trade_advice_log,
    list_active_trade_positions,
)
from backend.trading_calendar import get_next_trading_day_str
from backend.utils import send_wecom_notification, send_wecom_template_card


@dataclass
class AdviceLoopResult:
    processed_count: int
    persisted_count: int
    delivered_count: int
    suppressed_count: int
    failed_count: int
    skipped_count: int
    cards: list[str]
    errors: list[str]


def _split_action_summary(summary: str) -> tuple[str, str]:
    text = (summary or "").strip()
    if not text:
        return ("继续观察", "默认动作")
    for sep in ["，", "、", ",", " "]:
        if sep in text:
            left, right = text.split(sep, 1)
            left = left.strip()
            right = right.strip()
            if left and right:
                return (left, right)
    return (text, "默认动作")


def _state_theme(snapshot_state_id: str) -> tuple[str, int]:
    mapping = {
        "ProfitProtection": ("盈利保护期", 2),
        "TrendHolding": ("趋势持有", 2),
        "BreakoutPending": ("突破待确认", 0),
        "EntryTriggered": ("建仓确认期", 0),
        "FailureRisk": ("风险抬升", 3),
        "ExitCompleted": ("已退出", 0),
    }
    return mapping.get(snapshot_state_id, ("交易管理", 0))


def run_trade_management_advice_loop(
    user_id: Optional[str] = None,
    symbol: Optional[str] = None,
    market: Optional[str] = None,
    persist_log: bool = True,
    notify: bool = False,
) -> AdviceLoopResult:
    init_db()
    positions = list_active_trade_positions(user_id=user_id, symbol=symbol, market=market)

    cards: list[str] = []
    errors: list[str] = []
    processed_count = 0
    persisted_count = 0
    delivered_count = 0
    suppressed_count = 0
    failed_count = 0
    skipped_count = 0
    advice_style = os.getenv("WECOM_TRADE_ADVICE_STYLE", "markdown").strip().lower()

    for position in positions:
        try:
            snapshots = build_position_snapshots(
                symbol=position.symbol,
                entry_date=position.entry_date,
                entry_price=position.entry_price,
                position_size=position.remaining_size,
            )
            if not snapshots:
                skipped_count += 1
                errors.append(f"{position.symbol}: 无可用快照")
                continue

            latest = snapshots[-1]
            lane_route = route_case_lanes(snapshots)
            final_lane = lane_route["final"]
            next_trade_date = get_next_trading_day_str(
                latest.trade_date,
                symbol=position.symbol,
                market=position.market,
            )
            record = build_advice_record(
                position=position,
                snapshot=latest,
                next_trade_date=next_trade_date,
                lane_id=str(final_lane["lane_id"]),
                recommended_policy=str(final_lane["recommended_policy"]),
                advice_id=build_advice_id(),
            )
            previous = fetch_latest_trade_advice(position.position_id)
            is_duplicate_sent = bool(
                notify
                and previous
                and str(previous.get("latest_trade_date") or "") == record.latest_trade_date
                and str(previous.get("card_markdown") or "") == record.card_markdown
                and str(previous.get("webhook_delivery_status") or "") == "sent"
            )
            if is_duplicate_sent:
                processed_count += 1
                suppressed_count += 1
                cards.append(record.card_markdown)
                continue

            if not notify:
                record.webhook_delivery_status = "dry_run"

            if persist_log:
                insert_trade_advice_log(record)
                persisted_count += 1

            if notify:
                try:
                    mentions = get_admin_mobiles() or ["@all"]
                    if advice_style == "template_card":
                        plan = build_action_plan(latest, str(final_lane["recommended_policy"]))
                        primary_action, secondary_action = _split_action_summary(plan.summary)
                        source_desc, source_desc_color = _state_theme(latest.state_id)
                        stock_label = position.stock_name or position.symbol
                        send_wecom_template_card(
                            title=stock_label,
                            subtitle=f"{position.symbol} · {next_trade_date or latest.trade_date} 建议",
                            state_label=str(record.extra_payload.get("state_id_text") or latest.state_id or ""),
                            summary_line=f"最新收盘 {format_price(latest.close)} · 浮盈 {format_pct(latest.unrealized_pnl_pct)}",
                            action_label=primary_action,
                            action_desc=secondary_action,
                            holding_text=f"{position.remaining_size:.0f}股 @ {position.entry_price:.2f}",
                            observation_text=format_price(resolve_observation_price(latest)),
                            discipline_text=format_price(latest.discipline_price),
                            detail_lines=plan.bullets or [],
                            observation_price=format_price(resolve_observation_price(latest)),
                            discipline_price=format_price(latest.discipline_price),
                            detail=plan.detail,
                            source_desc=source_desc,
                            source_desc_color=source_desc_color,
                            jump_url=f"{os.getenv('NEXT_PUBLIC_SITE_URL', 'https://ziso.cc').rstrip('/')}/admin/trade-positions",
                            mentioned_mobile_list=mentions,
                            mention_text="交易管理提醒：请查收上一条持仓建议卡",
                        )
                    else:
                        send_wecom_notification(
                            record.card_markdown,
                            mentioned_mobile_list=mentions,
                            mention_text="交易管理提醒：请查收上一条持仓建议卡",
                        )
                    record.webhook_delivery_status = "sent"
                    delivered_count += 1
                except Exception as notify_exc:
                    if advice_style == "template_card":
                        try:
                            send_wecom_notification(
                                record.card_markdown,
                                mentioned_mobile_list=get_admin_mobiles() or ["@all"],
                                mention_text="交易管理提醒：请查收上一条持仓建议卡",
                            )
                            record.webhook_delivery_status = "sent"
                            delivered_count += 1
                        except Exception as fallback_exc:
                            record.webhook_delivery_status = "failed"
                            record.webhook_delivery_error = (
                                f"template_card failed: {notify_exc}; markdown fallback failed: {fallback_exc}"
                            )
                            failed_count += 1
                            errors.append(f"{position.symbol}: webhook 发送失败 - {record.webhook_delivery_error}")
                    else:
                        record.webhook_delivery_status = "failed"
                        record.webhook_delivery_error = str(notify_exc)
                        failed_count += 1
                        errors.append(f"{position.symbol}: webhook 发送失败 - {notify_exc}")
                if persist_log:
                    insert_trade_advice_log(record)
            elif persist_log:
                # dry_run/status-initialized rows are already persisted once above
                pass

            cards.append(record.card_markdown)
            processed_count += 1
        except Exception as exc:
            failed_count += 1
            errors.append(f"{position.symbol}: {exc}")

    return AdviceLoopResult(
        processed_count=processed_count,
        persisted_count=persisted_count,
        delivered_count=delivered_count,
        suppressed_count=suppressed_count,
        failed_count=failed_count,
        skipped_count=skipped_count,
        cards=cards,
        errors=errors,
    )
