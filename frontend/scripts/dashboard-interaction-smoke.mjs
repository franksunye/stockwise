import process from 'node:process';

const DEFAULT_BASE_URL = process.env.DASHBOARD_INTERACTION_BASE_URL || 'http://127.0.0.1:3000';
const DEFAULT_HEADLESS = process.env.DASHBOARD_INTERACTION_HEADLESS !== 'false';

const NOW = 1760000000000;

function formatDate(value) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const TODAY = formatDate(new Date());
const YESTERDAY_DATE = new Date();
YESTERDAY_DATE.setDate(YESTERDAY_DATE.getDate() - 1);
const YESTERDAY = formatDate(YESTERDAY_DATE);

const WATCHLIST = [
    { symbol: 'AAPL', name: 'Apple', addedAt: NOW - 2000 },
    { symbol: 'MSFT', name: 'Microsoft', addedAt: NOW - 1000 },
];

const TACTICAL_PAYLOAD = {
    summary: '苹果处于温和趋势延续阶段，等待量价进一步确认。',
    reasoning_trace: [
        { step: 'trend', data: '趋势抬升', conclusion: '结构偏多' },
    ],
    tactics: {
        holding_profit: [
            {
                priority: 'P1',
                action: '继续持有',
                trigger: '若价格维持在支撑位上方',
                reason: '趋势延续',
            },
        ],
        holding_loss: [],
        empty: [
            {
                priority: 'P1',
                action: '等待突破',
                trigger: '放量站稳前高',
                reason: '等待确认',
            },
        ],
        general: [],
    },
    key_levels: {
        support: 178,
        resistance: 187,
        stop_loss: 174,
    },
    conflict_resolution: '若量能不能跟随，则以观望为主。',
};

function parseArgs(argv) {
    const options = {
        baseUrl: DEFAULT_BASE_URL,
        headless: DEFAULT_HEADLESS,
        caseName: '',
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--base-url' && argv[i + 1]) {
            options.baseUrl = argv[i + 1];
            i += 1;
        } else if (arg === '--headed') {
            options.headless = false;
        } else if (arg === '--headless') {
            options.headless = true;
        } else if (arg === '--case' && argv[i + 1]) {
            options.caseName = argv[i + 1];
            i += 1;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
    }

    return options;
}

function printHelp() {
    console.log(`Usage:
  node scripts/dashboard-interaction-smoke.mjs [--base-url http://127.0.0.1:3000] [--headed] [--case url-symbol-context]

Environment variables:
  DASHBOARD_INTERACTION_BASE_URL
  DASHBOARD_INTERACTION_HEADLESS=false

Notes:
  - Start local frontend first.
  - This script validates dashboard symbol navigation and modal context semantics.
  - It runs against stubbed API responses and controlled local/session storage.`);
}

function buildAuthCache({ tier = 'free', authorized = true, timestamp = NOW } = {}) {
    return JSON.stringify({ tier, authorized, timestamp });
}

function buildProfileCache({
    userId = 'user_interaction_case',
    tier = 'free',
    hasOnboarded = true,
} = {}) {
    return JSON.stringify({
        userId,
        tier,
        hasOnboarded,
        email: 'interaction@example.com',
    });
}

function buildBatchStock(symbol, overrides = {}) {
    return {
        symbol,
        lastUpdated: '15:30',
        price: {
            symbol,
            date: TODAY,
            close: symbol === 'AAPL' ? 182.35 : 417.1,
            change_percent: symbol === 'AAPL' ? 1.24 : -0.42,
            open: 0,
            high: 0,
            low: 0,
            volume: 0,
            ma5: 0,
            ma10: 0,
            ma20: 0,
            ma60: 0,
            macd: 0,
            macd_signal: 0,
            macd_hist: 0,
            boll_upper: 0,
            boll_mid: 0,
            boll_lower: 0,
            rsi: 55,
            kdj_k: 50,
            kdj_d: 50,
            kdj_j: 50,
            ai_summary: null,
        },
        prediction: {
            symbol,
            date: TODAY,
            target_date: TODAY,
            signal: symbol === 'AAPL' ? 'Long' : 'Side',
            confidence: symbol === 'AAPL' ? 0.81 : 0.62,
            support_price: symbol === 'AAPL' ? 178 : 410,
            ai_reasoning: JSON.stringify(TACTICAL_PAYLOAD),
            validation_status: 'Pending',
            actual_change: null,
            model: 'gpt-5.4-mini',
            layer1_status: symbol === 'AAPL' ? 'Long' : 'Side',
        },
        previousPrediction: null,
        history: [
            {
                symbol,
                date: YESTERDAY,
                target_date: YESTERDAY,
                signal: 'Side',
                confidence: 0.55,
                support_price: 0,
                ai_reasoning: JSON.stringify(TACTICAL_PAYLOAD),
                validation_status: 'Correct',
                actual_change: 1.2,
            },
        ],
        hasMoreHistory: false,
        shortMetrics: null,
        ...overrides,
    };
}

