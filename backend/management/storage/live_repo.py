from __future__ import annotations

import json
from datetime import datetime
from typing import Optional
from uuid import uuid4

from backend.database import get_connection
from backend.management.domain.live_advice import TradeAdviceRecord, TradePositionEvent, UserTradePosition
from backend.trading_calendar import get_market_from_symbol


NOW_EXPR = "datetime('now', '+8 hours')"


def _now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def list_active_trade_positions(
    user_id: Optional[str] = None,
    symbol: Optional[str] = None,
    market: Optional[str] = None,
) -> list[UserTradePosition]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        sql = """
            SELECT p.position_id, p.user_id, p.symbol, COALESCE(p.market, m.market),
                   p.entry_date, p.entry_price, p.position_size, p.remaining_size,
                   p.direction, p.status, p.source, p.note, m.name,
                   (p.position_size - p.remaining_size) AS sold_quantity,
                   evt.event_date AS latest_sell_date,
                   evt.price AS latest_sell_price,
                   evt.quantity AS latest_sell_quantity,
                   le.event_date AS latest_event_date,
                   le.event_type AS latest_event_type,
                   le.price AS latest_event_price,
                   le.quantity AS latest_event_quantity,
                   COALESCE(ec.event_count, 0) AS event_count,
                   COALESCE(ec.buy_event_count, 0) AS buy_event_count,
                   COALESCE(ec.sell_event_count, 0) AS sell_event_count
            FROM user_trade_positions p
            LEFT JOIN stock_meta m ON m.symbol = p.symbol
            LEFT JOIN user_trade_position_events evt
              ON evt.position_id = p.position_id
             AND evt.event_type = 'SELL'
             AND evt.event_date = (
                SELECT MAX(e2.event_date)
                FROM user_trade_position_events e2
                WHERE e2.position_id = p.position_id
                  AND e2.event_type = 'SELL'
             )
            LEFT JOIN user_trade_position_events le
              ON le.position_id = p.position_id
             AND le.event_date = (
                SELECT MAX(e3.event_date)
                FROM user_trade_position_events e3
                WHERE e3.position_id = p.position_id
             )
            LEFT JOIN (
                SELECT
                    position_id,
                    COUNT(*) AS event_count,
                    SUM(CASE WHEN event_type = 'BUY' THEN 1 ELSE 0 END) AS buy_event_count,
                    SUM(CASE WHEN event_type = 'SELL' THEN 1 ELSE 0 END) AS sell_event_count
                FROM user_trade_position_events
                GROUP BY position_id
            ) ec ON ec.position_id = p.position_id
            WHERE p.status = 'active' AND p.remaining_size > 0
        """
        params: list[object] = []
        if user_id:
            sql += " AND p.user_id = ?"
            params.append(user_id)
        if symbol:
            sql += " AND p.symbol = ?"
            params.append(symbol)
        if market:
            sql += " AND COALESCE(p.market, m.market) = ?"
            params.append(market)
        sql += " ORDER BY p.user_id ASC, p.symbol ASC, p.entry_date ASC"
        cur.execute(sql, tuple(params))
        rows = cur.fetchall()
        positions: list[UserTradePosition] = []
        for row in rows:
            position_market = str(row[3] or get_market_from_symbol(str(row[2])))
            positions.append(
                UserTradePosition(
                    position_id=str(row[0]),
                    user_id=str(row[1]),
                    symbol=str(row[2]),
                    market=position_market,
                    entry_date=str(row[4]),
                    entry_price=float(row[5]),
                    position_size=float(row[6]),
                    remaining_size=float(row[7]),
                    direction=str(row[8] or "long"),
                    status=str(row[9] or "active"),
                    source=str(row[10] or "manual"),
                    note=row[11],
                    stock_name=row[12],
                    sold_quantity=float(row[13] or 0.0),
                    latest_sell_date=row[14],
                    latest_sell_price=float(row[15]) if row[15] is not None else None,
                    latest_sell_quantity=float(row[16]) if row[16] is not None else None,
                    latest_event_date=row[17],
                    latest_event_type=row[18],
                    latest_event_price=float(row[19]) if row[19] is not None else None,
                    latest_event_quantity=float(row[20]) if row[20] is not None else None,
                    event_count=int(row[21] or 0),
                    buy_event_count=int(row[22] or 0),
                    sell_event_count=int(row[23] or 0),
                )
            )
        return positions
    finally:
        conn.close()


