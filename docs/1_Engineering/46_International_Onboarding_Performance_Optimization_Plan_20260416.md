# International Onboarding Performance Optimization Plan

## 1. Scope

This document defines a narrow performance and perceived-speed optimization plan for the international invite onboarding flow.

It only covers:
- `invite -> onboarding first screen`
- `onboarding completion -> dashboard first usable screen`
- loading-state perception during this path

It does not cover:
- locale correctness
- invite eligibility logic
- onboarding step redesign
- pricing or payment flow changes

## 2. Problem Statement

Current international invite entry is functionally working, but first-load perception is still weak:

1. users can see a generic dashboard-like skeleton for around `~3s` before onboarding appears,
2. this makes the experience feel slower than it is,
3. the loading state is visually misleading because users are entering onboarding, not the main dashboard,
4. this issue appears to be global, not Android-specific.

The core problem is no longer feature correctness. It is onboarding entry performance and loading-state quality.

## 3. Current Evidence

Based on the 2026-04-16 PH invite validation:

- `https://ziso.cc/v/PH` can enter English onboarding correctly
- onboarding steps remain English
- onboarding can enter dashboard without manual refresh
- Android Chrome foreground/background recovery is stable
- PC flow was previously verified and currently inherits the same forced-English invite entry
- the remaining visible risk is the first-load skeleton duration and presentation

Related background documents:
- [25_Onboarding_First_Load_Recovery_Plan_20260314.md](/Users/yesun/Code/stockwise/docs/1_Engineering/25_Onboarding_First_Load_Recovery_Plan_20260314.md)
- [34_Dashboard_Page_Refactoring_Design.md](/Users/yesun/Code/stockwise/docs/1_Engineering/34_Dashboard_Page_Refactoring_Design.md)
- [45_International_V1_Release_Engineering_Review_20260411.md](/Users/yesun/Code/stockwise/docs/1_Engineering/45_International_V1_Release_Engineering_Review_20260411.md)
- [48_V1_International_Launch_Playbook.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/48_V1_International_Launch_Playbook.md)

## 4. Optimization Goal

The goal is not to change onboarding behavior.

The goal is to make the first international onboarding entry:
- feel intentional,
- reach an understandable first screen faster,
- avoid misleading dashboard-like waiting states,
- reduce perceived dead time before the first meaningful interaction.

## 4.1 Global Entry Design Principle

This专项 follows one global entry rule:

`entry classification -> route-specific loading -> minimal bootstrap -> content render`

That means:

1. classify the user into the correct primary route first,
2. show a loading state that matches that route,
3. only wait for the minimum data needed by that route,
4. render route content after that route is already known.

The system should not:

- render a generic dashboard skeleton before the route is known,
- let dashboard bootstrap visuals leak into onboarding entry,
- block onboarding first paint on non-critical dashboard work.

## 4.2 Route Classes

For current international invite flows, entry should be classified into one of these primary classes:

1. `invite-onboarding`
2. `authorized-dashboard`
3. `invite-wall`
4. `marketing/pricing`

Each class should have its own loading and bootstrap contract.

## 4.3 Loading Contract

The loading state must follow route semantics:

- `invite-onboarding` uses onboarding-aware loading,
- `authorized-dashboard` uses dashboard loading,
- `invite-wall` uses invite-wall loading,
- other public routes use their own public loading.

Generic dashboard skeleton must not be the default fallback for every app entry.

## 4.4 Entry State Machine

To make this industrial-grade, the app entry flow must be modeled as an explicit state machine instead of scattered local decisions.

### States

1. `entry_unknown`
2. `entry_classifying`
3. `route_invite_onboarding`
4. `route_authorized_dashboard`
5. `route_invite_wall`
6. `route_public`
7. `route_error`

### Allowed transitions

1. `entry_unknown -> entry_classifying`
2. `entry_classifying -> route_invite_onboarding`
3. `entry_classifying -> route_authorized_dashboard`
4. `entry_classifying -> route_invite_wall`
5. `entry_classifying -> route_public`
6. `entry_classifying -> route_error`

### State-machine rule

Before entry classification is complete, the UI may only show:
- neutral shell loading, or
- route-classification loading

It may not show:
- dashboard-specific skeleton,
- onboarding-specific content,
- invite-wall content,

