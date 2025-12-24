import { NextResponse } from 'next/server';
import { getDbClient } from '../../../lib/db';


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

    try {
        const client = getDbClient();
        let stocks;

        if ('execute' in client) {
            // Turso
            const rs = await client.execute({
                sql: `SELECT uw.symbol, gp.name 
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
                    `SELECT uw.symbol, gp.name 
                     FROM user_watchlist uw
                     LEFT JOIN global_stock_pool gp ON uw.symbol = gp.symbol
                     WHERE uw.user_id = ?
                     ORDER BY uw.added_at DESC`
                )
                .all(userId);
            client.close();
        }

        return NextResponse.json({ stocks });
    } catch (error) {
        console.error('Fetch user watchlist error:', error);
        return NextResponse.json({ stocks: [] }, { status: 500 });
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
        const displayName = name || `股票 ${symbol}`;
        const now = new Date().toISOString();

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
                // 股票已存在，增加计数
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
                client
                    .prepare('UPDATE global_stock_pool SET watchers_count = watchers_count + 1 WHERE symbol = ?')
                    .run(symbol);
            } else {
                client
                    .prepare('INSERT INTO global_stock_pool (symbol, name, watchers_count, first_watched_at) VALUES (?, ?, 1, ?)')
                    .run(symbol, displayName, now);
            }

            client.close();
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

