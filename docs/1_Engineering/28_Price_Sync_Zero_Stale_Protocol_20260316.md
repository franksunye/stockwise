---
title: "Price Sync Zero-Stale Protocol (Incident 2026-03-16)"
doc_id: "engineering-price-sync-zero-stale-protocol-20260316"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-19"
summary: "定义价格同步零陈旧协议，是零 stale、价格刷新与相关 Support 内容的工程事实源。"
---

# Price Sync Zero-Stale Protocol (Incident 2026-03-16)

## 1. Background

On 2026-03-16 (Monday), users reported that stock prices on the Dashboard were stuck on data from **2026-03-13 (Friday)**. 
- The UI showed a `lastUpdated` timestamp of **15:50** (Friday's close).
- Inspection of the **production database (Turso)** confirmed that new data for 2026-03-16 existed.
- Analysis concluded that the **API response was cached at the Edge (Vercel/CDN)** or within the browser, despite previous headers like `no-store`.

## 2. Root Cause: Cache Layer Poisoning

Previous optimizations (March 13th) used `cache: 'no-store'` in fetch, but did not use a URL-level cache-buster for "silent" background refreshes. 
Vercel Edge/Middleware or intermediate CDNs can sometimes ignore `Cache-Control` headers if the URL is identical and the request is frequent, leading to a "frozen" response segment.

## 3. The "Zero Stale" Solution

To ensure users never see stale prices during active trading, the following protocol is enacted.

### 3.1 Frontend: URL-Level Decoupling (Mandatory Cache-Buster)

Every fetch to the batch API must append a unique timestamp `_t` to the query string, regardless of whether it is a "foreground" or "silent" fetch.

- **Current Failure**: Silent refreshes use `/api/stock/batch?symbols=...&historyLimit=5`.
- **Protocol Fix**: Append `&_t=${Date.now()}` to **every** request.

This ensures that the URL is unique for every invocation, forcing the Edge to bypass the cache and hit the Origin (Serverless Function).

### 3.2 Backend: Strong Origin Headers

The backend API (`/api/stock/batch`) must explicitly command Edge and Browser caches to stay away.

- **Headers**:
  - `Cache-Control: no-cache, no-store, max-age=0, must-revalidate`
  - `Pragma: no-cache`
  - `X-Accel-Buffering: no` (Specific to forcing Vercel/Nginx to stream the result rather than buffer/cache)

### 3.3 Architecture: EOD vs. Intraday Separation

The `lastUpdated` logic should be hardened to clearly distinguish between:
- **EOD Data**: Timestamp is fixed at market close (e.g., 15:50).
- **Intraday Data**: Timestamp should reflect the actual sync time (e.g., 10:20).

If the current time is Monday morning and the data received is from Friday, the UI must treat this as a "data missing" or "loading" state rather than rendering a stale "15:50" timestamp as if it were current.

## 4. Cache Preservation Strategy (Preventing Server Overload)

The Zero-Stale Protocol does **NOT** destroy the entire caching architecture. It performs a **"Precision Bypass"** of the CDN/Edge layer, while differentiating server-side cache treatment by endpoint role:

| Layer | Status | Reason |
| :--- | :--- | :--- |
| **Service Worker (PWA Shell)** | ✅ Preserved | Handles static JS/CSS; no impact on server load. |
| **Local Snapshot (localStorage)** | ✅ Preserved | Ensures "Instant-Open" (秒开); background fetch happens afterwards. |
| **Server-side `unstable_cache` (batch)** | ✅ Preserved (2 min) | `getCachedLatestPrices` in `lib/stock-cache.ts` protects the DB on the heavy `/api/stock/batch` path. TTL reduced from 15 min → **2 min** on 2026-03-17 to balance freshness and load. |
| **Server-side DB query (prices)** | 🔄 Direct query | `/api/stock/prices` now calls `getLatestPrices` (uncached) directly. This endpoint is the dedicated price-refresh channel and must always return the freshest DB state. Changed on 2026-03-17. |
| **Edge/CDN (Vercel Cache)** | ❌ Bypassed | This layer is the source of the "frozen timestamp" and "dirty data." |

### Why this is safe:
- For `/api/stock/batch`: Even if many users refresh simultaneously, the Origin Server hits `unstable_cache` (2 min TTL). The effective max staleness is ~4 min (TTL + stale-while-revalidate), far better than the previous ~30 min window.
- For `/api/stock/prices`: Each request queries the DB directly. This query is lightweight (single `MAX(date)` per symbol) and the endpoint is only called every 3 min (trading) / 10 min (non-trading) per client, making the DB load manageable.
- The Edge Cache bypass remains permanent for both endpoints.

## 5. Implementation Checklist

- [x] **Frontend**: Modify `useDashboardData.ts` to include `_t` in all batch fetch URLs.
- [x] **Backend**: Update `/api/stock/batch/route.ts` with explicit Bypass headers.
- [x] **Verification**: Monitor `X-Stockwise-Request-Id` in DevTools; verify it changes on every refresh cycle.
- [x] **Server Cache Tiering (2026-03-17)**: Split `stock-cache.ts` into uncached `getLatestPrices` (for price-refresh endpoint) and reduced-TTL `getCachedLatestPrices` (2 min, for batch endpoint). `/api/stock/prices` now queries DB directly; `/api/stock/batch` uses 2-min server cache.

## 6. Decision Reference

This protocol prioritizes **Freshness Accuracy** over **Server Load**. In trading systems, stale price data is a high-severity UX failure. CDN offloading for the primary dashboard batch API is permanently disabled.

### 2026-03-17 Revision: Server-Side Cache Tiering

The original protocol (2026-03-16) preserved the 15-minute `unstable_cache` on the server side, reasoning that it protected the DB while the Edge bypass solved the UX freshness issue. In practice, `unstable_cache` with stale-while-revalidate semantics introduced an **effective 30-minute staleness window** that the Edge bypass could not resolve — the Origin itself was returning cached data.

Resolution:
- `/api/stock/prices` (price-refresh channel): now bypasses `unstable_cache` entirely, querying the DB directly via `getLatestPrices`.
- `/api/stock/batch` (full decision payload): `getCachedLatestPrices` TTL reduced from 900s → 120s (15 min → 2 min).
- `getCachedShortMetrics` (HK short selling data): unchanged at 3600s (1 hour), as this data updates less frequently.
