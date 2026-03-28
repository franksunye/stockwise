import { Client } from '@libsql/client';
import Database from 'better-sqlite3';

type DbStrategy = 'cloud' | 'local';

export interface TradePositionDetailRow {
  position_id: string;
  user_id: string;
  symbol: string;
  market: string | null;
  entry_date: string;
  entry_price: number;
  position_size: number;
  remaining_size: number;
  direction: string;
  status: string;
  source: string | null;
  note: string | null;
  stock_name: string | null;
  latest_trade_date: string | null;
  latest_state_id: string | null;
  latest_action_summary: string | null;
  latest_next_trade_date: string | null;
  latest_delivery_status: string | null;
  latest_event_date: string | null;
  latest_event_type: string | null;
  latest_event_price: number | null;
  latest_event_quantity: number | null;
  event_count: number;
  buy_event_count: number;
  sell_event_count: number;
  updated_at: string | null;
}

export interface TradeAdviceLogRow {
  advice_id: string;
  latest_trade_date: string;
  next_trade_date: string | null;
  state_id: string | null;
  signal_state: string | null;
  lane_id: string | null;
  recommended_policy: string | null;
  action_summary: string | null;
  webhook_delivery_status: string | null;
  card_markdown: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function buildPositionDetailSql(): string {
  return `
    SELECT
      p.position_id,
      p.user_id,
      p.symbol,
      COALESCE(p.market, m.market) AS market,
      p.entry_date,
      p.entry_price,
      p.position_size,
      p.remaining_size,
      p.direction,
      p.status,
      p.source,
      p.note,
      m.name AS stock_name,
      a.latest_trade_date,
      a.state_id AS latest_state_id,
      a.action_summary AS latest_action_summary,
      a.next_trade_date AS latest_next_trade_date,
      a.webhook_delivery_status AS latest_delivery_status,
      e.event_date AS latest_event_date,
      e.event_type AS latest_event_type,
      e.price AS latest_event_price,
      e.quantity AS latest_event_quantity,
      COALESCE(ec.event_count, 0) AS event_count,
      COALESCE(ec.buy_event_count, 0) AS buy_event_count,
      COALESCE(ec.sell_event_count, 0) AS sell_event_count,
      p.updated_at
    FROM user_trade_positions p
    LEFT JOIN stock_meta m ON m.symbol = p.symbol
    LEFT JOIN trade_management_advice_log a
      ON a.position_id = p.position_id
     AND a.updated_at = (
        SELECT MAX(a2.updated_at)
        FROM trade_management_advice_log a2
        WHERE a2.position_id = p.position_id
     )
    LEFT JOIN user_trade_position_events e
      ON e.position_id = p.position_id
     AND e.event_date = (
        SELECT MAX(e2.event_date)
        FROM user_trade_position_events e2
        WHERE e2.position_id = p.position_id
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
    WHERE p.position_id = ?
  `;
}

export async function recomputeRemainingSize(
  client: Client | Database.Database,
  strategy: DbStrategy,
  positionId: string,
): Promise<number> {
  if (strategy === 'cloud') {
    const turso = client as Client;
    const result = await turso.execute({
      sql: `
        SELECT
          p.position_size AS base_size,
          COALESCE(SUM(CASE WHEN e.event_type = 'BUY' THEN e.quantity ELSE 0 END), 0) AS buy_qty,
          COALESCE(SUM(CASE WHEN e.event_type = 'SELL' THEN e.quantity ELSE 0 END), 0) AS sell_qty
        FROM user_trade_positions p
        LEFT JOIN user_trade_position_events e ON e.position_id = p.position_id
        WHERE p.position_id = ?
        GROUP BY p.position_id, p.position_size
      `,
      args: [positionId],
    });
    const row = result.rows[0] as { base_size?: number; buy_qty?: number; sell_qty?: number } | undefined;
    const baseSize = Number(row?.base_size || 0);
    const buyQty = Number(row?.buy_qty || 0);
    const sellQty = Number(row?.sell_qty || 0);
    const remainingSize = baseSize + buyQty - sellQty;
    await turso.execute({
      sql: `
        UPDATE user_trade_positions
        SET remaining_size = ?, updated_at = datetime('now', '+8 hours')
        WHERE position_id = ?
      `,
      args: [remainingSize, positionId],
    });
    return remainingSize;
  }

  const db = client as Database.Database;
  const row = db
    .prepare(
      `
        SELECT
          p.position_size AS base_size,
          COALESCE(SUM(CASE WHEN e.event_type = 'BUY' THEN e.quantity ELSE 0 END), 0) AS buy_qty,
          COALESCE(SUM(CASE WHEN e.event_type = 'SELL' THEN e.quantity ELSE 0 END), 0) AS sell_qty
        FROM user_trade_positions p
        LEFT JOIN user_trade_position_events e ON e.position_id = p.position_id
        WHERE p.position_id = ?
        GROUP BY p.position_id, p.position_size
      `,
    )
    .get(positionId) as { base_size?: number; buy_qty?: number; sell_qty?: number } | undefined;
  const baseSize = Number(row?.base_size || 0);
  const buyQty = Number(row?.buy_qty || 0);
  const sellQty = Number(row?.sell_qty || 0);
  const remainingSize = baseSize + buyQty - sellQty;
  db.prepare(
    `
      UPDATE user_trade_positions
      SET remaining_size = ?, updated_at = datetime('now', '+8 hours')
      WHERE position_id = ?
    `,
  ).run(remainingSize, positionId);
  return remainingSize;
}

export async function queryTradeAdviceLogs(
  client: Client | Database.Database,
  strategy: DbStrategy,
  positionId: string,
): Promise<TradeAdviceLogRow[]> {
  const sql = `
    SELECT
      advice_id,
      latest_trade_date,
      next_trade_date,
      state_id,
      signal_state,
      lane_id,
      recommended_policy,
      action_summary,
      webhook_delivery_status,
      card_markdown,
      created_at,
      updated_at
    FROM trade_management_advice_log
    WHERE position_id = ?
    ORDER BY updated_at DESC
    LIMIT 30
  `;

  if (strategy === 'cloud') {
    const turso = client as Client;
    const result = await turso.execute({ sql, args: [positionId] });
    return result.rows as unknown as TradeAdviceLogRow[];
  }

  const db = client as Database.Database;
  return db.prepare(sql).all(positionId) as TradeAdviceLogRow[];
}
