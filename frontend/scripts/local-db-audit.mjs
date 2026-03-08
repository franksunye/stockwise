import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../..');
const localDbPath = resolve(repoRoot, 'data/stockwise.db');

if (!fs.existsSync(localDbPath)) {
  console.error(`❌ 本地数据库不存在: ${localDbPath}`);
  process.exit(1);
}

const db = new Database(localDbPath, { readonly: true });

function scalar(sql) {
  const row = db.prepare(sql).get();
  return row ? Object.values(row)[0] : null;
}

function tableColumns(table) {
  return db.prepare(`PRAGMA table_info("${table}")`).all().map(row => String(row.name));
}

function latestValue(table, candidates) {
  const columns = tableColumns(table);
  const target = candidates.find(name => columns.includes(name));
  if (!target) {
    return null;
  }
  return scalar(`SELECT MAX("${target}") FROM "${table}"`);
}

try {
  const summary = [
    { table: 'daily_prices', rows: scalar('SELECT COUNT(*) FROM daily_prices'), latest: latestValue('daily_prices', ['date', 'updated_at', 'created_at']) },
    { table: 'weekly_prices', rows: scalar('SELECT COUNT(*) FROM weekly_prices'), latest: latestValue('weekly_prices', ['date', 'updated_at', 'created_at']) },
    { table: 'monthly_prices', rows: scalar('SELECT COUNT(*) FROM monthly_prices'), latest: latestValue('monthly_prices', ['date', 'updated_at', 'created_at']) },
    { table: 'stock_meta', rows: scalar('SELECT COUNT(*) FROM stock_meta'), latest: latestValue('stock_meta', ['last_updated', 'updated_at', 'created_at']) },
    { table: 'global_stock_pool', rows: scalar('SELECT COUNT(*) FROM global_stock_pool'), latest: latestValue('global_stock_pool', ['first_watched_at', 'created_at', 'added_at']) },
    { table: 'users', rows: scalar('SELECT COUNT(*) FROM users'), latest: latestValue('users', ['created_at', 'updated_at', 'last_active_at']) },
    { table: 'user_watchlist', rows: scalar('SELECT COUNT(*) FROM user_watchlist'), latest: latestValue('user_watchlist', ['created_at', 'added_at', 'updated_at']) },
    { table: 'ai_predictions_v2', rows: scalar('SELECT COUNT(*) FROM ai_predictions_v2'), latest: latestValue('ai_predictions_v2', ['date', 'target_date', 'created_at']) },
    { table: 'llm_traces', rows: scalar('SELECT COUNT(*) FROM llm_traces'), latest: latestValue('llm_traces', ['created_at', 'started_at', 'updated_at']) },
    { table: 'mode_decision_log', rows: scalar('SELECT COUNT(*) FROM mode_decision_log'), latest: latestValue('mode_decision_log', ['decision_date', 'created_at', 'updated_at']) },
    { table: 'mode_performance_snapshot', rows: scalar('SELECT COUNT(*) FROM mode_performance_snapshot'), latest: latestValue('mode_performance_snapshot', ['as_of_date', 'computed_at', 'created_at']) },
  ];

  console.log(`📂 Local DB: ${localDbPath}`);
  console.log(`🧪 integrity_check: ${scalar('PRAGMA integrity_check')}`);
  console.table(summary);
} finally {
  db.close();
}
