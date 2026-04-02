---
title: "投研决议：多维度的共识"
content_id: "support-ai-council-logic"
content_source: "support"
content_type: "guide"
canonical_role: "canonical"
lastUpdated: "2026-03-18"
source_docs:
  - docs/1_Engineering/25_AICouncil_Collaboration_Routes_20260318.md
category: "Engine"
funnel_stage: "BOFU"
traceability:
  status: "healthy"
  last_reviewed_at: "2026-03-19"
workflow:
  stage: "published"
  owner: "cmo"
  reviewer: "founder"
  priority: "high"
  target_publish_date: "2026-03-19"
  last_action_at: "2026-03-19"
  blocked_reason: ""
maintenance:
  change_status: "review_needed"
  update_reason: "product_change"
  external_action: "publish_replacement"
  external_status: "in_progress"
  external_note: "公众号旧文仍沿用“智囊团”历史语义，建议以“投研决议”现行口径重发替代说明。"
content_lifecycle:
  status: "active"
  superseded_by: "wechat: 投研决议（现行版，待发布）"
website:
  enabled: true
  surface: "support"
distribution:
  wechat:
    enabled: true
    status: "published"
    url: "https://mp.weixin.qq.com/s/NuvCM1CRxNs1GfKvIiotow"
    published_at: "2026-02-18"
    baseline: "frontline_q1_2026"
date: "2026-03-19"
---

在个股详情页的"投研决议" (AI Council) 面板中，你可以看到来自多位不同背景分析师的意见，分为两种类型：

**复核意见**：分析师基于量化工程底座（沈策提供）的输入，对照自身分析框架做出的复核与分歧说明。

**独立判断**：分析师基于自身分析模型或规则的原始结论。

补充理解：

- 有些成员会直接给出自己的独立判断
- 有些成员会基于共享的量化事实做复核、解读与转述
- 系统最终对用户展示的是综合后的投研决议，而不是把所有成员都当成同一种角色

### 团队成员

- **顾深 (DeepSeek V3)**：资深分析师，专注于逻辑链条的深度推演与形态拆解。其独立判断卡片保留 AI 原始分析视角。
- **林序 (混元 Lite)**：初级分析师，擅长多维度趋势捕捉与辅助解读。
- **程矩 (量化规则)**：初级规则分析师，基于独立的趋势跟踪规则（TrendStrategy）产出规则侧判断。
- **沈策 (Quant Engineer)**：量化工程师，提供 Layer-1 量化模型底座（Tradeability 状态机），不作为前台主要露出角色。

### 协作线路

- 沈策的量化底座为所有分析师提供统一的市场事实输入（技术指标、共振评分、关键位）。
- 顾深、林序既可以提供 AI 侧独立判断，也可以承担对量化事实和系统结论的解读职能。
- 程矩代表规则侧视角，拥有独立于 Layer-1 的 TrendStrategy 规则集。
- 投研决议的共识由多种独立视角的交叉验证形成，而非单一模型的复制。

这种"分析侧 + 规则侧 + 工程底座"的架构，确保结论既有 AI 的解释力，也保留量化系统的稳定性。
