# Stock Name Internationalization Design (CN/HK)

This document defines the implementation plan for internationalizing stock names in StockWise, with initial scope limited to China A-shares (`CN`) and Hong Kong stocks (`HK`).

The goal is not to "translate UI labels", but to make stock identity itself locale-aware across the data layer, API contracts, and rendering surfaces.

## 1. Scope and Problem

### Current State

`stock_meta` currently stores only:

- `symbol`
- `name`
- `market`
- `pinyin`
- `pinyin_abbr`

Today, `name` is the canonical Chinese display name:

- CN uses Simplified Chinese
- HK generally uses Traditional Chinese or upstream Chinese name forms

The app already supports English UI, but stock names still remain Chinese. This creates an inconsistent experience in:

- dashboard watchlist
- search results
- onboarding stock pickers
- stock pool views
- trade management surfaces
- admin and operational views that surface stock labels

### Initial Scope

In scope:

- `CN` and `HK` market stock names
- database schema
- metadata sync pipeline
- API response contracts
- frontend display selection
- fallback semantics
- verification and rollout gates

Out of scope for this phase:

- company profile body translation (`industry`, `main_business`, `description`)
- US market symbol naming changes
- multilingual search ranking beyond Chinese + pinyin + symbol
- adding `ko` / `es` stock-name columns

## 2. Design Principles

### 2.1 Data-Layer i18n, not UI-string i18n

Stock names are not `messages.json` content. They are domain data and must be localized in the data layer.

### 2.2 Symbol remains the universal identity key

`symbol` remains the only stable identifier across:

- ETL
- joins
- watchlists
- predictions
- navigation
- caching

Localized names are display attributes, not identifiers.

### 2.3 Separate "official English name" from "display fallback"

This is the most important semantic constraint.

`name_en` must mean:

- a trusted English company/security name
- sourced from an upstream provider or curated mapping
- nullable when unavailable

It must not be polluted with:

- `symbol`
- `pinyin`
- `pinyin_abbr`
- ad-hoc transliterations pretending to be official English names

Those are fallback display values, not English metadata.

### 2.4 UI fallback happens at render time

Fallback order belongs in application logic, not in persisted data.

This allows us to distinguish:

- high-quality English metadata
- missing English metadata
- temporary display degradation

## 3. Target Data Model

## 3.1 `stock_meta` schema

Add a nullable English name column:

```sql
ALTER TABLE stock_meta ADD COLUMN name_en TEXT;
```

Target logical shape:

```sql
stock_meta(
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT NULL,
  market TEXT NOT NULL,
  last_updated TEXT,
  pinyin TEXT,
  pinyin_abbr TEXT,
  industry TEXT,
  main_business TEXT,
  description TEXT
)
```

### 3.2 Field semantics

- `name`: canonical Chinese display name
- `name_en`: trusted English display name, nullable

Examples:

- `00700`: `name="腾讯控股"`, `name_en="Tencent"`
- `600519`: `name="贵州茅台"`, `name_en=NULL` if no verified English source is available yet

## 4. Migration and Schema Safety

`ALTER TABLE` alone is not sufficient. The implementation must update every place that defines or validates schema.

### 4.1 Required schema touchpoints

- `backend/database.py`
  - update `CREATE TABLE IF NOT EXISTS stock_meta`
- migration scripts or one-off operational migration
- schema validation scripts/tests
- any tests that construct `stock_meta` explicitly

### 4.2 Backward compatibility

The rollout must work in mixed states:

- old DB without `name_en`
- migrated DB with `name_en`
- partial backfill where only some rows have `name_en`

Recommendation:

1. Ship schema migration first
2. Ship query and type compatibility second
3. Enable ETL backfill third
4. Flip frontend rendering last

### 4.3 Important write-path risk

Current metadata sync uses `INSERT OR REPLACE`, and `stock_meta` also stores:

- `industry`
- `main_business`
- `description`

If we continue replacing rows with only metadata sync columns, profile fields may be wiped.

This is a pre-existing risk and must be addressed in the same implementation.

Preferred fix:

- replace `INSERT OR REPLACE` with `INSERT ... ON CONFLICT(symbol) DO UPDATE`
- update only the metadata columns that sync actually owns

Example target pattern:

