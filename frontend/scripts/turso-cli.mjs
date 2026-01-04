/**
 * Turso Database CLI Tool
 * 用于本地操作 Turso 远程数据库
 * 
 * 使用方法:
 *   node scripts/turso-cli.mjs query "SELECT * FROM stock_pool"
 *   node scripts/turso-cli.mjs tables
 *   node scripts/turso-cli.mjs count daily_prices
 */

import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// 加载 backend/.env 文件
config({ path: resolve(process.cwd(), 'backend/.env') });

const TURSO_DB_URL = process.env.TURSO_DB_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_DB_URL || !TURSO_AUTH_TOKEN) {
  console.error('❌ 缺少环境变量 TURSO_DB_URL 或 TURSO_AUTH_TOKEN');
  console.error('   请确保 backend/.env 文件存在并包含正确的配置');
  process.exit(1);
}

const client = createClient({
  url: TURSO_DB_URL,
  authToken: TURSO_AUTH_TOKEN,
});

async function main() {
  const [,, command, ...args] = process.argv;

  console.log(`🔗 连接 Turso: ${TURSO_DB_URL.substring(0, 50)}...`);

  try {
    switch (command) {
      case 'query':
      case 'sql':
        // 执行任意 SQL
        const sql = args.join(' ');
        if (!sql) {
          console.error('❌ 请提供 SQL 语句');
          console.error('   示例: node scripts/turso-cli.mjs query "SELECT * FROM stock_pool"');
          process.exit(1);
        }
        console.log(`📝 执行: ${sql}\n`);
        const result = await client.execute(sql);
        console.log(`✅ 影响行数: ${result.rowsAffected}`);
        if (result.rows.length > 0) {
          console.table(result.rows);
        }
        break;

      case 'tables':
        // 列出所有表
        const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        console.log('\n📋 数据库表:');
        tables.rows.forEach(row => console.log(`   - ${row.name}`));
        break;

      case 'count':
        // 统计表记录数
        const tableName = args[0] || 'daily_prices';
        const count = await client.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        console.log(`\n📊 ${tableName}: ${count.rows[0].count} 条记录`);
        break;

      case 'stocks':
        // 显示股票池
        const stocks = await client.execute('SELECT * FROM stock_pool ORDER BY added_at');
        console.log('\n📈 股票池:');
        console.table(stocks.rows);
        break;

      case 'latest':
        // 显示最新数据
        const symbol = args[0] || '00700';
        const latest = await client.execute(`
          SELECT symbol, date, close, ma5, macd, rsi 
          FROM daily_prices 
          WHERE symbol = '${symbol}' 
          ORDER BY date DESC 
          LIMIT 5
        `);
        console.log(`\n📈 ${symbol} 最新数据:`);
        console.table(latest.rows);
        break;

      default:
        console.log(`
Turso CLI 工具 - 使用方法:

  node scripts/turso-cli.mjs tables              列出所有表
  node scripts/turso-cli.mjs stocks              显示股票池
  node scripts/turso-cli.mjs count <table>       统计表记录数
  node scripts/turso-cli.mjs latest <symbol>     显示某股票最新数据
  node scripts/turso-cli.mjs query "<SQL>"       执行任意 SQL
        `);
    }
  } catch (error) {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
