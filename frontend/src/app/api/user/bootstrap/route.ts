import { NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
import { requireUserSession } from '@/lib/user-session';
import { prepareUserBootstrapPayload } from '@/lib/user-bootstrap-server';

export async function POST(request: Request) {
    let db: ReturnType<typeof getDbClient> | null = null;
    const startTime = Date.now();
    const requestId = `bootstrap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    try {
        const auth = requireUserSession(request);
        if ('response' in auth) {
            auth.response.headers.set('X-Stockwise-Request-Id', requestId);
            return auth.response;
        }

        const userId = auth.userId;
        const { watchlist, referredBy, locale, explicitLocale } = await request.json().catch(() => ({}));

        db = getDbClient();
        const payload = await prepareUserBootstrapPayload(db, userId, {
            watchlist,
            referredBy,
            locale,
            explicitLocale,
            referralRewardEnabled: MEMBERSHIP_CONFIG.switches.enableReferralReward,
            referralDays: MEMBERSHIP_CONFIG.referral.refereeDays,
            includeWatchlistItems: true,
            includeReferralDetails: false,
        });

        const response = NextResponse.json({
            userId: payload.user.user_id,
            tier: payload.tier,
            expiresAt: payload.expiresAt,
            hasOnboarded: payload.hasOnboarded,
            watchlistCount: payload.watchlistCount,
            watchlist: payload.watchlist,
            email: payload.user.email ?? null,
            locale: payload.locale,
            hasStripeCustomer: payload.hasStripeCustomer,
            isNewUser: payload.isNewUser,
            isChannel: payload.isChannel,
        });
        const duration = Date.now() - startTime;
        response.headers.set('X-Stockwise-Request-Id', requestId);
        response.headers.set('X-Stockwise-Bootstrap-Watchlist-Count', String(payload.watchlistCount));
        response.headers.set('X-Stockwise-Tier', payload.tier);
        response.headers.set('Server-Timing', `app;dur=${duration}`);
        console.info(JSON.stringify({
            type: 'stockwise_observation',
            route: '/api/user/bootstrap',
            requestId,
            ok: true,
            tier: payload.tier,
            watchlistCount: payload.watchlistCount,
            hasOnboarded: payload.hasOnboarded,
            duration,
            ts: new Date().toISOString(),
        }));
        return response;
    } catch (error: unknown) {
        console.error('Bootstrap error:', error);
        console.info(JSON.stringify({
            type: 'stockwise_observation',
            route: '/api/user/bootstrap',
            requestId,
            ok: false,
            duration: Date.now() - startTime,
            error: (error as Error).message || 'Internal Server Error',
            ts: new Date().toISOString(),
        }));
        const response = NextResponse.json({ error: (error as Error).message || 'Internal Server Error' }, { status: 500 });
        response.headers.set('X-Stockwise-Request-Id', requestId);
        return response;
    } finally {
        if (db && typeof db.close === 'function') {
            db.close();
        }
    }
}
