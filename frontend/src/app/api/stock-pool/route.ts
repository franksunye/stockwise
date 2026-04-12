import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getDbClient } from '../../../lib/db';
import { triggerOnDemandSync } from '@/lib/github-actions';
import { getMarketFromSymbol, getExpectedLatestDataDate } from '@/lib/date-utils';
import type { Client } from '@libsql/client';
import type { Database } from 'better-sqlite3';
import { requireUserSession } from '@/lib/user-session';

/**
 * GET /api/stock-pool
 * 获取当前会话用户的股票池
 */
export async function GET(request: Request) {
    const auth = requireUserSession(request);
    if ('response' in auth) return auth.response;
    const userId = auth.userId;

    const client = getDbClient() as Client | Database;
    try {
        let stocks: { symbol: string; name?: string; name_en?: string | null; added_at?: string }[] = [];

        if ('execute' in client) {
            // Turso
            const rs = await client.execute({
                sql: `SELECT uw.symbol,
                             COALESCE(sm.name, gp.name) AS name,
                             sm.name_en AS name_en,
                             uw.added_at
                      FROM user_watchlist uw
                      LEFT JOIN global_stock_pool gp ON uw.symbol = gp.symbol
                      LEFT JOIN stock_meta sm ON uw.symbol = sm.symbol
                      WHERE uw.user_id = ?
                      ORDER BY uw.added_at DESC`,
                args: [userId],
            });
            stocks = rs.rows as unknown as { symbol: string; name?: string; name_en?: string | null; added_at?: string }[];
        } else {
            // SQLite
            stocks = client
                .prepare(
                    `SELECT uw.symbol,
                            COALESCE(sm.name, gp.name) AS name,
                            sm.name_en AS name_en,
                            uw.added_at
                     FROM user_watchlist uw
                     LEFT JOIN global_stock_pool gp ON uw.symbol = gp.symbol
                     LEFT JOIN stock_meta sm ON uw.symbol = sm.symbol
                     WHERE uw.user_id = ?
                      ORDER BY uw.added_at DESC`
                )
                .all(userId) as { symbol: string; name?: string; name_en?: string | null; added_at?: string }[];
        }

        return NextResponse.json({ stocks });
    } catch (error) {
        console.error('Fetch user watchlist error:', error);
        return NextResponse.json({ stocks: [] }, { status: 500 });
    } finally {
        if (client && typeof client.close === 'function') {
            client.close();
        }
    }
}

/**
 * POST /api/stock-pool
 * 添加股票到用户关注列表
 */
