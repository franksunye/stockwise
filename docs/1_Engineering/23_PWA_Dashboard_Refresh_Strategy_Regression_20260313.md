# PWA Dashboard Refresh Strategy Regression 2026-03-13

## 1. Purpose

This note records the intended Dashboard refresh strategy, how the implementation evolved, why the iPhone PWA regression appeared, and what was changed on 2026-03-13 to stop the issue.

It is written as an incident reference, not as a product spec.

Document relationship:

1. This document is the incident/background record.
2. [`46_Frontend_SWR_Architecture_Upgrade.md`](/Users/yesun/Code/stockwise/docs/3_Product/Specs/46_Frontend_SWR_Architecture_Upgrade.md) provides the architecture judgment that followed from this class of issues.
3. [`25_Onboarding_First_Load_Recovery_Plan_20260314.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/25_Onboarding_First_Load_Recovery_Plan_20260314.md) provides the small-step execution plan for the related new-user first-load bootstrap hang.
4. Read them in this order when tracing the topic: incident -> architecture judgment -> execution plan.

## 2. Original Intended Strategy

The intended behavior was already documented in [`46_Frontend_SWR_Architecture_Upgrade.md`](/Users/yesun/Code/stockwise/docs/3_Product/Specs/46_Frontend_SWR_Architecture_Upgrade.md):

- Returning users should see Dashboard instantly from local snapshot.
- Old data may render first, but the app must silently refresh when the page becomes active again.
- Refresh should be silent and should not break current layout, scroll context, or optimistic UI state.
- iOS PWA identity and local recovery flow must not be broken by generic caching logic.

In short:

`秒开旧数据 + 回前台静默拉新`

This was the product intent.

## 3. Actual Implementation Layers Before Regression Fix

By 2026-03-13, the Dashboard refresh path was effectively split across three cache layers:

### 3.1 Service Worker shell cache

[`frontend/public/sw.js`](/Users/yesun/Code/stockwise/frontend/public/sw.js)

- Navigation shell uses cache-first or background revalidate semantics depending on route.
- RSC requests also use stale-while-revalidate style behavior.
- Goal: instant reopen and soft navigation performance.

### 3.2 Client local snapshot cache

[`frontend/src/hooks/useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts)

- Reads `localStorage` snapshot first.
- Restores stock cards immediately.
- Uses `visibilitychange` and `focus` to trigger silent refresh.
- Uses interval refresh by market scene.

### 3.3 HTTP response caching on batch API

[`frontend/src/app/api/stock/batch/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/stock/batch/route.ts)

Before the fix, the route returned:

`Cache-Control: private, max-age=60, stale-while-revalidate=30`

This meant that even when the Dashboard decided to refresh, the browser could still reuse a recent response.

## 4. Why It Worked Before

Earlier versions had fewer overlapping cache layers.

The user-visible experience was roughly:

- reopen app
- recover page
- refresh on focus / visibility

That was usually enough.

The system became riskier only after the Dashboard local snapshot strategy and the stronger PWA shell strategy were both active at the same time.

## 5. Why It Broke

The regression was not caused by prediction generation or DB freshness.

The regression came from cache stacking:

1. Service Worker could restore an old app shell quickly.
2. `useDashboardData` could restore an old `localStorage` snapshot immediately.
3. The silent refresh request could still hit browser-level cached `/api/stock/batch` data.
4. On iPhone PWA standalone mode, `focus` / `visibilitychange` are less reliable than in normal browser tabs.

This produced a failure mode where:

- the app looked healthy
- some other surfaces such as AICouncil could show newer data
- the main Dashboard cards stayed stale for too long after reopening

That is exactly why the issue felt like "network is fine, but homepage does not update."

## 6. Timeline of Relevant Changes

### 6.1 2026-03-03

PWA service worker rewrite landed.

Relevant commits from history:

- `98f6718` `perf: SW v5 — navigation CacheFirst for instant PWA cold-start (秒开)`
- `45c97bf` `fix(pwa): use network-first for app entry navigations to avoid stale landing shell`
- `7794e2e6` later revisions of `sw.js`

Impact:

- PWA shell performance improved.
- Cache behavior around reopen became more layered.

### 6.2 2026-03-10

Dashboard local-first "秒开" path was reinforced.

Relevant commits:

- `20d83a1` attempted Dashboard SWR migration
- `d405fc2` rolled back that migration

Even after rollback, [`useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts) still kept:

- local snapshot restore
- `visibilitychange`
- `focus`
- interval refresh

Impact:

- correct product intent stayed in place
- but implementation complexity stayed high

### 6.3 2026-03-13 incident

