import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_NOTIFICATION_SETTINGS,
    normalizeNotificationSettings,
    readCachedUserCenterMode,
} from '../src/lib/user-center-data.ts';

test('normalizes notification settings with defaults and preserves overrides', () => {
    const normalized = normalizeNotificationSettings({
        types: {
            signal_flip: { enabled: false },
            price_update: { enabled: true },
        },
    });

    assert.equal(normalized.types.signal_flip.enabled, false);
    assert.equal(normalized.types.signal_flip.priority, DEFAULT_NOTIFICATION_SETTINGS.types.signal_flip.priority);
    assert.equal(normalized.types.price_update.enabled, true);
    assert.equal(normalized.types.market_almanac.enabled, true);
});

test('reads cached user center mode from investment mode card snapshot', () => {
    const mode = readCachedUserCenterMode(JSON.stringify({
        modeResponse: {
            mode: {
                name: '波段',
                risk_band: 'medium',
                tagline: '适合波段观察',
                default_horizon: '30d',
            },
        },
    }));

    assert.deepEqual(mode, {
        name: '波段',
        risk_band: 'medium',
        tagline: '适合波段观察',
        default_horizon: '30d',
    });
});

test('returns null for invalid cached mode payloads', () => {
    assert.equal(readCachedUserCenterMode('not-json'), null);
    assert.equal(readCachedUserCenterMode(null), null);
});
