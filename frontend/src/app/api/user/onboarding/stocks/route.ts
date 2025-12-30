import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/onboarding/stocks
 * 获取含有近期 AI 预测结果的热门股票，用于 Onboarding 引导。
 * 逻辑：只获取数据库中最新的 AI 深度分析批次（MAX(date)），并从中随机选择 4 只进行展示。
 */
interface Stock {
    symbol: string;
    name: string;
    market: string;
}

export async function GET() {
    try {
        const db = getDbClient();

        // 方案：获取最近一次 AI 深度分析（非常规规则）的全部标的
        // 使用子查询获取 MAX(date)，确保数据是最新的
        const sql = `
            SELECT DISTINCT ap.symbol, sm.name, sm.market, ap.date
            FROM ai_predictions ap
            JOIN stock_meta sm ON ap.symbol = sm.symbol
            WHERE ap.model != 'rule-based' AND ap.model IS NOT NULL
            AND ap.date = (SELECT MAX(date) FROM ai_predictions WHERE model != 'rule-based')
            ORDER BY ap.confidence DESC
            LIMIT 30
        `;

        let pool: Stock[] = [];

        if ('execute' in db) {
            const res = await db.execute(sql);
            pool = res.rows.map(row => ({
                symbol: String(row.symbol),
                name: String(row.name),
                market: String(row.market)
            }));
        } else {
            const rows = db.prepare(sql).all() as Stock[];
            pool = rows;
        }

        // 1. 同名去重 (处理 A+H 股同时出现的情况，优先保留排在前面的)
        const uniquePool: Stock[] = [];
        const seenNames = new Set<string>();
        for (const s of pool) {
            const baseName = s.name.replace(/-[A-Z]$/, '').trim(); // 简单处理如 "科济药业-B"
            if (!seenNames.has(baseName)) {
                uniquePool.push(s);
                seenNames.add(baseName);
            }
        }

        // 2. 随机打乱池子并取 4 只，让引导页每次看起来都有新鲜感
        const shuffled = uniquePool.sort(() => 0.5 - Math.random());
        const stocks = shuffled.slice(0, 4);

        // 3. 极端的兜底逻辑：如果数据库批次数据不够 4 只（理论上不应该，除非刚开始运行）
        if (stocks.length < 4) {
            const fallbacks: Stock[] = [
                { symbol: '688256', name: '寒武纪', market: 'CN' },
                { symbol: '601398', name: '工商银行', market: 'CN' },
                { symbol: '02171', name: '科济药业', market: 'HK' },
                { symbol: '01167', name: '加科思', market: 'HK' }
            ];

            for (const f of fallbacks) {
                if (stocks.length >= 4) break;
                // 检查 symbol 或 name 是否已存在
                if (!stocks.find(s => s.symbol === f.symbol || s.name.includes(f.name))) {
                    stocks.push(f);
                }
            }
        }

        return NextResponse.json({ stocks });
    } catch (error) {
        console.error('[API] Onboarding stocks error:', error);
        return NextResponse.json({
            stocks: [
                { symbol: '688256', name: '寒武纪', market: 'CN' },
                { symbol: '601398', name: '工商银行', market: 'CN' },
                { symbol: '02171', name: '科济药业', market: 'HK' },
                { symbol: '01167', name: '加科思', market: 'HK' }
            ]
        });
    }
}
