from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Optional

from backend.admin_notifications import get_admin_mobiles
from backend.database import init_db
from backend.management.live.card_formatter import (
    build_action_plan,
    build_advice_record,
    build_execution_mode_plan,
    format_pct,
    format_price,
    resolve_observation_price,
)
from backend.management.research.lanes import route_case_lanes
from backend.management.state.snapshot_builder import build_position_snapshots
from backend.management.storage.live_repo import (
    build_advice_id,
    fetch_latest_trade_advice,
    fetch_user_wecom_delivery,
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


def _resolve_delivery_target(user_id: str) -> tuple[str | None, list[str] | None]:
    delivery = fetch_user_wecom_delivery(user_id) or {}
    user_webhook_url = str(delivery.get("wecom_webhook_url") or "").strip() or None
    user_mobile = str(delivery.get("mobile") or "").strip() or None

    if user_webhook_url:
        mentions = [user_mobile] if user_mobile else None
        return user_webhook_url, mentions

    admin_mobiles = get_admin_mobiles() or ["@all"]
    return None, admin_mobiles


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
    advice_style = os.getenv("WECOM_TRADE_ADVICE_STYLE", "template_card").strip().lower()

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
            lane_route = route_case_lanes(snapshots, market=position.market)
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
            record.source_ref = (
                f"{lane_route.get('routing_config_version', 'tm_market_routing_v2')}"
                f":{lane_route.get('market', position.market)}"
            )
            record.extra_payload.update(
                {
                    "routing_market": lane_route.get("market", position.market),
                    "routing_config_version": lane_route.get("routing_config_version"),
                    "routing_config": lane_route.get("routing_config"),
                    "takeover_applied": lane_route.get("takeover_applied", False),
                    "takeover_score_threshold": lane_route.get("takeover_score_threshold"),
                    "active_lane_ids": lane_route.get("active_lane_ids", []),
                }
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
                    webhook_url, mentions = _resolve_delivery_target(position.user_id)
                    if advice_style == "template_card":
                        plan = build_action_plan(latest, str(final_lane["recommended_policy"]))
                        execution_mode = build_execution_mode_plan(latest, position)
                        primary_action, secondary_action = _split_action_summary(plan.summary)
                        source_desc, source_desc_color = _state_theme(latest.state_id)
                        stock_label = position.stock_name or position.symbol
                        holding_text = f"{position.remaining_size:.0f}/{position.position_size:.0f}股 @ {position.entry_price:.2f}"
                        success_branch = (plan.bullets or ["继续观察"])[0]
                        failure_branch = (plan.bullets or ["继续观察", "按纪律处理"])[1] if plan.bullets and len(plan.bullets) > 1 else "按纪律处理"
                        detail_lines = [
                            success_branch,
                            failure_branch,
                        ]
                        followup_text = f"执行依据：{execution_mode.rationale}"
                        recent_event_text: str | None = None
                        if position.latest_event_date and position.latest_event_quantity and position.latest_event_type:
                            event_label = "加仓" if str(position.latest_event_type).upper() == "BUY" else "减仓"
                            event_price = format_price(position.latest_event_price)
                            recent_event_text = f"{position.latest_event_date} {event_label} {position.latest_event_quantity:.0f}股 @ {event_price}"
                            if event_label == "减仓":
                                secondary_action = f"管理剩余 {position.remaining_size:.0f}股"
                            elif event_label == "加仓":
                                secondary_action = f"管理最新 {position.remaining_size:.0f}股仓位"
                        send_wecom_template_card(
                            title=stock_label,
                            subtitle=f"{position.symbol} · {next_trade_date or latest.trade_date} 剩余仓位决策卡" if recent_event_text else f"{position.symbol} · {next_trade_date or latest.trade_date} 决策卡",
                            state_label=str(record.extra_payload.get("state_id_text") or latest.state_id or ""),
                            summary_line=f"最新收盘 {format_price(latest.close)} · 浮盈 {format_pct(latest.unrealized_pnl_pct)}",
                            action_label=primary_action,
                            action_desc=execution_mode.default_mode,
                            holding_text=holding_text,
                            observation_text=format_price(resolve_observation_price(latest)),
                            discipline_text=format_price(latest.discipline_price),
                            detail_lines=detail_lines,
                            observation_price=format_price(resolve_observation_price(latest)),
                            discipline_price=format_price(latest.discipline_price),
                            detail=plan.detail,
                            recent_event_text=recent_event_text,
                            source_desc=source_desc,
                            source_desc_color=source_desc_color,
                            jump_url=f"{os.getenv('NEXT_PUBLIC_SITE_URL', 'https://ziso.cc').rstrip('/')}/admin/trade-positions",
                            mentioned_mobile_list=mentions,
                            mention_text=followup_text,
                            webhook_url=webhook_url,
                        )
                    else:
                        followup_text = f"执行依据：{build_execution_mode_plan(latest, position).rationale}"
                        send_wecom_notification(
                            record.card_markdown,
                            mentioned_mobile_list=mentions,
                            mention_text=followup_text,
                            webhook_url=webhook_url,
                        )
                    record.webhook_delivery_status = "sent"
                    delivered_count += 1
                except Exception as notify_exc:
                    if advice_style == "template_card":
                        try:
                            webhook_url, mentions = _resolve_delivery_target(position.user_id)
                            send_wecom_notification(
                                record.card_markdown,
                                mentioned_mobile_list=mentions,
                                mention_text="交易管理提醒：请查收上一条持仓建议卡",
                                webhook_url=webhook_url,
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
