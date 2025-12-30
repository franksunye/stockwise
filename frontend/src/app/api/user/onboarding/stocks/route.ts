import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/onboarding/stocks
 * 获取含有近期 AI 预测结果的热门股票，用于 Onboarding 引导。
 * 逻辑：从 ai_predictions 中筛选 model != 'rule-based' 的最新 4 只股票。
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    try {
        const db = getDbClient();

        // 方案：优先寻找近期有 gpt-3.5-turbo 深度分析的股票
        // 如果有 userId，排除掉该用户已经关注的
        const sql = `
            SELECT DISTINCT ap.symbol, sm.name, sm.market
            FROM ai_predictions ap
            JOIN stock_meta sm ON ap.symbol = sm.symbol
            WHERE ap.model != 'rule-based' AND ap.model IS NOT NULL
            ${userId ? 'AND ap.symbol NOT IN (SELECT symbol FROM user_watchlist WHERE user_id = ?)' : ''}
            ORDER BY ap.date DESC, ap.confidence DESC
            LIMIT 4
        `;

        const args = userId ? [userId] : [];
        let stocks: any[] = [];

        if ('execute' in db) {
            const res = await db.execute({ sql, args });
            // 确保将 Turso 的 Row 类型转换为普通对象数组
            stocks = res.rows.map(row => ({
                symbol: String(row.symbol),
                name: String(row.name),
                market: String(row.market)
            }));
        } else {
            const rows = userId ? db.prepare(sql).all(userId) : db.prepare(sql).all();
            stocks = rows as any[];
        }

        // 兜底逻辑：如果数据库里真的没有 AI 预测，或者全被去重了
        if (stocks.length < 4) {
            const fallbacks = [
                { symbol: '688256', name: '寒武纪', market: 'CN' },
                { symbol: '601398', name: '工商银行', market: 'CN' },
                { symbol: '02171', name: '科济药业', market: 'HK' },
                { symbol: '01167', name: '加科思', market: 'HK' }
            ];

            for (const f of fallbacks) {
                if (stocks.length >= 4) break;
                if (!stocks.find(s => s.symbol === f.symbol)) {
                    stocks.push(f);
                }
            }
        }

        return NextResponse.json({ stocks });
    } catch (error) {
        console.error('[API] Onboarding stocks error:', error);
        return NextResponse.json({ stocks: [] });
    }
}
