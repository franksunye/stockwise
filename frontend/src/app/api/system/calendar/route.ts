import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const sql = `SELECT date, market FROM market_holidays`;
        const client = getDbClient();

        // Define interface for row type
        interface HolidayRow {
            date: string;
            market: string;
        }

        let rows: HolidayRow[] = [];

        try {
            // Check if client is LibSQL (has execute method)
            if ('execute' in client) {
                const rs = await client.execute(sql);
                // Cast to unknown first to avoid direct type mismatch, then to our shape
                rows = rs.rows as unknown as HolidayRow[];
            } else {
                // Better-SQLite3
                // Check if table exists first in local SQLite to avoid crash
                const checkTable = client.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='market_holidays'").get();
                if (checkTable) {
                    rows = client.prepare(sql).all() as HolidayRow[];
                }
            }
        } catch (e) {
            console.warn("Failed to fetch holidays from DB, might be missing table:", e);
            // Return empty or default structure if table missing
            return NextResponse.json({
                HK: [],
                CN: [],
                error: "Table not found or DB error"
            });
        } finally {
            // Safe close with type assertion
            if (client && typeof (client as { close?: unknown }).close === 'function') {
                (client as { close: () => void }).close();
            }
        }

        // Process rows into sets/arrays
        const holidays = {
            HK: [] as string[],
            CN: [] as string[]
        };

        for (const row of rows) {
            const date = row.date;
            const market = row.market; // 'HK' or 'CN'

            if (market === 'HK') {
                holidays.HK.push(date);
            } else if (market === 'CN') {
                holidays.CN.push(date);
            }
        }

        return NextResponse.json(holidays);

    } catch (error) {
        console.error('Calendar API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