Observed on iPhone PWA:

- CN / HK predictions were already updated
- Dashboard reopened with old data
- update did not happen promptly
- other data surfaces could still load

Conclusion:

- data source was fresh
- Dashboard refresh chain was stale

## 7. Fix Applied on 2026-03-13

The stop-gap fix changed two things.

### 7.1 Force batch refresh requests to bypass cache

File:

[`frontend/src/hooks/useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts)

Changes:

- batch fetch now uses `cache: 'no-store'`
- request sends `Cache-Control: no-cache`

Effect:

- when Dashboard decides to refresh, it is much less likely to reuse stale HTTP cache

### 7.2 Remove response caching from Dashboard batch API

File:

[`frontend/src/app/api/stock/batch/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/stock/batch/route.ts)

Change:

- changed response header from short-lived cacheable response
- to `private, no-store, max-age=0, must-revalidate`

Effect:

- user-specific Dashboard prediction payload is no longer treated as a short-term reusable cache object

### 7.3 Add more reliable resume triggers for iPhone PWA

File:

[`frontend/src/hooks/useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts)

Changes:

- added `pageshow`
- added `online`
- unified resume refresh handling
- reduced resume refresh threshold to 30 seconds

Effect:

- resume refresh no longer depends only on `focus` / `visibilitychange`

## 8. Why This Fix Is Tactical, Not Final

This fix is intended to restore correctness first.

It is not the final architecture because:

- refresh rules are still spread across event listeners, local snapshot logic, and polling
- Dashboard still mixes bootstrap, cache restore, debounce, refresh, and fallback responsibilities in one hook
- the repo backlog already records this complexity as technical debt

Reference:

[`docs/Backlog.md`](/Users/yesun/Code/stockwise/docs/Backlog.md)

Relevant item:

- `大盘主线清理` should strip manual `visibilitychange`, complex cache logic, and timers from `useDashboardData.ts`

## 9. Operational Guardrails Going Forward

Any future refresh or caching work on Dashboard should preserve these rules:

1. User-facing prediction cards are freshness-sensitive and should not rely on generic short-lived HTTP caching by default.
2. PWA shell speed and prediction freshness are different concerns and must not be merged casually.
3. iPhone PWA standalone resume behavior must be treated as a separate runtime, not as a normal browser tab.
4. "秒开" is allowed only if silent refresh remains dependable.
5. If multiple cache layers exist, one owner must define freshness semantics explicitly.
6. **All page-level navigation within the Dashboard PWA must use hard navigation (`<a>` / `window.location.href`), not Next.js `<Link>` / `router.push()`.** See Section 13 for the full rationale.

## 10. Recommended Next Cleanup

After the incident is stable on real devices, the next cleanup should be:

1. Define a single Dashboard freshness policy document.
2. Separate bootstrap, snapshot restore, live revalidation, and polling into distinct responsibilities.
3. Decide whether Dashboard should stay hand-managed or move to a constrained SWR layer with explicit snapshot support.
4. Add a real-device regression checklist for:
   - iOS Safari
   - iOS Home Screen PWA
   - reopen after 30s / 2m / 10m
   - stale snapshot present vs absent

## 11. Bottom Line

The intended strategy was never "always trust cached Dashboard data."

The intended strategy was:

`show cached Dashboard immediately, then reliably refresh when the app comes back`

The regression appeared because the implementation accumulated too many independent cache layers without one explicit freshness owner.

## 12. Follow-Up: Server-Side Cache Tiering (2026-03-17)

A related staleness issue resurfaced on 2026-03-17: even with the Edge/CDN bypass from Section 7, stock prices remained stale because the **server-side `unstable_cache`** in `lib/stock-cache.ts` still held DB query results for up to 15 minutes (with stale-while-revalidate pushing effective staleness to ~30 min).

This was resolved by splitting `stock-cache.ts` into two paths:
- `getLatestPrices` (uncached, direct DB query) — used by `/api/stock/prices` for real-time price refresh.
- `getCachedLatestPrices` (2 min TTL, down from 15 min) — used by `/api/stock/batch` for the heavier decision payload.

See [`28_Price_Sync_Zero_Stale_Protocol_20260316.md`](./28_Price_Sync_Zero_Stale_Protocol_20260316.md) Section 6 for the full decision record.

## 13. Follow-Up: Hard Navigation Mandate for Dashboard PWA (2026-03-17)

### 13.1 Incident

On iPhone PWA, navigating from stock-pool to dashboard (by tapping a stock) intermittently — and after an attempted SW fix, consistently — showed "页面加载异常" error page instead of the dashboard.

Clicking "重新加载" always recovered successfully, confirming the cached data and HTML were healthy.

### 13.2 Root Cause

Next.js `<Link>` / `router.push()` triggers **RSC soft navigation**: a separate fetch for the React Server Component payload. This RSC fetch goes through the SW's `rscCacheFirst()` strategy:

1. If RSC cache has a hit → returns instantly (works).
2. If RSC cache is empty → tries network with 8s timeout.
3. If network fails → returns synthetic 504 → Next.js throws → **error boundary fires**.

The error boundary showed "页面加载异常", bypassing the entire SW cache architecture that was built for 秒开 — the `navigationCacheFirst` HTML shell cache, `localStorage` auth/data cache, and client-side hydration were all completely unused.

**The irony**: a perfectly valid cached HTML shell for `/dashboard` existed in the SW navigation cache the entire time. A hard navigation would have loaded it instantly.

### 13.3 Why RSC Soft Navigation Is Fragile in PWA Context

| Factor | Impact |
|--------|--------|
| RSC fetch is a sub-resource request, not a navigation | SW `navigationCacheFirst` never runs |
| RSC cache only populates on successful soft-nav | First-time or cache-miss paths always hit network |
| `navigator.onLine` is unreliable on iOS Safari standalone | `fetchWithTimeout` may reject immediately even with working network |
| `event.respondWith()` reject (throw) has unpredictable behavior on iOS Safari | Attempted fix of throwing instead of 504 made the issue reproducible every time |
| `router.prefetch()` also uses RSC path | Prefetch failure leaves cache empty for subsequent navigation |

### 13.4 Architectural Decision

**All page-level navigation within the Dashboard PWA uses hard navigation (`<a>` / `window.location.href`) instead of Next.js `<Link>` / `router.push()`.**

Hard navigation path:

```
User tap → browser navigation request → SW intercepts →
navigationCacheFirst → cached HTML shell → instant load →
React hydrate → localStorage auth/data restore → content ready
```

This path is **100% on the SW cache chain**. Offline, weak network, slow Vercel/Turso — all served from cache.

### 13.5 Pages Fixed

| File | Navigation | Change |
|------|-----------|--------|
| `stock-pool/page.tsx` | Stock item → dashboard | `<Link>` → `<a>` + `window.location.href` |
| `stock-pool/page.tsx` | Back arrow → dashboard | `<Link>` → `<a>` |
| `dashboard/page.tsx` | Footer icon → stock-pool | `<Link>` → `<a>` |
| `dashboard/page.tsx` | Overscroll left → stock-pool | `router.push()` → `window.location.href` |
| `brief/page.tsx` | Back arrow → dashboard (×2) | `<Link>` → `<a>` |
| `brief/page.tsx` | "返回首页" button | `<Link>` → `<a>` |

ESLint `@next/next/no-html-link-for-pages` is suppressed per-line with comments explaining the PWA intent.

### 13.6 Error Boundary Safety Net

`dashboard/error.tsx` was also hardened:

- **Non-chunk errors** (RSC timeout, network failure): auto-recover via `window.location.href` to trigger SW cache. Renders `null` during recovery so the error page never flashes.
- **Chunk errors** (version mismatch): existing `CLEAR_CACHES` + reload behavior preserved.
- **Critical**: non-chunk recovery does NOT send `CLEAR_CACHES` — the navigation HTML cache is the recovery lifeline, especially when completely offline.
- 10-second cooldown prevents infinite loops; error UI shown only if auto-recovery itself fails.

### 13.7 SW `rscCacheFirst` Status

The SW's `rscCacheFirst` handler was reverted to returning 504 on cache-miss + network-fail. An attempt to `throw` instead (to produce a genuine `TypeError` and trigger Next.js MPA fallback) caused **worse** behavior on iOS Safari — the error became reproducible every time instead of intermittent.

The 504 path remains as-is. With all dashboard pages using hard navigation, `rscCacheFirst` is no longer on the critical path for user-facing page transitions.

### 13.8 Principle for Future Work

> **In a PWA with SW-cached HTML shells, page-level navigation must stay on the SW navigation cache path.** Next.js RSC soft navigation creates a parallel fetch path that bypasses the SW HTML cache entirely. On unreliable networks (offline, weak, slow backend), this parallel path fails — and the failure mode (error boundary) is visible and disruptive.
>
> Soft navigation (`<Link>`) is appropriate for non-PWA web apps with reliable network, or for transitions within the same page (drawers, modals, tabs). For PWA page transitions where offline resilience is required, hard navigation is the correct choice.

Commits: `5758f70`, `89f46ae`, `ea68864`, `eaa4b88`.
