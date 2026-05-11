import { Client } from '@libsql/client';
import Database from 'better-sqlite3';

type DbStrategy = 'cloud' | 'local';

export interface UserPositionBudgetPreferences {
  default_account_size: number | null;
  default_risk_ratio: number;
  default_r_mode: 'system_followed' | 'fixed_stop' | 'percent_stop';
}

export interface PositionBudgetSnapshotRow {
  snapshot_id: string;
  user_id: string;
  symbol: string;
  entry_price: number;
  stop_loss_price: number;
  target_price: number | null;
  account_size: number;
  risk_ratio: number;
  risk_amount: number;
  risk_per_share: number;
  position_size: number;
  expected_loss: number;
  r_mode: 'system_followed' | 'fixed_stop' | 'percent_stop';
  created_at: string;
}

let _schemaEnsured = false;

async function execute(
  client: Client | Database.Database,
  strategy: DbStrategy,
  sql: string,
  args: Array<string | number | null> = [],
): Promise<void> {
  if (strategy === 'cloud') {
    const turso = client as Client;
    await turso.execute({ sql, args });
    return;
  }
  const db = client as Database.Database;
  db.prepare(sql).run(...args);
}

function isDuplicateColumnError(error: unknown): boolean {
  const message = String(error).toLowerCase();
  return message.includes('duplicate column') || message.includes('already exists');
}

export async function ensurePositionBudgetSchema(
  client: Client | Database.Database,
  strategy: DbStrategy,
): Promise<void> {
  if (_schemaEnsured) return;

  await execute(client, strategy, `
    CREATE TABLE IF NOT EXISTS position_budget_snapshots (
      snapshot_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      entry_price REAL NOT NULL,
      stop_loss_price REAL NOT NULL,
      target_price REAL,
      account_size REAL NOT NULL,
      risk_ratio REAL NOT NULL,
      risk_amount REAL NOT NULL,
      risk_per_share REAL NOT NULL,
      position_size INTEGER NOT NULL,
      expected_loss REAL NOT NULL,
      r_mode TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL
    )
  `);

  await execute(client, strategy, `
    CREATE INDEX IF NOT EXISTS idx_pbs_user_created
    ON position_budget_snapshots(user_id, created_at DESC)
  `);

  for (const sql of [
    'ALTER TABLE users ADD COLUMN default_account_size REAL',
    'ALTER TABLE users ADD COLUMN default_risk_ratio REAL',
    'ALTER TABLE users ADD COLUMN default_r_mode TEXT',
  ]) {
    try {
      await execute(client, strategy, sql);
    } catch (error) {
      if (!isDuplicateColumnError(error)) throw error;
    }
  }

  _schemaEnsured = true;
}

export async function getUserPositionBudgetPreferences(
  client: Client | Database.Database,
  strategy: DbStrategy,
  userId: string,
): Promise<UserPositionBudgetPreferences> {
  type PreferenceRow = {
    default_account_size?: number | null;
    default_risk_ratio?: number | null;
    default_r_mode?: string | null;
  };
  const sql = `
    SELECT
      default_account_size,
      default_risk_ratio,
      default_r_mode
    FROM users
    WHERE user_id = ?
    LIMIT 1
  `;

  let row: PreferenceRow | null = null;

  if (strategy === 'cloud') {
    const result = await (client as Client).execute({ sql, args: [userId] });
    row = ((result.rows[0] as unknown as PreferenceRow | undefined) ?? null);
  } else {
    row = (((client as Database.Database).prepare(sql).get(userId) as PreferenceRow | undefined) ?? null);
  }

  return {
    default_account_size: row?.default_account_size ?? null,
    default_risk_ratio: Number(row?.default_risk_ratio ?? 0.01),
    default_r_mode: ((row?.default_r_mode as UserPositionBudgetPreferences['default_r_mode']) || 'system_followed'),
  };
}

export async function updateUserPositionBudgetPreferences(
  client: Client | Database.Database,
  strategy: DbStrategy,
  userId: string,
  input: UserPositionBudgetPreferences,
): Promise<void> {
  const sql = `
    UPDATE users
    SET
      default_account_size = ?,
      default_risk_ratio = ?,
      default_r_mode = ?,
      last_active_at = datetime('now', '+8 hours')
    WHERE user_id = ?
  `;
  const args = [input.default_account_size, input.default_risk_ratio, input.default_r_mode, userId];

  await execute(client, strategy, sql, args);
}

export async function createPositionBudgetSnapshot(
  client: Client | Database.Database,
  strategy: DbStrategy,
  input: PositionBudgetSnapshotRow,
): Promise<void> {
  const sql = `
    INSERT INTO position_budget_snapshots (
      snapshot_id,
      user_id,
      symbol,
      entry_price,
      stop_loss_price,
      target_price,
      account_size,
      risk_ratio,
      risk_amount,
      risk_per_share,
      position_size,
      expected_loss,
      r_mode,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const args = [
    input.snapshot_id,
    input.user_id,
    input.symbol,
    input.entry_price,
    input.stop_loss_price,
    input.target_price,
    input.account_size,
    input.risk_ratio,
    input.risk_amount,
    input.risk_per_share,
    input.position_size,
    input.expected_loss,
    input.r_mode,
    input.created_at,
  ];
  await execute(client, strategy, sql, args);
}

export async function listPositionBudgetSnapshots(
  client: Client | Database.Database,
  strategy: DbStrategy,
  userId: string,
  symbol?: string,
  limit: number = 20,
): Promise<PositionBudgetSnapshotRow[]> {
  const hasSymbol = !!symbol;
  const sql = hasSymbol
    ? `
      SELECT snapshot_id, user_id, symbol, entry_price, stop_loss_price, target_price, account_size, risk_ratio,
             risk_amount, risk_per_share, position_size, expected_loss, r_mode, created_at
      FROM position_budget_snapshots
      WHERE user_id = ? AND symbol = ?
      ORDER BY created_at DESC
      LIMIT ?
    `
    : `
      SELECT snapshot_id, user_id, symbol, entry_price, stop_loss_price, target_price, account_size, risk_ratio,
             risk_amount, risk_per_share, position_size, expected_loss, r_mode, created_at
      FROM position_budget_snapshots
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

  const args = hasSymbol ? [userId, symbol as string, limit] : [userId, limit];
  if (strategy === 'cloud') {
    const result = await (client as Client).execute({ sql, args });
    return result.rows as unknown as PositionBudgetSnapshotRow[];
  }
  return (client as Database.Database).prepare(sql).all(...args) as PositionBudgetSnapshotRow[];
}
