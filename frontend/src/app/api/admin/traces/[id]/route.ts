import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';

export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const traceId = params.id;
        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';

        let trace = null;
        const sql = "SELECT * FROM chain_execution_traces WHERE trace_id = ?";

        if (strategy === 'cloud') {
            const turso = client as Client;
            const res = await turso.execute({ sql, args: [traceId] });
            if (res.rows.length > 0) {
                trace = res.rows[0];
            }
        } else {
            const db = client as Database.Database;
            trace = db.prepare(sql).get(traceId);
            db.close();
        }

        if (!trace) {
            return NextResponse.json({ error: 'Trace not found' }, { status: 404 });
        }

        return NextResponse.json(trace);
    } catch (error) {
        console.error('Failed to fetch trace details:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
