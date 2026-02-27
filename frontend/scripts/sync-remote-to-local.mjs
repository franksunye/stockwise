import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 backend/.env 文件
config({ path: resolve(__dirname, '../../backend/.env') });

const TURSO_DB_URL = process.env.TURSO_DB_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DB_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ 缺少环境变量 TURSO_DB_URL 或 TURSO_AUTH_TOKEN');
  process.exit(1);
}

const remoteClient = createClient({
  url: TURSO_DB_URL,
  authToken: TURSO_AUTH_TOKEN,
});

const localDbPath = resolve(__dirname, '../../data/stockwise.db');

async function main() {
  console.log('🔄 开始从 Turso 拉取并覆盖本地 SQLite 数据库...');
  
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
    
    for (const table of tables) {
      console.log(`📥 正在同步表 \`${table}\` ...`);
      
      const dataResult = await remoteClient.execute(`SELECT * FROM ${table}`);
      const rows = dataResult.rows;
      
      if (rows.length === 0) {
        console.log(`    - 无数据`);
        continue;
      }

      // 获取列名
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      
      // 准备批量插入语句
      const insertStmt = localDb.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
      
      // 使用事务批量插入
      const insertMany = localDb.transaction((rowsToInsert) => {
        for (const row of rowsToInsert) {
          // values as array matching columns order
          const values = columns.map(c => row[c]);
          insertStmt.run(values);
        }
      });
      
      insertMany(rows);
      console.log(`    - 同步了 ${rows.length} 行`);
    }

    console.log('🎉 数据库复刻完成！');
    console.log(`💡 您现在可以修改 DB_SOURCE="local" 使用此数据库进行调试。`);

  } catch (error) {
    console.error('❌ 同步过程中发生错误:', error);
  } finally {
    localDb.close();
    process.exit(0);
  }
}

main();
