import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getDbClient } from '../../../lib/db';
import { triggerOnDemandSync } from '@/lib/github-actions';
import { getMarketFromSymbol, getExpectedLatestDataDate } from '@/lib/date-utils';

/**
 * GET /api/stock-pool?userId=xxx
 * 获取用户的股票池
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: any = null;
    try {
        client = getDbClient();
        let stocks: { symbol: string, name?: string, added_at?: string }[] = [];

        if ('execute' in client) {
            // Turso
            const rs = await client.execute({
                sql: `SELECT uw.symbol, gp.name, uw.added_at
                      FROM user_watchlist uw
                      LEFT JOIN global_stock_pool gp ON uw.symbol = gp.symbol
                      WHERE uw.user_id = ?
                      ORDER BY uw.added_at DESC`,
                args: [userId],
            });
            stocks = rs.rows;
        } else {
            // SQLite
            stocks = client
                .prepare(
                    `SELECT uw.symbol, gp.name, uw.added_at
                     FROM user_watchlist uw
                     LEFT JOIN global_stock_pool gp ON uw.symbol = gp.symbol
                     WHERE uw.user_id = ?
                      ORDER BY uw.added_at DESC`
                )
                .all(userId);
        }

        // 核心增强：数据自愈 (Self-healing on Read)
        // 既然用户打开了列表，我们就顺便检查列表中的股票是否真的有“预期”的数据
        // 我们在这里 await 以确保连接在 check 期间保持开启，因查询 MAX(date) 有索引且极快，对延迟影响微乎其微
        if (stocks.length > 0) {
            try {
                for (const stock of stocks) {
                    const symbol = stock.symbol;
                    const market = getMarketFromSymbol(symbol);
                    const expectedDate = getExpectedLatestDataDate(market);

                    let actualDate = null;
                    if ('execute' in client) {
                        const res = await client.execute({
                            sql: 'SELECT MAX(date) as last_date FROM daily_prices WHERE symbol = ?',
                            args: [symbol],
                        });
                        actualDate = res.rows[0]?.last_date;
                    } else {
                        const row = client.prepare('SELECT MAX(date) as last_date FROM daily_prices WHERE symbol = ?').get(symbol) as { last_date: string } | undefined;
                        actualDate = row?.last_date;
                    }

                    if (!actualDate || String(actualDate) < expectedDate) {
                        console.log(`📡[GET 自愈] ${symbol}: 库中日期(${actualDate || '无'}) < 预期(${expectedDate})。触发布发同步...`);
                        // 同步触发是真正的非阻塞异步调用
                        triggerOnDemandSync(symbol).catch(e => console.error(`Failed to sync ${symbol} in GET`, e));
                    }
                }
            } catch (e) {
                console.error('Self-healing check failed:', e);
            }
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
        const { userId, symbol, name } = await request.json();

        if (!userId || !symbol) {
            return NextResponse.json(
                { error: 'Missing userId or symbol' },
                { status: 400 }
            );
        }

        const client = getDbClient();
        const displayName = name || `股票 ${symbol} `;
        const now = new Date().toISOString();

        // 标记是否为新股票（用于决定是否触发即时同步）

        if ('execute' in client) {
            // Turso
            // 1. 添加到用户关注列表
            await client.execute({
                sql: 'INSERT OR IGNORE INTO user_watchlist (user_id, symbol, added_at) VALUES (?, ?, ?)',
                args: [userId, symbol, now],
            });

            // 2. 更新全局股票池
            const existing = await client.execute({
                sql: 'SELECT watchers_count FROM global_stock_pool WHERE symbol = ?',
                args: [symbol],
            });

            if (existing.rows.length > 0) {
                // 股票已存在，增加计数（无需触发即时同步，常规同步会覆盖）
                await client.execute({
                    sql: 'UPDATE global_stock_pool SET watchers_count = watchers_count + 1 WHERE symbol = ?',
                    args: [symbol],
                });
            } else {
                // 新股票，插入记录
                await client.execute({
                    sql: 'INSERT INTO global_stock_pool (symbol, name, watchers_count, first_watched_at) VALUES (?, ?, 1, ?)',
                    args: [symbol, displayName, now],
                });
            }
        } else {
            // SQLite
            // 1. 添加到用户关注列表
            client
                .prepare('INSERT OR IGNORE INTO user_watchlist (user_id, symbol, added_at) VALUES (?, ?, ?)')
                .run(userId, symbol, now);

            // 2. 更新全局股票池
            const existing = client
                .prepare('SELECT watchers_count FROM global_stock_pool WHERE symbol = ?')
                .get(symbol);

            if (existing) {
                // 股票已存在，增加计数（无需触发即时同步）
                client
                    .prepare('UPDATE global_stock_pool SET watchers_count = watchers_count + 1 WHERE symbol = ?')
                    .run(symbol);
            } else {
                // 新股票，插入记录
                client
                    .prepare('INSERT INTO global_stock_pool (symbol, name, watchers_count, first_watched_at) VALUES (?, ?, 1, ?)')
                    .run(symbol, displayName, now);
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
            console.log(`📡 [数据实质缺失] ${symbol}: 库中最新(${actualLatestDate || '无'}) < 预期(${expectedDate})。触发同步...`);
            await triggerOnDemandSync(symbol);
        } else {
            console.log(`✅ [数据实质完备] ${symbol}: 库中最新(${actualLatestDate}) >= 预期(${expectedDate})。跳过冗余同步。`);
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
 * DELETE /api/stock-pool?userId=xxx&symbol=xxx
 * 从用户关注列表删除股票
 */
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const symbol = searchParams.get('symbol');

    if (!userId || !symbol) {
        return NextResponse.json(
            { error: 'Missing userId or symbol' },
            { status: 400 }
        );
    }

    try {
        const client = getDbClient();

        if ('execute' in client) {
            // Turso
            // 1. 从用户关注列表删除
            await client.execute({
                sql: 'DELETE FROM user_watchlist WHERE user_id = ? AND symbol = ?',
                args: [userId, symbol],
            });

            // 2. 更新全局股票池计数
            await client.execute({
                sql: 'UPDATE global_stock_pool SET watchers_count = watchers_count - 1 WHERE symbol = ?',
                args: [symbol],
            });

            // 3. 可选：如果无人关注，删除记录 (暂时保留以保存历史数据)
            // await client.execute({
            //     sql: 'DELETE FROM global_stock_pool WHERE symbol = ? AND watchers_count <= 0',
            //     args: [symbol],
            // });
        } else {
            // SQLite
            client
                .prepare('DELETE FROM user_watchlist WHERE user_id = ? AND symbol = ?')
                .run(userId, symbol);

            client
                .prepare('UPDATE global_stock_pool SET watchers_count = watchers_count - 1 WHERE symbol = ?')
                .run(symbol);

            client.close();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete stock error:', error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}