def list_trade_position_events(position_id: str) -> list[TradePositionEvent]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT event_id, position_id, user_id, symbol, market, event_date, event_type, quantity, price, note, created_at, updated_at
            FROM user_trade_position_events
            WHERE position_id = ?
            ORDER BY event_date DESC, updated_at DESC, event_id DESC
            """,
            (position_id,),
        )
        rows = cur.fetchall()
        return [
            TradePositionEvent(
                event_id=str(row[0]),
                position_id=str(row[1]),
                user_id=str(row[2]),
                symbol=str(row[3]),
                market=row[4],
                event_date=str(row[5]),
                event_type=str(row[6]),
                quantity=float(row[7]),
                price=float(row[8]) if row[8] is not None else None,
                note=row[9],
                created_at=row[10],
                updated_at=row[11],
            )
            for row in rows
        ]
    finally:
        conn.close()


def insert_trade_advice_log(record: TradeAdviceRecord) -> str:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            f"""
            INSERT INTO trade_management_advice_log (
                advice_id, position_id, user_id, symbol, market, latest_trade_date, next_trade_date,
                latest_close, signal_state, state_id, lane_id, recommended_policy, action_summary,
                discipline_price, resistance_price, unrealized_pnl_pct, card_markdown,
                webhook_delivery_status, webhook_delivery_error, source_ref, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, {NOW_EXPR}, {NOW_EXPR})
            ON CONFLICT(position_id, latest_trade_date) DO UPDATE SET
                latest_close=excluded.latest_close,
                signal_state=excluded.signal_state,
                state_id=excluded.state_id,
                lane_id=excluded.lane_id,
                recommended_policy=excluded.recommended_policy,
                action_summary=excluded.action_summary,
                discipline_price=excluded.discipline_price,
                resistance_price=excluded.resistance_price,
                unrealized_pnl_pct=excluded.unrealized_pnl_pct,
                card_markdown=CASE
                    WHEN trade_management_advice_log.webhook_delivery_status = 'sent'
                     AND excluded.webhook_delivery_status = 'dry_run'
                    THEN trade_management_advice_log.card_markdown
                    ELSE excluded.card_markdown
                END,
                webhook_delivery_status=CASE
                    WHEN trade_management_advice_log.webhook_delivery_status = 'sent'
                     AND excluded.webhook_delivery_status = 'dry_run'
                    THEN trade_management_advice_log.webhook_delivery_status
                    ELSE excluded.webhook_delivery_status
                END,
                webhook_delivery_error=CASE
                    WHEN trade_management_advice_log.webhook_delivery_status = 'sent'
                     AND excluded.webhook_delivery_status = 'dry_run'
                    THEN trade_management_advice_log.webhook_delivery_error
                    ELSE excluded.webhook_delivery_error
                END,
                source_ref=CASE
                    WHEN trade_management_advice_log.webhook_delivery_status = 'sent'
                     AND excluded.webhook_delivery_status = 'dry_run'
                    THEN trade_management_advice_log.source_ref
                    ELSE excluded.source_ref
                END,
                updated_at={NOW_EXPR}
            """,
            (
                record.advice_id,
                record.position_id,
                record.user_id,
                record.symbol,
                record.market,
                record.latest_trade_date,
                record.next_trade_date,
                record.latest_close,
                record.signal_state,
                record.state_id,
                record.lane_id,
                record.recommended_policy,
                record.action_summary,
                record.discipline_price,
                record.resistance_price,
                record.unrealized_pnl_pct,
                record.card_markdown,
                record.webhook_delivery_status,
                record.webhook_delivery_error,
                record.source_ref or json.dumps(record.extra_payload, ensure_ascii=False),
            ),
        )
        conn.commit()
        return record.advice_id
    finally:
        conn.close()


def fetch_latest_trade_advice(position_id: str) -> dict[str, object] | None:
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT latest_trade_date, card_markdown, webhook_delivery_status, webhook_delivery_error
            FROM trade_management_advice_log
            WHERE position_id = ?
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (position_id,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return {
            "latest_trade_date": row[0],
            "card_markdown": row[1],
            "webhook_delivery_status": row[2],
            "webhook_delivery_error": row[3],
        }
    finally:
        conn.close()


def build_position_id() -> str:
    return f"pos_{uuid4().hex[:12]}"


def build_advice_id() -> str:
    return f"tmadv_{uuid4().hex[:12]}"
