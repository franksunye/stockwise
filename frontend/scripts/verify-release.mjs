import process from 'node:process';
import { spawn } from 'node:child_process';

function parseArgs(argv) {
    const options = {
        skipDashboardEntry: false,
        skipDashboardInteraction: false,
        skipDashboardRefresh: false,
        dashboardCase: '',
        dashboardInteractionCase: '',
        dashboardRefreshCase: '',
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--skip-dashboard-entry') {
            options.skipDashboardEntry = true;
        } else if (arg === '--skip-dashboard-interaction') {
            options.skipDashboardInteraction = true;
        } else if (arg === '--skip-dashboard-refresh') {
            options.skipDashboardRefresh = true;
        } else if (arg === '--dashboard-case' && argv[i + 1]) {
            options.dashboardCase = argv[i + 1];
            i += 1;
        } else if (arg === '--dashboard-interaction-case' && argv[i + 1]) {
            options.dashboardInteractionCase = argv[i + 1];
            i += 1;
        } else if (arg === '--dashboard-refresh-case' && argv[i + 1]) {
            options.dashboardRefreshCase = argv[i + 1];
            i += 1;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
    }

    return options;
}

function printHelp() {
console.log(`Usage:
  node scripts/verify-release.mjs [--dashboard-case authorized-returning-user] [--dashboard-interaction-case url-symbol-context] [--dashboard-refresh-case reorder-watchlist-remap] [--skip-dashboard-entry] [--skip-dashboard-interaction] [--skip-dashboard-refresh]

Steps:
  1. npm run build
  2. npm run test:quality
  3. npm run verify:dashboard-entry -- --mode start
  4. npm run verify:dashboard-interaction -- --mode start
  5. npm run verify:dashboard-refresh -- --mode start

Notes:
  - Dashboard entry verification runs against a production Next server.
  - Interaction verification runs against a production Next server too.
  - Refresh verification runs against a production Next server too.
  - Use skip flags only when Playwright/browser execution is intentionally unavailable.`);
}

function runStep(label, command, args, extraEnv = {}) {
    return new Promise((resolve, reject) => {
        console.log(`\n==> ${label}`);
        const child = spawn(command, args, {
            cwd: process.cwd(),
            stdio: 'inherit',
            env: {
                ...process.env,
                ...extraEnv,
            },
        });

        child.once('exit', code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`${label} failed with exit code ${code ?? 1}`));
            }
        });
        child.once('error', reject);
    });
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    await runStep('Build', 'npm', ['run', 'build']);
    await runStep('Quality Gates', 'npm', ['run', 'test:quality']);

    if (!options.skipDashboardEntry) {
        const verifyArgs = ['run', 'verify:dashboard-entry', '--', '--mode', 'start', '--base-url', 'http://127.0.0.1:3311'];
        if (options.dashboardCase) {
            verifyArgs.push('--case', options.dashboardCase);
        }
        await runStep('Dashboard Entry Gate', 'npm', verifyArgs, {
            USER_SESSION_SECRET: process.env.USER_SESSION_SECRET || 'test_user_session_secret_for_quality_gate_only',
            DB_STRATEGY: process.env.DB_STRATEGY || 'local',
        });
    }

    if (!options.skipDashboardInteraction) {
        const verifyArgs = ['run', 'verify:dashboard-interaction', '--', '--mode', 'start', '--base-url', 'http://127.0.0.1:3312'];
        if (options.dashboardInteractionCase) {
            verifyArgs.push('--case', options.dashboardInteractionCase);
        }
        await runStep('Dashboard Interaction Gate', 'npm', verifyArgs, {
            USER_SESSION_SECRET: process.env.USER_SESSION_SECRET || 'test_user_session_secret_for_quality_gate_only',
            DB_STRATEGY: process.env.DB_STRATEGY || 'local',
        });
    }

    if (!options.skipDashboardRefresh) {
        const verifyArgs = ['run', 'verify:dashboard-refresh', '--', '--mode', 'start', '--profile', 'release', '--base-url', 'http://127.0.0.1:3313'];
        if (options.dashboardRefreshCase) {
            verifyArgs.push('--case', options.dashboardRefreshCase);
        }
        await runStep('Dashboard Refresh Gate', 'npm', verifyArgs, {
            USER_SESSION_SECRET: process.env.USER_SESSION_SECRET || 'test_user_session_secret_for_quality_gate_only',
            DB_STRATEGY: process.env.DB_STRATEGY || 'local',
        });
    }

    console.log('\nRelease quality gates passed.');
}

main().catch(error => {
    console.error(`\nRelease verification failed: ${error.message}`);
    process.exit(1);
});
