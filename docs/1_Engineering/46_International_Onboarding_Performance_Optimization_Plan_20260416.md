# App Entry Contract and Follow-up

## 1. Purpose

This document is the current, concise contract for ZISO app entry behavior.

It replaces the earlier long-form onboarding performance plan. Historical debugging context remains in:

- [25_Onboarding_First_Load_Recovery_Plan_20260314.md](/Users/yesun/Code/stockwise/docs/1_Engineering/25_Onboarding_First_Load_Recovery_Plan_20260314.md)
- [45_International_V1_Release_Engineering_Review_20260411.md](/Users/yesun/Code/stockwise/docs/1_Engineering/45_International_V1_Release_Engineering_Review_20260411.md)
- [48_V1_International_Launch_Playbook.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/48_V1_International_Launch_Playbook.md)

## 2. Current Rule

App entry follows one rule:

`entry classification -> route-specific loading -> minimal bootstrap -> content render`

The entry layer must classify the user before showing a route-specific surface. Dashboard visuals must not be used as the generic fallback for every app entry.

## 3. Route Classes

Current route classes:

| Route class | Meaning | Loading contract |
| --- | --- | --- |
| `invite-onboarding` | Invite/referral entry that should proceed into onboarding | Onboarding-aware loading |
| `authorized-dashboard` | Returning or restored user allowed into Dashboard | Dashboard loading or direct Dashboard render |
| `invite-wall` | Direct app entry blocked by invite requirement | Invite-wall/access-check loading, then invite wall |
| `public` | Marketing or public route | Public route loading |
| `error` | Failed classification or unrecoverable entry problem | Error state |

## 4. Non-negotiable Constraints

1. `invite-onboarding` must not show Dashboard skeleton before onboarding.
2. Cold direct `app.ziso.cc` entry with no local authorized/onboarded evidence must not show Dashboard skeleton while bootstrap is pending.
3. Cookie-only returning users may still transition from invite-wall/access-check loading to `authorized-dashboard` after bootstrap restores identity.
4. Route classification should have one source of truth. Do not re-infer route class independently in layout, gate, profile hooks, and onboarding components.
5. Loading copy must support English and Chinese, including pre-`LocaleProvider` entry loading.

## 5. Current Implementation

Primary files:

- `frontend/src/lib/dashboard-bootstrap.ts`
  - `getAppEntryControllerSnapshot`
  - `shouldPreferInviteOnboardingLoading`
  - `shouldPreferInviteWallLoading`
- `frontend/src/app/(site)/(dashboard)/dashboard/layout.tsx`
  - consumes the entry snapshot for the top-level pending state
- `frontend/src/components/dashboard/DashboardEntryGate.tsx`
  - keeps nested dashboard loading aligned with the same snapshot
- `frontend/src/components/dashboard/AppEntryLoading.tsx`
  - route-specific loading shell
- `frontend/src/messages/en.json`
- `frontend/src/messages/cn.json`
  - `appEntry.loading.*`
- `frontend/src/components/analytics/AppEntryTelemetry.tsx`
  - emits entry route classification telemetry

Current user-visible loading copy:

| Route | English | Chinese |
| --- | --- | --- |
| `invite-onboarding` | `Getting your trial ready...` | `正在准备你的体验权限...` |
| `invite-wall` | `Checking your access...` | `正在核验访问权限...` |
| `shell` | `Loading...` | `加载中...` |

## 6. Verification Standard

Before shipping app-entry changes, run at minimum:

```bash
cd frontend
node --test tests/i18n-integrity.test.mjs tests/dashboard-bootstrap.test.mjs tests/app-entry-telemetry.test.mjs tests/dashboard-locale-boundary.test.mjs
npm run lint -- src/components/dashboard/AppEntryLoading.tsx src/lib/dashboard-bootstrap.ts src/components/dashboard/AppEntryControllerContext.tsx src/components/dashboard/DashboardEntryGate.tsx 'src/app/(site)/(dashboard)/dashboard/layout.tsx' src/components/analytics/AppEntryTelemetry.tsx
npm run build
```

Manual/browser checks:

1. Fresh direct `/dashboard` with bootstrap delayed: shows `invite-wall` loading; `data-dashboard-skeleton="true"` count is `0`.
2. Fresh `?invite=PH&locale=en`: shows onboarding-aware loading, then onboarding.
3. Chinese locale from `stockwise_locale=cn` or `ziso_locale=cn`: entry loading copy renders in Chinese.
4. Returning authorized user: still reaches Dashboard without being trapped behind invite wall.

## 7. Current Status

As of 2026-04-23:

- PH invite/onboarding path no longer depends on Dashboard skeleton.
- Cold direct app entry no longer leaks Dashboard skeleton before invite wall.
- Entry loading copy is localized in English and Chinese.
- Route classification has regression coverage in `tests/dashboard-bootstrap.test.mjs`.
- Production build has passed after the latest entry changes.

## 8. Short Follow-up

Keep follow-up small and operational:

1. Extract the current snapshot logic into an explicit reducer/state-machine only if future entry classes grow.
2. Review production telemetry for route classification duration and first meaningful paint.
3. Add one browser smoke script for cold direct entry and PH invite entry if the flow changes again.
4. Keep historical incident plans as background; do not duplicate app-entry rules outside this contract.
