import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getDbClient } from '@/lib/db';
import { requireUserSession } from '@/lib/user-session';

/**
 * 批量 Dashboard API (私有部分)
 * 仅获取用户关注的股票列表 (Watchlist)
 * 
 * GET /api/dashboard
 * 返回: { watchlist: [{symbol: '00700', name: 'Tencent'}], timestamp: string }
 * 
 * 注意：具体的行情数据请拿着 symbol 列表去请求 /api/stock/batch
 */
export async function GET(request: Request) {
    const startTime = Date.now();
    const auth = requireUserSession(request);
    if ('response' in auth) return auth.response;
    const userId = auth.userId;

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


            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let almanac: any = null;
            if ('execute' in client) {
                const rsAlmanac = await client.execute({ sql: 'SELECT * FROM market_almanacs ORDER BY target_date DESC LIMIT 1', args: [] });
                if (rsAlmanac.rows && rsAlmanac.rows.length > 0) almanac = rsAlmanac.rows[0];
            } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                almanac = (client as any).prepare('SELECT * FROM market_almanacs ORDER BY target_date DESC LIMIT 1').get();
            }
            if (almanac) {
                try {
                    if (typeof almanac.market_entropy === 'string') almanac.market_entropy = JSON.parse(almanac.market_entropy);
                    if (typeof almanac.sector_currents === 'string') almanac.sector_currents = JSON.parse(almanac.sector_currents);
                } catch (e) { }
            }

            const queryTime = Date.now() - startTime;


            // ✂️ 只返回 Watchlist，不再返回具体的 Price/Prediction 数据
            // 前端需要拿到这个列表后，再去请求 /api/stock/batch
            return NextResponse.json({
                watchlist,
                almanac,
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
