import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

/**
 * Link a recovery email to a user ID.
 * This is a "soft-link" for recovery purposes.
 */
export async function POST(request: Request) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    let db: any;
    try {
        const { userId, email } = await request.json();

        if (!userId || !email) {
            return NextResponse.json({ error: 'Missing userId or email' }, { status: 400 });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        db = getDbClient();
        const isCloud = db.$type === 'cloud';

        console.log(`[Email Link] Linking ${email} to ${userId} (Mode: ${db.$type})`);

        // Update user email
        if (isCloud) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const client = db as any;
            await client.execute({
                sql: "UPDATE users SET email = ? WHERE user_id = ?",
                args: [email, userId]
            });
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const localDb = db as any;
            localDb.prepare("UPDATE users SET email = ? WHERE user_id = ?").run(email, userId);
        }

        return NextResponse.json({ success: true, message: 'Recovery email linked successfully' });

    } catch (error: unknown) {
        console.error('Recovery link error:', error);
        return NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
    } finally {
        if (db && typeof db.close === 'function') {
            db.close();
        }
    }
}
