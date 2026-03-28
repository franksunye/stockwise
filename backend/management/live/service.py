from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from backend.admin_notifications import get_admin_mobiles
from backend.database import init_db
from backend.management.live.card_formatter import build_advice_record
from backend.management.research.lanes import route_case_lanes
from backend.management.state.snapshot_builder import build_position_snapshots
from backend.management.storage.live_repo import (
    build_advice_id,
    insert_trade_advice_log,
    list_active_trade_positions,
)
from backend.trading_calendar import get_next_trading_day_str
from backend.utils import send_wecom_notification


@dataclass
class AdviceLoopResult:
    processed_count: int
    persisted_count: int
    delivered_count: int
    failed_count: int
    skipped_count: int
    cards: list[str]
    errors: list[str]


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
    failed_count = 0
    skipped_count = 0

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
            if not notify:
                record.webhook_delivery_status = "dry_run"

            if persist_log:
                insert_trade_advice_log(record)
                persisted_count += 1

            if notify:
                try:
                    send_wecom_notification(
                        record.card_markdown,
                        mentioned_mobile_list=get_admin_mobiles() or ["@all"],
                    )
                    record.webhook_delivery_status = "sent"
                    delivered_count += 1
                except Exception as notify_exc:
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
        failed_count=failed_count,
        skipped_count=skipped_count,
        cards=cards,
        errors=errors,
    )
