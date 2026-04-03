---
title: "Investment Mode: Switching Your Strategy Style"
subtitle: "Align Your Risk Aperture with Your Sleep Threshold"
date: "2026-03-19"
image: "/images/support/investment-mode-config_cover.png"
content_id: "support-investment-mode-config"
content_source: "support"
content_type: "guide"
canonical_role: "canonical"
category: "Features"
funnel_stage: "BOFU"
rhythm: "Hub"
source_docs:
  - docs/3_Product/Specs/47_Investment_Mode_Product_Layer.md
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

To satisfy different user profiles, we have encapsulated our complex backend strategy library into understandable and actionable **Investment Modes**.

> *"There is no right or wrong risk exposure—only what fits your Sleep Threshold."*

### 🟢 Steady (Defensive - Capital Preservation First)
*   **Goal**: Treats the "Never exceed a 5% drawdown" rule as an iron law.
*   **Logic**: Significantly tightens stop-loss thresholds and ignores "bottom-fishing" attempts. Only gives a green light for perfect right-side breakouts with strong structural support.
*   **Trade-off**: Frequent "whipsaws" during minor market volatility, potentially sacrificing early-stage gains for absolute safety.

### 🟡 Balanced (The ZISO Default)
*   **Goal**: The Golden Ratio of coverage and accuracy, seeking a superior long-term Sharpe Ratio.
*   **Logic**: Tolerates healthy pullbacks and shakeouts. Only intervenes forcefully when fundamental logic reversals occur or if the trend suffers a major break.

### 🔴 Aggressive (Berserker Mode)
*   **Goal**: High drawdown tolerance, seeking swing opportunities in highly volatile environments.
*   **Logic**: Broadens slippage tolerance bands, allowing the AI to remain "silent" during larger price swings to capture extended runs.
*   **The Red Line**: Even in this mode, if ZISO detects "Liquidity Exhaustion" or "Logic Bankruptcy," it will bypass preferences and issue a lethal 🔴 **Kill** signal.

### ⚪ Observe Only
*   **Goal**: Pure structural assessment without entry suggestions.

---

### Key Takeaway: Avoid Style Drift
Each mode has its own **Default Horizon**. You can trigger real-time logic recalculation via the **Optimistic UI** in the individual stock center.

**Warning: Style drift is a cardinal sin in quantitative trading.** Avoid switching modes simply because a trade is facing temporary resistance. The power of quant lies in the compounding of the strategy, not the volatility of your emotions.

---
*ZISO AI: AI does the research. You keep the decision.*
