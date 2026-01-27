import { NextResponse } from 'next/server';

/**
 * GET /api/notifications/vapid-public-key
 * 
 * Returns the VAPID public key for web push subscriptions.
 * This endpoint is used by the frontend to subscribe users to push notifications.
 */
export async function GET() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) {
        console.error('[VAPID] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured');
        return NextResponse.json(
            { error: 'Push notifications are not configured on this server' },
            { status: 503 }
        );
    }

    return NextResponse.json({ publicKey });
}
