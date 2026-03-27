import process from 'node:process';
import { waitForServerReady } from '../tests/test-utils.mjs';

const DEFAULT_BASE_URL = process.env.USER_CENTER_SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const DEFAULT_HEADLESS = process.env.USER_CENTER_SMOKE_HEADLESS !== 'false';
const TODAY = '2026-03-27';

function parseArgs(argv) {
    const options = {
        baseUrl: DEFAULT_BASE_URL,
        headless: DEFAULT_HEADLESS,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--base-url' && argv[i + 1]) {
            options.baseUrl = argv[i + 1];
            i += 1;
        } else if (arg === '--headed') {
            options.headless = false;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
    }

    return options;
}

function printHelp() {
    console.log(`Usage:
  node scripts/user-center-smoke.mjs [--base-url http://127.0.0.1:3000] [--headed]

Notes:
  - Start local frontend first.
  - This script validates UserCenterDrawer open-time data loading and notification settings writeback.`);
}

async function loadPlaywright() {
    try {
        return await import('playwright');
    } catch {
        console.error('Missing local playwright package.');
        process.exit(1);
    }
}

async function seedStorage(context) {
    await context.addInitScript(() => {
        localStorage.setItem('ZISO_AUTH_CACHE_V1', JSON.stringify({
            tier: 'free',
            authorized: true,
            timestamp: Date.now(),
        }));
        localStorage.setItem('stockwise_user_profile_v1', JSON.stringify({
            userId: 'user_center_smoke',
            tier: 'free',
            hasOnboarded: true,
            email: 'smoke@example.com',
            watchlistCount: 2,
        }));
        localStorage.setItem('STOCKWISE_HAS_ONBOARDED', 'true');
        localStorage.setItem('STOCKWISE_USER_ID', 'user_center_smoke');
        localStorage.setItem('stockwise_splash_ts', String(Date.now()));
        localStorage.setItem('STOCKWISE_WATCHLIST_V2', JSON.stringify([
            { symbol: '00700', name: 'Tencent', addedAt: Date.now() },
            { symbol: '09988', name: 'Alibaba', addedAt: Date.now() + 1 },
        ]));
        localStorage.setItem('stock_watchlist', JSON.stringify(['00700', '09988']));
        localStorage.setItem('stockwise_dashboard_cache_v1', JSON.stringify({
            data: [
                {
                    symbol: '00700',
                    name: 'Tencent',
                    price: {
                        symbol: '00700',
                        date: TODAY,
                        open: 378,
                        high: 382,
                        low: 377,
                        close: 380,
                        volume: 100000,
                        change_percent: 1.5,
                        ma5: 380,
                        ma10: 379,
                        ma20: 378,
                        ma60: 370,
                        macd: 0.1,
                        macd_signal: 0.1,
                        macd_hist: 0,
                        boll_upper: 385,
                        boll_mid: 380,
                        boll_lower: 375,
                        rsi: 55,
                        kdj_k: 60,
                        kdj_d: 58,
                        kdj_j: 64,
                        ai_summary: null,
                    },
                    prediction: {
                        symbol: '00700',
                        date: TODAY,
                        target_date: TODAY,
                        signal: 'Long',
                        confidence: 0.9,
                        support_price: 100,
                        ai_reasoning: '{"summary":"smoke"}',
                        validation_status: 'Pending',
                        actual_change: null,
                        updated_at: `${TODAY}T09:30:00.000Z`,
                    },
                    previousPrediction: null,
                    history: [],
                    shortMetrics: null,
                    lastUpdated: '09:30',
                    rule: null,
                    loading: false,
                },
                {
                    symbol: '09988',
                    name: 'Alibaba',
                    price: {
                        symbol: '09988',
                        date: TODAY,
                        open: 87,
                        high: 89,
                        low: 86,
                        close: 88,
                        volume: 100000,
                        change_percent: 1.2,
                        ma5: 88,
                        ma10: 87,
                        ma20: 86,
                        ma60: 84,
                        macd: 0.1,
                        macd_signal: 0.1,
                        macd_hist: 0,
                        boll_upper: 90,
                        boll_mid: 88,
                        boll_lower: 86,
                        rsi: 55,
                        kdj_k: 60,
                        kdj_d: 58,
                        kdj_j: 64,
                        ai_summary: null,
                    },
                    prediction: {
                        symbol: '09988',
                        date: TODAY,
                        target_date: TODAY,
                        signal: 'Side',
                        confidence: 0.82,
                        support_price: 70,
                        ai_reasoning: '{"summary":"smoke"}',
                        validation_status: 'Pending',
                        actual_change: null,
                        updated_at: `${TODAY}T09:30:00.000Z`,
                    },
                    previousPrediction: null,
                    history: [],
                    shortMetrics: null,
                    lastUpdated: '09:31',
                    rule: null,
                    loading: false,
                },
            ],
            timestamp: Date.now(),
        }));

        const fakeSubscription = {
            endpoint: 'https://example.com/push/subscription',
            toJSON: () => ({ endpoint: 'https://example.com/push/subscription' }),
            unsubscribe: async () => true,
        };
        const fakeRegistration = {
            pushManager: {
                getSubscription: async () => fakeSubscription,
                subscribe: async () => fakeSubscription,
            },
            showNotification: async () => {},
        };
        Object.defineProperty(Object.getPrototypeOf(navigator), 'serviceWorker', {
            configurable: true,
            get: () => ({
                ready: Promise.resolve(fakeRegistration),
                register: async () => fakeRegistration,
            }),
        });
        Object.defineProperty(window, 'PushManager', {
            configurable: true,
            value: function PushManager() {},
        });
        Object.defineProperty(Notification, 'permission', {
            configurable: true,
            get: () => 'granted',
        });
        Notification.requestPermission = async () => 'granted';
    });
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const { chromium } = await loadPlaywright();
    await waitForServerReady(options.baseUrl);

    const counters = {
        profileRefresh: 0,
        modeSummary: 0,
        notificationGet: 0,
        notificationPost: 0,
    };

    const browser = await chromium.launch({
        headless: options.headless,
        channel: 'chrome',
    });

    try {
        const context = await browser.newContext({
            viewport: { width: 1440, height: 900 },
        });
        await seedStorage(context);
        const page = await context.newPage();

        await page.route('**/_vercel/insights/**', async (route) => {
            await route.fulfill({ status: 204, body: '' });
        });
        await page.route('**/api/user/register', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, userId: 'user_center_smoke' }),
            });
        });
        await page.route('**/api/shared/almanac', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    almanac: {
                        target_date: TODAY,
                        mood_tag: '平稳',
                        action_strategy: '宜：观察 · 忌：追涨',
                        meteorology: '微风',
                        market_entropy: { score: 0.6, label: 'steady', breadth: 'neutral', volume_status: '量能平稳' },
                        sector_currents: { main: [], inverse: [] },
                        ai_insight: 'smoke',
                    },
                }),
            });
        });
        await page.route('**/api/user/profile', async (route) => {
            counters.profileRefresh += 1;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    userId: 'user_center_smoke',
                    tier: 'free',
                    hasOnboarded: true,
                    watchlistCount: 2,
                    email: 'smoke@example.com',
                    expiresAt: null,
                    hasStripeCustomer: false,
                }),
            });
        });
        await page.route('**/api/stock-pool**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    stocks: [
                        { symbol: '00700', name: 'Tencent', added_at: `${TODAY}T09:30:00.000Z` },
                        { symbol: '09988', name: 'Alibaba', added_at: `${TODAY}T09:31:00.000Z` },
                    ],
                }),
            });
        });
        await page.route('**/api/stock/batch**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ stocks: [] }),
            });
        });
        await page.route('**/api/user/mode/summary', async (route) => {
            counters.modeSummary += 1;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    mode: {
                        name: '波段模式',
                        risk_band: 'medium',
                        tagline: '适合趋势中的中段观察',
                        default_horizon: '30d',
                    },
                }),
            });
        });
        await page.route('**/api/user/notification-settings', async (route) => {
            if (route.request().method() === 'POST') {
                counters.notificationPost += 1;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true }),
                });
                return;
            }

            counters.notificationGet += 1;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    settings: {
                        enabled: true,
                        types: {
                            signal_flip: { enabled: true, priority: 'high' },
                            morning_call: { enabled: true, priority: 'medium' },
                            validation_glory: { enabled: true, priority: 'medium' },
                            prediction_updated: { enabled: true, priority: 'low' },
                            daily_brief: { enabled: true, priority: 'low' },
                            price_update: { enabled: false, priority: 'low' },
                            market_almanac: { enabled: true, priority: 'medium' },
                        },
                    },
                }),
            });
        });
        await page.route('**/api/system/calendar**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({}),
            });
        });

        await page.goto(`${options.baseUrl}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });
        await page.waitForFunction(() => {
            return (
                !!document.querySelector('[data-dashboard-content="true"]') &&
                !document.querySelector('[data-dashboard-skeleton="true"]')
            );
        }, { timeout: 15000 });

        counters.profileRefresh = 0;
        counters.modeSummary = 0;
        counters.notificationGet = 0;
        counters.notificationPost = 0;

        await page.click('[data-open-user-center="true"]');
        await page.waitForSelector('[data-user-center-drawer="true"]', { timeout: 15000 });
        await page.waitForFunction(() => {
            const modeNode = document.querySelector('[data-user-center-current-mode="true"]');
            return modeNode?.textContent?.includes('波段模式');
        }, { timeout: 15000 });

        await page.waitForTimeout(400);

        const result = {
            profileRefreshCalls: counters.profileRefresh,
            modeSummaryCalls: counters.modeSummary,
            notificationGetCalls: counters.notificationGet,
            notificationPostCalls: counters.notificationPost,
            modeLabel: await page.locator('[data-user-center-current-mode="true"]').innerText(),
            hasNotificationSettingsButton: await page.locator('[data-user-center-notification-settings-button="true"]').count(),
            success:
                counters.profileRefresh >= 1 &&
                counters.modeSummary >= 1,
        };

        console.log(JSON.stringify(result, null, 2));

        if (!result.success) {
            process.exitCode = 2;
        }

        await context.close();
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
