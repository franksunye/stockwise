import { NextResponse } from 'next/server';
import { createAdminSessionToken, safeEqualText, setAdminSessionCookie } from '@/lib/admin-session';

interface LoginBody {
    username?: string;
    password?: string;
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as LoginBody;
        const username = body.username?.trim() || '';
        const password = body.password || '';

        const adminUsername = process.env.ADMIN_USERNAME?.trim() || '';
        const adminPassword = process.env.ADMIN_PASSWORD || '';

        if (!adminUsername || !adminPassword) {
            console.error('[admin-auth] ADMIN_USERNAME/ADMIN_PASSWORD is not configured');
            return NextResponse.json({ error: 'Admin login not configured' }, { status: 503 });
        }

        const userOk = safeEqualText(username, adminUsername);
        const passOk = safeEqualText(password, adminPassword);
        if (!userOk || !passOk) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const token = createAdminSessionToken(adminUsername);
        if (!token) {
            console.error('[admin-auth] session signing secret is not configured');
            return NextResponse.json({ error: 'Admin session not configured' }, { status: 503 });
        }

        const response = NextResponse.json({ success: true });
        setAdminSessionCookie(response, token);
        return response;
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

