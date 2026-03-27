# Release Quality Gates (Frontend + PWA)

This document defines the release gates for frontend stability after architecture and auth changes.

## 1) Automated Gates (must pass)

Run in `frontend`:

```bash
npm run verify:release
```

This command does:

1. `npm run build`
2. `npm run test:quality`
3. `npm run verify:dashboard-entry -- --mode start --base-url http://127.0.0.1:3311`

`test:quality` covers:

1. `Auth Contract Gate`
2. `Frontend Smoke Gate`
3. `PWA Baseline Gate`

`verify:dashboard-entry` covers:

1. returning user direct `/dashboard` open
2. optimistic nav intent recovery
3. authorized-but-not-onboarded gate
4. invite wall gate
5. `console:error` and `pageerror` must both stay empty

### Auth Contract Gate

Protected routes must return `401` without session, and must no longer rely on `x-user-id` or `userId` request injection.

Covered routes:

1. `GET /api/brief`
2. `GET /api/history`
3. `GET /api/predictions`
4. `GET /api/stock/batch`
5. `GET /api/dashboard`
6. `POST /api/user/pay-success`

### Frontend Smoke Gate

Ensures key pages render without server-side failure:

1. `/`
2. `/dashboard`
3. `/dashboard/brief`
4. `/pricing`

### PWA Baseline Gate

Ensures core PWA assets are served correctly:

1. `/manifest.json`
2. `/sw.js`
3. `/offline.html`

### Dashboard Entry Gate

Ensures the production build still preserves the `dashboard` bootstrap contract:

1. runs against `next start`, not `next dev`
2. seeds storage and API stubs for controlled entry-state verification
3. fails on visible state mismatch, `console:error`, or `pageerror`
4. requires local `playwright` devDependency to be installed

## 2) Manual Device Gates (must pass before full rollout)

Automated tests cannot fully validate iOS standalone PWA behavior.  
Use real devices for these checks.

### iOS Safari + iOS Home Screen PWA matrix

Run each case in both environments:

1. iOS Safari tab
2. iOS Home Screen standalone app

### Required cases

1. First launch: register/session bootstrap succeeds, dashboard opens.
2. Cold start: kill app process, reopen, session still valid.
3. Offline open: open app in airplane mode, offline page/cached UI works.
4. Reconnect recovery: return online, data sync resumes without manual refresh.
5. Watchlist flow: add/remove stock, data updates correctly.
6. Brief flow: open daily brief panel/page, no auth error.
7. Upgrade flow: pricing -> checkout entrypoint works (no blocked identity path).
8. Push subscription flow: subscribe/unsubscribe works and persists after restart.
9. SW upgrade: deploy a new version, refresh/close-open behavior has no broken cache loop.
10. Multi-user safety: log out/clear storage and switch identity, no cross-user data leak.

## 3) Rollout Policy

1. Run automated gates on release branch.
2. Deploy to staging and execute manual device gates.
3. Start production canary at 5% traffic.
4. Observe for 24 hours.
5. Expand to 25% -> 50% -> 100% if all metrics remain healthy.

## 4) Monitor Metrics and Rollback Thresholds

Watch during canary:

1. `401/403` rate on protected APIs
2. `/api/user/register` failure rate
3. frontend runtime error rate
4. page interactive latency (`/dashboard`, `/pricing`)
5. checkout funnel conversion drop

Immediate rollback if any of:

1. Protected API 401 rate increases by > 2x baseline
2. session bootstrap failure > 1%
3. checkout conversion drops > 10% vs baseline
4. repeated PWA startup failures on iOS
