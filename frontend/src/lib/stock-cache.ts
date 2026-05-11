/* eslint-disable @typescript-eslint/no-explicit-any */
import { unstable_cache } from 'next/cache';
import { getDbClient } from '@/lib/db';

const LATEST_PRICES_SQL = `SELECT dp.* FROM daily_prices dp
INNER JOIN (
    SELECT symbol, MAX(date) as max_date
    FROM daily_prices
    WHERE symbol IN (%PLACEHOLDERS%)
    GROUP BY symbol
) latest ON dp.symbol = latest.symbol AND dp.date = latest.max_date`;

const LATEST_BROADCAST_PRICES_SQL = `WITH pool AS (
    SELECT gp.symbol
    FROM global_stock_pool gp
    JOIN stock_meta sm ON gp.symbol = sm.symbol
),
latest AS (
    SELECT symbol, MAX(date) AS max_date
    FROM daily_prices
    WHERE symbol IN (SELECT symbol FROM pool)
    GROUP BY symbol
)
SELECT dp.symbol, dp.date, dp.close, dp.change_percent
FROM daily_prices dp
JOIN latest l ON dp.symbol = l.symbol AND dp.date = l.max_date
ORDER BY dp.symbol
LIMIT ?`;

const LATEST_BROADCAST_PRICES_BY_MARKET_SQL = `WITH pool AS (
    SELECT gp.symbol
    FROM global_stock_pool gp
    JOIN stock_meta sm ON gp.symbol = sm.symbol
    WHERE LOWER(sm.market) = LOWER(?)
),
latest AS (
    SELECT symbol, MAX(date) AS max_date
    FROM daily_prices
    WHERE symbol IN (SELECT symbol FROM pool)
    GROUP BY symbol
)
SELECT dp.symbol, dp.date, dp.close, dp.change_percent
FROM daily_prices dp
JOIN latest l ON dp.symbol = l.symbol AND dp.date = l.max_date
ORDER BY dp.symbol
LIMIT ?`;

const PRICE_HISTORY_SQL = `
SELECT symbol, date, close, change_percent
FROM daily_prices
WHERE symbol = ?
  AND close IS NOT NULL
ORDER BY date DESC
LIMIT ?
`;

async function queryLatestPrices(symbols: string[]): Promise<Record<string, unknown>[]> {
    if (symbols.length === 0) return [];
    const client = getDbClient();
    try {
        const placeholders = symbols.map(() => '?').join(',');
        const sql = LATEST_PRICES_SQL.replace('%PLACEHOLDERS%', placeholders);
        let rows: Record<string, unknown>[] = [];
        if ('execute' in client) {
            const rs = await client.execute({ sql, args: symbols });
            rows = rs.rows as Record<string, unknown>[];
        } else {
            rows = client.prepare(sql).all(...symbols) as any[];
        }
        return rows;
    } finally {
        if (client && typeof (client as any).close === 'function') (client as any).close();
    }
}

/**
 * 直接查询最新价格（无缓存）— 供价格刷新端点使用，保证实时性。
 */
export const getLatestPrices = queryLatestPrices;

export async function getPriceHistory(
    symbol: string,
    limit: number = 30,
): Promise<Record<string, unknown>[]> {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return [];
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 2), 90) : 30;
    const client = getDbClient();
    try {
        let rows: Record<string, unknown>[] = [];
        if ('execute' in client) {
            const rs = await client.execute({
                sql: PRICE_HISTORY_SQL,
                args: [normalized, safeLimit],
            });
            rows = rs.rows as Record<string, unknown>[];
        } else {
            rows = client.prepare(PRICE_HISTORY_SQL).all(normalized, safeLimit) as any[];
        }
        return rows.reverse();
    } finally {
        if (client && typeof (client as any).close === 'function') (client as any).close();
    }
}

/**
 * 缓存获取最新价格 (2分钟) — 供 batch 端点使用，平衡新鲜度与 DB 负载。
 */
export const getCachedLatestPrices = unstable_cache(
    queryLatestPrices,
    ['latest-prices'],
    { revalidate: 120, tags: ['daily-prices'] }
);

async function queryLatestBroadcastPrices(
    market: string = 'all',
    limit: number = 200,
): Promise<Record<string, unknown>[]> {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 1000) : 200;
    const client = getDbClient();
    try {
        let rows: Record<string, unknown>[] = [];
        const normalizedMarket = market.toLowerCase();
        const sql = normalizedMarket === 'hk' || normalizedMarket === 'cn'
            ? LATEST_BROADCAST_PRICES_BY_MARKET_SQL
            : LATEST_BROADCAST_PRICES_SQL;
        const args: (string | number)[] = sql === LATEST_BROADCAST_PRICES_BY_MARKET_SQL
            ? [normalizedMarket, safeLimit]
            : [safeLimit];
        if ('execute' in client) {
            const rs = await client.execute({
                sql,
                args,
            });
            rows = rs.rows as Record<string, unknown>[];
        } else {
            rows = client.prepare(sql).all(...args) as any[];
        }
        return rows;
    } finally {
        if (client && typeof (client as any).close === 'function') (client as any).close();
    }
}

/**
 * 广播价格快照（30 秒）— 供 /api/stock/prices/all 使用。
 * 将价格查询从 per-user symbols 请求收敛为公共全量查询。
 */
export const getCachedBroadcastPrices = unstable_cache(
    queryLatestBroadcastPrices,
    ['broadcast-prices'],
    { revalidate: 30, tags: ['daily-prices', 'broadcast-prices'] },
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
