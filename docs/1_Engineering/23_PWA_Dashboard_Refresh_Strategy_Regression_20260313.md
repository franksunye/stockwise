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
