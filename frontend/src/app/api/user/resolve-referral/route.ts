
import { NextRequest, NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ success: false, error: 'Code is required' }, { status: 400 });
    }

    try {
        const db = getDbClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = db as any;

        let userId: string | null = null;

        // Check if using LibSQL (Cloud) or Better-SQLite3 (Local)
        if (client.execute && typeof client.execute === 'function' && !client.prepare) {
            const result = await client.execute({
                sql: "SELECT user_id FROM users WHERE referral_alias = ? LIMIT 1",
                args: [code]
            });
            if (result.rows.length > 0) {
                userId = result.rows[0].user_id as string;
            }
        } else {
            // Local SQLite
            const stmt = client.prepare("SELECT user_id FROM users WHERE referral_alias = ?");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const row = stmt.get(code) as any;
            if (row) {
                userId = row.user_id;
            }
        }

        if (userId) {
            return NextResponse.json({ success: true, userId });
        } else {
            return NextResponse.json({ success: false, error: 'Alias not found' }, { status: 404 });
        }
    } catch (error) {
        console.error('Error resolving referral alias:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
