/* eslint-disable @typescript-eslint/no-explicit-any */
import { unstable_cache } from 'next/cache';
import { getDbClient } from '@/lib/db';

/**
 * 缓存获取最新价格 (15分钟)
 */
export const getCachedLatestPrices = unstable_cache(
    async (symbols: string[]) => {
        if (symbols.length === 0) return [];
        const client = getDbClient();
        try {
            const placeholders = symbols.map(() => '?').join(',');
            let rows: Record<string, unknown>[] = [];
            if ('execute' in client) {
                const rs = await client.execute({
                    sql: `SELECT dp.* FROM daily_prices dp
                          INNER JOIN (
                              SELECT symbol, MAX(date) as max_date
                              FROM daily_prices
                              WHERE symbol IN (${placeholders})
                              GROUP BY symbol
                          ) latest ON dp.symbol = latest.symbol AND dp.date = latest.max_date`,
                    args: symbols
                });
                rows = rs.rows as Record<string, unknown>[];
            } else {
                const result = client.prepare(`
                    SELECT dp.* FROM daily_prices dp
                    INNER JOIN (
                        SELECT symbol, MAX(date) as max_date
                        FROM daily_prices
                        WHERE symbol IN (${placeholders})
                        GROUP BY symbol
                    ) latest ON dp.symbol = latest.symbol AND dp.date = latest.max_date
                `).all(...symbols) as any[];
                rows = result as Record<string, unknown>[];
            }
            return rows;
        } finally {
            if (client && typeof (client as any).close === 'function') (client as any).close();
        }
    },
    ['latest-prices'],
    { revalidate: 900, tags: ['daily-prices'] }
);

/**
 * 缓存获取 HK 卖空数据 (1小时)
 */
export const getCachedShortMetrics = unstable_cache(
    async (symbols: string[]) => {
        if (symbols.length === 0) return [];
        const client = getDbClient();
        try {
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
            
            let rows: Record<string, unknown>[] = [];
            if ('execute' in client) {
                const rs = await client.execute({
                    sql: shortSql,
                    args: symbols
                });
                rows = rs.rows as Record<string, unknown>[];
            } else {
                const result = client.prepare(shortSql).all(...symbols) as any[];
                rows = result as Record<string, unknown>[];
            }
            return rows;
        } finally {
            if (client && typeof (client as any).close === 'function') (client as any).close();
        }
    },
    ['short-metrics'],
    { revalidate: 3600, tags: ['hk-short'] }
);
