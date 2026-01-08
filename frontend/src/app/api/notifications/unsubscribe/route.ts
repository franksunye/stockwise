import { NextResponse } from 'next/server';
import { getDbClient, executeWithRetry } from '@/lib/db';
import Database from 'better-sqlite3';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, endpoint } = body;

        console.log('Received unsubscribe request:', { userId, endpoint: endpoint?.slice(0, 50) + '...' });

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const strategy = process.env.DB_STRATEGY || 'local';

        if (strategy === 'cloud') {
            // Use retry wrapper for cloud Turso
            await executeWithRetry(async (client) => {
                if (endpoint) {
                    // 删除特定的订阅
                    await client.execute({
                        sql: `DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`,
                        args: [userId, endpoint]
                    });
                } else {
                    // 删除该用户的所有订阅
                    await client.execute({
                        sql: `DELETE FROM push_subscriptions WHERE user_id = ?`,
                        args: [userId]
                    });
                }
            });
        } else {
            const db = getDbClient() as Database.Database;
            if (endpoint) {
                const stmt = db.prepare(`DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`);
                stmt.run(userId, endpoint);
            } else {
                const stmt = db.prepare(`DELETE FROM push_subscriptions WHERE user_id = ?`);
                stmt.run(userId);
            }
            db.close();
        }

        console.log('✅ Subscription removed successfully for user:', userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing subscription:', error);
        return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 });
    }
}
