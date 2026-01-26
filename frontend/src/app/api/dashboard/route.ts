import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getDbClient } from '@/lib/db';

/**
 * 批量 Dashboard API (私有部分)
 * 仅获取用户关注的股票列表 (Watchlist)
 * 
 * GET /api/dashboard?userId=xxx
 * 返回: { watchlist: [{symbol: '00700', name: 'Tencent'}], timestamp: string }
 * 
 * 注意：具体的行情数据请拿着 symbol 列表去请求 /api/stock/batch
 */
export async function GET(request: Request) {
    const startTime = Date.now();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    try {
        const client = getDbClient();

        try {
            // Step 1: 仅获取用户监控列表 (私有数据)
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

            const queryTime = Date.now() - startTime;

            // ✂️ 只返回 Watchlist，不再返回具体的 Price/Prediction 数据
            // 前端需要拿到这个列表后，再去请求 /api/stock/batch
            return NextResponse.json({
                watchlist,
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