const BASE_STORAGE = {
    local: {
        ZISO_AUTH_CACHE_V1: buildAuthCache(),
        stockwise_user_profile_v2: buildProfileCache(),
        STOCKWISE_HAS_ONBOARDED: 'true',
        STOCKWISE_USER_ID: 'user_interaction_case',
        STOCKWISE_WATCHLIST_V2: JSON.stringify(WATCHLIST),
        stockwise_splash_ts: String(NOW),
        'stockwise:investment-mode-card': JSON.stringify({
            mode: 'balanced',
            label: 'Balanced',
            riskBand: 'balanced',
            updatedAt: '2026-03-27T15:30:00.000Z',
        }),
    },
    session: {},
};

const CASES = [
    {
        name: 'url-symbol-context',
        path: '/dashboard?symbol=MSFT',
        expectedCurrentSymbol: 'MSFT',
        expectedContextSymbol: 'MSFT',
        expectedActiveModal: 'none',
        assert: async ({ assertMainState }) => {
            await assertMainState({
                currentSymbol: 'MSFT',
                contextSymbol: 'MSFT',
                activeModal: 'none',
            });
        },
    },
    {
        name: 'stock-pool-nav-intent',
        path: '/dashboard/stock-pool',
        expectedCurrentSymbol: 'MSFT',
        expectedContextSymbol: 'MSFT',
        expectedActiveModal: 'none',
        assert: async ({ page, assertMainState }) => {
            await page.locator('[data-stock-pool-symbol="MSFT"]').click();
            await page.waitForURL('**/dashboard');
            await assertMainState({
                currentSymbol: 'MSFT',
                contextSymbol: 'MSFT',
                activeModal: 'none',
            });
        },
    },
    {
        name: 'brief-modal-context',
        path: '/dashboard?symbol=AAPL',
        expectedCurrentSymbol: 'AAPL',
        expectedContextSymbol: 'AAPL',
        expectedActiveModal: 'brief',
        storage: {
            local: {
                ZISO_AUTH_CACHE_V1: buildAuthCache({ tier: 'pro' }),
                stockwise_user_profile_v2: buildProfileCache({ tier: 'pro' }),
            },
        },
        assert: async ({ page, assertMainState }) => {
            let lastError = null;
            for (let attempt = 0; attempt < 4; attempt += 1) {
                const briefButton = page.locator('[data-open-brief="true"]').first();
                await briefButton.waitFor({ state: 'visible' });
                try {
                    await briefButton.click();
                    lastError = null;
                    break;
                } catch (error) {
                    lastError = error;
                    await page.waitForTimeout(250);
                }
            }
            if (lastError) throw lastError;
            await page.locator('[data-dashboard-brief-drawer="true"][data-brief-drawer-symbol="AAPL"]').waitFor();
            await assertMainState({
                currentSymbol: 'AAPL',
                contextSymbol: 'AAPL',
                activeModal: 'brief',
            });
        },
    },
    {
        name: 'profile-modal-context',
        path: '/dashboard?symbol=AAPL',
        expectedCurrentSymbol: 'AAPL',
        expectedContextSymbol: 'AAPL',
        expectedActiveModal: 'profile',
        assert: async ({ page, assertMainState }) => {
            await page.locator('[data-open-profile="true"]').first().click();
            await page.locator('[data-stock-profile="true"][data-stock-profile-symbol="AAPL"]').waitFor();
            await assertMainState({
                currentSymbol: 'AAPL',
                contextSymbol: 'AAPL',
                activeModal: 'profile',
            });
        },
    },
    {
        name: 'tactical-modal-context',
        path: '/dashboard?symbol=AAPL',
        expectedCurrentSymbol: 'AAPL',
        expectedContextSymbol: 'AAPL',
        expectedActiveModal: 'tactics',
        assert: async ({ page, assertMainState }) => {
            await page.locator('[data-open-tactics="true"][data-stock-dashboard-card-symbol="AAPL"]').click();
            await page.locator('[data-tactical-brief-drawer="true"][data-tactical-brief-symbol="AAPL"]').waitFor();
            await assertMainState({
                currentSymbol: 'AAPL',
                contextSymbol: 'AAPL',
                activeModal: 'tactics',
            });
        },
    },
    {
        name: 'user-center-modal-context',
        path: '/dashboard?symbol=AAPL',
        expectedCurrentSymbol: 'AAPL',
        expectedContextSymbol: 'AAPL',
        expectedActiveModal: 'user-center',
        assert: async ({ page, assertMainState }) => {
            await page.locator('[data-open-user-center="true"]').click();
            await page.locator('[data-user-center-drawer="true"]').waitFor();
            await assertMainState({
                currentSymbol: 'AAPL',
                contextSymbol: 'AAPL',
                activeModal: 'user-center',
            });
        },
    },
    {
        name: 'horizontal-swipe-native-snap',
        path: '/dashboard?symbol=AAPL',
        expectedCurrentSymbol: 'MSFT',
        expectedContextSymbol: 'MSFT',
        expectedActiveModal: 'none',
        contextOptions: {
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
        },
        assert: async ({ page, assertMainState }) => {
            await page.evaluate(async () => {
                const container = Array.from(document.querySelectorAll('div')).find((node) => {
                    if (!(node instanceof HTMLDivElement)) return false;
                    const style = window.getComputedStyle(node);
                    return node.scrollWidth > node.clientWidth + 20 &&
                        (style.overflowX === 'scroll' || style.overflowX === 'auto');
                });

                if (!(container instanceof HTMLDivElement)) {
                    throw new Error('Horizontal dashboard scroller not found');
                }

                const calls = [];
                const originalScrollTo = container.scrollTo.bind(container);
                container.scrollTo = (...args) => {
                    calls.push(args);
                    return originalScrollTo(...args);
                };
                window.__dashboardScrollToCalls = calls;

                const startLeft = container.scrollLeft;
                const targetLeft = Math.min(startLeft + container.clientWidth, container.scrollWidth - container.clientWidth);

                await new Promise((resolve) => {
                    const start = performance.now();
                    const duration = 220;
                    const step = (timestamp) => {
                        const progress = Math.min((timestamp - start) / duration, 1);
                        container.scrollLeft = startLeft + ((targetLeft - startLeft) * progress);
                        if (progress < 1) {
                            requestAnimationFrame(step);
                            return;
                        }
                        resolve();
                    };
                    requestAnimationFrame(step);
                });

                await new Promise(resolve => setTimeout(resolve, 120));
            });

            await assertMainState({
                currentSymbol: 'MSFT',
                contextSymbol: 'MSFT',
                activeModal: 'none',
            });

            const scrollToCalls = await page.evaluate(() => window.__dashboardScrollToCalls || []);
            if (scrollToCalls.length > 0) {
                throw new Error(`Expected native snap without JS correction, but recorded ${scrollToCalls.length} horizontal scrollTo call(s)`);
            }
        },
    },
];

