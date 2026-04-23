# Onboarding First-Load Recovery Record 2026-03-14

## 1. Status

This document is a completed repair record, not an active execution plan.

The original first-load hang after invite-link onboarding has been fixed in production code paths. Current app-entry rules and future follow-up are maintained in:

- [46_International_Onboarding_Performance_Optimization_Plan_20260416.md](/Users/yesun/Code/stockwise/docs/1_Engineering/46_International_Onboarding_Performance_Optimization_Plan_20260416.md)

Keep this file only as historical incident context for the March 2026 onboarding first-load repair.

## 2. Original Symptom

The original bug was observed on a fresh invite onboarding path:

1. User entered from an invite link.
2. User completed onboarding in browser.
3. Dashboard showed only the Almanac frame first.
4. The first stock card appeared very late or only after manual refresh.

The issue was not caused by one slow API. It was a chained Dashboard bootstrap-state problem.

## 3. Root Cause Summary

The broken path involved several layers racing or blocking each other:

1. Local identity recovery could wait too long on `/api/user/register`.
2. Watchlist bootstrap conflated local restore, empty state, and remote sync.
3. Dashboard data fetch could wait on watchlist recovery even when the selected onboarding stock was already known.
4. Onboarding completion wrote server truth but did not reliably seed local snapshot truth for the immediate first render.

Important conclusion from the incident:

`bootstrap` in this context meant Dashboard bootstrap state, not the entire PWA shell.

## 4. Repairs Landed

The repair was intentionally small-step and reversible. The completed work included:

1. Decoupled local identity availability from blocking session sync.
2. Made watchlist local bootstrap finish deterministically before remote sync.
3. Seeded local watchlist/snapshot truth during onboarding completion.
4. Relaxed Dashboard wait rules so usable local state could render without manual refresh.
5. Accepted empty stock batch requests as valid almanac-only requests to avoid noisy early `400` responses.

Primary paths involved during the original repair:

- `frontend/src/lib/user.ts`
- `frontend/src/hooks/useWatchlist.ts`
- `frontend/src/components/onboarding/OnboardingOverlay.tsx`
- `frontend/src/hooks/useDashboardData.ts`
- `frontend/src/app/api/stock/batch/route.ts`

## 5. Verification Recorded

The repaired flow was validated locally with a fresh browser context against a local Next dev server:

1. clear browser context,
2. open `/dashboard?invite=<existing-user-id>`,
3. complete onboarding,
4. enter Dashboard in the same tab without manual refresh.

Observed result:

1. `STOCKWISE_HAS_ONBOARDED=true`,
2. local watchlist was seeded with the selected stock,
3. footer dot count became `2` on first entry,
4. Dashboard rendered `Almanac + first stock` without manual refresh,
5. `/api/stock/batch?symbols=<selected-symbol>` returned `200`.

Local verification required a valid `USER_SESSION_SECRET`; without it, session-backed local reproduction is not meaningful.

## 6. Current Interpretation

This incident should not be used to argue that onboarding first-load work is still at phase zero.

Current interpretation:

1. The original onboarding first-load hang is fixed.
2. The March 2026 phase plan is closed.
3. Current entry behavior is governed by the App Entry contract in document `46`.
4. Future work should improve the centralized entry controller and telemetry, not rerun this plan.

## 7. Historical Notes

This record is retained because other architecture and traceability documents still reference it, including Dashboard refresh/cache and SWR/bootstrap architecture notes.

If this file is ever moved to an archive directory, leave a redirect note at this path or update all inbound references in the same change.
