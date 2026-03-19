---
title: "投资模式：切换你的策略风格"
content_id: "support-investment-mode-config"
content_source: "support"
content_type: "guide"
canonical_role: "canonical"
category: "交互与导航"
lastUpdated: "2026-03-09"
source_docs:
  - docs/3_Product/Specs/47_Investment_Mode_Product_Layer.md
funnel_stage: "BOFU"
campaign_role: "conversion"
campaign: "wechat_4_week_sprint_2026q2"
date: "2026-03-19"
traceability:
  status: "healthy"
  last_reviewed_at: "2026-03-19"
workflow:
  stage: "reviewing"
  owner: "cmo"
  reviewer: "founder"
  priority: "high"
  target_publish_date: "2026-04-21"
  last_action_at: "2026-03-19"
  blocked_reason: ""
maintenance:
  change_status: "updated"
  update_reason: "product_change"
website:
  enabled: true
  surface: "support"
distribution:
  wechat:
    enabled: true
    status: "draft"
---

为了满足不同风格的用户，我们将复杂的后台策略库封装成了可理解、可选择、可执行的 **投资模式 (Investment Mode)**。

> *"风险敞口没有对错，只有是否符合你的睡眠阈值 (Sleep Threshold)。"*

### 🟢 稳健 (Steady/Defensive - 保本优先)
*   **定位**：将“绝不发生回撤超 5%”视为第一铁律，追求极端容错。
*   **逻辑**：极大收缩止损阈值（如同重塔盾），取消所有左侧猜底，只在结构形成极其完美的纯右侧长阳上给出绿灯。
*   **代价**：会频繁被市场小震荡“洗盘”出局，牺牲部分鱼头利润。

### 🟡 平衡 (Balanced - ZISO 默认推演)
*   **定位**：覆盖度与准确性的黄金分割，追求长周期夏普比率 (Sharpe Ratio)。
*   **逻辑**：容忍健康的拉回洗盘，只在逻辑面发生根本反转或趋势出现断头侧刀时强行介入。

### 🔴 进取 (Aggressive/Berserker - 狂战士模式)
*   **定位**：回撤耐受极强，寻求抓极高波动的波段机会。
*   **逻辑**：极大地拉宽滑点容忍带，在大波动内 AI 不会频繁干扰报警。
*   **重申底线**：即使在此模式下，一旦触发“流动性枯竭”或“逻辑破产”，ZISO 依然会跨越偏好直接发出致命的 🔴 Kill 信号。

### ⚪ 仅观察 (Observe Only)
*   **定位**：仅保留结构级判定，不提供任何进场建议。

---

每个模式都有其专属的 **评估周期 (Default Horizon)**。在个页中心可以一键通过“乐观 UI (Optimistic UI)”实现策略逻辑实时重算。

**注意：风格漂移是量化之大忌。** 请勿在交易遇到阶段性阻力时随意更改投向，量化的核心是策略的复利，而非情绪的波动。