until the route is known.

## 4.5 Single Entry Controller

Entry classification must have a single source of truth.

Current behavior is split across:
- dashboard layout authorization state,
- dashboard entry gate,
- profile/bootstrap hooks,
- onboarding overlay visibility,

which makes loading behavior drift.

Target architecture:

1. one entry controller decides the current route class,
2. route-specific components consume that decision,
3. route-specific loading is derived from the route class,
4. dashboard bootstrap and onboarding bootstrap are no longer allowed to race visually.

This controller can be implemented as:
- a dedicated entry hook,
- a route-state reducer,
- or an explicit bootstrap state module,

but it must remain the only place that classifies app entry.

## 4.6 Observability Contract

This entry architecture is incomplete without observability.

Every first-load entry should be able to answer:

1. which route class was chosen,
2. how long classification took,
3. how long route-specific bootstrap took,
4. when first meaningful render happened,
5. whether the user reached onboarding first interaction,
6. whether the user reached dashboard first usable state.

Minimum events:

1. `entry_classification_started`
2. `entry_classification_resolved`
3. `entry_route_loading_shown`
4. `onboarding_first_meaningful_paint`
5. `onboarding_first_interaction_ready`
6. `dashboard_first_usable`
7. `entry_route_error`

## 5. Measurement Contract

This专项 uses three timings:

1. `invite_open -> onboarding_first_meaningful_paint`
2. `invite_open -> onboarding_first_interaction_ready`
3. `onboarding_complete -> dashboard_first_usable_screen`

At minimum, engineering must be able to distinguish:
- HTML / shell arrival
- bootstrap wait
- onboarding overlay render
- dashboard usable render

## 6. Optimization Rules

1. Do not add or remove onboarding steps in this专项.
2. Do not change invite semantics in this专项.
3. Prefer reducing critical-path work over adding more loading UI.
4. If loading UI is necessary, it must match route context instead of generic dashboard context.
5. Non-critical dashboard work should not block onboarding first paint.
6. Route classification must happen before route-specific loading is rendered.
7. Entry state must be modeled centrally, not re-inferred independently by multiple layers.
8. Every route-classification decision must be observable in logs or analytics.

## 7. Work Items

### 7.1 Instrument first-load timings

Add focused timing markers for:
- invite entry
- bootstrap start/end
- onboarding overlay mount
- onboarding first interaction ready
- dashboard first usable render
- route classification start/end
- route-specific loading shown

### 7.1.1 Instrument entry route decisions

Add explicit route decision logging for:
- route class chosen,
- invite present or not,
- profile known or not,
- hasOnboarded known or not,
- authorization known or not.

### 7.2 Audit current blocking path

Identify which of these still sit on the critical path before onboarding becomes visible:
- locale/bootstrap calls
- auth/profile sync
- watchlist recovery
- dashboard shell render
- fonts/images/animation assets

Also identify where route classification is currently delayed behind generic dashboard authorization states.

### 7.3 Replace misleading skeleton behavior

If the user is entering onboarding, the waiting state should look like onboarding entry, not dashboard content placeholders.

This likely requires moving from:

- `generic dashboard skeleton first`

to:

- `route-aware entry gate first`

### 7.3.1 Separate shell loading from route loading

The app may keep one neutral shell-level loading state for very early bootstrap,
but route-specific skeletons must only appear after route classification.

### 7.4 Defer non-critical dashboard work

Anything not required for the onboarding first screen should move after:
- onboarding visible
or after:
- dashboard first usable state

## 8. Acceptance Criteria

This专项 is complete only if:

1. fresh international invite entry no longer shows a misleading dashboard-like skeleton before onboarding,
2. onboarding first screen becomes visibly intentional and faster in perception,
3. onboarding completion still enters dashboard without manual refresh,
4. no locale regression is introduced,
5. PC and mobile invite paths both keep functional parity.
6. route decision can be reconstructed from telemetry for every first-load sample.

## 9. Backlog Boundary

The following are related but out of scope for this document:
- onboarding copy rewrite
- onboarding step reduction
- Product Hunt funnel analysis by device
- PWA install UX refinement
- eventual removal of temporary invite locale enforcement

Those should be tracked separately after this performance专项 is closed.
