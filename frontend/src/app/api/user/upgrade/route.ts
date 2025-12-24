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
 * POST /api/user/upgrade
 * 用户升级 (匿名用户 -> 注册用户)
 */
export async function POST(request: Request) {
    try {
        const { userId, username } = await request.json();

        if (!userId || !username) {
            return NextResponse.json(
                { error: 'Missing userId or username' },
                { status: 400 }
            );
        }

        const client = getDbClient();

        if ('execute' in client) {
            // Turso
            await client.execute({
                sql: `UPDATE users 
                      SET username = ?, registration_type = 'explicit', last_active_at = ?
                      WHERE user_id = ?`,
                args: [username, new Date().toISOString(), userId],
            });
        } else {
            // SQLite
            client
                .prepare(
                    `UPDATE users 
                     SET username = ?, registration_type = 'explicit', last_active_at = ?
                     WHERE user_id = ?`
                )
                .run(username, new Date().toISOString(), userId);
            client.close();
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('User upgrade error:', error);
        return NextResponse.json(
            { error: 'Upgrade failed' },
            { status: 500 }
        );
    }
}
