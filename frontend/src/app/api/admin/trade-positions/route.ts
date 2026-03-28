import { NextResponse } from 'next/server';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';
import { requireAdminAuth } from '@/lib/admin-auth';
import { buildPositionDetailSql } from '@/lib/admin-trade-positions';
import { getDbClient } from '@/lib/db';

interface TradePositionRow {
    position_id: string;
    user_id: string;
    symbol: string;
    market: string | null;
    entry_date: string;
    entry_price: number;
    position_size: number;
    remaining_size: number;
    direction: string;
    status: string;
    source: string | null;
    note: string | null;
    stock_name: string | null;
    latest_trade_date: string | null;
    latest_state_id: string | null;
    latest_action_summary: string | null;
    latest_next_trade_date: string | null;
    latest_delivery_status: string | null;
    latest_event_date: string | null;
    latest_event_type: string | null;
    latest_event_price: number | null;
    latest_event_quantity: number | null;
    event_count: number;
    buy_event_count: number;
    sell_event_count: number;
    updated_at: string | null;
}

function normalizeSymbol(input: unknown): string {
    return String(input || '').trim().toUpperCase();
}

function inferMarket(symbol: string): string {
    return symbol.length === 5 ? 'HK' : 'CN';
}

function toNumber(input: unknown): number {
    const value = Number(input);
    if (!Number.isFinite(value)) return NaN;
    return value;
}

function buildListSql(): string {
    const detailSql = buildPositionDetailSql();
    return detailSql.replace('WHERE p.position_id = ?', 'ORDER BY p.status = \'active\' DESC, p.updated_at DESC, p.entry_date DESC');
}

async function queryCloudPositions(client: Client): Promise<TradePositionRow[]> {
    const result = await client.execute(buildListSql());
    return result.rows as unknown as TradePositionRow[];
}

function queryLocalPositions(db: Database.Database): TradePositionRow[] {
    return db.prepare(buildListSql()).all() as TradePositionRow[];
}

export async function GET(request: Request) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    try {
        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local';

        if (strategy === 'cloud') {
            const positions = await queryCloudPositions(client as Client);
            return NextResponse.json({ positions });
        }

        const db = client as Database.Database;
        const positions = queryLocalPositions(db);
        db.close();
        return NextResponse.json({ positions });
    } catch (error) {
        console.error('Failed to fetch trade positions:', error);
        return NextResponse.json({ error: 'Failed to fetch trade positions' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    try {
        const body = await request.json();
        const symbol = normalizeSymbol(body.symbol);
        const userId = String(body.user_id || '').trim();
        const entryDate = String(body.entry_date || '').trim();
        const entryPrice = toNumber(body.entry_price);
        const positionSize = toNumber(body.position_size);
        const remainingSize = Number.isFinite(toNumber(body.remaining_size)) ? toNumber(body.remaining_size) : positionSize;
        const market = String(body.market || '').trim().toUpperCase() || inferMarket(symbol);
        const direction = String(body.direction || 'long').trim() || 'long';
        const status = String(body.status || 'active').trim() || 'active';
        const source = String(body.source || 'manual').trim() || 'manual';
        const note = body.note == null ? null : String(body.note);

        if (!userId || !symbol || !entryDate || !Number.isFinite(entryPrice) || !Number.isFinite(positionSize) || !Number.isFinite(remainingSize)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const positionId = String(body.position_id || `pos_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`);
        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local';

        if (strategy === 'cloud') {
            const turso = client as Client;
            await turso.execute({
                sql: `
                    INSERT INTO user_trade_positions (
                        position_id, user_id, symbol, market, entry_date, entry_price, position_size, remaining_size,
                        direction, status, source, note, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))
                `,
                args: [positionId, userId, symbol, market, entryDate, entryPrice, positionSize, remainingSize, direction, status, source, note],
            });
        } else {
            const db = client as Database.Database;
            db.prepare(`
                INSERT INTO user_trade_positions (
                    position_id, user_id, symbol, market, entry_date, entry_price, position_size, remaining_size,
                    direction, status, source, note, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+8 hours'), datetime('now', '+8 hours'))
            `).run(positionId, userId, symbol, market, entryDate, entryPrice, positionSize, remainingSize, direction, status, source, note);
            db.close();
        }

        return NextResponse.json({ success: true, position_id: positionId });
    } catch (error) {
        console.error('Failed to create trade position:', error);
        return NextResponse.json({ error: 'Failed to create trade position' }, { status: 500 });
    }
}
