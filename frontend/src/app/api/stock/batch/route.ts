import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

export const dynamic = 'force-dynamic'; // Next.js 默认动态，通过 Header 控制 CDN 缓存

/**
 * 公有数据接口：批量获取股票行情与预测
 * GET /api/stock/batch?symbols=00700,09988
 * 
 * 核心策略：
 * 1. 纯公共数据，不含用户信息
 * 2. 设置 Cache-Control 头，允许 CDN (Cloudflare/Vercel) 缓存
 * 3. 50万用户高并发下的流量挡板
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    const historyLimit = parseInt(searchParams.get('historyLimit') || '7');

    if (!symbolsParam) {
        return NextResponse.json({ error: 'Missing symbols' }, { status: 400 });
    }

    const symbols = symbolsParam.split(',').filter(s => s.trim().length > 0);
    if (symbols.length === 0) {
        return NextResponse.json({ stocks: [] });
    }

    // 限制单次最大查询数量，防止 URL 过长或 SQL 压力过大
    if (symbols.length > 50) {
        return NextResponse.json({ error: 'Too many symbols' }, { status: 400 });
    }

    const startTime = Date.now();

    try {
        const client = getDbClient();
        const placeholders = symbols.map(() => '?').join(',');

        let latestPrices: Record<string, unknown>[];
        let allHistory: Record<string, unknown>[];

        if ('execute' in client) {
            // Turso
            const [pricesRs, historyRs] = await Promise.all([
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
            // SQLite Local
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

        // 组装逻辑
        const priceMap = new Map(latestPrices.map(p => [p.symbol as string, p]));
        const historyBySymbol = new Map<string, Record<string, unknown>[]>();

        for (const hist of allHistory) {
            const sym = hist.symbol as string;
            if (!historyBySymbol.has(sym)) {
                historyBySymbol.set(sym, []);
            }
            historyBySymbol.get(sym)!.push(hist);
        }

        // 计算最后更新时间 (UTC+8) -> 此处只是数据层面的时间，实际上 CDN 缓存后这个时间也是缓存的
        // 真实性：对于公有数据，这个“最后更新时间”应该是数据本身的时间，而不是查询时间
        // 但为了复用之前的 UI 逻辑，我们先计算出来
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const hkTime = new Date(utc + (3600000 * 8));
        const hours = hkTime.getHours();
        const minutes = hkTime.getMinutes();
        const roundedMinutes = Math.floor(minutes / 10) * 10;
        const lastUpdateTime = `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;

        const stocks = symbols.map(sym => {
            const history = historyBySymbol.get(sym) || [];

            // 数据安全处理
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
            const validPreds = (history as { date: string }[]).filter(p => p.date >= sevenDaysAgoStr);

            return {
                symbol: sym,
                price: priceMap.get(sym) || null,
                prediction: validPreds[0] || null,
                previousPrediction: validPreds[1] || null,
                history: history,
                lastUpdated: lastUpdateTime
            };
        });

        const queryTime = Date.now() - startTime;

        // 🚀🔥 核心魔法：设置 CDN 缓存头
        // s-maxage=300: 边缘节点缓存 5 分钟
        // stale-while-revalidate=60: 过期后 60秒内，允许先返回旧的，后台再去取新的 (丝滑)
        const response = NextResponse.json({
            stocks,
            queryTime
        });

        response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
        response.headers.set('CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60'); // Cloudflare Specific
        response.headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60'); // Vercel Specific

        return response;

    } catch (error) {
        console.error('Batch Stock API Error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
