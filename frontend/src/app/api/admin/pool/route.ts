import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { createClient } from '@libsql/client';

const DB_PATH = path.join(process.cwd(), '..', 'data', 'stockwise.db');
const TURSO_DB_URL = process.env.TURSO_DB_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

function getDb() {
    if (TURSO_DB_URL) {
        return createClient({
            url: TURSO_DB_URL,
            authToken: TURSO_AUTH_TOKEN,
        });
    }
    return null;
}

function getLocalDb() {
    return new Database(DB_PATH, { readonly: false });
}

export async function GET() {
    try {
        const turso = getDb();
        if (turso) {
            const result = await turso.execute('SELECT * FROM stock_pool ORDER BY added_at DESC');
            return NextResponse.json({ stocks: result.rows });
        } else {
            const db = getLocalDb();
            const stocks = db.prepare('SELECT * FROM stock_pool ORDER BY added_at DESC').all();
            db.close();
            return NextResponse.json({ stocks });
        }
    } catch (error) {
        console.error('Failed to fetch stock pool:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { symbol, name } = body;

        if (!symbol) {
            return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
        }

        const turso = getDb();
        let stockName = name;

        if (turso) {
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

            // 2. 插入股票池
            await turso.execute({
                sql: 'INSERT INTO stock_pool (symbol, name) VALUES (?, ?)',
                args: [symbol, stockName]
            });
            return NextResponse.json({ success: true, name: stockName });
        } else {
            const db = getLocalDb();
            if (!stockName) {
                const meta = db.prepare('SELECT name FROM stock_meta WHERE symbol = ?').get(symbol);
                if (meta) stockName = (meta as any).name;
            }

            if (!stockName) {
                db.close();
                return NextResponse.json({ error: '未找到股票基本信息' }, { status: 404 });
            }

            db.prepare('INSERT INTO stock_pool (symbol, name) VALUES (?, ?)').run(symbol, stockName);
            db.close();
            return NextResponse.json({ success: true, name: stockName });
        }
    } catch (error: any) {
        console.error('❌ 添加失败:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
