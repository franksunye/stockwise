# Onboarding First-Load Recovery Plan 2026-03-14

## 1. Purpose

This document defines a cautious execution plan for the new-user first-load hang observed on the Dashboard after invite-link onboarding.

Document relationship:

1. This document is the execution follow-up to the architectural judgment in [`46_Frontend_SWR_Architecture_Upgrade.md`](/Users/yesun/Code/stockwise/docs/3_Product/Specs/46_Frontend_SWR_Architecture_Upgrade.md).
2. It does not replace that SWR document.
3. It operationalizes one specific conclusion from that document: Dashboard first-load stability is currently a bootstrap-state problem first, not a request-library migration problem first.
4. Therefore this plan intentionally avoids broad SWR expansion and focuses on small, reversible bootstrap repairs.
5. For adjacent incident context on Dashboard refresh/cache regressions, see [`23_PWA_Dashboard_Refresh_Strategy_Regression_20260313.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/23_PWA_Dashboard_Refresh_Strategy_Regression_20260313.md).

Target symptom:

1. User enters from an invite link.
2. User completes onboarding in browser.
3. Dashboard shows only the Almanac frame first.
4. The first stock card appears very late or only after manual refresh.

This is an execution document, not a brainstorming note.

## 2. What Has Been Proven

Current code indicates the delay is not caused by one single slow API.

It is a chained bootstrap problem across these layers:

1. [`frontend/src/app/(dashboard)/dashboard/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/layout.tsx)
2. [`frontend/src/lib/user.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/user.ts)
3. [`frontend/src/hooks/useWatchlist.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useWatchlist.ts)
4. [`frontend/src/hooks/useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts)
5. [`frontend/src/components/onboarding/OnboardingOverlay.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/onboarding/OnboardingOverlay.tsx)

Observed risk chain:

1. New user path may wait for `/api/user/register` too early.
2. Watchlist bootstrap can stay in `loading=true` too long when local cache is empty.
3. Dashboard data fetch waits on watchlist recovery even when the first selected stock is already logically known.
4. Onboarding completion writes server truth, but does not reliably seed local truth for immediate render.

## 3. Constraints

This fix must be surgical.

We will not:

1. Rewrite Dashboard data architecture in one pass.
2. Migrate the whole flow to SWR as part of this issue.
3. Merge auth, profile, watchlist, and dashboard state into one global persistence layer.
4. Change service worker caching rules unless a later step proves it is necessary.

## 4. Success Criteria

The issue is considered fixed only if all of the following hold:

1. With all browser storage cleared, invite-link onboarding can complete and enter Dashboard without manual refresh.
2. The first selected stock becomes visible on first entry in the same navigation flow.
3. A slow `/api/user/register` does not leave the user stuck on Almanac-only view.
4. Returning-user behavior does not regress.
5. Each step can be reverted independently.

## 5. Rollout Strategy

We will execute in four small phases.

Each phase:

1. touches one narrow responsibility,
2. has an explicit verification checklist,
3. has a clear rollback trigger,
4. should be committed separately.

Do not batch phases into one commit unless a previous phase proves impossible to validate alone.

## 6. Phase 0: Baseline Reproduction and Logging

### Goal

Freeze the current failure mode before any fix lands.

### Change Scope

No behavior change if possible. Prefer temporary debug logging only.

Candidate files:

1. [`frontend/src/app/(dashboard)/dashboard/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/layout.tsx)
2. [`frontend/src/lib/user.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/user.ts)
3. [`frontend/src/hooks/useWatchlist.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useWatchlist.ts)
4. [`frontend/src/hooks/useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts)

### Required Logging

Record timestamps for:

1. `getCurrentUser()` return time
2. `/api/user/register` start and end
3. watchlist local restore start and end
4. watchlist remote sync start and end
5. first `loadAllData()` entry
6. first non-empty `stocks` render

### Verification

Run exactly this manual path:

1. Clear `localStorage`, `sessionStorage`, cookies, and service worker data for the site.
2. Open invite link.
3. Complete onboarding.
4. Capture ordered logs and rough timings.

### Exit Condition

We can point to the longest blocking segment with evidence instead of guesswork.

### Rollback

If logs become noisy or risky, remove them before Phase 1.

## 7. Phase 1: Split Identity from Session Sync

### Goal

Make local identity available immediately without forcing the UI path to wait for `/api/user/register`.

### Change Scope

Primary file:

1. [`frontend/src/lib/user.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/user.ts)

Secondary caller:

1. [`frontend/src/app/(dashboard)/dashboard/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/layout.tsx)

### Intended Change

Refactor `getCurrentUser()` semantics into:

1. immediate local identity recovery,
2. background session sync,
3. forced sync only on explicit recovery path such as `401`.

For this issue, the important rule is:

`identity available` must no longer imply `register request completed`.

