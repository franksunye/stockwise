/**
 * Performance Benchmark Script
 * 用于测量数据库查询性能
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
    process.exit(1);
}

const client = createClient({
    url: TURSO_DB_URL,
    authToken: TURSO_AUTH_TOKEN,
});

async function benchmark(name, queryFn, iterations = 3) {
    const times = [];
    for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await queryFn();
        times.push(Date.now() - start);
    }
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const min = Math.min(...times);
    const max = Math.max(...times);
    console.log(`📊 ${name}: avg=${avg}ms, min=${min}ms, max=${max}ms`);
    return avg;
}

// 模拟批量 Dashboard API 查询
async function benchmarkBatchApi(symbols) {
    const placeholders = symbols.map(() => '?').join(',');
    
    const [watchlist, pricesRs, predictionsRs] = await Promise.all([
        // 模拟获取监控列表
        client.execute({
            sql: `SELECT uw.symbol, gp.name 
                  FROM user_watchlist uw
                  LEFT JOIN global_stock_pool gp ON uw.symbol = gp.symbol
                  WHERE uw.user_id = ?
                  ORDER BY uw.added_at DESC LIMIT 20`,
            args: ['test-user']
        }),
        // 批量获取所有股票最新价格
        client.execute({
            sql: `SELECT dp.* FROM daily_prices dp
                  INNER JOIN (
                      SELECT symbol, MAX(date) as max_date
                      FROM daily_prices
                      WHERE symbol IN (${placeholders})
                      GROUP BY symbol
                  ) latest ON dp.symbol = latest.symbol AND dp.date = latest.max_date`,
            args: symbols
        }),
        // 批量获取所有预测
        client.execute({
            sql: `SELECT p.*, m.display_name as model
                  FROM ai_predictions_v2 p
                  LEFT JOIN prediction_models m ON p.model_id = m.model_id
                  WHERE p.symbol IN (${placeholders}) AND p.is_primary = 1
                  ORDER BY p.symbol, p.date DESC`,
            args: symbols
        })
    ]);
    
    return { watchlist, pricesRs, predictionsRs };
}

async function main() {
    console.log('🔗 连接 Turso...');
    console.log('=' .repeat(60));
    console.log('🏁 开始性能基准测试\n');

    const testSymbol = '00700';

    // Query 1: 获取 AI 预测 (带 JOIN)
    const q1Avg = await benchmark('Query 1: AI预测(is_primary+JOIN)', async () => {
        await client.execute({
            sql: `SELECT p.*, m.display_name, d.close 
                  FROM ai_predictions_v2 p 
                  LEFT JOIN prediction_models m ON p.model_id = m.model_id 
                  LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.target_date = d.date 
                  WHERE p.symbol = ? AND p.is_primary = 1 
                  ORDER BY p.date DESC LIMIT 15`,
            args: [testSymbol]
        });
    });

    // Query 2: 获取最新价格
    const q2Avg = await benchmark('Query 2: 最新价格', async () => {
        await client.execute({
            sql: 'SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1',
            args: [testSymbol]
        });
    });

    // Query 3: 获取价格历史
    const q3Avg = await benchmark('Query 3: 价格历史(30条)', async () => {
        await client.execute({
            sql: 'SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 30',
            args: [testSymbol]
        });
    });

    // Query 4: 模拟完整刷新（5只股票）
    const testSymbols = ['00700', '02171', '600519', '601398', '300395'];
    const q4Avg = await benchmark('Query 4: 模拟刷新(5只股票)', async () => {
        await Promise.all(testSymbols.map(async (symbol) => {
            const [price, predictions] = await Promise.all([
                client.execute({
                    sql: 'SELECT * FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT 1',
                    args: [symbol]
                }),
                client.execute({
                    sql: `SELECT p.*, m.display_name 
                          FROM ai_predictions_v2 p 
                          LEFT JOIN prediction_models m ON p.model_id = m.model_id 
                          WHERE p.symbol = ? AND p.is_primary = 1 
                          ORDER BY p.date DESC LIMIT 15`,
                    args: [symbol]
                })
            ]);
            return { price, predictions };
        }));
    }, 2);

    // Query 5: 🚀 新批量 API (3个并行查询)
    const q5Avg = await benchmark('Query 5: 批量API(5只股票)', async () => {
        await benchmarkBatchApi(testSymbols);
    }, 3);

    console.log('\n' + '=' .repeat(60));
    console.log('📈 汇总:');
    console.log('');
    console.log('  [旧方案 - N+1请求]');
    console.log(`   单只股票查询: ~${q1Avg + q2Avg}ms`);
    console.log(`   5只股票刷新(10请求): ~${q4Avg}ms`);
    console.log(`   预计20只股票刷新(41请求): ~${Math.round(q4Avg * 4)}ms`);
    console.log('');
    console.log('  [新方案 - 批量API]');
    console.log(`   5只股票刷新(3请求): ~${q5Avg}ms`);
    console.log(`   预计20只股票刷新(3请求): ~${q5Avg}ms (常量时间)`);
    console.log('');
    const improvement = Math.round((1 - q5Avg / (q4Avg * 4)) * 100);
    console.log(`  ⚡ 性能提升: ${improvement}%`);
    console.log('=' .repeat(60));

    process.exit(0);
}

main().catch(console.error);
