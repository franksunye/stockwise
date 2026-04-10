import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { isAppLocale, type AppLocale, LOCALE_COOKIE_KEY } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
const ONBOARDING_STOCK_LIMIT = 3;

interface Stock {
    symbol: string;
    name: string;
    name_en?: string | null;
    market: string;
}

function resolveRequestLocale(request: Request): AppLocale {
    const { searchParams } = new URL(request.url);
    const localeParam = searchParams.get('locale');
    if (isAppLocale(localeParam)) return localeParam;

    const cookieHeader = request.headers.get('cookie') ?? '';
    const cookieLocale = cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${LOCALE_COOKIE_KEY}=`))
        ?.split('=')[1];

    if (isAppLocale(cookieLocale)) return cookieLocale;
    return 'cn';
}

function pickMarketAwareStocks(pool: Stock[], locale: AppLocale, limit = ONBOARDING_STOCK_LIMIT): Stock[] {
    const preferredTargets = locale === 'en'
        ? [
            { market: 'US', target: 2 },
            { market: 'HK', target: 1 },
            { market: 'CN', target: 0 },
        ]
        : [
            { market: 'HK', target: 2 },
            { market: 'CN', target: 1 },
            { market: 'US', target: 0 },
        ];

    const selected: Stock[] = [];
    const selectedSymbols = new Set<string>();

    for (const { market, target } of preferredTargets) {
        if (target <= 0) continue;
        for (const stock of pool) {
            if (selected.length >= limit) return selected;
            if (stock.market !== market || selectedSymbols.has(stock.symbol)) continue;
            selected.push(stock);
            selectedSymbols.add(stock.symbol);
            if (selected.filter((item) => item.market === market).length >= target) break;
        }
    }

    for (const stock of pool) {
        if (selected.length >= limit) break;
        if (selectedSymbols.has(stock.symbol)) continue;
        selected.push(stock);
        selectedSymbols.add(stock.symbol);
    }

    return selected;
}

function getFallbackStocks(locale: AppLocale): Stock[] {
    if (locale === 'en') {
        return [
            { symbol: 'AAPL', name: 'Apple', name_en: 'Apple Inc.', market: 'US' },
            { symbol: 'NVDA', name: 'NVIDIA', name_en: 'NVIDIA Corporation', market: 'US' },
            { symbol: '00700', name: '腾讯控股', name_en: 'Tencent Holdings', market: 'HK' },
            { symbol: '09988', name: '阿里巴巴-W', name_en: 'Alibaba Group', market: 'HK' },
            { symbol: '600519', name: '贵州茅台', name_en: 'Kweichow Moutai', market: 'CN' },
        ];
    }

    return [
        { symbol: '00700', name: '腾讯控股', name_en: 'Tencent Holdings', market: 'HK' },
        { symbol: '09988', name: '阿里巴巴-W', name_en: 'Alibaba Group', market: 'HK' },
        { symbol: '688256', name: '寒武纪', name_en: 'Cambricon', market: 'CN' },
        { symbol: '601398', name: '工商银行', name_en: 'Industrial and Commercial Bank of China', market: 'CN' },
        { symbol: 'AAPL', name: 'Apple', name_en: 'Apple Inc.', market: 'US' },
    ];
}

export async function GET(request: Request) {
    let db: unknown;
    try {
        const locale = resolveRequestLocale(request);
        db = getDbClient();

        const sql = `
            SELECT DISTINCT ap.symbol, sm.name, sm.name_en, sm.market, ap.date
            FROM ai_predictions_v2 ap
            JOIN stock_meta sm ON ap.symbol = sm.symbol
            WHERE ap.is_primary = 1
            AND ap.date = (SELECT MAX(date) FROM ai_predictions_v2 WHERE is_primary = 1)
            ORDER BY ap.confidence DESC
            LIMIT 30
        `;

        let pool: Stock[] = [];

        if (db && typeof db === 'object' && 'execute' in db) {
            const res = await (db as { execute: (q: { sql: string; args?: unknown[] }) => Promise<{ rows: unknown[] }> }).execute({ sql, args: [] });
            pool = (res.rows as { symbol: unknown; name: unknown; name_en: unknown; market: unknown }[]).map((row) => ({
                symbol: String(row.symbol),
                name: String(row.name),
                name_en: row.name_en != null ? String(row.name_en) : null,
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
        const stocks = pickMarketAwareStocks(shuffled, locale, ONBOARDING_STOCK_LIMIT);

        if (stocks.length < ONBOARDING_STOCK_LIMIT) {
            const fallbacks = getFallbackStocks(locale);

            for (const f of fallbacks) {
                if (stocks.length >= ONBOARDING_STOCK_LIMIT) break;
                if (!stocks.find(s => s.symbol === f.symbol || s.name.includes(f.name))) {
                    stocks.push(f);
                }
            }
        }

        return NextResponse.json({ stocks });
    } catch (error) {
        console.error('[API] Onboarding stocks error:', error);
        const locale = resolveRequestLocale(request);
        return NextResponse.json({
            stocks: getFallbackStocks(locale).slice(0, ONBOARDING_STOCK_LIMIT)
        });
    } finally {
        if (db && typeof db === 'object' && 'close' in db && typeof (db as { close?: () => void }).close === 'function') {
            (db as { close: () => void }).close();
        }
    }
}
