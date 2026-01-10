import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

/**
 * POST /api/user/activity
 * 更新用户最后活跃时间
 */
export async function POST(request: Request) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: any;
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json(
                { error: 'Missing userId' },
                { status: 400 }
            );
        }

        client = getDbClient();
        const now = new Date().toISOString();

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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Update activity error:', error);
        return NextResponse.json(
            { error: 'Update failed' },
            { status: 500 }
        );
    } finally {
        if (client && typeof client.close === 'function') {
            client.close();
        }
    }
}
