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
 * POST /api/user/activity
 * 更新用户最后活跃时间
 */
export async function POST(request: Request) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json(
                { error: 'Missing userId' },
                { status: 400 }
            );
        }

        const client = getDbClient();
        const now = new Date().toISOString();

        try {
            if ('execute' in client) {
                // Turso
                await client.execute({
                    sql: `UPDATE users SET last_active_at = ? WHERE user_id = ?`,
                    args: [now, userId],
                });
            } else {
                // SQLite
                client
                    .prepare(`UPDATE users SET last_active_at = ? WHERE user_id = ?`)
                    .run(now, userId);
            }
        } finally {
            if (client && !('execute' in client)) {
                client.close();
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update activity error:', error);
        return NextResponse.json(
            { error: 'Update failed' },
            { status: 500 }
        );
    }
}
