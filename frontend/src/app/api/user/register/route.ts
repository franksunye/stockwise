import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import path from 'path';

function getDbClient() {
    const url = process.env.TURSO_DB_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (url && authToken) {
        return createClient({ url, authToken });
    } else {
        const dbPath = path.join(process.cwd(), '..', 'data', 'stockwise.db');
        return new Database(dbPath);
    }
}

/**
 * POST /api/user/register
 * 用户注册 (隐式注册)
 */
export async function POST(request: Request) {
    try {
        const { userId, registrationType } = await request.json();

        if (!userId || !registrationType) {
            return NextResponse.json(
                { error: 'Missing userId or registrationType' },
                { status: 400 }
            );
        }

        const client = getDbClient();
        const now = new Date().toISOString();

        try {
            if ('execute' in client) {
                // Turso
                await client.execute({
                    sql: `INSERT OR IGNORE INTO users (user_id, registration_type, created_at, last_active_at)
                          VALUES (?, ?, ?, ?)`,
                    args: [userId, registrationType, now, now],
                });
            } else {
                // SQLite
                client
                    .prepare(
                        `INSERT OR IGNORE INTO users (user_id, registration_type, created_at, last_active_at)
                         VALUES (?, ?, ?, ?)`
                    )
                    .run(userId, registrationType, now, now);
            }
        } finally {
            if (client && !('execute' in client)) {
                client.close();
            }
        }

        return NextResponse.json({ success: true, userId });
    } catch (error) {
        console.error('User registration error:', error);
        return NextResponse.json(
            { error: 'Registration failed' },
            { status: 500 }
        );
    }
}
