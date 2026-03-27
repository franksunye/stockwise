import process from 'node:process';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForServerReady } from '../tests/test-utils.mjs';

const DEFAULT_BASE_URL = process.env.DASHBOARD_REFRESH_VERIFY_BASE_URL || 'http://127.0.0.1:3000';
const DEFAULT_USER_SESSION_SECRET = process.env.USER_SESSION_SECRET || 'dev-stockwise-secret';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FRONTEND_DIR, '..');
const LOCAL_DB_PATH = path.join(REPO_ROOT, 'data', 'stockwise.db');

function parseArgs(argv) {
    const options = {
        baseUrl: DEFAULT_BASE_URL,
        caseName: '',
        mode: 'dev',
        profile: 'full',
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--base-url' && argv[i + 1]) {
            options.baseUrl = argv[i + 1];
            i += 1;
        } else if (arg === '--case' && argv[i + 1]) {
            options.caseName = argv[i + 1];
            i += 1;
        } else if (arg === '--mode' && argv[i + 1]) {
            options.mode = argv[i + 1];
            i += 1;
        } else if (arg === '--profile' && argv[i + 1]) {
            options.profile = argv[i + 1];
            i += 1;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
    }

    return options;
}

function printHelp() {
    console.log(`Usage:
  node scripts/verify-dashboard-refresh.mjs [--base-url http://127.0.0.1:3000] [--case reorder-watchlist-remap] [--mode dev|start] [--profile full|release]

Notes:
  - Starts a local Next server automatically.
  - Runs dashboard refresh smoke coverage against that local server.
  - 'dev' mode uses next dev for local iteration.
  - 'start' mode uses next start and is suitable for release verification.
  - 'release' profile runs the deterministic mutation-side refresh cases only.`);
}

function prefixOutput(stream, prefix) {
    stream.on('data', chunk => {
        const text = chunk.toString();
        for (const line of text.split('\n')) {
            if (line) {
                process.stdout.write(`${prefix}${line}\n`);
            }
        }
    });
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const serverUrl = new URL(options.baseUrl);
    const serverPort = serverUrl.port || (serverUrl.protocol === 'https:' ? '443' : '80');
    const isStartMode = options.mode === 'start';
    if (options.mode !== 'dev' && options.mode !== 'start') {
        throw new Error(`Unknown mode: ${options.mode}`);
    }

    const serverArgs = isStartMode
        ? ['run', 'start', '--', '-p', serverPort, '--hostname', serverUrl.hostname]
        : ['run', 'dev', '--', '--hostname', serverUrl.hostname, '--port', serverPort];

    const devServer = spawn('npm', serverArgs, {
        cwd: process.cwd(),
        env: {
            ...process.env,
            USER_SESSION_SECRET: DEFAULT_USER_SESSION_SECRET,
            ...(isStartMode ? {
                NODE_ENV: 'production',
                DB_STRATEGY: process.env.DB_STRATEGY || 'local',
                LOCAL_DB_PATH: process.env.LOCAL_DB_PATH || LOCAL_DB_PATH,
                ALLOW_LEGACY_USERID_BOOTSTRAP: process.env.ALLOW_LEGACY_USERID_BOOTSTRAP || 'false',
            } : {}),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    prefixOutput(devServer.stdout, '[dev] ');
    prefixOutput(devServer.stderr, '[dev] ');

    const shutdown = () => {
        if (!devServer.killed) {
            devServer.kill('SIGINT');
        }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    try {
        await waitForServerReady(serverUrl.origin);

        const smokeArgs = ['scripts/dashboard-refresh-smoke.mjs', '--base-url', serverUrl.origin, '--profile', options.profile];
        if (options.caseName) {
            smokeArgs.push('--case', options.caseName);
        }

        const smoke = spawn(process.execPath, smokeArgs, {
            cwd: process.cwd(),
            stdio: 'inherit',
            env: process.env,
        });

        const [code] = await once(smoke, 'exit');
        if (code !== 0) {
            process.exitCode = code ?? 1;
        }
    } finally {
        shutdown();
        await once(devServer, 'exit').catch(() => {});
        process.off('SIGINT', shutdown);
        process.off('SIGTERM', shutdown);
    }
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
