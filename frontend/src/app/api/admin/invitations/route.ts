import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-auth';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';

export async function GET(request: Request) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    try {
        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';

        let invitations = [];

        if (strategy === 'cloud') {
            const turso = client as Client;
            const result = await turso.execute('SELECT * FROM invitation_codes ORDER BY COALESCE(used_at, created_at) DESC');
            invitations = result.rows;
        } else {
            const db = client as Database.Database;
            invitations = db.prepare('SELECT * FROM invitation_codes ORDER BY COALESCE(used_at, created_at) DESC').all();
            db.close();
        }

        return NextResponse.json({ invitations });
    } catch (error) {
        console.error('Failed to fetch invitation codes:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const unauthorized = requireAdminAuth(request);
    if (unauthorized) return unauthorized;

    try {
        const { count = 1, type = 'beta', duration_days = 30 } = await request.json();
        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';

        const newCodes = [];
        for (let i = 0; i < count; i++) {
            // Generate a simple but unique code: SW-[8 random chars]
            const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
            const code = `SW-${randomStr}`;
            newCodes.push(code);
        }

        if (strategy === 'cloud') {
            const turso = client as Client;
            const queries = newCodes.map(code => ({
                sql: 'INSERT INTO invitation_codes (code, type, duration_days, is_used, created_at) VALUES (?, ?, ?, 0, datetime(\'now\', \'+8 hours\'))',
                args: [code, type, duration_days]
            }));
            await turso.batch(queries);
        } else {
            const db = client as Database.Database;
            const insert = db.prepare('INSERT INTO invitation_codes (code, type, duration_days, is_used, created_at) VALUES (?, ?, ?, 0, datetime(\'now\', \'+8 hours\'))');
            const transaction = db.transaction((codes) => {
                for (const code of codes) insert.run(code, type, duration_days);
            });
            transaction(newCodes);
            db.close();
        }

        return NextResponse.json({ success: true, codes: newCodes });
    } catch (error) {
        console.error('Failed to create invitation codes:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
