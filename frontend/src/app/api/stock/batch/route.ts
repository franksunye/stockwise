import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { headers } from 'next/headers';
import { getUserTier } from '@/lib/user-server';
import { getModelSqlFilter } from '@/lib/membership-config';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    const historyLimit = parseInt(searchParams.get('historyLimit') || '7');

    if (!symbolsParam) {
        return NextResponse.json({ error: 'Missing symbols' }, { status: 400 });
    }

    const symbols = symbolsParam.split(',').filter(s => s.trim().length > 0);
    if (symbols.length === 0) return NextResponse.json({ stocks: [] });
    if (symbols.length > 50) return NextResponse.json({ error: 'Too many symbols' }, { status: 400 });

    const startTime = Date.now();

    try {
        const headersList = await headers();
        const userId = headersList.get('x-user-id');
        const userTier = await getUserTier(userId);
        const tierFilter = getModelSqlFilter(userTier);

        const client = getDbClient();
        const placeholders = symbols.map(() => '?').join(',');

        let latestPrices: Record<string, unknown>[];
        let allHistory: Record<string, unknown>[];

        try {
            const sql = `
                    WITH RankedPredictions AS (
                        SELECT p.symbol, p.date, p.target_date, p.signal, p.confidence,
                                p.support_price, p.ai_reasoning, p.validation_status, p.actual_change,
                                p.max_perf_in_window,
                                p.is_primary, p.model_id as model, m.display_name,
                                ROW_NUMBER() OVER (PARTITION BY p.symbol, p.target_date ORDER BY m.priority DESC) as rn_daily
                        FROM ai_predictions_v2 p
                        LEFT JOIN prediction_models m ON p.model_id = m.model_id
                        WHERE p.symbol IN (${placeholders}) AND (${tierFilter})
                    ),
                    DailyBest AS (
                        SELECT * FROM RankedPredictions WHERE rn_daily = 1
                    ),
                    HistoryRanked AS (
                        SELECT d.*, 
                               ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY target_date DESC) as rn_history
                        FROM DailyBest d
                    )
                    SELECT h.*, dp.close as close_price,
                           dp.rsi, dp.kdj_k, dp.kdj_d, dp.kdj_j, dp.macd, dp.macd_signal, dp.macd_hist, dp.boll_upper, dp.boll_mid, dp.boll_lower
                    FROM HistoryRanked h
                    LEFT JOIN daily_prices dp ON h.symbol = dp.symbol AND h.target_date = dp.date
                    WHERE h.rn_history <= ${historyLimit}
                    ORDER BY h.target_date DESC
                `;

            if ('execute' in client) {
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
                        sql,
                        args: symbols
                    })
                ]);
                latestPrices = pricesRs.rows as Record<string, unknown>[];
                allHistory = historyRs.rows as Record<string, unknown>[];
            } else {
                latestPrices = client.prepare(`
                        SELECT dp.* FROM daily_prices dp
                        INNER JOIN (
                            SELECT symbol, MAX(date) as max_date
                            FROM daily_prices
                            WHERE symbol IN (${placeholders})
                            GROUP BY symbol
                        ) latest ON dp.symbol = latest.symbol AND dp.date = latest.max_date
                    `).all(...symbols) as Record<string, unknown>[];

                allHistory = client.prepare(sql).all(...symbols) as Record<string, unknown>[];
            }
        } finally {
            if (client && typeof (client as { close?: () => void }).close === 'function') {
                (client as { close: () => void }).close();
            }
        }

        const priceMap = new Map(latestPrices.map(p => [p.symbol as string, p]));
        const historyBySymbol = new Map<string, Record<string, unknown>[]>();
        for (const hist of allHistory) {
            const sym = hist.symbol as string;
            if (!historyBySymbol.has(sym)) historyBySymbol.set(sym, []);
            historyBySymbol.get(sym)!.push(hist);
        }

        const hkTime = new Date(new Date().getTime() + (new Date().getTimezoneOffset() * 60000) + (3600000 * 8));
        const lastUpdateTime = `${hkTime.getHours().toString().padStart(2, '0')}:${(Math.floor(hkTime.getMinutes() / 10) * 10).toString().padStart(2, '0')}`;
        const hkDateStr = hkTime.toISOString().split('T')[0];

        // Calculate the threshold string exactly once to avoid redundant allocations inside the loop
        const PREDICTION_VALIDITY_DAYS = 20;
        const validDateThreshold = new Date(Date.now() - PREDICTION_VALIDITY_DAYS * 86400000).toISOString().split('T')[0];

        const stocks = symbols.map(sym => {
            const history = historyBySymbol.get(sym) || [];
            const price = priceMap.get(sym) as Record<string, unknown> | undefined;
            const validPreds = (history as { date: string }[]).filter(p => p.date >= validDateThreshold);

            return {
                symbol: sym,
                price: price || null,
                prediction: validPreds[0] || null,
                previousPrediction: validPreds[1] || null,
                history,
                lastUpdated: (price?.date && String(price.date) < hkDateStr) ? `${String(price.date).substring(5)} ${lastUpdateTime}` : lastUpdateTime
            };
        });

        const response = NextResponse.json({ stocks, tier: userTier, queryTime: Date.now() - startTime });
        response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
        response.headers.set('Vary', 'x-user-id');
        return response;
    } catch (error) {
        console.error('Batch Stock API Error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
