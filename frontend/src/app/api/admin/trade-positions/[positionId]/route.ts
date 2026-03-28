import { NextResponse } from 'next/server';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';
import { requireAdminAuth } from '@/lib/admin-auth';
import { getDbClient } from '@/lib/db';

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

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ positionId: string }> }
) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    try {
        const { positionId } = await params;
        const body = await request.json();
        const symbol = normalizeSymbol(body.symbol);
        const userId = String(body.user_id || '').trim();
        const entryDate = String(body.entry_date || '').trim();
        const entryPrice = toNumber(body.entry_price);
        const positionSize = toNumber(body.position_size);
        const remainingSize = toNumber(body.remaining_size);
        const market = String(body.market || '').trim().toUpperCase() || inferMarket(symbol);
        const direction = String(body.direction || 'long').trim() || 'long';
        const status = String(body.status || 'active').trim() || 'active';
        const source = String(body.source || 'manual').trim() || 'manual';
        const note = body.note == null ? null : String(body.note);

        if (!positionId || !userId || !symbol || !entryDate || !Number.isFinite(entryPrice) || !Number.isFinite(positionSize) || !Number.isFinite(remainingSize)) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local';

        if (strategy === 'cloud') {
            const turso = client as Client;
            await turso.execute({
                sql: `
                    UPDATE user_trade_positions
                    SET user_id = ?, symbol = ?, market = ?, entry_date = ?, entry_price = ?, position_size = ?,
                        remaining_size = ?, direction = ?, status = ?, source = ?, note = ?, updated_at = datetime('now', '+8 hours')
                    WHERE position_id = ?
                `,
                args: [userId, symbol, market, entryDate, entryPrice, positionSize, remainingSize, direction, status, source, note, positionId],
            });
        } else {
            const db = client as Database.Database;
            db.prepare(`
                UPDATE user_trade_positions
                SET user_id = ?, symbol = ?, market = ?, entry_date = ?, entry_price = ?, position_size = ?,
                    remaining_size = ?, direction = ?, status = ?, source = ?, note = ?, updated_at = datetime('now', '+8 hours')
                WHERE position_id = ?
            `).run(userId, symbol, market, entryDate, entryPrice, positionSize, remainingSize, direction, status, source, note, positionId);
            db.close();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update trade position:', error);
        return NextResponse.json({ error: 'Failed to update trade position' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ positionId: string }> }
) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    try {
        const { positionId } = await params;
        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || process.env.DB_SOURCE || 'local';

        if (strategy === 'cloud') {
            const turso = client as Client;
            await turso.execute({
                sql: 'DELETE FROM trade_management_advice_log WHERE position_id = ?',
                args: [positionId],
            });
            await turso.execute({
                sql: 'DELETE FROM user_trade_positions WHERE position_id = ?',
                args: [positionId],
            });
        } else {
            const db = client as Database.Database;
            db.prepare('DELETE FROM trade_management_advice_log WHERE position_id = ?').run(positionId);
            db.prepare('DELETE FROM user_trade_positions WHERE position_id = ?').run(positionId);
            db.close();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete trade position:', error);
        return NextResponse.json({ error: 'Failed to delete trade position' }, { status: 500 });
    }
}
