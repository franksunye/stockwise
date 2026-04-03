---
title: "Zero-Stale Protocol: Never Trust Old Data"
subtitle: "Prioritizing Fidelity Over Speed for Real-Time Accuracy"
date: "2026-03-19"
image: "/images/support/zero-stale-guarantee_cover.png"
content_id: "support-zero-stale-guarantee"
content_source: "support"
content_type: "guide"
canonical_role: "canonical"
category: "Engineering & Precision"
funnel_stage: "BOFU"
rhythm: "Hygiene"
source_docs:
  - docs/1_Engineering/28_Price_Sync_Zero_Stale_Protocol_20260316.md
traceability:
  status: "healthy"
  last_reviewed_at: "2026-04-03"
workflow:
  stage: "published"
  last_action_at: "2026-04-03"
maintenance:
  change_status: "updated"
  update_reason: "ziso_standard_upgrade"
website:
  enabled: true
  surface: "support"
distribution:
  wechat:
    status: "none"
---

When refreshing prices, ZISO prioritizes one rule: **"Never present stale data as new."**

If the latest price point hasn't been retrieved, the system would rather wait briefly than risk displaying a previous cache cycle as the current state.

### What Problem Does It Solve?

- **Ghost Data**: Prevents edge or browser caches from misrepresenting old prices as "live."
- **Timestamp Lag**: Ensures that even if the page is open for a long period, you aren't looking at data from an hour ago without a warning.
- **Network Jitter**: Prevents "flickering" where old data makes the signal look valid when it has actually expired.

### How It Works

1.  **Cache Bypassing**: Price requests are appended with unique timestamp parameters to bypass aggressive edge caches.
2.  **Explicit Headers**: API responses explicitly return `no-store / no-cache` headers to minimize middle-layer pollution.
3.  **Tiered Processing**: 
    - **Price Pipeline**: Returns the raw, fastest database state without overhead.
    - **Decision Pipeline**: Maintains a short server-side cache for heavy AI reasoning to prevent page weight issues.
4.  **Validation**: If the returned data timestamp doesn't match the browser's current reality window, the UI will treat it as "Loading/Missing" rather than forcing the display of a stale result.

### What You Will Experience

- **Higher Fidelity**: Prices are far less likely to get "stuck" during market hours.
- **Honest Loading**: If data is delayed, you'll see a loading state or a refresh prompt rather than a fake "Live" status.

### Our Design Principles

- **Wait for truth, don't mask with stale data.**
- **Fidelity over vanity "instant" loads.**
- **Segmented rendering for real-time accuracy.**

---
*ZISO AI: AI does the research. You keep the decision.*
