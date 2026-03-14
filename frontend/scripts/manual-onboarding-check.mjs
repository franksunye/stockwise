import process from 'node:process';

const DEFAULT_BASE_URL = process.env.MANUAL_CHECK_BASE_URL || 'http://127.0.0.1:3000';
const DEFAULT_INVITE_USER = process.env.MANUAL_CHECK_INVITE_USER || 'user_H9r_ZpYv';
const DEFAULT_WAIT_MS = Number(process.env.MANUAL_CHECK_WAIT_MS || '8000');

function parseArgs(argv) {
    const options = {
        baseUrl: DEFAULT_BASE_URL,
        inviteUser: DEFAULT_INVITE_USER,
        waitMs: DEFAULT_WAIT_MS,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--base-url' && argv[i + 1]) {
            options.baseUrl = argv[i + 1];
            i += 1;
        } else if (arg === '--invite-user' && argv[i + 1]) {
            options.inviteUser = argv[i + 1];
            i += 1;
        } else if (arg === '--wait-ms' && argv[i + 1]) {
            options.waitMs = Number(argv[i + 1]);
            i += 1;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
    }

    return options;
}

function printHelp() {
    console.log(`Usage:
  node scripts/manual-onboarding-check.mjs [--base-url http://127.0.0.1:3000] [--invite-user user_xxx] [--wait-ms 8000]

Environment variables:
  MANUAL_CHECK_BASE_URL
  MANUAL_CHECK_INVITE_USER
  MANUAL_CHECK_WAIT_MS

Notes:
  - Start local frontend first.
  - Ensure USER_SESSION_SECRET is configured for the dev server.
  - This script expects a usable invite user in the target DB.
  - Playwright must be available locally (for example via a temporary local install).`);
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    let chromium;
    try {
        ({ chromium } = await import('playwright'));
    } catch {
        console.error('Missing local playwright package. Install temporarily with:');
        console.error('  cd frontend && npm install --no-save playwright');
        process.exit(1);
    }

    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const logs = [];

    page.on('console', (msg) => logs.push(`[console:${msg.type()}] ${msg.text()}`));
    page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));
    page.on('response', (res) => {
        const url = res.url();
        if (['/api/user/register', '/api/user/profile', '/api/user/onboarding/complete', '/api/stock-pool', '/api/stock/batch'].some((p) => url.includes(p))) {
            logs.push(`[response] ${res.status()} ${url}`);
        }
    });

    try {
        await page.goto(`${options.baseUrl}/dashboard?invite=${options.inviteUser}`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });

        await page.waitForSelector('text=开启旅程', { timeout: 30000 });
        await page.click('text=开启旅程');
        await page.waitForSelector('text=选择一只股票体验', { timeout: 10000 });

        const stockButtons = page.locator('button').filter({ has: page.locator('p.text-base.font-bold') });
        const selectedButtonText = (await stockButtons.first().innerText()).trim();
        await stockButtons.first().click();

        await page.waitForSelector('text=收下这份洞察', { timeout: 20000 });
        await page.click('text=收下这份洞察');
        await page.waitForSelector('text=进入控制台', { timeout: 10000 });
        await page.click('text=进入控制台');
        await page.waitForTimeout(options.waitMs);

        const bodyText = await page.locator('body').innerText();
        const footerDots = await page.locator('footer .flex.gap-2 > div').count().catch(() => 0);
        const localWatchlist = await page.evaluate(() => localStorage.getItem('STOCKWISE_WATCHLIST_V2'));
        const onboarded = await page.evaluate(() => localStorage.getItem('STOCKWISE_HAS_ONBOARDED'));
        const selectedStockName = selectedButtonText.split('\n').find((line) => line && !line.includes('A股') && !line.includes('港股'));

        const result = {
            baseUrl: options.baseUrl,
            inviteUser: options.inviteUser,
            selectedButtonText,
            urlAfter: page.url(),
            footerDots,
            hasAlmanac: bodyText.includes('ZISO AI · 投资黄历'),
            hasSelectedStock: selectedStockName ? bodyText.includes(selectedStockName) : false,
            onboarded,
            localWatchlist,
            logTail: logs.slice(-40),
        };

        console.log(JSON.stringify(result, null, 2));

        if (footerDots <= 1 || onboarded !== 'true' || !result.hasSelectedStock) {
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
