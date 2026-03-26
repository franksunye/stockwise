import process from 'node:process';
import { waitForServerReady } from '../tests/test-utils.mjs';

const DEFAULT_BASE_URL = process.env.DASHBOARD_SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const DEFAULT_HEADLESS = process.env.DASHBOARD_SMOKE_HEADLESS !== 'false';

const NOW = 1760000000000;
const AUTH_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const NAV_INTENT_MAX_AGE_MS = 15 * 1000;

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
  node scripts/dashboard-entry-smoke.mjs [--base-url http://127.0.0.1:3000] [--headed] [--case authorized-returning-user]

Environment variables:
  DASHBOARD_SMOKE_BASE_URL
  DASHBOARD_SMOKE_HEADLESS=false

Notes:
  - Start local frontend first.
  - This script validates dashboard entry states with Playwright route stubs.
  - It does not require a real invite code or live user data.`);
}

function buildAuthCache({ tier = 'free', authorized = true, timestamp = NOW } = {}) {
    return JSON.stringify({ tier, authorized, timestamp });
}

function buildProfileCache({
    userId = 'user_smoke_case',
    tier = 'free',
    hasOnboarded = true,
} = {}) {
    return JSON.stringify({
        userId,
        tier,
        hasOnboarded,
        email: 'smoke@example.com',
    });
}

function buildNavIntent({ symbol = 'AAPL', timestamp = NOW } = {}) {
    return JSON.stringify({ symbol, timestamp });
}

const CASES = [
    {
        name: 'authorized-returning-user',
        storage: {
            local: {
                ZISO_AUTH_CACHE_V1: buildAuthCache(),
                stockwise_user_profile_v1: buildProfileCache(),
                STOCKWISE_HAS_ONBOARDED: 'true',
                STOCKWISE_USER_ID: 'user_smoke_case',
                stockwise_splash_ts: String(NOW),
            },
            session: {},
        },
        profileResponse: {
            userId: 'user_smoke_case',
            tier: 'free',
            hasOnboarded: true,
            expiresAt: null,
        },
        expectedState: 'content',
    },
    {
        name: 'optimistic-nav-intent-entry',
        storage: {
            local: {
                ZISO_AUTH_CACHE_V1: buildAuthCache({
                    timestamp: NOW - AUTH_CACHE_MAX_AGE_MS - 1000,
                }),
                stockwise_user_profile_v1: buildProfileCache({
                    hasOnboarded: false,
                }),
                STOCKWISE_USER_ID: 'user_smoke_case',
            },
            session: {
                stockwise_dashboard_nav_intent: buildNavIntent({
                    timestamp: NOW - Math.floor(NAV_INTENT_MAX_AGE_MS / 2),
                }),
            },
        },
        profileResponse: {
            userId: 'user_smoke_case',
            tier: 'free',
            hasOnboarded: true,
            expiresAt: null,
        },
        expectedState: 'content',
    },
    {
        name: 'authorized-user-needs-onboarding',
        storage: {
            local: {
                ZISO_AUTH_CACHE_V1: buildAuthCache(),
                stockwise_user_profile_v1: buildProfileCache({
                    hasOnboarded: false,
                }),
                STOCKWISE_USER_ID: 'user_smoke_case',
            },
            session: {},
        },
        profileResponse: {
            userId: 'user_smoke_case',
            tier: 'free',
            hasOnboarded: false,
            expiresAt: null,
        },
        expectedState: 'onboarding',
    },
    {
        name: 'free-user-hits-invite-wall',
        storage: {
            local: {
                stockwise_user_profile_v1: buildProfileCache({
                    hasOnboarded: false,
                }),
                STOCKWISE_USER_ID: 'user_smoke_case',
            },
            session: {},
        },
        profileResponse: {
            userId: 'user_smoke_case',
            tier: 'free',
            hasOnboarded: false,
            expiresAt: null,
        },
        expectedState: 'invite',
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

function getSelectorForState(state) {
    if (state === 'content') return '[data-dashboard-content="true"]';
    if (state === 'invite') return '[data-dashboard-invite-wall="true"]';
    if (state === 'onboarding') return '[data-dashboard-onboarding-overlay="true"]';
    throw new Error(`Unknown expected state: ${state}`);
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

        window.__restoreDateNow = () => {
            Date.now = realNow;
        };
    }, { storage: seed, now: NOW });
}

async function addApiStubs(page, profileResponse) {
    await page.route('**/api/user/register', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                userId: 'user_smoke_case',
            }),
        });
    });

    await page.route('**/api/user/profile', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(profileResponse),
        });
    });

    await page.route('**/api/stock-pool**', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ stocks: [] }),
        });
    });

    await page.route('**/api/system/calendar**', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({}),
        });
    });
}

async function detectState(page) {
    const flags = await page.evaluate(() => ({
        content: !!document.querySelector('[data-dashboard-content="true"]'),
        invite: !!document.querySelector('[data-dashboard-invite-wall="true"]'),
        onboarding: !!document.querySelector('[data-dashboard-onboarding-overlay="true"]'),
        skeleton: !!document.querySelector('[data-dashboard-skeleton="true"]'),
    }));

    if (flags.onboarding) return 'onboarding';
    if (flags.invite) return 'invite';
    if (flags.content) return 'content';
    if (flags.skeleton) return 'skeleton';
    return 'unknown';
}

async function runCase(browser, options, smokeCase) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    });
    await seedStorage(context, smokeCase.storage);
    const page = await context.newPage();
    const logs = [];

    page.on('console', msg => logs.push(`[console:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

    await addApiStubs(page, smokeCase.profileResponse);

    try {
        console.error(`Running dashboard smoke case: ${smokeCase.name}`);
        await page.goto(`${options.baseUrl}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });

        const timeoutAt = Date.now() + 15000;
        let observedState = 'unknown';
        while (Date.now() < timeoutAt) {
            observedState = await detectState(page);
            if (observedState === smokeCase.expectedState) {
                break;
            }
            await page.waitForTimeout(250);
        }

        const success = observedState === smokeCase.expectedState;

        return {
            name: smokeCase.name,
            success,
            expectedState: smokeCase.expectedState,
            observedState,
            urlAfter: page.url(),
            expectedSelector: getSelectorForState(smokeCase.expectedState),
            logTail: logs.slice(-20),
        };
    } finally {
        await context.close();
    }
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const { chromium } = await loadPlaywright();
    await waitForServerReady(options.baseUrl);

    const browser = await chromium.launch({
        headless: options.headless,
        channel: 'chrome',
    });

    try {
        const results = [];
        const casesToRun = options.caseName
            ? CASES.filter(smokeCase => smokeCase.name === options.caseName)
            : CASES;

        if (casesToRun.length === 0) {
            throw new Error(`Unknown case: ${options.caseName}`);
        }

        for (const smokeCase of casesToRun) {
            results.push(await runCase(browser, options, smokeCase));
        }

        console.log(JSON.stringify({
            baseUrl: options.baseUrl,
            cases: results,
        }, null, 2));

        if (results.some(result => !result.success)) {
            process.exitCode = 2;
        }
    } finally {
        await browser.close();
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
