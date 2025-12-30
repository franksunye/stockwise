import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/onboarding/stocks
 * 获取含有近期 AI 预测结果的热门股票，用于 Onboarding 引导。
 * 逻辑：从 ai_predictions 中筛选 model != 'rule-based' 的最新 4 只股票。
 */
export async function GET() {
    try {
        const db = getDbClient();
        let stocks;

        const sql = `
            SELECT DISTINCT ap.symbol, sm.name, sm.market
            FROM ai_predictions ap
            JOIN stock_meta sm ON ap.symbol = sm.symbol
            WHERE ap.model != 'rule-based' AND ap.model IS NOT NULL
            ORDER BY ap.date DESC, ap.confidence DESC
            LIMIT 4
        `;

        // 默认兜底数据 (如果数据库查询不到结果)
        const fallbackStocks = [
            { symbol: '00700', name: '腾讯控股', market: 'HK' },
            { symbol: '600519', name: '贵州茅台', market: 'CN' },
            { symbol: '01398', name: '工商银行', market: 'HK' },
            { symbol: '688981', name: '中芯国际', market: 'CN' },
        ];

        if ('execute' in db) {
            // Turso
            const res = await db.execute(sql);
            stocks = res.rows.length > 0 ? res.rows : fallbackStocks;
        } else {
            // Better-SQLite3
            const rows = db.prepare(sql).all();
            stocks = rows.length > 0 ? rows : fallbackStocks;
            // Note: Normally we don't close the client here as it might be shared
        }

        return NextResponse.json({ stocks });
    } catch (error) {
        console.error('Fetch onboarding stocks error:', error);
        // 出错则返回兜底数据
        return NextResponse.json({
            stocks: [
                { symbol: '00700', name: '腾讯控股', market: 'HK' },
                { symbol: '600519', name: '贵州茅台', market: 'CN' },
                { symbol: '01398', name: '工商银行', market: 'HK' },
                { symbol: '688981', name: '中芯国际', market: 'CN' },
            ]
        });
    }
}
