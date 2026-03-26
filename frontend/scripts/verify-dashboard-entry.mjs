import process from 'node:process';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { waitForServerReady } from '../tests/test-utils.mjs';

const DEFAULT_BASE_URL = process.env.DASHBOARD_VERIFY_BASE_URL || 'http://127.0.0.1:3000';
const DEFAULT_USER_SESSION_SECRET = process.env.USER_SESSION_SECRET || 'dev-stockwise-secret';

function parseArgs(argv) {
    const options = {
        baseUrl: DEFAULT_BASE_URL,
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
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
    }

    return options;
}

function printHelp() {
    console.log(`Usage:
  node scripts/verify-dashboard-entry.mjs [--base-url http://127.0.0.1:3000] [--case authorized-returning-user]

Environment variables:
  DASHBOARD_VERIFY_BASE_URL
  USER_SESSION_SECRET

Notes:
  - Starts a local Next dev server automatically.
  - Runs dashboard entry smoke coverage against that local server.
  - Cleans up the dev server when finished.`);
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

    const devServer = spawn('npm', ['run', 'dev'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            USER_SESSION_SECRET: DEFAULT_USER_SESSION_SECRET,
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
        await waitForServerReady(options.baseUrl);

        const smokeArgs = ['scripts/dashboard-entry-smoke.mjs', '--base-url', options.baseUrl];
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
