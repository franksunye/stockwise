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

async function main() {
  console.log('🔄 开始从 Turso 拉取并覆盖本地 SQLite 数据库...');

  fs.mkdirSync(resolve(repoRoot, 'data'), { recursive: true });

  // 备份原数据库 (如果存在)
  if (fs.existsSync(localDbPath)) {
    const backupPath = `${localDbPath}.backup.${Date.now()}`;
    fs.copyFileSync(localDbPath, backupPath);
    console.log(`📦 本地数据库已备份至: ${backupPath}`);
  }

  // 创建并清空新的本地数据库
  if (fs.existsSync(localDbPath)) {
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
    for (const row of schemaResult.rows) {
      if (!row.sql) continue;
      console.log(`    -> 创建 ${row.type}: ${row.name}`);
      // Turso 返回的是 libsql 专有类型或常规 SQLite
      localDb.exec(row.sql);
    }

    // 3. 提取所有的表并迁移数据
    const tablesResult = await remoteClient.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
        AND name NOT LIKE 'sqlite_%' 
        AND name NOT LIKE '_litestream_%'
        AND name NOT LIKE 'libsql_%'
    `);

    const tables = tablesResult.rows.map(r => r.name);
    const summary = [];

    for (const table of tables) {
      console.log(`📥 正在同步表 \`${table}\` ...`);

      const countResult = await remoteClient.execute(`SELECT COUNT(*) AS count FROM ${quoteIdent(table)}`);
      const remoteCount = Number(countResult.rows[0]?.count || 0);

      if (remoteCount === 0) {
        console.log(`    - 无数据`);
        summary.push({ table, remoteCount, localCount: 0 });
        continue;
      }

      const firstBatch = await remoteClient.execute(`SELECT * FROM ${quoteIdent(table)} LIMIT ${BATCH_SIZE} OFFSET 0`);
      const rows = firstBatch.rows;
      const columns = Object.keys(rows[0] || {});

      if (!columns.length) {
        throw new Error(`表 ${table} 未能解析列信息`);
      }

      const placeholders = columns.map(() => '?').join(', ');

      const insertStmt = localDb.prepare(
        `INSERT INTO ${quoteIdent(table)} (${columns.map(quoteIdent).join(', ')}) VALUES (${placeholders})`
      );

      const insertMany = localDb.transaction((rowsToInsert) => {
        for (const row of rowsToInsert) {
          const values = columns.map(c => row[c]);
          insertStmt.run(values);
        }
      });

      let inserted = 0;
      let offset = 0;

      while (true) {
        const batchRows = offset === 0
          ? rows
          : (await remoteClient.execute(
              `SELECT * FROM ${quoteIdent(table)} LIMIT ${BATCH_SIZE} OFFSET ${offset}`
            )).rows;

        if (!batchRows.length) {
          break;
        }

        insertMany(batchRows);
        inserted += batchRows.length;
        offset += batchRows.length;
        console.log(`    - 已同步 ${inserted}/${remoteCount} 行`);

        if (batchRows.length < BATCH_SIZE) {
          break;
        }
      }

      const localCount = Number(
        localDb.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdent(table)}`).get().count || 0
      );

      if (localCount !== remoteCount) {
        throw new Error(`表 ${table} 行数校验失败: remote=${remoteCount}, local=${localCount}`);
      }

      summary.push({ table, remoteCount, localCount });
    }

    localDb.pragma('foreign_keys = ON');
    const integrity = localDb.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') {
      throw new Error(`本地 SQLite integrity_check 失败: ${integrity}`);
    }

    console.log('🎉 数据库复刻完成！');
    console.table(summary);
    console.log(`💡 您现在可以修改 DB_SOURCE="local" 使用此数据库进行调试。`);

  } catch (error) {
    console.error('❌ 同步过程中发生错误:', error);
    process.exitCode = 1;
  } finally {
    localDb.close();
  }
}

main();
