import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
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

        // 标记是否为新股票（用于决定是否触发即时同步）
        let isNewStock = false;

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
                isNewStock = true;
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
                isNewStock = true;
                client
                    .prepare('INSERT INTO global_stock_pool (symbol, name, watchers_count, first_watched_at) VALUES (?, ?, 1, ?)')
                    .run(symbol, displayName, now);
            }

            client.close();
        }

        // 3. 只有新股票才触发 GitHub Action 即时同步
        //    已存在的股票会被常规的10分钟/每日同步覆盖，无需重复触发
        if (isNewStock) {
            console.log(`🆕 New stock ${symbol} added, triggering on-demand sync...`);
            triggerGithubSync(symbol).catch(err => console.error('Failed to trigger GitHub sync:', err));
        } else {
            console.log(`📋 Stock ${symbol} already in pool, skipping on-demand sync (covered by regular sync)`);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Add stock error:', error);
        return NextResponse.json({ error: 'Failed to add' }, { status: 500 });
    }
}

/**
 * 触发 GitHub Action 异步同步特定股票数据
 */
async function triggerGithubSync(symbol: string) {
    const pat = process.env.GITHUB_PAT;
    const owner = 'franksunye';
    const repo = 'stockwise';
    const workflowId = 'data_sync_single.yml';

    if (!pat) {
        console.warn('⚠️ GITHUB_PAT not found in environment, skipping on-demand sync');
        return;
    }

    try {
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${pat}`,
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: { symbol }
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GitHub API error: ${response.status} ${errorText}`);
        }

        console.log(`🚀 Successfully triggered GitHub sync for ${symbol}`);
    } catch (error) {
        console.error(`❌ Failed to trigger GitHub sync for ${symbol}:`, error);
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

