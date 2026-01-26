import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getDbClient } from '@/lib/db';

/**
 * 批量 Dashboard API
 * 一次性获取用户所有监控股票的完整数据
 * 
 * GET /api/dashboard?userId=xxx
 * 返回: { stocks: [...], timestamp: string }
 */
export async function GET(request: Request) {
    const startTime = Date.now();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const historyLimit = parseInt(searchParams.get('historyLimit') || '7');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    try {
        const client = getDbClient();

        try {
            // Step 1: 获取用户监控列表
            let watchlist: { symbol: string; name: string }[];
            if ('execute' in client) {
                const rs = await client.execute({
                    sql: `SELECT uw.symbol, gp.name 
                          FROM user_watchlist uw
                          LEFT JOIN global_stock_pool gp ON uw.symbol = gp.symbol
                          WHERE uw.user_id = ?
                          ORDER BY uw.added_at DESC`,
                    args: [userId],
                });
                watchlist = rs.rows as unknown as { symbol: string; name: string }[];
            } else {
                watchlist = client
                    .prepare(
                        `SELECT uw.symbol, gp.name 
                         FROM user_watchlist uw
                         LEFT JOIN global_stock_pool gp ON uw.symbol = gp.symbol
                         WHERE uw.user_id = ?
                         ORDER BY uw.added_at DESC`
                    )
                    .all(userId) as { symbol: string; name: string }[];
            }

            if (watchlist.length === 0) {
                return NextResponse.json({
                    stocks: [],
                    timestamp: new Date().toISOString(),
                    queryTime: Date.now() - startTime
                });
            }

            // Step 2: 批量获取所有股票的最新价格
            const symbols = watchlist.map(w => w.symbol);
            const placeholders = symbols.map(() => '?').join(',');

            let latestPrices: Record<string, unknown>[];
            let allHistory: Record<string, unknown>[];

            if ('execute' in client) {
                // Turso: 使用批量查询
                const [pricesRs, historyRs] = await Promise.all([
                    // 每只股票的最新价格
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
                    // 历史预测（合并查询，使用窗口函数限制条数）
                    client.execute({
                        sql: `WITH RankedPredictions AS (
                                  SELECT p.symbol, p.date, p.target_date, p.signal, p.confidence,
                                         p.support_price, p.ai_reasoning, p.validation_status, p.actual_change,
                                         p.is_primary, p.model_id as model, m.display_name,
                                         d.close as close_price,
                                         d.rsi, d.kdj_k, d.kdj_d, d.kdj_j,
                                         d.macd, d.macd_signal, d.macd_hist,
                                         d.boll_upper, d.boll_mid, d.boll_lower,
                                         ROW_NUMBER() OVER (PARTITION BY p.symbol ORDER BY p.date DESC) as rn
                                  FROM ai_predictions_v2 p
                                  LEFT JOIN prediction_models m ON p.model_id = m.model_id
                                  LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.target_date = d.date
                                  WHERE p.symbol IN (${placeholders}) AND p.is_primary = 1
                              )
                              SELECT * FROM RankedPredictions WHERE rn <= ?
                              ORDER BY symbol, date DESC`,
                        args: [...symbols, historyLimit]
                    })
                ]);

                latestPrices = pricesRs.rows as Record<string, unknown>[];
                allHistory = historyRs.rows as Record<string, unknown>[];
            } else {
                // SQLite: 本地查询
                latestPrices = client.prepare(
                    `SELECT dp.* FROM daily_prices dp
                     INNER JOIN (
                         SELECT symbol, MAX(date) as max_date
                         FROM daily_prices
                         WHERE symbol IN (${placeholders})
                         GROUP BY symbol
                     ) latest ON dp.symbol = latest.symbol AND dp.date = latest.max_date`
                ).all(...symbols) as Record<string, unknown>[];

                allHistory = client.prepare(
                    `WITH RankedPredictions AS (
                          SELECT p.symbol, p.date, p.target_date, p.signal, p.confidence,
                                 p.support_price, p.ai_reasoning, p.validation_status, p.actual_change,
                                 p.is_primary, p.model_id as model, m.display_name,
                                 d.close as close_price,
                                 d.rsi, d.kdj_k, d.kdj_d, d.kdj_j,
                                 d.macd, d.macd_signal, d.macd_hist,
                                 d.boll_upper, d.boll_mid, d.boll_lower,
                                 ROW_NUMBER() OVER (PARTITION BY p.symbol ORDER BY p.date DESC) as rn
                          FROM ai_predictions_v2 p
                          LEFT JOIN prediction_models m ON p.model_id = m.model_id
                          LEFT JOIN daily_prices d ON p.symbol = d.symbol AND p.target_date = d.date
                          WHERE p.symbol IN (${placeholders}) AND p.is_primary = 1
                      )
                      SELECT * FROM RankedPredictions WHERE rn <= ?
                      ORDER BY symbol, date DESC`
                ).all(...symbols, historyLimit) as Record<string, unknown>[];
            }

            // Step 3: 组装数据
            const priceMap = new Map(latestPrices.map(p => [p.symbol as string, p]));

            // 按股票分组历史 (包含最新的预测)
            const historyBySymbol = new Map<string, Record<string, unknown>[]>();
            for (const hist of allHistory) {
                const sym = hist.symbol as string;
                if (!historyBySymbol.has(sym)) {
                    historyBySymbol.set(sym, []);
                }
                historyBySymbol.get(sym)!.push(hist);
            }

            // 计算最新更新时间
            const getLastUpdateTime = () => {
                const now = new Date();
                const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                const hkTime = new Date(utc + (3600000 * 8));
                const hours = hkTime.getHours();
                const minutes = hkTime.getMinutes();
                const totalMinutes = hours * 60 + minutes;

                if (totalMinutes >= 960) return "16:00";
                if (totalMinutes < 570) return "16:00";
                if (totalMinutes >= 720 && totalMinutes < 780) return "12:00";

                const roundedMinutes = Math.floor(minutes / 10) * 10;
                return `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
            };

            const lastUpdateTime = getLastUpdateTime();

            // 组装最终结果
            const stocks = watchlist.map(w => {
                const history = historyBySymbol.get(w.symbol) || [];

                // 🌟 数据安全：只显示最近 7 天内的预测 (Strict filtering)
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

                // Ensure history is typed correctly for filtering
                const validPreds = (history as { date: string }[]).filter(p => p.date >= sevenDaysAgoStr);

                // Sort by date desc just in case
                // validPreds.sort((a, b) => b.date.localeCompare(a.date)); // Already sorted by SQL

                return {
                    symbol: w.symbol,
                    name: w.name,
                    price: priceMap.get(w.symbol) || null,
                    prediction: validPreds[0] || null,
                    previousPrediction: validPreds[1] || null,
                    history: history, // Return all fetched history (which is already limited by SQL LIMIT) or just validPreds? 
                    // Previous logic returned 'history' (all fetched). SQL Limit is now 7.
                    // So history contains at most 7 items.
                    lastUpdated: lastUpdateTime
                };
            });

            const queryTime = Date.now() - startTime;
            console.log(`📊 Dashboard API: ${watchlist.length} stocks, ${queryTime}ms`);

            return NextResponse.json({
                stocks,
                timestamp: new Date().toISOString(),
                queryTime
            });
        } finally {
            if (client && typeof client.close === 'function') {
                client.close();
            }
        }

    } catch (error) {
        console.error('Dashboard API Error:', error);
        return NextResponse.json({ error: 'Database error', details: String(error) }, { status: 500 });
    }
}
