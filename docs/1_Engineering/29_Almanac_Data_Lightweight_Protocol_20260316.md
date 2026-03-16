# Almanac Data Lightweight Protocol (Stability Pivot 2026-03-16)

## 1. Background

The "Almanac" feature provides users with a daily summary of the A-share market. Originally, the system relied on a **"Brute Force Scraping"** approach, which involved:
- Fetching 5,000+ individual stock rows from Eastmoney/Sina.
- Processing this massive dataset to compute breadth (advancers/decliners) and total turnover.
- **Failures**: This method was highly unstable. Frequent CDN blocks ("Remote end closed connection"), large data payloads, and proxy interference led to incomplete data and "unsmooth" (不丝滑) system performance.

## 2. Technical Pivot: From Scraping to Protocol Aggregation

To ensure 100% stability, we pivoted the data acquisition strategy from volume-based scraping to a **Lightweight Protocol** based on pre-aggregated market summaries.

| Metric | Old Method (Scraping) | New Method (Aggregation) | Gain |
| :--- | :--- | :--- | :--- |
| **Market Breadth** | Iterate 5,000 stocks | `ak.stock_market_activity_legu()` | **Instant**; Aggregated by source. |
| **Total Turnover** | Sum 5,000 stock amounts | Sum SH000001 + SZ399001 Index Spot | **Millisecond-level**; Reliable. |
| **Data Payload** | ~2MB JSON | ~2KB JSON | **1000x reduction** in network risk. |

## 3. Core Components

### 3.1 High-Stability Market Breadth
We now use the **LeGu** (乐股) market activity API. This source provides pre-calculated counts of advancing, declining, and flat stocks. It is much more resilient to the scraping blocks that hit individual stock lists.

### 3.2 Total Turnover Aggregation
Instead of summing individual stock turnover (which is prone to missing rows), we fetch the **Real-time Index Spot** data for the Shanghai and Shenzhen indices. Summing their `成交额` (Turnover Amount) provides the most accurate and stable total market turnover available via lightweight APIs.

### 3.3 Environment Isolation Fetcher (`_isolated_ak_fetch`)
A critical engineering addition is the `_isolated_ak_fetch` pattern. In local or restrictive environments, proxies frequently interfere with the SSL handshakes of financial data providers.

**The Protocol**:
1.  **Tier 1**: Attempt fetch with standard environment settings.
2.  **Tier 2 (Isolation)**: If Tier 1 fails, temporarily set `NO_PROXY='*'`, wait for 1 second (jitter), and retry.
3.  **Tier 3 (Clean up)**: Restore environment variables immediately.

This ensures that the engine can "self-heal" and bypass local network obstacles.

## 4. Resilience Architecture

The system remains protected by a **Quality Hard Lock** (Fail-Fast Gate). If even the lightweight protocol fails to deliver the "Required Dimensions" (Liquidity, Breadth, Sentiment), the Almanac generation is aborted to prevent misleading the user.

- **Status**: The engine now prioritizes **Correctness** over "Best Effort" incomplete rendering.
- **Fallback**: Automated fallback to the latest known historical facts with a `stale_fallback_used` flag ensures the UI doesn't break, while maintaining integrity.

## 5. Decision Reference

This pivot prioritizes **System Robustness (Reliability)** over **Granular Data Granularity**. While scraping provided more detail, the instability cost was too high. The aggregated protocol delivers sufficient market metadata for the Almanac while ensuring the system remains "Silicon-Smooth" and professional.

## 6. Implementation Checklist (Completed 2026-03-16)

- [x] **Refactor**: Remove `_fetch_a_spot` (deprecated scraping logic).
- [x] **New Source**: Implement `_fetch_breadth_stable` and `_fetch_total_turnover_stable`.
- [x] **Hardening**: Implement `_isolated_ak_fetch` for all core summary APIs.
- [x] **Verification**: Verify that `generate_market_facts` passes the gate in milliseconds.

---
**Document Status**: Finalized
**Owner**: Antigravity (Advanced Agentic Coding Team)
