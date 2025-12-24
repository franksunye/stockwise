
import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), 'backend/.env') });

const TURSO_DB_URL = process.env.TURSO_DB_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

const turso = createClient({ url: TURSO_DB_URL, authToken: TURSO_AUTH_TOKEN });
const localDb = new Database(resolve(process.cwd(), 'data/stockwise.db'));

async function sync() {
  console.log("🔄 开始同步真实的 AI 历史决策到 Turso...");
  try {
    const rows = localDb.prepare("SELECT * FROM ai_predictions ORDER BY date DESC LIMIT 60").all();
    if (rows.length === 0) {
      console.log("⚠️ 本地无预测数据");
      return;
    }

    // 清理远程现有的预测数据
    await turso.execute("DELETE FROM ai_predictions");
    console.log("🧹 已清空远程旧预测数据");

    const statements = rows.map(row => ({
      sql: `INSERT INTO ai_predictions 
            (symbol, date, target_date, signal, confidence, support_price, ai_reasoning, validation_status, actual_change)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        row.symbol, row.date, row.target_date, row.signal, 
        row.confidence, row.support_price, row.ai_reasoning, 
        row.validation_status, row.actual_change
      ]
    }));

    await turso.batch(statements);
    console.log(`✅ 成功同步 ${rows.length} 条真实记录到 Turso`);
  } catch (e) {
    console.error("❌ 同步失败:", e.message);
  } finally {
    localDb.close();
    process.exit(0);
  }
}

sync();
