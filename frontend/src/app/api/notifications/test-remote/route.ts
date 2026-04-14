import { NextResponse } from 'next/server';
import { Client } from '@libsql/client';
import Database from 'better-sqlite3';
import { getDbClient } from '@/lib/db';
import { sendInternalNotification } from '@/lib/server-notify';
import { requireUserSession } from '@/lib/user-session';

type SubscriptionRow = {
    endpoint?: string | null;
    user_agent?: string | null;
    last_used_at?: string | null;
};

function summarizeEndpointHosts(rows: SubscriptionRow[]): string[] {
    return [...new Set(rows
        .map((row) => {
            const endpoint = String(row.endpoint || '').trim();
            if (!endpoint) return null;
            try {
                return new URL(endpoint).host;
            } catch {
                return 'invalid-endpoint';
            }
        })
        .filter((host): host is string => Boolean(host)))];
}

export async function POST(request: Request) {
    const auth = requireUserSession(request);
    if ('response' in auth) return auth.response;
    const userId = auth.userId;

    const strategy = process.env.DB_STRATEGY || 'local';
    const client = getDbClient();

    try {
        let subscriptions: SubscriptionRow[] = [];
        if (strategy === 'cloud') {
            const res = await (client as Client).execute({
                sql: 'SELECT endpoint, user_agent, last_used_at FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC',
                args: [userId],
            });
            subscriptions = res.rows as SubscriptionRow[];
        } else {
            const db = client as Database.Database;
            subscriptions = db.prepare(
                'SELECT endpoint, user_agent, last_used_at FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC',
            ).all(userId) as SubscriptionRow[];
        }

        if (subscriptions.length === 0) {
            return NextResponse.json({
                error: 'No push subscription found',
                subscriptionCount: 0,
            }, { status: 409 });
        }

        const result = await sendInternalNotification({
            target_user_id: userId,
            title: 'Remote push test — ZISO AI',
            body: 'If you see this on your phone, server-side Web Push is working.',
            url: '/dashboard',
            tag: 'referral_reward',
            skip_log: true,
        });

        if (!result || result.success !== true) {
            return NextResponse.json({
                error: 'Remote push dispatch failed',
                subscriptionCount: subscriptions.length,
                endpointHosts: summarizeEndpointHosts(subscriptions),
            }, { status: 502 });
        }

        return NextResponse.json({
            success: true,
            subscriptionCount: subscriptions.length,
            endpointHosts: summarizeEndpointHosts(subscriptions),
            lastUsedAt: subscriptions[0]?.last_used_at || null,
            dispatch: result,
        });
    } catch (error) {
        console.error('[notifications/test-remote] Failed to send remote test push:', error);
        return NextResponse.json({ error: 'Failed to send remote test push' }, { status: 500 });
    } finally {
        if (client && typeof client.close === 'function') {
            client.close();
        }
    }
}