```sql
INSERT INTO stock_meta (symbol, name, name_en, market, last_updated, pinyin, pinyin_abbr)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(symbol) DO UPDATE SET
  name = excluded.name,
  name_en = excluded.name_en,
  market = excluded.market,
  last_updated = excluded.last_updated,
  pinyin = excluded.pinyin,
  pinyin_abbr = excluded.pinyin_abbr;
```

This avoids clearing profile columns on every metadata refresh.

## 5. ETL and Source Strategy

## 5.1 HK market

The document assumes HK English names can be fetched upstream. That is acceptable, but implementation must first verify the exact provider and field stability.

Current reality in code:

- `sync_stock_meta()` currently uses `ak.stock_hk_spot_em()`
- the existing implementation only persists `(symbol, name, market, last_updated, pinyin, pinyin_abbr)`

Therefore the plan must explicitly answer:

- which HK source becomes the truth source for `name_en`
- whether the provider is stable in bulk sync
- what happens when the source intermittently drops the English field

Required rule:

- only write `name_en` when upstream gives a non-empty trusted value
- do not overwrite a previously valid `name_en` with low-quality fallback text

## 5.2 CN market

For A-shares, English naming quality is the core risk.

Recommended source priority:

1. curated or exchange-derived official English names for high-priority universe
2. trusted global market provider with stable company names
3. `NULL`

Not acceptable as persisted `name_en`:

- `symbol`
- `pinyin`
- `pinyin_abbr`

Those belong only in display fallback.

### 5.2.1 Operational strategy

The CN rollout should be staged:

1. add schema and wire contracts
2. ship HK first
3. ship curated CN subset for high-priority universe
4. expand CN coverage later

This avoids forcing low-quality fake English names into the database.

## 5.3 ETL output contract

`sync_stock_meta()` should produce records shaped like:

```python
(symbol, name, name_en, market, last_updated, pinyin, pinyin_abbr)
```

All helper paths must be updated consistently, including:

- HK ingestion branch
- CN HTTP API branch
- CN AkShare fallback branch
- any batch SQL placeholders

## 6. Query Contract Changes

Changing only the table is not enough. Every read surface that needs localized names must be updated to return both `name` and `name_en`, or to return a resolved display field with explicit semantics.

### 6.1 Backend query registry

At minimum the following query patterns must be reviewed:

- `GET_STOCK_NAME_QUERY`
- `BULK_INSERT_STOCK_META_BASE`
- search queries
- watchlist queries
- stock pool queries
- onboarding queries
- trade management joins
- admin joins

### 6.2 API contract recommendation

For app-facing APIs, prefer returning both raw fields and letting frontend choose display by locale:

```json
{
  "symbol": "00700",
  "name": "腾讯控股",
  "name_en": "Tencent",
  "market": "HK"
}
```

This is better than returning only a server-resolved `display_name`, because:

- frontend locale can switch without refetch in some surfaces
- rendering logic stays explicit
- analytics/debugging can inspect raw name fields

## 7. Frontend Contract

## 7.1 Type changes

Current `StockData` and related result shapes only expose `name`.

This design requires adding optional `name_en` to relevant TS contracts, for example:

```ts
export interface StockData {
  symbol: string;
  name: string;
  name_en?: string | null;
  ...
}
```

The same review should be applied to:

- dashboard watchlist response
- search results
- onboarding candidate stocks
- stock pool rows
- trade management rows

## 7.2 Locale source in components

Do not call `resolveLocale()` directly inside rendering components for this feature.

Component layer should use existing locale context/hooks:

- `useLocale()` for app surfaces
- public-route locale props for marketing/public pages

`resolveLocale()` is an environment detection utility, not the preferred render-time source of truth.

### Recommended rendering helper

Introduce a small shared helper:

```ts
function getLocalizedStockName(
  stock: { symbol: string; name: string; name_en?: string | null },
  locale: 'cn' | 'en'
) {
  if (locale === 'en') return stock.name_en || stock.symbol;
  return stock.name;
}
```

Note the fallback:

- English UI: `name_en -> symbol`
- Chinese UI: `name`

We intentionally do not use `pinyin` as default visible label in English UI for now. Pinyin can remain a search aid or future tertiary fallback, but symbol is clearer and less misleading for global users.

## 7.3 Search UX

Search ranking must remain robust for Chinese users.

Adding `name_en` must not regress:

