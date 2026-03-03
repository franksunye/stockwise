import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { getUserTier } from '@/lib/user-server';
import { getModelSqlFilter } from '@/lib/membership-config';
import { requireUserSession } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');
    const parsedHistoryLimit = Number.parseInt(searchParams.get('historyLimit') || '7', 10);
    const historyLimit = Number.isFinite(parsedHistoryLimit)
        ? Math.min(30, Math.max(1, parsedHistoryLimit))
        : 7;

    if (!symbolsParam) {
        return NextResponse.json({ error: 'Missing symbols' }, { status: 400 });
    }

    const symbols = symbolsParam ? symbolsParam.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
    if (symbols.length > 50) return NextResponse.json({ error: 'Too many symbols' }, { status: 400 });

    const startTime = Date.now();

    try {
        const auth = requireUserSession(request);
        if ('response' in auth) return auth.response;
        const userId = auth.userId;
        const userTier = await getUserTier(userId);
        const tierFilter = getModelSqlFilter(userTier);

        const client = getDbClient();
        let latestPrices: Record<string, unknown>[] = [];
        let allHistory: Record<string, unknown>[] = [];
        let shortMetricsRows: Record<string, unknown>[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let almanacs: any[] = [];

        try {
            if ('execute' in client) {
                if (symbols.length > 0) {
                    const placeholders = symbols.map(() => '?').join(',');
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
                    const targetValues = symbols.map(() => '(?)').join(',');
                    const shortSql = `
                        WITH target(symbol) AS (VALUES ${targetValues}),
                        daily_latest AS (
                            SELECT d.symbol, d.trade_date, d.short_volume, d.short_turnover, d.short_volume_ratio, d.short_turnover_ratio, d.quality_flag
                            FROM hk_short_selling_daily d
                            INNER JOIN (
                                SELECT symbol, MAX(trade_date) AS max_date
                                FROM hk_short_selling_daily
                                WHERE symbol IN (SELECT symbol FROM target)
                                GROUP BY symbol
                            ) m ON d.symbol = m.symbol AND d.trade_date = m.max_date
                        ),
                        weekly_latest AS (
                            SELECT w.symbol, w.report_week, w.short_interest_shares, w.short_interest_market_value, w.quality_flag
                            FROM hk_short_interest_weekly w
                            INNER JOIN (
                                SELECT symbol, MAX(report_week) AS max_week
                                FROM hk_short_interest_weekly
                                WHERE symbol IN (SELECT symbol FROM target)
                                GROUP BY symbol
                            ) m ON w.symbol = m.symbol AND w.report_week = m.max_week
                        ),
                        eligible_latest AS (
                            SELECT e.symbol, e.is_eligible, e.snapshot_date
                            FROM hk_short_eligible_list e
                            INNER JOIN (
                                SELECT symbol, MAX(snapshot_date) AS max_snapshot
                                FROM hk_short_eligible_list
                                WHERE symbol IN (SELECT symbol FROM target)
                                GROUP BY symbol
                            ) m ON e.symbol = m.symbol AND e.snapshot_date = m.max_snapshot
                        )
                        SELECT t.symbol,
                               d.trade_date, d.short_volume, d.short_turnover, d.short_volume_ratio, d.short_turnover_ratio, d.quality_flag AS daily_quality_flag,
                               w.report_week, w.short_interest_shares, w.short_interest_market_value, w.quality_flag AS weekly_quality_flag,
                               e.is_eligible, e.snapshot_date
                        FROM target t
                        LEFT JOIN daily_latest d ON t.symbol = d.symbol
                        LEFT JOIN weekly_latest w ON t.symbol = w.symbol
                        LEFT JOIN eligible_latest e ON t.symbol = e.symbol
                    `;
                    const [pricesRs, historyRs, shortRs] = await Promise.all([
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
                        }),
                        client.execute({
                            sql: shortSql,
                            args: symbols
                        })
                    ]);
                    if (pricesRs.rows && pricesRs.rows.length > 0) latestPrices = pricesRs.rows as Record<string, unknown>[];
                    if (historyRs.rows && historyRs.rows.length > 0) allHistory = historyRs.rows as Record<string, unknown>[];
                    if (shortRs.rows && shortRs.rows.length > 0) shortMetricsRows = shortRs.rows as Record<string, unknown>[];
                }

                const rsAlmanac = await client.execute({ sql: 'SELECT * FROM market_almanacs ORDER BY target_date DESC LIMIT 5', args: [] });
                if (rsAlmanac.rows && rsAlmanac.rows.length > 0) almanacs = rsAlmanac.rows;
            } else {
                if (symbols.length > 0) {
                    const placeholders = symbols.map(() => '?').join(',');
                    latestPrices = client.prepare(`
                            SELECT dp.* FROM daily_prices dp
                            INNER JOIN (
                                SELECT symbol, MAX(date) as max_date
                                FROM daily_prices
                                WHERE symbol IN (${placeholders})
                                GROUP BY symbol
                            ) latest ON dp.symbol = latest.symbol AND dp.date = latest.max_date
                        `).all(...symbols) as Record<string, unknown>[];

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
                    const targetValues = symbols.map(() => '(?)').join(',');
                    const shortSql = `
                        WITH target(symbol) AS (VALUES ${targetValues}),
                        daily_latest AS (
                            SELECT d.symbol, d.trade_date, d.short_volume, d.short_turnover, d.short_volume_ratio, d.short_turnover_ratio, d.quality_flag
                            FROM hk_short_selling_daily d
                            INNER JOIN (
                                SELECT symbol, MAX(trade_date) AS max_date
                                FROM hk_short_selling_daily
                                WHERE symbol IN (SELECT symbol FROM target)
                                GROUP BY symbol
                            ) m ON d.symbol = m.symbol AND d.trade_date = m.max_date
                        ),
                        weekly_latest AS (
                            SELECT w.symbol, w.report_week, w.short_interest_shares, w.short_interest_market_value, w.quality_flag
                            FROM hk_short_interest_weekly w
                            INNER JOIN (
                                SELECT symbol, MAX(report_week) AS max_week
                                FROM hk_short_interest_weekly
                                WHERE symbol IN (SELECT symbol FROM target)
                                GROUP BY symbol
                            ) m ON w.symbol = m.symbol AND w.report_week = m.max_week
                        ),
                        eligible_latest AS (
                            SELECT e.symbol, e.is_eligible, e.snapshot_date
                            FROM hk_short_eligible_list e
                            INNER JOIN (
                                SELECT symbol, MAX(snapshot_date) AS max_snapshot
                                FROM hk_short_eligible_list
                                WHERE symbol IN (SELECT symbol FROM target)
                                GROUP BY symbol
                            ) m ON e.symbol = m.symbol AND e.snapshot_date = m.max_snapshot
                        )
                        SELECT t.symbol,
                               d.trade_date, d.short_volume, d.short_turnover, d.short_volume_ratio, d.short_turnover_ratio, d.quality_flag AS daily_quality_flag,
                               w.report_week, w.short_interest_shares, w.short_interest_market_value, w.quality_flag AS weekly_quality_flag,
                               e.is_eligible, e.snapshot_date
                        FROM target t
                        LEFT JOIN daily_latest d ON t.symbol = d.symbol
                        LEFT JOIN weekly_latest w ON t.symbol = w.symbol
                        LEFT JOIN eligible_latest e ON t.symbol = e.symbol
                    `;
                    allHistory = client.prepare(sql).all(...symbols) as Record<string, unknown>[];
                    shortMetricsRows = client.prepare(shortSql).all(...symbols) as Record<string, unknown>[];
                }
                almanacs = client.prepare('SELECT * FROM market_almanacs ORDER BY target_date DESC LIMIT 5').all();
            }
            if (almanacs.length > 0) {
                almanacs.forEach(a => {
                    try {
                        if (typeof a.market_entropy === 'string') a.market_entropy = JSON.parse(a.market_entropy);
                        if (typeof a.sector_currents === 'string') a.sector_currents = JSON.parse(a.sector_currents);
                        if (typeof a.generation_trace === 'string') a.generation_trace = JSON.parse(a.generation_trace);
                        a.degraded = Boolean(
                            a?.generation_trace?.logic?.degraded ||
                            (a?.generation_trace?.data_quality?.facts_gate_pass === false)
                        );
                    } catch { }
                });
            }

        } finally {
            if (client && typeof (client as { close?: () => void }).close === 'function') {
                (client as { close: () => void }).close();
            }
        }

        const priceMap = new Map(latestPrices.map(p => [p.symbol as string, p]));
        const shortMetricsMap = new Map(shortMetricsRows.map(m => [m.symbol as string, m]));
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
                shortMetrics: shortMetricsMap.get(sym) || null,
                lastUpdated: (price?.date && String(price.date) < hkDateStr) ? `${String(price.date).substring(5)} ${lastUpdateTime}` : lastUpdateTime
            };
        });

        const response = NextResponse.json({
            stocks,
            almanacs,
            almanac: almanacs[0] || null, // Keep for fallback
            tier: userTier,
            queryTime: Date.now() - startTime
        });
        response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=30');
        response.headers.set('Vary', 'Cookie');
        return response;
    } catch (error) {
        console.error('Batch Stock API Error:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
