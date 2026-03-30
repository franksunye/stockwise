import { Client } from '@libsql/client';
import Database from 'better-sqlite3';

type DbStrategy = 'cloud' | 'local';

export interface UserTradePositionView {
  position_id: string;
  user_id: string;
  symbol: string;
  stock_name: string | null;
  market: string | null;
  entry_date: string;
  entry_price: number;
  position_size: number;
  remaining_size: number;
  status: string;
  note: string | null;
  latest_event_date: string | null;
  latest_event_type: string | null;
  latest_event_price: number | null;
  latest_event_quantity: number | null;
}

export interface UserTradeAdviceView {
  advice_id: string;
  position_id: string;
  latest_trade_date: string;
  next_trade_date: string | null;
  state_id: string | null;
  signal_state: string | null;
  recommended_policy: string | null;
  action_summary: string | null;
  card_markdown: string | null;
  updated_at: string | null;
}

export interface UserTradeManagementStockResponse {
  position: UserTradePositionView | null;
  advice: UserTradeAdviceView | null;
  recent_events: UserTradePositionEventView[];
  can_create_position: boolean;
}

export interface UserTradePositionEventView {
  event_id: string;
  position_id: string;
  user_id: string;
  symbol: string;
  market: string | null;
  event_date: string;
  event_type: string;
  quantity: number;
  price: number | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function inferMarket(symbol: string): string {
  return symbol.length === 5 ? 'HK' : 'CN';
}

const POSITION_SQL = `
  SELECT
    p.position_id,
    p.user_id,
    p.symbol,
    COALESCE(p.market, m.market) AS market,
    m.name AS stock_name,
    p.entry_date,
    p.entry_price,
    p.position_size,
    p.remaining_size,
    p.status,
    p.note,
    e.event_date AS latest_event_date,
    e.event_type AS latest_event_type,
    e.price AS latest_event_price,
    e.quantity AS latest_event_quantity
  FROM user_trade_positions p
  LEFT JOIN stock_meta m ON m.symbol = p.symbol
  LEFT JOIN user_trade_position_events e
    ON e.position_id = p.position_id
   AND e.event_date = (
      SELECT MAX(e2.event_date)
      FROM user_trade_position_events e2
      WHERE e2.position_id = p.position_id
   )
  WHERE p.user_id = ?
    AND p.symbol = ?
    AND p.status = 'active'
  ORDER BY p.updated_at DESC, p.entry_date DESC
  LIMIT 1
`;

const ADVICE_SQL = `
  SELECT
    advice_id,
    position_id,
    latest_trade_date,
    next_trade_date,
    state_id,
    signal_state,
    recommended_policy,
    action_summary,
    card_markdown,
    updated_at
  FROM trade_management_advice_log
  WHERE position_id = ?
  ORDER BY updated_at DESC
  LIMIT 1
`;

const RECENT_EVENTS_SQL = `
  SELECT
    event_id,
    position_id,
    user_id,
    symbol,
    market,
    event_date,
    event_type,
    quantity,
    price,
    note,
    created_at,
    updated_at
  FROM user_trade_position_events
  WHERE position_id = ?
  ORDER BY event_date DESC, updated_at DESC, event_id DESC
  LIMIT 5
`;

export async function getUserTradeManagementBySymbol(
  client: Client | Database.Database,
  strategy: DbStrategy,
  userId: string,
  symbol: string,
): Promise<UserTradeManagementStockResponse> {
  let position: UserTradePositionView | null = null;

  if (strategy === 'cloud') {
    const turso = client as Client;
    const result = await turso.execute({ sql: POSITION_SQL, args: [userId, symbol] });
    position = (result.rows[0] as unknown as UserTradePositionView | undefined) || null;
  } else {
    const db = client as Database.Database;
    position = (db.prepare(POSITION_SQL).get(userId, symbol) as UserTradePositionView | undefined) || null;
  }

  if (!position) {
    return {
      position: null,
      advice: null,
      recent_events: [],
      can_create_position: true,
    };
  }

  let advice: UserTradeAdviceView | null = null;

  if (strategy === 'cloud') {
    const turso = client as Client;
    const result = await turso.execute({ sql: ADVICE_SQL, args: [position.position_id] });
    advice = (result.rows[0] as unknown as UserTradeAdviceView | undefined) || null;
  } else {
    const db = client as Database.Database;
    advice = (db.prepare(ADVICE_SQL).get(position.position_id) as UserTradeAdviceView | undefined) || null;
  }

  let recentEvents: UserTradePositionEventView[] = [];

  if (strategy === 'cloud') {
    const turso = client as Client;
    const result = await turso.execute({ sql: RECENT_EVENTS_SQL, args: [position.position_id] });
    recentEvents = result.rows as unknown as UserTradePositionEventView[];
  } else {
    const db = client as Database.Database;
    recentEvents = db.prepare(RECENT_EVENTS_SQL).all(position.position_id) as UserTradePositionEventView[];
  }

  return {
    position,
    advice,
    recent_events: recentEvents,
    can_create_position: false,
  };
}

export async function hasActiveUserTradePosition(
  client: Client | Database.Database,
  strategy: DbStrategy,
  userId: string,
  symbol: string,
): Promise<boolean> {
  const sql = `
    SELECT 1
    FROM user_trade_positions
    WHERE user_id = ?
      AND symbol = ?
      AND status = 'active'
    LIMIT 1
  `;

  if (strategy === 'cloud') {
    const turso = client as Client;
    const result = await turso.execute({ sql, args: [userId, symbol] });
    return result.rows.length > 0;
  }

  const db = client as Database.Database;
  return !!db.prepare(sql).get(userId, symbol);
}

export async function getUserTradePositionById(
  client: Client | Database.Database,
  strategy: DbStrategy,
  userId: string,
  positionId: string,
): Promise<UserTradePositionView | null> {
  const sql = `
    SELECT
      p.position_id,
      p.user_id,
      p.symbol,
      COALESCE(p.market, m.market) AS market,
      m.name AS stock_name,
      p.entry_date,
      p.entry_price,
      p.position_size,
      p.remaining_size,
      p.status,
      p.note,
      NULL AS latest_event_date,
      NULL AS latest_event_type,
      NULL AS latest_event_price,
      NULL AS latest_event_quantity
    FROM user_trade_positions p
    LEFT JOIN stock_meta m ON m.symbol = p.symbol
    WHERE p.position_id = ?
      AND p.user_id = ?
    LIMIT 1
  `;

  if (strategy === 'cloud') {
    const turso = client as Client;
    const result = await turso.execute({ sql, args: [positionId, userId] });
    return (result.rows[0] as unknown as UserTradePositionView | undefined) || null;
  }

  const db = client as Database.Database;
  return (db.prepare(sql).get(positionId, userId) as UserTradePositionView | undefined) || null;
}

export async function createUserTradePosition(
  client: Client | Database.Database,
  strategy: DbStrategy,
  input: {
    positionId: string;
    userId: string;
    symbol: string;
    market?: string | null;
    entryDate: string;
    entryPrice: number;
    positionSize: number;
    note?: string | null;
  },
): Promise<void> {
  const market = (input.market || inferMarket(input.symbol)).trim().toUpperCase();
  const sql = `
    INSERT INTO user_trade_positions (
      position_id, user_id, symbol, market, entry_date, entry_price, position_size, remaining_size,
      direction, status, source, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'long', 'active', 'manual', ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))
  `;

  const args = [
    input.positionId,
    input.userId,
    input.symbol,
    market,
    input.entryDate,
    input.entryPrice,
    input.positionSize,
    input.positionSize,
    input.note || null,
  ];

  if (strategy === 'cloud') {
    const turso = client as Client;
    await turso.execute({ sql, args });
    return;
  }

  const db = client as Database.Database;
  db.prepare(sql).run(...args);
}

export async function createUserTradePositionEvent(
  client: Client | Database.Database,
  strategy: DbStrategy,
  input: {
    eventId: string;
    positionId: string;
    userId: string;
    symbol: string;
    market?: string | null;
    eventDate: string;
    eventType: 'BUY' | 'SELL';
    quantity: number;
    price?: number | null;
    note?: string | null;
  },
): Promise<void> {
  const market = (input.market || inferMarket(input.symbol)).trim().toUpperCase();
  const sql = `
    INSERT INTO user_trade_position_events (
      event_id, position_id, user_id, symbol, market, event_date, event_type, quantity, price, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))
  `;
  const args = [
    input.eventId,
    input.positionId,
    input.userId,
    input.symbol,
    market,
    input.eventDate,
    input.eventType,
    input.quantity,
    input.price ?? null,
    input.note || null,
  ];

  if (strategy === 'cloud') {
    const turso = client as Client;
    await turso.execute({ sql, args });
    return;
  }

  const db = client as Database.Database;
  db.prepare(sql).run(...args);
}
