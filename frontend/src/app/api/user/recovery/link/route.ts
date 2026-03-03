import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { requireUserSession } from '@/lib/user-session';

/**
 * Link a recovery email to a user ID.
 * This is a "soft-link" for recovery purposes.
 */
export async function POST(request: Request) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    let db: any;
    try {
        const auth = requireUserSession(request);
        if ('response' in auth) return auth.response;
        const userId = auth.userId;
        const { email } = await request.json();

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Missing email' }, { status: 400 });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        db = getDbClient();
        const isCloud = db.$type === 'cloud';

        console.log(`[Email Link] Linking ${normalizedEmail} to ${userId} (Mode: ${db.$type})`);

        let linkedEmail: string | null = null;

        // Update user email
        if (isCloud) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const client = db as any;
            await client.execute({
                sql: "UPDATE users SET email = ? WHERE user_id = ?",
                args: [normalizedEmail, userId]
            });

            const verifyRes = await client.execute({
                sql: "SELECT email FROM users WHERE user_id = ?",
                args: [userId]
            });
            const row = verifyRes.rows?.[0] as { email?: string | null } | undefined;
            if (!row) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }
            linkedEmail = row.email || null;
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const localDb = db as any;
            localDb.prepare("UPDATE users SET email = ? WHERE user_id = ?").run(normalizedEmail, userId);
            const row = localDb.prepare("SELECT email FROM users WHERE user_id = ?").get(userId) as { email?: string | null } | undefined;
            if (!row) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }
            linkedEmail = row.email || null;
        }

        return NextResponse.json({
            success: true,
            message: 'Recovery email linked successfully',
            email: linkedEmail
        });

    } catch (error: unknown) {
        console.error('Recovery link error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
    } finally {
        if (db && typeof db.close === 'function') {
            db.close();
        }
    }
}