- Chinese exact match
- Chinese fuzzy match
- pinyin/pinyin_abbr match
- symbol exact/prefix match

English search support can be added by extending `WHERE` and ranking rules to include `name_en`, but without reducing Chinese hit quality.

## 8. Affected Surfaces Checklist

The implementation owner must audit at least these surfaces:

- `frontend/src/app/api/dashboard/route.ts`
- `frontend/src/app/api/stock/search/route.ts`
- `frontend/src/app/api/user/onboarding/stocks/route.ts`
- `frontend/src/hooks/useDashboardData.ts`
- `frontend/src/app/(dashboard)/dashboard/stock-pool/page.tsx`
- `frontend/src/components/onboarding/OnboardingOverlay.tsx`
- `frontend/src/components/dashboard/StockProfile.tsx`
- trade management query builders in `frontend/src/lib/user-trade-management.ts`
- admin trade position query builders in `frontend/src/lib/admin-trade-positions.ts`

Also review backend scripts that join `stock_meta.name`, especially if they generate user-facing text or reports.

## 9. Rollout Plan

### Phase 1: Schema and contracts

- add `name_en` to DB schema
- update `stock_meta` creation path
- update query constants
- add TS optional fields
- no UI change yet

### Phase 2: Safe ETL for HK

- source and backfill HK `name_en`
- verify no profile-field wiping
- verify partial null behavior

### Phase 3: UI rendering for app locale

- app surfaces use localized stock display helper
- English locale shows `name_en || symbol`
- Chinese locale remains unchanged

### Phase 4: CN curated expansion

- backfill trusted CN `name_en` for prioritized universe
- keep missing rows as `NULL`

## 10. Verification Matrix

The original verification plan was too narrow. Use the following minimum matrix.

### 10.1 Schema verification

- old local DB migrates successfully
- fresh DB bootstrap includes `name_en`
- schema validation scripts pass

### 10.2 Write-path verification

- metadata sync writes `name_en` without clearing `industry/main_business/description`
- partial ETL runs do not overwrite valid `name_en` with empty strings

### 10.3 API verification

- `/api/dashboard` returns `name` and `name_en` for watchlist rows
- `/api/stock/search` still returns Chinese/pinyin matches correctly
- onboarding stock candidates return dual-name fields where available

### 10.4 UI verification

For `locale=cn`:

- stock labels remain Chinese

For `locale=en`:

- HK stock with `name_en` shows English name
- CN stock without `name_en` falls back to symbol
- no component crashes on `name_en=null`

### 10.5 Regression verification

- stock search Chinese ranking unchanged
- watchlist add/remove behavior unchanged
- admin pool / trade management labels still render
- dashboard hydration and cache bootstrap unaffected

## 11. Suggested Tests

### Backend / DB

- schema test: `stock_meta` contains `name_en`
- sync test: metadata UPSERT preserves profile columns
- ETL unit test: empty `name_en` does not overwrite existing trusted value

### Frontend

- rendering helper tests:
  - `en + name_en -> name_en`
  - `en + null -> symbol`
  - `cn -> name`
- API contract tests for dashboard/search/onboarding payload shape

## 12. Acceptance Criteria

This design is complete only when all conditions are true:

1. `stock_meta` safely stores nullable `name_en`
2. metadata sync updates `name_en` without destructive profile-field loss
3. app APIs expose both `name` and `name_en` where stock labels are rendered
4. frontend types support `name_en`
5. English app locale displays trusted English names when available
6. missing English names degrade to `symbol`, not fake persisted translations
7. search and Chinese UX do not regress

## 13. Non-Goals and Follow-ups

Future extensions may include:

- `industry_en`, `description_en`
- multilingual company profiles
- `name_ko` / `name_es` if real localized market data is ever justified
- smarter English search ranking using `name_en`

But those are separate projects. For this phase, success means safe dual-name support for CN/HK securities without damaging existing Chinese-first workflows.

## 14. Feasibility and Maturity Validation

This design is implementation-ready in structure, but several assumptions still need short-cycle validation before full rollout.

The purpose of this section is to reduce two kinds of risk:

- building on an unstable or low-quality upstream English-name source
- introducing schema/write-path changes that look correct in code review but damage live metadata

### 14.1 What still requires validation

#### A. Upstream source feasibility