async function loadPlaywright() {
    try {
        return await import('playwright');
    } catch {
        console.error('Missing local playwright package. Install temporarily with:');
        console.error('  cd frontend && npm install --no-save playwright');
        process.exit(1);
    }
}

async function seedStorage(context, seed) {
    await context.addInitScript(({ storage, now }) => {
        const realNow = Date.now;
        Date.now = () => now;

        for (const [key, value] of Object.entries(storage.local || {})) {
            window.localStorage.setItem(key, value);
        }
        for (const [key, value] of Object.entries(storage.session || {})) {
            window.sessionStorage.setItem(key, value);
        }

        try {
            Object.defineProperty(window, 'PushManager', {
                configurable: true,
                value: undefined,
            });
        } catch {}

        try {
            Object.defineProperty(window, 'Notification', {
                configurable: true,
                value: { permission: 'denied' },
            });
        } catch {}

        window.__restoreDateNow = () => {
            Date.now = realNow;
        };
    }, { storage: seed, now: NOW });
}

async function addApiStubs(page, smokeCase = null) {
    const profileSeedRaw =
        smokeCase?.storage?.local?.stockwise_user_profile_v2 ??
        BASE_STORAGE.local.stockwise_user_profile_v2;
    let seededProfile = {
        userId: 'user_interaction_case',
        tier: 'free',
        hasOnboarded: true,
    };
    try {
        seededProfile = {
            ...seededProfile,
            ...JSON.parse(profileSeedRaw),
        };
    } catch {}

    await page.route('https://va.vercel-scripts.com/**', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: '',
        });
    });

    await page.route('**/_vercel/insights/**', async route => {
        await route.fulfill({ status: 204, body: '' });
    });

    await page.route('**/api/user/register', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, userId: 'user_interaction_case' }),
        });
    });

    await page.route('**/api/user/profile', async route => {
        const isPaidTier = seededProfile.tier === 'pro' || seededProfile.tier === 'alpha';
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                userId: seededProfile.userId,
                tier: seededProfile.tier,
                hasOnboarded: seededProfile.hasOnboarded,
                watchlistCount: WATCHLIST.length,
                expiresAt: isPaidTier ? '2026-12-31T00:00:00.000Z' : null,
                email: 'interaction@example.com',
                hasStripeCustomer: isPaidTier,
                recentTransactions: [],
            }),
        });
    });

    await page.route('**/api/user/activity', async route => {
        await route.fulfill({
            status: 204,
            body: '',
        });
    });

    await page.route('**/api/stock-pool**', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                stocks: WATCHLIST.map(item => ({
                    symbol: item.symbol,
                    name: item.name,
                    added_at: new Date(item.addedAt).toISOString(),
                })),
            }),
        });
    });

    await page.route('**/api/brief**', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                brief: {
                    date: TODAY,
                    push_hook: '今天更适合盯住结构确认，而不是追逐杂讯。',
                    content: '## AAPL\n苹果维持结构完整。\n\n## MSFT\n微软偏向震荡整理。',
                },
            }),
        });
    });

    await page.route('**/api/stock/batch**', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                stocks: [
                    buildBatchStock('AAPL'),
                    buildBatchStock('MSFT'),
                ],
            }),
        });
    });

    await page.route('**/api/predictions**', async route => {
        const requestUrl = new URL(route.request().url());
        const symbol = requestUrl.searchParams.get('symbol') || 'AAPL';
        const targetDate = requestUrl.searchParams.get('targetDate') || TODAY;
        const prediction = buildBatchStock(symbol).prediction;
        const historyPrediction = {
            ...prediction,
            target_date: targetDate,
        };

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                predictions: [historyPrediction],
            }),
        });
    });

    await page.route('**/api/shared/almanac', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                almanacs: [{
                    target_date: '2026-03-27',
                    mood_tag: '中性偏稳',
                    action_strategy: '控制节奏',
                    meteorology: '轻雾',
                    market_entropy: {
                        score: 0.4,
                        label: 'stable',
                        breadth: 'balanced',
                        volume_status: 'normal',
                    },
                    sector_currents: {
                        main: [],
                        inverse: [],
                    },
                    ai_insight: '今日适合观察结构确认。',
                }],
            }),
        });
    });

    await page.route('**/api/system/calendar**', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({}),
        });
    });

    await page.route('**/api/user/mode/summary', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                mode: {
                    mode: 'balanced',
                    label: 'Balanced',
                    riskBand: 'balanced',
                    updatedAt: '2026-03-27T15:30:00.000Z',
                },
            }),
        });
    });

    await page.route('**/api/user/notification-settings', async route => {
        if (route.request().method() === 'POST') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true }),
            });
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                settings: {
                    types: {
                        dailyBrief: { enabled: true },
                        tacticalSignal: { enabled: true },
                        watchlistEvent: { enabled: true },
                    },
                },
            }),
        });
    });

    await page.route('**/api/stock/prediction-versions**', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ versions: [] }),
        });
    });

    await page.route('**/api/stock/prices/all**', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [] }),
        });
    });

    await page.route('**/api/stock/prices**', async route => {
        const requestUrl = new URL(route.request().url());
        const symbols = (requestUrl.searchParams.get('symbols') || '')
            .split(',')
            .filter(Boolean);

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                prices: symbols.map(symbol => ({
                    symbol,
                    date: '2026-03-27',
                    close: symbol === 'AAPL' ? 182.35 : 417.1,
                    change_percent: symbol === 'AAPL' ? 1.24 : -0.42,
                    lastUpdated: '15:30',
                })),
            }),
        });
    });

    await page.route('**/api/ops/broadcast/events', async route => {
        await route.fulfill({ status: 204, body: '' });
    });
}

