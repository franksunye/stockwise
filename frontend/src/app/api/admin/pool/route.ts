import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-auth';
import { Client } from '@libsql/client';
import { triggerOnDemandSync } from '@/lib/github-actions';
import Database from 'better-sqlite3';
import { getMarketFromSymbol, getExpectedLatestDataDate } from '@/lib/date-utils';

export async function GET(request: Request) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    try {
        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';

        if (strategy === 'cloud') {
            const turso = client as Client;
            const result = await turso.execute('SELECT symbol, name, first_watched_at as added_at FROM global_stock_pool ORDER BY first_watched_at DESC');
            return NextResponse.json({ stocks: result.rows });
        } else {
            const db = client as Database.Database;
            const stocks = db.prepare('SELECT symbol, name, first_watched_at as added_at FROM global_stock_pool ORDER BY first_watched_at DESC').all();
            db.close();
            return NextResponse.json({ stocks });
        }
    } catch (error) {
        console.error('Failed to fetch stock pool:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    try {
        const body = await request.json();
        const { symbol, name } = body;

        if (!symbol) {
            return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
        }

        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';
        let stockName = name;

        if (strategy === 'cloud') {
            const turso = client as Client;
            // 1. 尝试从 stock_meta 获取名称
            if (!stockName) {
                const metaResult = await turso.execute({
                    sql: 'SELECT name FROM stock_meta WHERE symbol = ?',
                    args: [symbol]
                });
                if (metaResult.rows.length > 0) {
                    stockName = metaResult.rows[0].name;
                }
            }

            if (!stockName) {
                return NextResponse.json({ error: '未找到股票信息，请手动输入名称' }, { status: 404 });
            }

            // 2. 插入或忽略全局股票池
            await turso.execute({
                sql: 'INSERT OR IGNORE INTO global_stock_pool (symbol, name, first_watched_at) VALUES (?, ?, ?)',
                args: [symbol, stockName, new Date().toISOString()]
            });

            // 3. 智能同步判断
            const market = getMarketFromSymbol(symbol);
            const expectedDate = getExpectedLatestDataDate(market);

            const priceRes = await turso.execute({
                sql: 'SELECT MAX(date) as last_date FROM daily_prices WHERE symbol = ?',
                args: [symbol]
            });
            const actualLatestDate = priceRes.rows[0]?.last_date;

            if (!actualLatestDate || String(actualLatestDate) < expectedDate) {
                console.log(`📡 [Admin] ${symbol}: Data missing or stale (${actualLatestDate} < ${expectedDate}). Syncing...`);
                await triggerOnDemandSync(symbol);
            }

            return NextResponse.json({ success: true, name: stockName });
        } else {
            const db = client as Database.Database;
            if (!stockName) {
                const meta = db.prepare('SELECT name FROM stock_meta WHERE symbol = ?').get(symbol) as { name: string } | undefined;
                if (meta) stockName = meta.name;
            }

            if (!stockName) {
                db.close();
                return NextResponse.json({ error: '未找到股票基本信息' }, { status: 404 });
            }

            db.prepare('INSERT OR IGNORE INTO global_stock_pool (symbol, name, first_watched_at) VALUES (?, ?, ?)').run(symbol, stockName, new Date().toISOString());

            // 3. 智能同步判断 (Local)
            const market = getMarketFromSymbol(symbol);
            const expectedDate = getExpectedLatestDataDate(market);
            const priceRow = db.prepare('SELECT MAX(date) as last_date FROM daily_prices WHERE symbol = ?').get(symbol) as { last_date: string } | undefined;
            const actualLatestDate = priceRow?.last_date;

            if (!actualLatestDate || String(actualLatestDate) < expectedDate) {
                await triggerOnDemandSync(symbol);
            }

            db.close();

            return NextResponse.json({ success: true, name: stockName });
        }
    } catch (error) {
        console.error('❌ 添加失败:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
