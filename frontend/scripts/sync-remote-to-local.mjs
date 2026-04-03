import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const repoRoot = resolve(__dirname, '../..');
const envCandidates = [
  resolve(repoRoot, '.env'),
  resolve(repoRoot, 'backend/.env'),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}

const TURSO_DB_URL = process.env.TURSO_DB_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const BATCH_SIZE = Number(process.env.LOCAL_DB_SYNC_BATCH_SIZE || '1000');
const args = new Set(process.argv.slice(2));
const isFullRefresh = args.has('--full');
const isIncremental = !isFullRefresh;
const isHelp = args.has('--help') || args.has('-h');

const CURSOR_CANDIDATES = [
  'updated_at',
  'last_updated',
  'last_synced_at',
  'processed_at',
  'ingested_at',
  'last_used_at',
  'notified_at',
  'clicked_at',
  'used_at',
  'created_at',
  'first_watched_at',
  'added_at',
  'date',
  'target_date',
  'fact_date',
  'report_date',
  'decision_date',
  'as_of_date',
  'entry_date',
  'exit_date',
  'trade_date',
  'snapshot_date',
  'report_week',
];
const SYNC_STATE_TABLE = '_local_sync_state';

if (isHelp) {
  console.log('用法: node scripts/sync-remote-to-local.mjs [--full]');
  console.log('  默认: 增量同步并 upsert 到本地 SQLite');
  console.log('  --full: 全量重建本地 SQLite');
  process.exit(0);
}

if (!TURSO_DB_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ 缺少环境变量 TURSO_DB_URL 或 TURSO_AUTH_TOKEN');
  console.error(`   已检查: ${envCandidates.join(', ')}`);
  process.exit(1);
}

const remoteClient = createClient({
  url: TURSO_DB_URL,
  authToken: TURSO_AUTH_TOKEN,
});

const localDbPath = resolve(repoRoot, 'data/stockwise.db');

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

function getTableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all();
}

function getPrimaryKeyColumns(db, table) {
  return getTableColumns(db, table)
    .filter(col => Number(col.pk) > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk))
    .map(col => col.name);
}

function getCursorColumn(db, table) {
  const columns = new Set(getTableColumns(db, table).map(col => col.name));
  return CURSOR_CANDIDATES.find(name => columns.has(name)) || null;
}

function ensureSyncStateTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${quoteIdent(SYNC_STATE_TABLE)} (
      table_name TEXT PRIMARY KEY,
      cursor_column TEXT NOT NULL,
      last_value TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
      mode TEXT NOT NULL
    )
  `);
}

function getLastCursorValue(db, table) {
  const row = db.prepare(
    `SELECT last_value FROM ${quoteIdent(SYNC_STATE_TABLE)} WHERE table_name = ?`
  ).get(table);
  return row?.last_value ?? null;
}

function updateSyncState(db, table, cursorColumn, lastValue, mode) {
  db.prepare(`
    INSERT INTO ${quoteIdent(SYNC_STATE_TABLE)} (table_name, cursor_column, last_value, synced_at, mode)
    VALUES (?, ?, ?, datetime('now', '+8 hours'), ?)
    ON CONFLICT(table_name) DO UPDATE SET
      cursor_column = excluded.cursor_column,
      last_value = excluded.last_value,
      synced_at = excluded.synced_at,
      mode = excluded.mode
  `).run(table, cursorColumn, lastValue, mode);
}

function removeSyncState(db, table) {
  db.prepare(`DELETE FROM ${quoteIdent(SYNC_STATE_TABLE)} WHERE table_name = ?`).run(table);
}

function syncSchema(localDb, schemaRows) {
  for (const row of schemaRows) {
    if (!row.sql) continue;
    console.log(`    -> 确保 ${row.type}: ${row.name}`);
    try {
      localDb.exec(row.sql);
    } catch (error) {
      if (!String(error.message || error).includes('already exists')) {
        throw error;
      }
    }
  }
}

async function fetchRemoteRows(table, options = {}) {
  const { offset = 0, cursorColumn = null, lastValue = null } = options;
  const clauses = [];
  const args = [];

  if (cursorColumn && lastValue != null) {
    clauses.push(`${quoteIdent(cursorColumn)} >= ?`);
    args.push(lastValue);
  }

  const whereClause = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const orderClause = cursorColumn ? ` ORDER BY ${quoteIdent(cursorColumn)} ASC` : '';
  const sql = `SELECT * FROM ${quoteIdent(table)}${whereClause}${orderClause} LIMIT ${BATCH_SIZE} OFFSET ${offset}`;

  return remoteClient.execute({ sql, args });
}

async function getRemoteMaxCursor(table, cursorColumn) {
  const result = await remoteClient.execute(
    `SELECT MAX(${quoteIdent(cursorColumn)}) AS max_cursor FROM ${quoteIdent(table)}`
  );
  return result.rows[0]?.max_cursor ?? null;
}

function buildInsertStatement(localDb, table, columns, verb = 'INSERT') {
  const placeholders = columns.map(() => '?').join(', ');
  return localDb.prepare(
    `${verb} INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(', ')}) VALUES (${placeholders})`
  );
}

function ensureLocalTableExists(localDb, table) {
  const row = localDb.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
  ).get(table);
  return Boolean(row);
}

async function fullRefreshTable(localDb, table, remoteCount, summary, reason = null) {
  if (reason) {
    console.log(`    - 回退为表级全量刷新: ${reason}`);
  }

  localDb.prepare(`DELETE FROM ${quoteIdent(table)}`).run();

  if (remoteCount === 0) {
    summary.push({ table, mode: 'full-table', remoteCount, localCount: 0, note: reason || '' });
    return;
  }

  const firstBatch = await fetchRemoteRows(table);
  const columns = Object.keys(firstBatch.rows[0] || {});
  if (!columns.length) {
    throw new Error(`表 ${table} 未能解析列信息`);
  }

  const insertStmt = buildInsertStatement(localDb, table, columns);
  const insertMany = localDb.transaction((rowsToInsert) => {
    for (const row of rowsToInsert) {
      insertStmt.run(columns.map(c => row[c]));
    }
  });

  let inserted = 0;
  let offset = 0;

  while (true) {
    const batchRows = offset === 0 ? firstBatch.rows : (await fetchRemoteRows(table, { offset })).rows;
    if (!batchRows.length) break;
    insertMany(batchRows);
    inserted += batchRows.length;
    offset += batchRows.length;
    console.log(`    - 已同步 ${inserted}/${remoteCount} 行`);
    if (batchRows.length < BATCH_SIZE) break;
  }

  const localCount = Number(
    localDb.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdent(table)}`).get().count || 0
  );

  if (localCount !== remoteCount) {
    throw new Error(`表 ${table} 行数校验失败: remote=${remoteCount}, local=${localCount}`);
  }

  summary.push({ table, mode: 'full-table', remoteCount, localCount, note: reason || '' });
}

async function incrementalSyncTable(localDb, table, remoteCount, summary) {
  const cursorColumn = getCursorColumn(localDb, table);
  const primaryKeys = getPrimaryKeyColumns(localDb, table);

  if (!cursorColumn) {
    await fullRefreshTable(localDb, table, remoteCount, summary, '缺少增量水位列');
    removeSyncState(localDb, table);
    return;
  }

  if (!primaryKeys.length) {
    await fullRefreshTable(localDb, table, remoteCount, summary, '缺少主键，无法安全 upsert');
    removeSyncState(localDb, table);
    return;
  }

  const lastValue = getLastCursorValue(localDb, table);
  const remoteMaxCursor = await getRemoteMaxCursor(table, cursorColumn);

  if (remoteMaxCursor == null) {
    updateSyncState(localDb, table, cursorColumn, null, 'incremental');
    const localCount = Number(
      localDb.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdent(table)}`).get().count || 0
    );
    summary.push({ table, mode: 'incremental', remoteCount, localCount, delta: 0, cursor: cursorColumn });
    return;
  }

  let offset = 0;
  let changedRows = 0;
  let latestSeenCursor = lastValue;
  let columns = null;
  let upsertStmt = null;

  while (true) {
    const batchRows = (await fetchRemoteRows(table, {
      offset,
      cursorColumn,
      lastValue,
    })).rows;
    if (!batchRows.length) break;

    if (!columns) {
      columns = Object.keys(batchRows[0] || {});
      upsertStmt = buildInsertStatement(localDb, table, columns, 'INSERT OR REPLACE');
    }

    const upsertMany = localDb.transaction((rowsToInsert) => {
      for (const row of rowsToInsert) {
        upsertStmt.run(columns.map(c => row[c]));
      }
    });

    upsertMany(batchRows);
    changedRows += batchRows.length;
    latestSeenCursor = batchRows[batchRows.length - 1]?.[cursorColumn] ?? latestSeenCursor;
    offset += batchRows.length;
    console.log(`    - 增量 upsert ${changedRows} 行 (${cursorColumn}${lastValue == null ? ' from start' : ` >= ${lastValue}`})`);

    if (batchRows.length < BATCH_SIZE) break;
  }

  updateSyncState(localDb, table, cursorColumn, latestSeenCursor ?? remoteMaxCursor, 'incremental');

  const localCount = Number(
    localDb.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdent(table)}`).get().count || 0
  );

  summary.push({
    table,
    mode: 'incremental',
    remoteCount,
    localCount,
    delta: changedRows,
    cursor: cursorColumn,
  });
}