async function assertDashboardContent(page) {
    await page.locator('[data-dashboard-content="true"]').waitFor({ state: 'attached' });
}

async function assertMainState(page, expected) {
    const selector = `main[data-dashboard-current-symbol="${expected.currentSymbol}"][data-dashboard-context-symbol="${expected.contextSymbol}"][data-dashboard-active-modal="${expected.activeModal}"]`;
    await page.locator(selector).waitFor();
}

async function runCase(browser, options, smokeCase) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        ...(smokeCase.contextOptions || {}),
    });
    await seedStorage(context, {
        local: { ...BASE_STORAGE.local, ...(smokeCase.storage?.local || {}) },
        session: { ...BASE_STORAGE.session, ...(smokeCase.storage?.session || {}) },
    });
    const page = await context.newPage();

    const consoleErrors = [];
    const pageErrors = [];
    const unauthorizedResponses = [];
    const logTail = [];

    page.on('console', msg => {
        const entry = `[console:${msg.type()}] ${msg.text()}`;
        logTail.push(entry);
        if (logTail.length > 12) logTail.shift();
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
        }
    });
    page.on('pageerror', error => {
        pageErrors.push(error.message);
        const entry = `[pageerror] ${error.message}`;
        logTail.push(entry);
        if (logTail.length > 12) logTail.shift();
    });
    page.on('response', response => {
        if (response.status() === 401) {
            const entry = `[401] ${response.url()}`;
            unauthorizedResponses.push(response.url());
            logTail.push(entry);
            if (logTail.length > 12) logTail.shift();
        }
    });

    await addApiStubs(page, smokeCase);
    await page.goto(`${options.baseUrl}${smokeCase.path}`, { waitUntil: 'domcontentloaded' });
    await assertDashboardContent(page);

    let success = false;
    let failureReason = '';
    try {
        await smokeCase.assert({
            page,
            assertMainState: async (expected) => assertMainState(page, expected),
        });
        success = consoleErrors.length === 0 && pageErrors.length === 0;
        if (!success) {
            failureReason = `Unexpected console/page errors: ${JSON.stringify({ consoleErrors, pageErrors })}`;
        }
    } catch (error) {
        failureReason = error instanceof Error ? error.message : String(error);
    }

    const summary = {
        name: smokeCase.name,
        success,
        urlAfter: page.url(),
        expectedCurrentSymbol: smokeCase.expectedCurrentSymbol,
        expectedContextSymbol: smokeCase.expectedContextSymbol,
        expectedActiveModal: smokeCase.expectedActiveModal,
        consoleErrors,
        pageErrors,
        unauthorizedResponses,
        logTail,
        failureReason,
    };

    await context.close();
    return summary;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch({ headless: options.headless });

    try {
        const cases = options.caseName
            ? CASES.filter(item => item.name === options.caseName)
            : CASES;

        if (cases.length === 0) {
            throw new Error(`Unknown case: ${options.caseName}`);
        }

        const results = [];
        for (const smokeCase of cases) {
            console.log(`Running dashboard interaction case: ${smokeCase.name}`);
            results.push(await runCase(browser, options, smokeCase));
        }

        console.log(JSON.stringify({
            baseUrl: options.baseUrl,
            cases: results,
        }, null, 2));

        if (results.some(item => !item.success)) {
            process.exitCode = 1;
        }
    } finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
