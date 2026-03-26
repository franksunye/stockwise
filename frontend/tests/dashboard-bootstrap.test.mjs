import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/dashboard-bootstrap.ts')).href;
const {
    getDashboardEntryHint,
    getOptimisticDashboardBootstrap,
    readAuthCache,
    readDashboardNavIntent,
    shouldMarkDashboardBootReady,
    shouldOptimisticallyEnterDashboard,
    shouldSuppressDashboardSplash,
} = await import(moduleUrl);

describe('dashboard bootstrap helpers', () => {
    it('rejects expired auth cache', () => {
        const now = 1_000_000;
        const raw = JSON.stringify({
            tier: 'pro',
            authorized: true,
            timestamp: now - (7 * 24 * 60 * 60 * 1000) - 1,
        });

        assert.equal(readAuthCache(raw, now), null);
    });

    it('marks dashboard boot-ready for onboarded returning users with cached identity', () => {
        const state = {
            authCacheRaw: JSON.stringify({ tier: 'pro', authorized: true, timestamp: 1_000 }),
            profileCacheRaw: JSON.stringify({ userId: 'user_123', hasOnboarded: true, tier: 'pro' }),
            hasOnboardedRaw: 'true',
        };

        assert.equal(shouldMarkDashboardBootReady(state, 2_000), true);
    });

    it('derives optimistic bootstrap directly from valid auth cache', () => {
        const state = {
            authCacheRaw: JSON.stringify({ tier: 'pro', authorized: false, timestamp: 1_000 }),
            profileCacheRaw: JSON.stringify({ userId: 'user_123', hasOnboarded: true, tier: 'free' }),
        };

        assert.deepEqual(getOptimisticDashboardBootstrap(state, 2_000), {
            authorized: false,
            tier: 'pro',
        });
    });

    it('allows optimistic enter when profile exists and dashboard nav intent is still fresh', () => {
        const now = 50_000;
        const state = {
            profileCacheRaw: JSON.stringify({ userId: 'user_123', hasOnboarded: false, tier: 'free' }),
            navIntentRaw: JSON.stringify({ symbol: '00700', timestamp: now - 5_000 }),
        };

        assert.deepEqual(readDashboardNavIntent(state.navIntentRaw, now), {
            symbol: '00700',
            timestamp: now - 5_000,
        });
        assert.equal(shouldOptimisticallyEnterDashboard(state, now), true);
        assert.deepEqual(getOptimisticDashboardBootstrap(state, now), {
            authorized: true,
            tier: 'free',
        });
    });

    it('suppresses splash for recent in-session return visits', () => {
        const now = 200_000;
        const state = {
            splashTsRaw: String(now - 10_000),
        };
        const runtime = {
            hostname: 'app.ziso.cc',
            pathname: '/dashboard',
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
            now,
        };

        assert.equal(shouldSuppressDashboardSplash(state, runtime), true);
    });

    it('keeps splash for cold mobile dashboard opens', () => {
        const runtime = {
            hostname: 'app.ziso.cc',
            pathname: '/dashboard',
            userAgent: 'Mozilla/5.0 (Android 14; Mobile)',
            now: 300_000,
        };

        assert.equal(shouldSuppressDashboardSplash({}, runtime), false);
    });

    it('produces a combined dashboard entry hint without mutating behavior', () => {
        const now = 400_000;
        const state = {
            authCacheRaw: JSON.stringify({ tier: 'free', authorized: true, timestamp: now - 1_000 }),
            profileCacheRaw: JSON.stringify({ userId: 'user_123', hasOnboarded: true, tier: 'free' }),
            hasOnboardedRaw: 'true',
            navIntentRaw: JSON.stringify({ symbol: '09988', timestamp: now - 1_000 }),
        };

        assert.deepEqual(getDashboardEntryHint(state, now), {
            shouldMarkBootReady: true,
            canOptimisticallyEnter: true,
            optimisticBootstrap: {
                authorized: true,
                tier: 'free',
            },
        });
    });
});
