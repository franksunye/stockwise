import process from 'node:process';
import { waitForServerReady } from '../tests/test-utils.mjs';

const DEFAULT_BASE_URL = process.env.DASHBOARD_REFRESH_BASE_URL || 'http://127.0.0.1:3000';
const DEFAULT_HEADLESS = process.env.DASHBOARD_REFRESH_HEADLESS !== 'false';

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
        } else if (arg === '--case' && argv[i + 1]) {
            options.caseName = argv[i + 1];
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
  node scripts/dashboard-refresh-smoke.mjs [--base-url http://127.0.0.1:3000] [--case reorder-watchlist-remap]

Environment variables:
  DASHBOARD_REFRESH_BASE_URL
  DASHBOARD_REFRESH_HEADLESS=false

Notes:
  - Start local frontend first.
  - This script validates dashboard refresh-contract behavior with Playwright route stubs.
  - It is a local observation tool, not part of verify:release.`);
}

async function loadPlaywright() {
    try {
        return await import('playwright');
    } catch {
        console.error('Missing local playwright package.');
        process.exit(1);
    }
}

function getTodayInShanghai() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(new Date());
}

function buildWatchlistItems(symbols, stockCatalog) {
    return symbols.map((symbol, index) => ({
        symbol,
        name: stockCatalog[symbol].name,
        addedAt: Date.now() + index,
    }));
}

function buildPrediction(symbol, today, updatedAtSuffix = '09:30:00.000Z') {
    return {
        symbol,
        date: today,
        target_date: today,
        updated_at: `${today}T${updatedAtSuffix}`,
        signal: 'Long',
        confidence: 0.88,
        support_price: 100,
        ai_reasoning: '{"summary":"smoke"}',
        validation_status: 'Pending',
        actual_change: null,
    };
}

function buildPrice(symbol, close, updatedAt = '09:30') {
    return {
        symbol,
        date: getTodayInShanghai(),
        open: close - 1,
        high: close + 1,
        low: close - 2,
        close,
        volume: 100000,
        change_percent: 1.2,
        ma5: close,
        ma10: close,
        ma20: close,
        ma60: close,
        macd: 0.1,
        macd_signal: 0.1,
        macd_hist: 0,
        boll_upper: close + 2,
        boll_mid: close,
        boll_lower: close - 2,
        rsi: 55,
        kdj_k: 60,
        kdj_d: 58,
        kdj_j: 64,
        ai_summary: null,
        updatedAt,
    };
}

function buildBatchStock(symbol, stockCatalog, today, updatedAtSuffix) {
    const item = stockCatalog[symbol];
    return {
        symbol,
        name: item.name,
        price: buildPrice(symbol, item.close, item.lastUpdated),
        prediction: buildPrediction(symbol, today, updatedAtSuffix),
        previousPrediction: null,
        history: [buildPrediction(symbol, today, updatedAtSuffix)],
        shortMetrics: null,
        lastUpdated: item.lastUpdated,
    };
}

const FIXED_POST_MARKET_MS = Date.parse('2026-03-27T17:30:00+08:00');

async function seedStorage(context, stockCatalog, initialSymbols, today) {
    const dashboardCache = initialSymbols.map((symbol) => buildBatchStock(symbol, stockCatalog, today, '09:30:00.000Z'));
    await context.addInitScript(({ watchlistItems, watchlistSymbols, dashboardCacheData, fixedNowMs }) => {
        const RealDate = Date;
        class MockDate extends RealDate {
            constructor(...args) {
                if (args.length === 0) {
                    super(fixedNowMs);
                } else {
                    super(...args);
                }
            }
            static now() {
                return fixedNowMs;
            }
        }
        globalThis.Date = MockDate;

        localStorage.setItem('ZISO_AUTH_CACHE_V1', JSON.stringify({
            tier: 'free',
            authorized: true,
            timestamp: fixedNowMs,
        }));
        localStorage.setItem('stockwise_user_profile_v1', JSON.stringify({
            userId: 'user_refresh_smoke',
            tier: 'free',
            hasOnboarded: true,
            email: 'refresh@example.com',
        }));
        localStorage.setItem('STOCKWISE_HAS_ONBOARDED', 'true');
        localStorage.setItem('STOCKWISE_USER_ID', 'user_refresh_smoke');
        localStorage.setItem('stockwise_splash_ts', String(fixedNowMs));
        localStorage.setItem('STOCKWISE_WATCHLIST_V2', JSON.stringify(watchlistItems));
        localStorage.setItem('stock_watchlist', JSON.stringify(watchlistSymbols));
        localStorage.setItem('stockwise_dashboard_cache_v1', JSON.stringify({
            data: dashboardCacheData,
            timestamp: fixedNowMs,
        }));
    }, {
        watchlistItems: buildWatchlistItems(initialSymbols, stockCatalog),
        watchlistSymbols: initialSymbols,
        dashboardCacheData: dashboardCache,
        fixedNowMs: FIXED_POST_MARKET_MS,
    });
}

const STOCK_CATALOG = {
    '00700': { name: 'Tencent', close: 380, lastUpdated: '09:30' },
    '09988': { name: 'Alibaba', close: 88, lastUpdated: '09:31' },
};

const CASES = [
    {
        name: 'reorder-watchlist-remap',
        initialSymbols: ['00700', '09988'],
        run: async ({ page, resetCounters, counters, setRemoteSymbols }) => {
            await resetCounters();
            setRemoteSymbols(['09988', '00700']);

            await page.evaluate(() => {
                localStorage.setItem('STOCKWISE_WATCHLIST_V2', JSON.stringify([
                    { symbol: '09988', name: 'Alibaba', addedAt: Date.now() },
                    { symbol: '00700', name: 'Tencent', addedAt: Date.now() + 1 },
                ]));
                localStorage.setItem('stock_watchlist', JSON.stringify(['09988', '00700']));
                window.dispatchEvent(new Event('stockwise-watchlist-sync'));
            });

            await page.waitForFunction(() => {
                const first = document.querySelector('[data-stock-feed-symbol]');
                return first?.getAttribute('data-stock-feed-symbol') === '09988';
            });

            return {
                batchRequests: counters.batch,
                firstSymbol: await page.locator('[data-stock-feed-symbol]').first().getAttribute('data-stock-feed-symbol'),
                success: counters.batch === 0,
            };
        },
    },
    {
        name: 'watchlist-add-missing-symbol-forces-batch',
        initialSymbols: ['00700'],
        run: async ({ page, resetCounters, counters, setRemoteSymbols }) => {
            await resetCounters();
            setRemoteSymbols(['00700', '09988']);

            await page.evaluate(() => {
                localStorage.setItem('STOCKWISE_WATCHLIST_V2', JSON.stringify([
                    { symbol: '00700', name: 'Tencent', addedAt: Date.now() },
                    { symbol: '09988', name: 'Alibaba', addedAt: Date.now() + 1 },
                ]));
                localStorage.setItem('stock_watchlist', JSON.stringify(['00700', '09988']));
                window.dispatchEvent(new Event('stockwise-watchlist-sync'));
            });

            await page.waitForFunction(() => {
                return !!document.querySelector('[data-stock-feed-symbol="09988"]');
            });

            return {
                batchRequests: counters.batch,
                hasAlibaba: await page.locator('[data-stock-feed-symbol="09988"]').count(),
                success: counters.batch > 0,
            };
        },
    },
    {
        name: 'resume-refreshes-prices-and-drift-check-without-batch',
        initialSymbols: ['00700', '09988'],
        run: async ({ page, resetCounters, counters, setPredictionVersionMode }) => {
            await resetCounters();
            setPredictionVersionMode('same');

            await page.evaluate(() => {
                window.dispatchEvent(new Event('focus'));
            });

            await page.waitForTimeout(1200);

            return {
                priceRequests: counters.pricesAll,
                versionRequests: counters.predictionVersions,
                batchRequests: counters.batch,
                success: counters.pricesAll > 0 && counters.predictionVersions > 0 && counters.batch === 0,
            };
        },
    },
    {
        name: 'resume-with-drift-triggers-batch-refresh',
        initialSymbols: ['00700', '09988'],
        run: async ({ page, resetCounters, counters, setPredictionVersionMode }) => {
            await resetCounters();
            setPredictionVersionMode('drift');

            await page.evaluate(() => {
                window.dispatchEvent(new Event('focus'));
            });

            await page.waitForTimeout(1200);

            return {
                priceRequests: counters.pricesAll,
                versionRequests: counters.predictionVersions,
                batchRequests: counters.batch,
                success: counters.pricesAll > 0 && counters.predictionVersions > 0 && counters.batch > 0,
            };
        },
    },
];

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const { chromium } = await loadPlaywright();
    await waitForServerReady(options.baseUrl);
    const today = getTodayInShanghai();
    const browser = await chromium.launch({
        headless: options.headless,
        channel: 'chrome',
    });

    try {
        const casesToRun = options.caseName
            ? CASES.filter((item) => item.name === options.caseName)
            : CASES;

        if (casesToRun.length === 0) {
            throw new Error(`Unknown case: ${options.caseName}`);
        }

        const results = [];

        for (const smokeCase of casesToRun) {
            let remoteSymbols = [...smokeCase.initialSymbols];
            let predictionVersionMode = 'same';
            const counters = {
                batch: 0,
                predictionVersions: 0,
                pricesAll: 0,
                stockPool: 0,
            };

            const context = await browser.newContext({
                viewport: { width: 1440, height: 900 },
            });
            await seedStorage(context, STOCK_CATALOG, smokeCase.initialSymbols, today);
            const page = await context.newPage();

            await page.route('**/_vercel/insights/**', async (route) => {
                await route.fulfill({ status: 204, body: '' });
            });
            await page.route('**/api/user/register', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, userId: 'user_refresh_smoke' }),
                });
            });
            await page.route('**/api/user/profile', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        userId: 'user_refresh_smoke',
                        tier: 'free',
                        hasOnboarded: true,
                        watchlistCount: remoteSymbols.length,
                        expiresAt: null,
                    }),
                });
            });
            await page.route('**/api/shared/almanac', async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        almanac: {
                            target_date: today,
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
            await page.route('**/api/stock-pool**', async (route) => {
                counters.stockPool += 1;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        stocks: remoteSymbols.map((symbol, index) => ({
                            symbol,
                            name: STOCK_CATALOG[symbol].name,
                            added_at: new Date(Date.now() + index * 1000).toISOString(),
                        })),
                    }),
                });
            });
            await page.route('**/api/stock/batch**', async (route) => {
                counters.batch += 1;
                const url = new URL(route.request().url());
                const symbols = (url.searchParams.get('symbols') || '')
                    .split(',')
                    .filter(Boolean);
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        stocks: symbols.map((symbol) =>
                            buildBatchStock(
                                symbol,
                                STOCK_CATALOG,
                                today,
                                predictionVersionMode === 'drift' ? '09:45:00.000Z' : '09:30:00.000Z',
                            )),
                    }),
                });
            });
            await page.route('**/api/stock/prediction-versions**', async (route) => {
                counters.predictionVersions += 1;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: remoteSymbols.map((symbol) => ({
                            symbol,
                            date: today,
                            target_date: today,
                            updated_at:
                                predictionVersionMode === 'drift'
                                    ? `${today}T09:45:00.000Z`
                                    : `${today}T09:30:00.000Z`,
                        })),
                    }),
                });
            });
            await page.route('**/api/stock/prices/all**', async (route) => {
                counters.pricesAll += 1;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        items: remoteSymbols.map((symbol) => ({
                            symbol,
                            lastPrice: STOCK_CATALOG[symbol].close + 1,
                            changePct: 1.8,
                            updatedAt: `${today}T09:35:00.000Z`,
                        })),
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
            await page.waitForTimeout(1200);

            const resetCounters = async () => {
                counters.batch = 0;
                counters.predictionVersions = 0;
                counters.pricesAll = 0;
                counters.stockPool = 0;
                await page.waitForTimeout(50);
            };

            const result = await smokeCase.run({
                page,
                counters,
                resetCounters,
                setRemoteSymbols: (symbols) => {
                    remoteSymbols = [...symbols];
                },
                setPredictionVersionMode: (mode) => {
                    predictionVersionMode = mode;
                },
            });

            results.push({
                name: smokeCase.name,
                ...result,
            });

            await context.close();
        }

        console.log(JSON.stringify({ baseUrl: options.baseUrl, cases: results }, null, 2));

        if (results.some((item) => !item.success)) {
            process.exitCode = 2;
        }
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
