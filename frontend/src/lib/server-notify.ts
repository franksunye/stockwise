
/**
 * Server-side internal notification helper
 */
export async function sendInternalNotification(payload: {
    target_user_id?: string;
    related_symbol?: string;
    broadcast?: boolean;
    title: string;
    body: string;
    url?: string;
    tag?: string;
    skip_log?: boolean;
}) {
    const secret = process.env.INTERNAL_API_SECRET;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!secret) {
        console.warn('⚠️ [sendInternalNotification] INTERNAL_API_SECRET not set, cannot send notification');
        return null;
    }

    try {
        const res = await fetch(`${baseUrl}/api/internal/notify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${secret}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const error = await res.text();
            console.error(`❌ [sendInternalNotification] Failed to send notification: ${res.status} ${error}`);
            return null;
        }

        return await res.json();
    } catch (err) {
        console.error('❌ [sendInternalNotification] Error:', err);
        return null;
    }
}
