/**
 * Local DB check: stock_meta.name_en is set for a symbol (default 00700 Tencent).
 * Use before manual UI verification with DB_SOURCE=local.
 *
 * Usage (from frontend/):
 *   npm run verify:local-stock-name-en
 *   npm run verify:local-stock-name-en -- 09988
 */

import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const frontendRoot = resolve(__dirname, '..');
const repoRoot = resolve(frontendRoot, '..');

config({ path: resolve(frontendRoot, '.env.local') });
config({ path: resolve(frontendRoot, '.env') });

const symbol = (process.argv[2] || '00700').trim();
const dbPath = process.env.LOCAL_DB_PATH
  ? resolve(frontendRoot, process.env.LOCAL_DB_PATH)
  : resolve(repoRoot, 'data/stockwise.db');

if (!fs.existsSync(dbPath)) {
  console.error(`❌ 数据库文件不存在: ${dbPath}`);
  console.error('   请确认 LOCAL_DB_PATH（或默认仓库根目录 data/stockwise.db）');
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

try {
  const cols = db.prepare(`PRAGMA table_info(stock_meta)`).all();
  const hasEn = cols.some((c) => c.name === 'name_en');
  if (!hasEn) {
    console.error('❌ stock_meta 缺少 name_en 列，请先跑 backend 迁移 / init_db');
    process.exit(1);
  }

  const row = db
    .prepare(`SELECT symbol, name, name_en, market FROM stock_meta WHERE symbol = ?`)
    .get(symbol);

  if (!row) {
    console.error(`❌ stock_meta 无此标的: ${symbol}`);
    process.exit(1);
  }

  const en = row.name_en != null ? String(row.name_en).trim() : '';
  console.log(`📂 DB: ${dbPath}`);
  console.log(`📌 ${row.symbol} (${row.market})`);
  console.log(`   name:    ${row.name}`);
  console.log(`   name_en: ${en || '(空)'}`);

  if (!en) {
    console.error('\n❌ name_en 为空，英文界面会退回显示代码。可执行：');
    console.error(
      `   sqlite3 "${dbPath}" "UPDATE stock_meta SET name_en = 'Tencent Holdings' WHERE symbol='${symbol}';"`,
    );
    process.exit(1);
  }

  console.log('\n✅ 库内已有英文名。下一步本地 UI 验证：');
  console.log('   1) cd frontend && USER_SESSION_SECRET=dev-stockwise-secret npm run dev');
  console.log('   2) .env.local 中 DB_SOURCE=local，且 LOCAL_DB_PATH 指向上述同一文件');
  console.log('   3) 浏览器语言选 English（stockwise_locale=en），自选含该代码');
  console.log('   4) Dashboard 顶栏标题应显示 name_en，而不是中文 name\n');
} finally {
  db.close();
}