The biggest unresolved question is not schema design, but data quality.

We still need to prove:

- HK upstream can reliably provide usable English names in bulk sync
- CN upstream coverage is good enough for an initial curated rollout
- upstream values are stable enough to trust as persisted `name_en`

#### B. Write-path safety

The design recommends replacing `INSERT OR REPLACE` with safe `UPSERT`.

This must be verified against a real local DB snapshot to confirm:

- no accidental clearing of `industry`
- no accidental clearing of `main_business`
- no accidental clearing of `description`
- no regression in repeated sync runs

#### C. Contract viability

Before implementation broadens to all surfaces, we should validate the minimum contract on a few representative endpoints:

- dashboard watchlist API
- stock search API
- onboarding candidate stock API

#### D. Product fallback quality

The design intentionally chooses:

- English locale: `name_en || symbol`
- Chinese locale: `name`

That fallback is structurally sound, but should still be validated with real product samples to ensure it feels correct in the UI.

### 14.2 Validation goals

A short validation round is sufficient if it answers these questions:

1. Can we obtain trusted HK English names at scale?
2. Can we safely store nullable `name_en` without damaging existing metadata?
3. Can the app consume `name_en` without breaking current CN-first behavior?
4. Is the English fallback to `symbol` acceptable when `name_en` is missing?

### 14.3 Recommended pre-implementation validation pack

#### Validation Pack A: Data-source sampling

Use a small but representative sample.

Recommended sample:

- 50-100 HK symbols
- 30-50 CN symbols from high-priority universe

For each symbol, record:

- `symbol`
- `name`
- candidate `name_en`
- source provider
- confidence level (`trusted` / `uncertain` / `missing`)

Success criteria:

- HK sample has high-confidence usable English names for the clear majority of symbols
- CN sample confirms that a curated rollout is feasible, even if full-market coverage is not

#### Validation Pack B: Local DB migration rehearsal

Run against a copy of a realistic local DB.

Steps:

1. add nullable `name_en`
2. update metadata write path to safe `UPSERT`
3. run `--sync-meta`
4. compare before/after snapshots

Check explicitly:

- row count unchanged except for expected refresh behavior
- `industry/main_business/description` preserved
- `name_en` populated only where available
- repeated sync remains idempotent

#### Validation Pack C: Contract spike

Implement a short-lived spike or branch that updates only:

- `/api/dashboard`
- `/api/stock/search`
- `/api/user/onboarding/stocks`

Return:

```json
{
  "symbol": "00700",
  "name": "腾讯控股",
  "name_en": "Tencent",
  "market": "HK"
}
```

Then validate:

- existing consumers do not break when `name_en` is added
- new consumers can render dual-name data safely

#### Validation Pack D: UI sample review

Review at least these three scenarios in a dev build:

1. HK stock with trusted `name_en`
2. CN stock with curated `name_en`
3. CN stock without `name_en`

Expected outcomes:

- English locale shows English name when available
- English locale falls back to `symbol` when unavailable
- Chinese locale remains unchanged

### 14.4 Suggested validation outputs

The validation round should produce concrete artifacts, not just verbal confirmation.

Recommended outputs:

- a small CSV or Markdown table of sampled symbols and candidate `name_en`
- before/after DB check notes for metadata preservation
- one short implementation spike diff for API contracts
- 2-4 screenshots of English/CN rendering outcomes

### 14.5 Decision rule after validation

Proceed to implementation if all conditions are met:

- HK source quality is confirmed
- `UPSERT` path is verified safe
- contract spike does not break main consumers
- fallback behavior is acceptable in product review

If validation fails:

- do not block schema support
- reduce scope to HK-first
- keep CN `name_en` rollout curated and nullable
- do not persist low-confidence pseudo-English names

### 14.6 Maturity assessment

Current maturity of this design:

- **Architecture maturity**: High
- **Schema/query design maturity**: High
- **Source-data maturity**: Medium
- **Operational rollout maturity**: Medium

Conclusion:

This design does **not** require long-cycle research, but it **does** require a short, disciplined feasibility validation round before full implementation.

## 15. Implementation Task Checklist

Use this checklist as the execution order for implementation.

### 15.1 Priority Summary

#### P0: Minimum shippable closed loop