async function main() {
  console.log(`🔄 开始从 Turso 同步到本地 SQLite (${isIncremental ? '增量模式' : '全量模式'})...`);

  fs.mkdirSync(resolve(repoRoot, 'data'), { recursive: true });

  // 仅全量模式备份并重建整个库
  if (!isIncremental && fs.existsSync(localDbPath)) {
    const backupPath = `${localDbPath}.backup.${Date.now()}`;
    fs.copyFileSync(localDbPath, backupPath);
    console.log(`📦 本地数据库已备份至: ${backupPath}`);
  }

  if (!isIncremental && fs.existsSync(localDbPath)) {
    fs.unlinkSync(localDbPath);
  }
  const localDb = new Database(localDbPath);
  localDb.pragma('journal_mode = WAL');
  localDb.pragma('synchronous = NORMAL');
  localDb.pragma('foreign_keys = OFF');
  console.log(`📂 已连接本地数据库: ${localDbPath}`);

  try {
    // 1. 获取所有表和索引的 DDL (不含 sqlite_ 系统表和 _litestream 通道表)
    console.log('📝 获取远程表结构...');
    const schemaResult = await remoteClient.execute(`
      SELECT type, name, sql 
      FROM sqlite_master 
      WHERE sql IS NOT NULL 
        AND name NOT LIKE 'sqlite_%' 
        AND name NOT LIKE '_litestream_%'
        AND name NOT LIKE 'libsql_%'
      ORDER BY CASE 
        WHEN type = 'table' THEN 1 
        WHEN type = 'index' THEN 2 
        WHEN type = 'trigger' THEN 3 
        WHEN type = 'view' THEN 4 
        ELSE 5 END;
    `);

    // 2. 在本地执行 DDL 创建表结构
    syncSchema(localDb, schemaResult.rows);
    ensureSyncStateTable(localDb);

    // 3. 提取所有的表并迁移数据
    const tablesResult = await remoteClient.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
        AND name NOT LIKE 'sqlite_%' 
        AND name NOT LIKE '_litestream_%'
        AND name NOT LIKE 'libsql_%'
    `);

    const tables = tablesResult.rows
      .map(r => r.name)
      .filter(name => name !== SYNC_STATE_TABLE);
    const summary = [];

    for (const table of tables) {
      console.log(`📥 正在同步表 \`${table}\` ...`);

      const countResult = await remoteClient.execute(`SELECT COUNT(*) AS count FROM ${quoteIdent(table)}`);
      const remoteCount = Number(countResult.rows[0]?.count || 0);

      if (!ensureLocalTableExists(localDb, table)) {
        throw new Error(`本地缺少表 ${table}，请先执行一次全量同步`);
      }

      if (!isIncremental) {
        await fullRefreshTable(localDb, table, remoteCount, summary);
        const cursorColumn = getCursorColumn(localDb, table);
        if (cursorColumn) {
          const maxCursor = await getRemoteMaxCursor(table, cursorColumn);
          updateSyncState(localDb, table, cursorColumn, maxCursor, 'full');
        } else {
          removeSyncState(localDb, table);
        }
      } else {
        await incrementalSyncTable(localDb, table, remoteCount, summary);
      }
    }

    localDb.pragma('foreign_keys = ON');
    const integrity = localDb.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') {
      throw new Error(`本地 SQLite integrity_check 失败: ${integrity}`);
    }

    console.log(`🎉 数据库同步完成 (${isIncremental ? '增量' : '全量'})！`);
    console.table(summary);
    if (isIncremental) {
      console.log('💡 增量模式使用本地同步水位做 upsert，不会自动处理远端删除。建议定期执行一次全量同步校准。');
    }
    console.log('💡 您现在可以修改 DB_SOURCE="local" 使用此数据库进行调试。');

  } catch (error) {
    console.error('❌ 同步过程中发生错误:', error);
    process.exitCode = 1;
  } finally {
    localDb.close();
  }
}

main();