export async function POST(request: Request) {
    try {
        const auth = requireUserSession(request);
        if ('response' in auth) return auth.response;
        const userId = auth.userId;
        const { symbol, name } = await request.json();

        if (!symbol) {
            return NextResponse.json(
                { error: 'Missing symbol' },
                { status: 400 }
            );
        }

        const client = getDbClient();
        const displayName = name || `股票 ${symbol} `;
        const now = new Date().toISOString();

        // 标记是否为新股票（用于决定是否触发即时同步）

        if ('execute' in client) {
            const existingWatch = await client.execute({
                sql: 'SELECT 1 FROM user_watchlist WHERE user_id = ? AND symbol = ? LIMIT 1',
                args: [userId, symbol],
            });
            const alreadyWatched = existingWatch.rows.length > 0;

            // Turso
            // 1. 添加到用户关注列表
            await client.execute({
                sql: 'INSERT OR IGNORE INTO user_watchlist (user_id, symbol, added_at) VALUES (?, ?, ?)',
                args: [userId, symbol, now],
            });

            // 2. 仅在“本用户本次新增”时更新全局股票池，避免重复添加虚增 watchers_count
            if (!alreadyWatched) {
                const existing = await client.execute({
                    sql: 'SELECT watchers_count FROM global_stock_pool WHERE symbol = ?',
                    args: [symbol],
                });

                if (existing.rows.length > 0) {
                    await client.execute({
                        sql: 'UPDATE global_stock_pool SET watchers_count = watchers_count + 1 WHERE symbol = ?',
                        args: [symbol],
                    });
                } else {
                    await client.execute({
                        sql: 'INSERT INTO global_stock_pool (symbol, name, watchers_count, first_watched_at) VALUES (?, ?, 1, ?)',
                        args: [symbol, displayName, now],
                    });
                }
            }
        } else {
            const existingWatch = client
                .prepare('SELECT 1 FROM user_watchlist WHERE user_id = ? AND symbol = ? LIMIT 1')
                .get(userId, symbol) as { 1: number } | undefined;
            const alreadyWatched = Boolean(existingWatch);

            // SQLite
            // 1. 添加到用户关注列表
            client
                .prepare('INSERT OR IGNORE INTO user_watchlist (user_id, symbol, added_at) VALUES (?, ?, ?)')
                .run(userId, symbol, now);

            // 2. 仅在“本用户本次新增”时更新全局股票池
            if (!alreadyWatched) {
                const existing = client
                    .prepare('SELECT watchers_count FROM global_stock_pool WHERE symbol = ?')
                    .get(symbol);

                if (existing) {
                    client
                        .prepare('UPDATE global_stock_pool SET watchers_count = watchers_count + 1 WHERE symbol = ?')
                        .run(symbol);
                } else {
                    client
                        .prepare('INSERT INTO global_stock_pool (symbol, name, watchers_count, first_watched_at) VALUES (?, ?, 1, ?)')
                        .run(symbol, displayName, now);
                }
            }
        }

        // 3. 核心改进：基于“数据实质内容”判断是否触发同步 (方案 B 升级版)
        // 逻辑：查询该股票在 daily_prices 中的最新日期，与市场应有的 ECD (Expected Content Date) 对比
        const market = getMarketFromSymbol(symbol);
        const expectedDate = getExpectedLatestDataDate(market);

        let actualLatestDate = null;
        if ('execute' in client) {
            const res = await client.execute({
                sql: 'SELECT MAX(date) as last_date FROM daily_prices WHERE symbol = ?',
                args: [symbol],
            });
            actualLatestDate = res.rows[0]?.last_date;
        } else {
            const row = client.prepare('SELECT MAX(date) as last_date FROM daily_prices WHERE symbol = ?').get(symbol) as { last_date: string } | undefined;
            actualLatestDate = row?.last_date;
        }

        // 判定实质性缺失
        // 1. 从未有过价格数据 (actualLatestDate 为空) 
        // 2. 存量数据的日期落后于预期日期 (actualLatestDate < expectedDate)
        const isDataMissing = !actualLatestDate || String(actualLatestDate) < expectedDate;

        if (isDataMissing) {
            console.log(`📡[日线补全] ${symbol}: 库中最新(${actualLatestDate || '无'}) < 预期完整日线(${expectedDate})。后台触发同步...`);
            void triggerOnDemandSync(symbol).catch((syncError) => {
                console.error(`❌ 后台触发 ${symbol} 日线同步失败:`, syncError);
            });
        } else {
            console.log(`✅[日线完备] ${symbol}: 库中最新(${actualLatestDate}) >= 预期(${expectedDate})。跳过冗余同步。`);
        }

        // 4. 清理连接 (仅针对 SQLite)
        if (!('execute' in client) && typeof (client as { close?: () => void }).close === 'function') {
            (client as { close: () => void }).close();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Add stock error:', error);
        return NextResponse.json({ error: 'Failed to add' }, { status: 500 });
    }
}


/**
 * DELETE /api/stock-pool?symbol=xxx
 * 从当前会话用户关注列表删除股票
 */
export async function DELETE(request: Request) {
    const auth = requireUserSession(request);
    if ('response' in auth) return auth.response;
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json(
            { error: 'Missing symbol' },
            { status: 400 }
        );
    }

    try {
        const client = getDbClient();

        if ('execute' in client) {
            const existingWatch = await client.execute({
                sql: 'SELECT 1 FROM user_watchlist WHERE user_id = ? AND symbol = ? LIMIT 1',
                args: [userId, symbol],
            });
            const hadWatch = existingWatch.rows.length > 0;

            // Turso
            // 1. 从用户关注列表删除
            await client.execute({
                sql: 'DELETE FROM user_watchlist WHERE user_id = ? AND symbol = ?',
                args: [userId, symbol],
            });

            // 2. 仅在确实存在该关注时递减计数，且不允许负数
            if (hadWatch) {
                await client.execute({
                    sql: 'UPDATE global_stock_pool SET watchers_count = CASE WHEN watchers_count > 0 THEN watchers_count - 1 ELSE 0 END WHERE symbol = ?',
                    args: [symbol],
                });
            }

            // 3. 若无人关注，立即从全局关注池移除，保持“用户关注池总和”语义
            await client.execute({
                sql: 'DELETE FROM global_stock_pool WHERE symbol = ? AND watchers_count <= 0',
                args: [symbol],
            });
        } else {
            const existingWatch = client
                .prepare('SELECT 1 FROM user_watchlist WHERE user_id = ? AND symbol = ? LIMIT 1')
                .get(userId, symbol) as { 1: number } | undefined;
            const hadWatch = Boolean(existingWatch);

            // SQLite
            client
                .prepare('DELETE FROM user_watchlist WHERE user_id = ? AND symbol = ?')
                .run(userId, symbol);

            if (hadWatch) {
                client
                    .prepare('UPDATE global_stock_pool SET watchers_count = CASE WHEN watchers_count > 0 THEN watchers_count - 1 ELSE 0 END WHERE symbol = ?')
                    .run(symbol);
            }

            // 若无人关注，立即移除
            client
                .prepare('DELETE FROM global_stock_pool WHERE symbol = ? AND watchers_count <= 0')
                .run(symbol);

            client.close();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete stock error:', error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