### Guardrails

1. Do not remove the server sync mechanism.
2. Do not change server auth contract.
3. Only relax when callers wait.
4. Keep `forceSessionSync` behavior for protected API recovery.

### Verification

1. Cold new-user path still creates a stable `userId`.
2. Returning user still restores from storage/cookie/URL bridge.
3. Protected APIs can still recover via explicit forced sync on `401`.
4. Dashboard layout no longer waits on `register` before continuing first-load bootstrap.

### Rollback Trigger

Rollback if:

1. new users start hitting persistent `401` loops,
2. `userId` generation or recovery becomes unstable,
3. iOS bridge behavior regresses.

## 8. Phase 2: Fix Watchlist Bootstrap State Machine

### Goal

Stop `useWatchlist()` from holding the app in ambiguous loading state when there is no local cache yet.

### Change Scope

Primary file:

1. [`frontend/src/hooks/useWatchlist.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useWatchlist.ts)

### Intended Change

Separate three states that are currently conflated:

1. local restore not finished,
2. local restore finished but empty,
3. remote sync in progress.

Required behavior:

1. local restore completes fast and deterministically,
2. `loading=false` after local bootstrap is known,
3. remote sync continues in background,
4. user-facing consumers can distinguish `empty but ready` from `still bootstrapping`.

### Guardrails

1. Do not weaken anti-zombie protection around recent mutations.
2. Do not change optimistic add/remove semantics in the same phase.
3. Do not rewrite the whole hook to a new library.

### Verification

1. Returning user with local watchlist still sees immediate restoration.
2. Brand-new user with no local watchlist no longer stays in indefinite watchlist loading.
3. Remote sync can still replace local state when server truth differs.

### Rollback Trigger

Rollback if:

1. watchlist flickers between empty and non-empty,
2. recent add/remove actions get reverted by late remote reads,
3. stock-pool page behavior regresses.

## 9. Phase 3: Prime First Stock at Onboarding Completion

### Goal

Ensure the selected onboarding stock exists in local watchlist state before Dashboard depends on remote recovery.

### Change Scope

Primary file:

1. [`frontend/src/components/onboarding/OnboardingOverlay.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/onboarding/OnboardingOverlay.tsx)

Read-only confirmation file:

1. [`frontend/src/app/api/user/onboarding/complete/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/user/onboarding/complete/route.ts)

### Intended Change

When onboarding completes successfully:

1. write `STOCKWISE_HAS_ONBOARDED`,
2. seed `STOCKWISE_WATCHLIST_V2` with the selected stock if it is absent,
3. preserve dedup behavior,
4. then refresh profile / close overlay.

Important:

Seed the actual watchlist storage shape, not just a standalone `selectedStock` marker.

### Why This Phase Is Separate

This is the lowest-risk way to break the Almanac-only dead zone for first-time users.

It does not depend on a broader auth rewrite to be useful.

### Verification

1. Fresh user completes onboarding and immediately has one local watchlist item.
2. Dashboard footer dot count reflects Almanac + first stock without refresh.
3. If the server later returns the same stock, no duplicate appears.

### Rollback Trigger

Rollback if:

1. duplicate watchlist entries appear,
2. onboarding completion can succeed locally while server write failed,
3. stock names or timestamps are stored in an invalid shape.

## 10. Phase 4: Relax Dashboard Wait Rule

### Goal

Allow Dashboard data fetch to proceed as soon as there is a usable watchlist item, even if remote watchlist sync is still running.

### Change Scope

Primary file:

1. [`frontend/src/hooks/useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts)

Optional UX-only follow-up:

1. [`frontend/src/app/(dashboard)/dashboard/page.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/page.tsx)

### Intended Change

Current blocking rule is too strict:

1. if `loadingWatchlist && watchlist.length === 0`, Dashboard waits.

After Phase 2 and Phase 3, the safer rule is:

1. if watchlist already has items, proceed optimistically,
2. only show hard waiting state when both local bootstrap is unfinished and no item is available.

### Guardrails

1. Do not remove the fallback behavior for empty watchlist users.
2. Do not reintroduce stale-card mismatch during debounce logic.
3. Keep network error fallback to placeholder cards.

### Verification

1. Seeded first stock triggers batch fetch on first dashboard entry.
2. Dashboard no longer appears stuck on Almanac-only view.
3. Empty-watchlist users still behave correctly.

### Rollback Trigger

Rollback if:

1. batch fetch fires with invalid or empty symbols unexpectedly,
2. empty-watchlist users show broken placeholder cards,
3. first-load path starts double-fetching aggressively.

## 11. Optional Phase 5: Improve Empty-State Messaging

### Goal

Improve perceived correctness only after the blocking issue is fixed.

### Change Scope

1. [`frontend/src/app/(dashboard)/dashboard/page.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/page.tsx)

