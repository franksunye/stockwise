import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { subscription, userId } = body;

        console.log('Received subscription request:', { userId });

        if (!subscription || !subscription.endpoint || !userId) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const client = getDbClient();
        const strategy = process.env.DB_STRATEGY || 'local';
        const userAgent = request.headers.get('user-agent') || '';

        // 生成唯一 ID
        const id = crypto.randomUUID();
        const endpoint = subscription.endpoint;
        const p256dh = subscription.keys.p256dh;
        const auth = subscription.keys.auth;

        if (strategy === 'cloud') {
            const turso = client as Client;
            await turso.execute({
                sql: `INSERT OR REPLACE INTO push_subscriptions 
                      (id, user_id, endpoint, p256dh, auth, user_agent, last_used_at) 
                      VALUES (?, ?, ?, ?, ?, ?, ?)`,
                args: [id, userId, endpoint, p256dh, auth, userAgent, new Date().toISOString()]
            });
        } else {
            const db = client as Database.Database;
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO push_subscriptions 
                (id, user_id, endpoint, p256dh, auth, user_agent, last_used_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(id, userId, endpoint, p256dh, auth, userAgent, new Date().toISOString());
            db.close();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving subscription:', error);
        return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }
}
