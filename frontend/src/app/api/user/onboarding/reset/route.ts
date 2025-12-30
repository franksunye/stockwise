import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import type { Client } from '@libsql/client';
import type Database from 'better-sqlite3';

export async function POST(request: Request) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const db = getDbClient() as Client | Database.Database;
        const isCloud = 'execute' in db && typeof db.execute === 'function' && !('prepare' in db);

        // Reset has_onboarded to 0
        if (isCloud) {
            await (db as Client).execute({
                sql: "UPDATE users SET has_onboarded = 0 WHERE user_id = ?",
                args: [userId]
            });
        } else {
            (db as Database.Database).prepare("UPDATE users SET has_onboarded = 0 WHERE user_id = ?").run(userId);
        }

        console.log(`Onboarding reset for user: ${userId}`);

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error('Onboarding reset error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
    }
}
