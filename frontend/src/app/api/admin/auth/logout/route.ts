import { NextResponse } from 'next/server';
import { clearAdminSessionCookie } from '@/lib/admin-session';

function buildLogoutResponse() {
    const response = NextResponse.json({ success: true });
    clearAdminSessionCookie(response);
    return response;
}

export async function POST() {
    return buildLogoutResponse();
}

export async function GET() {
    return buildLogoutResponse();
}

