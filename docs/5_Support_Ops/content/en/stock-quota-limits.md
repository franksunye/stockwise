---
title: "Stock Quota Limits: Compute Resource Calculation"
subtitle: "Attention is Scarce, Compute is Expensive"
date: "2026-03-19"
image: "/images/support/stock-quota-limits_cover.png"
content_id: "support-stock-quota-limits"
content_source: "support"
content_type: "guide"
canonical_role: "canonical"
category: "Support Ops"
funnel_stage: "BOFU"
rhythm: "Hygiene"
source_docs:
  - docs/3_Product/31_Membership_Design_Plan.md
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

> *"Focus is finite. When you are watching 50 targets, you are effectively watching nothing."*

### Core Philosophy
In ZISO, you cannot indiscriminately add hundreds of stocks to a "watchlist" as you might in generic brokerage apps. We enforce strict "slot" limits for both Free and Pro tiers. This isn't just about encouraging upgrades—it's a dual constraint of our core philosophy and engineering architecture.

---

### 🎯 The Philosophy of Constraint

#### 1. Focus Horizon
A professional hunter only selects the most high-conviction, asymmetric targets. Being distracted by 50 different tickers moving up and down daily leads to information overload and "fidgety" over-trading.
-   **Free Tier**: Limited to **3 slots**. If you cannot master 3 carefully selected battlegrounds, more slots will only lead to confusion.
-   **Pro Tier**: Expanded to **10+ slots** (depending on the specific plan). This represents the physical limit of human cognitive bandwidth when monitoring high-velocity market rotations.

#### 2. Parallel LLM Quota Lock
Unlike traditional software that only calculates static indicators, every ticker added to your ZISO observation library triggers a massive backend workload:
-   **L1 Time-Series Analysis**: Continuous recalculation of trend boundaries.
-   **L2 Semantic Reasoning**: Real-time cross-model logical deduction (DeepSeek-V3).

Even if you add just one more stock, the system must process thousands of tokens every few minutes to maintain the reasoning depth you expect. **Therefore, stock quota slots are essentially compute resource allocations.** Greedy or inefficient use of server resources is not permitted in this ecosystem.

---
*ZISO AI: AI does the research. You keep the decision.*
