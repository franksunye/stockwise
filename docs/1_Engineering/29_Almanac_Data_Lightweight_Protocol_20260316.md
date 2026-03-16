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

## 5. Data Provider Verification Plan

Before we "lock in" AkShare-based aggregation for the Yellow Pages (Almanac) experience, we maintain a standing **Data Provider Verification Plan**:

- **Scope**:
  - `ak.stock_market_activity_legu()` → Market breadth (advancers / decliners).
  - `ak.stock_zh_index_spot_em()` → SH000001 + SZ399001 intraday turnover.
  - `ak.stock_zh_index_daily_em()` → Core index trend (SH / SZ / CYB).
  - `ak.stock_zt_pool_em` / `ak.stock_zt_pool_dtgc_em` / `ak.stock_zt_pool_zbgc_em` → Limit-up / limit-down / broken-board stats.
- **Dimensions**:
  - **Structural Stability**: Field names and schema stability across trading days, weekends, and holidays.
  - **Temporal Availability**: Behaviour under different time windows (trading hours, overnight, weekends) and retry characteristics.
  - **Numerical Sanity**: Spot-check against exchange announcements / trusted dashboards (e.g. total turnover,涨跌家数, 涨跌停数量) with explicit tolerance bands.
  - **Network Robustness**: Success-rate comparison *with vs. without* `_isolated_ak_fetch` under local proxy / VPN environments.
- **Execution**:
  - A lightweight `scripts/audit_data_providers.py` job can be run locally or on a scheduled basis to:
    - Sample one or more dates.
    - Call the above endpoints in parallel.
    - Persist raw responses + metrics (status, latency, schema hash, key figures) into SQLite / CSV for offline review.
  - Findings are fed back into:
    - `market_facts_service` quality rules (e.g. stricter sanity checks).
    - Yellow Pages design (which metrics are "hard guarantees" vs. "best-effort").

## 6. Yellow Pages Capability Boundaries

To reconcile **technical stability** with the **Yellow Pages product vision**, we explicitly separate:

- **Guaranteed Signals (Hard-Contract)**:
  - Daily market liquidity envelope (total turnover and its 5D/20D context).
  - Market breadth and temperature (advancers / decliners, breadth ratio, high/low/flat volume regime).
  - Core index trend state (SH / SZ / CYB direction over 1D/5D/20D).
- **Best-Effort Signals (Soft-Contract)**:
  - Fine-grained sector flows and narrative (top inflow / outflow sectors, northbound fund structure).
  - Limit-up / limit-down statistics and broken-board rate.
  - Additional sentiment enrichments that depend on more fragile upstream APIs.

### 6.1 Special Stability Strategy: Capital Flow (Stable Anchor + Optional Detail)

Capital flow APIs are a frequent source of instability (SSL EOF, connection aborts, and rate-limit behaviour on sector-ranking endpoints).
To ship a stable Yellow Pages MVP, we apply a **Stable-Anchor** strategy:

- **Primary (Stable Anchor)**: Always attempt **broad market flow** first:
  - `ak.stock_market_fund_flow()` → `全市场主力(+/-X亿)`
- **Optional (Best-effort Sector Detail)**: Sector ranking enrichment is **disabled by default** and only enabled via an environment switch:
  - Tier 1: `ak.stock_sector_fund_flow_rank(indicator="今日", sector_type="行业资金流")`
  - Tier 2: `ak.stock_fund_flow_industry(symbol="即时")`

**Env Switch**:

- `YELLOWPAGES_SECTOR_DETAIL=0` (default): Only broad-market anchor is used; sector detail calls are skipped entirely.
- `YELLOWPAGES_SECTOR_DETAIL=1`: Enable best-effort sector details (may degrade without blocking Yellow Pages).

UI / content guidelines for Yellow Pages:

- If **Guaranteed Signals** are available and pass the fact-layer gate, the Almanac renders as "complete" even if best-effort modules are missing.
- If only **Best-Effort Signals** fail, the UI should:
  - Clearly mark those sections as "temporarily unavailable" or omit them gracefully.
  - Avoid blocking the overall Almanac generation.
- Any future Yellow Pages feature proposal must clarify:
  - Whether it relies solely on **Guaranteed Signals**, or also on **Best-Effort Signals**.
  - How it should degrade when best-effort data is absent.

## 7. Decision Reference

This pivot prioritizes **System Robustness (Reliability)** over **Granular Data Granularity**. While scraping provided more detail, the instability cost was too high. The aggregated protocol delivers sufficient market metadata for the Almanac while ensuring the system remains "Silicon-Smooth" and professional.

## 8. Implementation Checklist (Completed 2026-03-16)

- [x] **Refactor**: Remove `_fetch_a_spot` (deprecated scraping logic).
- [x] **New Source**: Implement `_fetch_breadth_stable` and `_fetch_total_turnover_stable`.
- [x] **Hardening**: Implement `_isolated_ak_fetch` for all core summary APIs.
- [x] **Verification**: Verify that `generate_market_facts` passes the gate in milliseconds.

---
**Document Status**: Finalized
**Owner**: Antigravity (Advanced Agentic Coding Team)
