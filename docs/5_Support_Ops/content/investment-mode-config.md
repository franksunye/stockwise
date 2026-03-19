---
title: "投资模式：切换你的策略风格"
category: "交互与导航"
lastUpdated: "2026-03-09"
source_docs:
  - docs/3_Product/Specs/47_Investment_Mode_Product_Layer.md
funnel_stage: "BOFU"
date: "2026-03-19"
publish:
  wechat:
    status: "none"
---

为了满足不同风格的用户，我们将复杂的后台策略库封装成了可理解、可选择、可执行的 **投资模式 (Investment Mode)**：

- **平衡 (Balanced)**：覆盖度与准确性的黄金分割，系统的默认推荐。
- **稳健 (Steady)**：回撤优先，风险评级低波动，仅在胜率极高时给出指令。
- **进取 (Aggressive)**：覆盖度优先，可接受更高波动，捕捉更多的波段机会。
- **仅观察 (Observe Only)**：仅保留结构级判定，不提供任何进场建议。

每个模式都有其专属的 **评估周期 (Default Horizon)**（如 30天）。在个页中心可以一键通过“乐观 UI (Optimistic UI)”实现策略逻辑实时重算。
你可以根据自己的胃望，灵活切换你的风险承受能力。