### Intended Change

If the dashboard is still initializing with no stock cards yet, make that state visibly intentional rather than resembling a dead-end Almanac screen.

This phase is optional because it does not solve the root cause.

### Rule

Do not use this phase to hide unresolved bootstrap failures.

## 12. Verification Matrix

Every phase must pass a focused matrix before moving on.

### Core Cases

1. Fresh browser state, invite link, onboarding complete, no refresh.
2. Fresh browser state, direct `/dashboard`, onboarding complete, no refresh.
3. Returning user with existing local watchlist cache.
4. Returning user with empty local watchlist but valid server watchlist.
5. Slow network or artificially delayed `/api/user/register`.

### Required Observations

For each case record:

1. time to first visible stock card,
2. whether Almanac appears alone,
3. whether manual refresh changes outcome,
4. whether duplicate cards appear,
5. whether auth/profile/watchlist requests 401.

## 13. Commit Strategy

Recommended commit sequence:

1. `debug: instrument onboarding first-load bootstrap timings`
2. `fix(auth): decouple local identity from blocking session sync`
3. `fix(watchlist): finish local bootstrap before remote sync`
4. `fix(onboarding): seed first selected stock into local watchlist`
5. `fix(dashboard): allow optimistic first-load with seeded watchlist`
6. `ux(dashboard): clarify empty initializing state`

If a phase fails verification, revert only that phase and keep previous proven phases intact.

## 14. Why This Plan Is Safer Than a One-Pass Rewrite

This plan avoids a dangerous class of changes:

1. auth rewrite and data rewrite in one commit,
2. watchlist mutation changes mixed with bootstrap changes,
3. UI masking changes landing before state correctness is proven,
4. PWA caching changes introduced without evidence.

The main principle is:

`first prove the blocking edge, then remove one blocker at a time`

## 15. Final Recommendation

Execute only through Phase 4 for the first repair cycle.

Do not start Phase 5 unless Phase 1 through Phase 4 already prove:

1. no-refresh first entry works,
2. first selected stock appears reliably,
3. returning-user behavior remains stable.

After that, if the flow is stable, a separate follow-up can formalize a unified Dashboard bootstrap state layer.

## 16. Execution Status and Local Verification

Status as of 2026-03-14:

1. Phase 1 completed.
2. Phase 2 completed.
3. Phase 3 completed.
4. Phase 4 completed.
5. Phase 5 not started and not required for correctness.

### Code Paths Changed

1. [`frontend/src/lib/user.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/user.ts)
2. [`frontend/src/app/(dashboard)/dashboard/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/layout.tsx)
3. [`frontend/src/hooks/useWatchlist.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useWatchlist.ts)
4. [`frontend/src/components/onboarding/OnboardingOverlay.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/onboarding/OnboardingOverlay.tsx)
5. [`frontend/src/hooks/useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts)
6. [`frontend/src/app/api/stock/batch/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/stock/batch/route.ts)

### What Was Verified Locally

The flow was validated with a real local browser run using headless Chrome against a local Next dev server.

Verified path:

1. clear browser context,
2. open `/dashboard?invite=<existing-user-id>`,
3. complete onboarding,
4. click `进入控制台`,
5. wait on the same tab without manual refresh.

Observed result:

1. dashboard remained on `/dashboard`,
2. `STOCKWISE_HAS_ONBOARDED=true`,
3. `STOCKWISE_WATCHLIST_V2` was seeded with the selected stock,
4. footer dot count became `2` on first entry,
5. dashboard rendered `投资黄历 + 首只股票` without manual refresh,
6. `/api/stock/batch?symbols=<selected-symbol>` returned `200` and cards rendered normally.

### Additional Follow-up Fixed During Verification

During local verification, one secondary issue was discovered:

1. dashboard could issue an early `/api/stock/batch?symbols=` request before watchlist symbols existed.

This did not block the main flow after the bootstrap fixes, but it produced noisy `400` responses.

This was fixed by making [`frontend/src/app/api/stock/batch/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/stock/batch/route.ts) accept empty `symbols` as a valid almanac-only request:

1. returns `200`,
2. `stocks=[]`,
3. `almanac/almanacs` still populated when available.

### Verification Prerequisite

Local dev verification required a valid `USER_SESSION_SECRET`.

Without it:

1. `/api/user/register` returns `503`,
2. protected profile/watchlist routes fall back to `401`,
3. the frontend flow cannot be meaningfully validated.

This means any future local reproduction of this issue must first ensure session signing is configured.

### Remaining Risks

The following were not fully closed by this repair cycle:

1. no dedicated automated E2E test was committed to the repo,
2. real iOS Safari / iOS standalone PWA hardware verification is still required,
3. dashboard bootstrap still spans multiple layers and remains a candidate for later consolidation.