- [ ] Add `name_en` to `stock_meta` schema and migration path
- [ ] Update schema validation/tests for `name_en`
- [ ] Replace metadata sync `INSERT OR REPLACE` with safe `UPSERT`
- [ ] Extend metadata sync contract to write nullable `name_en`
- [ ] Ship HK `name_en` ingestion from a verified source
- [ ] Update dashboard/search/onboarding API contracts to expose `name_en`
- [ ] Add optional `name_en` to relevant frontend TS types
- [ ] Introduce shared locale-aware stock name rendering helper
- [ ] Render `name_en || symbol` in English app locale, keep Chinese locale unchanged
- [ ] Verify missing `name_en` degrades to `symbol`, not fake translations
- [ ] Verify search/watchlist/onboarding do not regress

#### P1: Coverage expansion and hardening

- [ ] Expand dual-name support to stock pool, trade management, and admin surfaces
- [ ] Add `name_en` matching into search ranking without degrading Chinese relevance
- [ ] Backfill curated CN high-priority universe with trusted English names
- [ ] Add more complete automated tests for ETL overwrite safety and UI rendering surfaces
- [ ] Audit backend scripts/reports that still assume `stock_meta.name` is the only display field

### 15.2 Schema and migration

- [ ] Add `name_en` to `stock_meta` in persistent schema creation (`backend/database.py`)
- [ ] Add/prepare one-time migration for existing SQLite/Turso environments
- [ ] Update schema validation scripts/tests to expect `name_en`
- [ ] Audit tests that manually create `stock_meta` and add the new column where needed

### 15.3 Query and write-path safety

- [ ] Update `BULK_INSERT_STOCK_META_BASE` to include `name_en`
- [ ] Replace metadata sync `INSERT OR REPLACE` behavior with safe `UPSERT`
- [ ] Ensure metadata sync does not wipe `industry`, `main_business`, or `description`
- [ ] Update `GET_STOCK_NAME_QUERY` and any stock meta lookup helpers as needed

### 15.4 ETL ingestion

- [ ] Define the HK truth source for `name_en`
- [ ] Implement HK metadata extraction for `name_en`
- [ ] Keep `name_en` nullable when upstream English name is missing
- [ ] Prevent empty/low-quality values from overwriting existing trusted `name_en`
- [ ] Define CN source strategy for trusted English names
- [ ] Limit initial CN rollout to curated/high-priority universe if source quality is not uniform

### 15.5 API contracts

- [ ] Update dashboard watchlist API to return `name` and `name_en`
- [ ] Update stock search API to return `name`, `name_en`, and `market`
- [ ] Update onboarding stock candidate APIs to return `name_en` where available
- [ ] Audit stock pool, trade management, and admin APIs that surface stock labels

### 15.6 Frontend types and rendering

- [ ] Add optional `name_en?: string | null` to relevant TS types
- [ ] Introduce a shared helper for locale-aware stock name rendering
- [ ] Use `useLocale()` / route locale instead of calling `resolveLocale()` directly in components
- [ ] Update dashboard watchlist rendering
- [ ] Update search result rendering
- [ ] Update onboarding stock picker rendering
- [ ] Update stock pool rendering
- [ ] Update trade management and admin label rendering where applicable

### 15.7 Search behavior

- [ ] Preserve Chinese exact/fuzzy search behavior
- [ ] Preserve pinyin / pinyin_abbr search behavior
- [ ] Add optional `name_en` matching without degrading Chinese relevance ordering
- [ ] Verify symbol exact/prefix ranking remains stable

### 15.8 Verification and release gates

- [ ] Verify old DB migration succeeds
- [ ] Verify fresh DB bootstrap includes `name_en`
- [ ] Verify metadata sync preserves existing profile fields
- [ ] Verify HK stocks with trusted English names render correctly in English locale
- [ ] Verify CN stocks without `name_en` fall back to `symbol` in English locale
- [ ] Verify Chinese locale remains unchanged
- [ ] Verify no crash on `name_en = NULL`
- [ ] Verify search, watchlist, onboarding, admin, and trade management flows for regressions
- [ ] Add/extend automated tests for schema, ETL safety, API contract, and rendering helper behavior

### 15.9 Rollout recommendation

- [ ] Merge schema + contract support first
- [ ] Backfill HK names second
- [ ] Enable UI rendering third
- [ ] Expand curated CN coverage last
