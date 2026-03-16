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

The Zero-Stale Protocol does **NOT** destroy the entire caching architecture. It performs a **"Precision Bypass"** of the CDN/Edge layer, while keeping the internal protection layers intact:

| Layer | Status | Reason |
| :--- | :--- | :--- |
| **Service Worker (PWA Shell)** | ✅ Preserved | Handles static JS/CSS; no impact on server load. |
| **Local Snapshot (localStorage)** | ✅ Preserved | Ensures "Instant-Open" (秒开); background fetch happens afterwards. |
| **Server-side `unstable_cache`** | ✅ Preserved | **CRITICAL**: The `getCachedLatestPrices` (15m) in `lib/stock-cache.ts` still protects the Database from redundant hits. |
| **Edge/CDN (Vercel Cache)** | ❌ Bypassed | This layer is the source of the "frozen timestamp" and "dirty data." |

### Why this is safe:
Even if 1,000 users refresh at the same second, the **Origin Server** will hit its internal `unstable_cache`. If the data is < 15 mins old, it returns immediately without querying the Database (Turso). The Edge Cache was redundant for DB protection but catastrophic for UX freshness.

## 5. Implementation Checklist

- [ ] **Frontend**: Modify `useDashboardData.ts` to include `_t` in all batch fetch URLs.
- [ ] **Backend**: Update `/api/stock/batch/route.ts` with explicit Bypass headers.
- [ ] **Verification**: Monitor `X-Stockwise-Request-Id` in DevTools; verify it changes on every refresh cycle.

## 5. Decision Reference

This protocol prioritizes **Freshness Accuracy** over **Server Load**. In trading systems, stale price data is a high-severity UX failure. CDN offloading for the primary dashboard batch API is permanently disabled.
