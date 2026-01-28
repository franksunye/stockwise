import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface Stock {
    symbol: string;
    name: string;
    market: string;
}

export async function GET() {
    let db: unknown;
    try {
        db = getDbClient();

        const sql = `
            SELECT DISTINCT ap.symbol, sm.name, sm.market, ap.date
            FROM ai_predictions_v2 ap
            JOIN stock_meta sm ON ap.symbol = sm.symbol
            WHERE ap.is_primary = 1
            AND ap.date = (SELECT MAX(date) FROM ai_predictions_v2 WHERE is_primary = 1)
            ORDER BY ap.confidence DESC
            LIMIT 30
        `;

        let pool: Stock[] = [];

        if (db && typeof db === 'object' && 'execute' in db) {
            const res = await (db as { execute: (sql: string) => Promise<{ rows: unknown[] }> }).execute(sql);
            pool = (res.rows as { symbol: unknown, name: unknown, market: unknown }[]).map((row) => ({
                symbol: String(row.symbol),
                name: String(row.name),
                market: String(row.market)
            }));
        } else if (db && typeof db === 'object' && 'prepare' in db) {
            const rows = (db as { prepare: (sql: string) => { all: () => Stock[] } }).prepare(sql).all();
            pool = rows;
        }

        const uniquePool: Stock[] = [];
        const seenNames = new Set<string>();
        for (const s of pool) {
            const baseName = s.name.replace(/-[A-Z]$/, '').trim();
            if (!seenNames.has(baseName)) {
                uniquePool.push(s);
                seenNames.add(baseName);
            }
        }

        const shuffled = uniquePool.sort(() => 0.5 - Math.random());
        const stocks = shuffled.slice(0, 4);

        if (stocks.length < 4) {
            const fallbacks: Stock[] = [
                { symbol: '688256', name: '寒武纪', market: 'CN' },
                { symbol: '601398', name: '工商银行', market: 'CN' },
                { symbol: '02171', name: '科济药业', market: 'HK' },
                { symbol: '01167', name: '加科思', market: 'HK' }
            ];

            for (const f of fallbacks) {
                if (stocks.length >= 4) break;
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
    } finally {
        if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
            (db as { close: () => void }).close();
        }
    }
}
