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

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ symbol: string }> }
) {
    try {
        const { symbol } = await params;
        const turso = getDb();

        if (turso) {
            await turso.execute({
                sql: 'DELETE FROM stock_pool WHERE symbol = ?',
                args: [symbol]
            });
        } else {
            const db = getLocalDb();
            db.prepare('DELETE FROM stock_pool WHERE symbol = ?').run(symbol);
            db.close();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete stock:', error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
