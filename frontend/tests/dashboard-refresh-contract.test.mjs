import test from 'node:test';
import assert from 'node:assert/strict';

import {
    getDashboardRefreshPlan,
} from '../src/lib/dashboard-refresh-contract.ts';

const baseState = {
    hasWatchlist: true,
    loadingWatchlist: false,
    hasMissingSymbols: false,
    shouldPollBatch: false,
    shouldCheckPredictionDrift: false,
    historySatisfied: true,
    priceOnlyRefresh: false,
};

test('watchlist change forces dashboard fetch when local cache misses symbols', () => {
    const plan = getDashboardRefreshPlan('watchlist_changed', {
        ...baseState,
        hasMissingSymbols: true,
    });

    assert.deepEqual(plan, {
        profile: 'silent',
        dashboard: 'force',
        prices: 'none',
        checkPredictionDrift: false,
    });
});

test('watchlist change only remaps dashboard when local cache already satisfies symbols', () => {
    const plan = getDashboardRefreshPlan('watchlist_changed', baseState);

    assert.deepEqual(plan, {
        profile: 'silent',
        dashboard: 'remap',
        prices: 'none',
        checkPredictionDrift: false,
    });
});

test('history limit upgrade silently fetches when cached history is insufficient', () => {
    const plan = getDashboardRefreshPlan('history_limit_upgraded', {
        ...baseState,
        historySatisfied: false,
    });

    assert.deepEqual(plan, {
        profile: 'none',
        dashboard: 'silent',
        prices: 'none',
        checkPredictionDrift: false,
    });
});

test('resume refreshes prices and polls batch when post-market predictions are stale', () => {
    const plan = getDashboardRefreshPlan('resume_visible', {
        ...baseState,
        shouldPollBatch: true,
    });

    assert.deepEqual(plan, {
        profile: 'none',
        dashboard: 'silent',
        prices: 'refresh',
        checkPredictionDrift: false,
    });
});

test('resume checks prediction drift when post-market predictions look fresh', () => {
    const plan = getDashboardRefreshPlan('resume_visible', {
        ...baseState,
        shouldCheckPredictionDrift: true,
    });

    assert.deepEqual(plan, {
        profile: 'none',
        dashboard: 'none',
        prices: 'refresh',
        checkPredictionDrift: true,
    });
});

test('post-market poll stays idle outside stale-prediction window', () => {
    const plan = getDashboardRefreshPlan('post_market_poll', baseState);

    assert.deepEqual(plan, {
        profile: 'none',
        dashboard: 'none',
        prices: 'none',
        checkPredictionDrift: false,
    });
});
