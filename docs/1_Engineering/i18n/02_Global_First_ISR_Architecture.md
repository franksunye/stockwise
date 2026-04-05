# Global-First & ISR Architecture Standards

This document defines the architecture standards for maintaining high performance and global scalability in StockWise. It ensures that the internationalization (i18n) layer does not compromise server performance (CPU usage) or search engine optimization (SEO).

## 1. Core Architecture Principles

### 1.1 Public/App Surface Separation
StockWise bifurcates the application into two distinct layers with different i18n and caching strategies:

- **Public Surface** (`/`, `/about`, `/learn`, `/support`, etc.): 
  - Optimized for SEO and performance via **ISR (Incremental Static Regeneration)**.
  - Sub-path routing (e.g., `/en/...`, `/es/...`, `/ko/...`) for clear language indexing.
  - Zero dynamic dependencies (no `headers()` or `cookies()`) in layouts to ensure static extraction.
- **Authenticated App Surface** (`/dashboard`, `/admin`):
  - Dynamic rendering based on user state (Tier, Mode, Watchlist).
  - Single-page application (SPA) behavior with client-side locale resolution.
  - Cross-subdomain locale cookie (`ziso_locale`) to persist user choice.

### 1.2 Zero-Dynamic Layout Rule
To prevent "Dynamic Carbonation" (where a single dynamic hook makes the entire route tree dynamic), the **Root Layout** must remain 100% static.
- **Forbidden**: `headers()`, `cookies()`, or any request-time hooks in `app/layout.tsx`.
- **Solution**: Use client-side detection (inline scripts) for non-critical UI state (like `lang` attribute) and route-segment layouts for locale-specific wrappers.

## 2. Data Layer i18n Standards

### 2.1 Metadata Localization
Stock metadata (names, industries) is localized at the **Database Level**, not the UI string level.
- **Schema**: `stock_meta` table contains `name` (CN) and `name_en` (International).
- **Fallback Rule**: In English UI, if `name_en` is missing, the system defaults to the `symbol` to maintain clarity.

### 2.2 Shared API Strategy
To reduce CPU load on Vercel, frequently accessed public data is served via **Shared APIs** with aggressive caching:
- **Shared Almanac**: `/api/shared/almanac` (cached 1 hour).
- **Public Stock Cache**: Shared price and metric lookups use `unstable_cache` with tag-based revalidation.

## 3. Implementation Status (as of 2026-04)

| Feature | Status | Implementation Detail |
| :--- | :--- | :--- |
| **Public Static Gen** | ✅ Done | Home, About, and Content pages are fully static (O). |
| **Root Layout De-carbonation** | ✅ Done | Removed `headers()` from `RootLayout`; locale set via inline script. |
| **Shared Almanac API** | ✅ Done | Decoupled from private dashboard batch API; highly cached. |
| **Stock Name i18n** | ✅ Done | `stock_meta.name_en` + safe UPSERT; HK Sina + `sanitize_hk_name_en_candidate`; CN/HK **ETL-only** curated JSON → DB; dashboard/search/onboarding/trade use `getLocalizedStockName`; watchlist meta sync + dashboard cache overlay; local `middleware` host split; `npm run verify:local-stock-name-en`. Details: `01_Stock_Name_Internationalization.md` §16. |
| **Dashboard Refresh Throttling** | ✅ Done | Throttled background refreshes to 10-20 min based on market hours. |

## 4. Maintenance Guidelines

- **Adding a new Public Page**: Ensure it belongs to a group that supports sub-path routing if it needs SEO. Never use `headers()` in the page component.
- **Adding a new Stock Field**: If the field is user-facing (e.g., industry), consider adding a `_en` variant to the database schema.
- **Modifying Middlewares**: Middleware must exclude `/api`, `/dashboard`, and `/admin` from locale-rewrite logic to protect authenticated state paths.

---
*Reference: V2 Globalization Strategy ([00_Globalization_Strategy_V2.md](./00_Globalization_Strategy_V2.md))*
