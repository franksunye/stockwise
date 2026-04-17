# 知守 AI (ZISO AI) 知识库 (Single Source of Truth)

This directory serves as the unified single source of truth for the 知守 AI (ZISO AI) 产品项目, covering product strategy, architecture design, AI logic, and operations/growth.

## 📁 Core Directory Structure

### [0_Strategy/](./0_Strategy/) - Why & Who
> Project "Soul": Business vision, monetization, and team roles.
- [Product & Business Vision](./0_Strategy/00_Product_Business_Vision.md)
- [Product Positioning & Boundaries](./0_Strategy/01_Product_Positioning_and_Boundaries.md)
- [Monetization & Pricing Strategy](./0_Strategy/02_Monetization_Pricing_Strategy.md)
- [Team Responsibility Matrix](./0_Strategy/03_Team_Responsibility_Matrix.md)
- [Milestones & Execution Log](./0_Strategy/04_Milestones_Execution_Log.md)
- [Quant Signal and Execution Axioms](./0_Strategy/05_Quant_Signal_and_Execution_Axioms.md)
- [Quant Industry Positioning Map](./0_Strategy/06_Quant_Industry_Positioning_Map.md)
- [GTM & Growth Roadmap](./0_Strategy/07_Growth_and_GTM_Roadmap.md)
- [Globalization Strategy & Evolution](./0_Strategy/08_Globalization_Strategy_and_Evolution.md)
- [Decision Stack & Producer Architecture](./0_Strategy/09_Decision_Stack_and_Producer_Architecture.md)

### [1_Engineering/](./1_Engineering/) - How (System)
> Project "Backbone": System architecture, reliability, and quality standards.
- [Architecture (As-Is & To-Be)](./1_Engineering/10_Architecture.md)
- [Reliability & Quality Gates](./1_Engineering/11_Reliability_Protocol.md)
- [Quant-Engine Architecture](./1_Engineering/13_Quant_Engine_Architecture.md)
- [Investment Mode Backend Runbook](./1_Engineering/14_Investment_Mode_Backend_Runbook.md)
- [Decision Data Model Architecture](./1_Engineering/21_Decision_Data_Model_Architecture.md)
- [Capacity Planning & Scaling Strategy](./1_Engineering/31_Capacity_Planning_And_Scaling_Strategy_20260317.md) *(主路线图：做什么/何时做)*
- [Frontend Network Zero-Redundancy](./1_Engineering/32_Frontend_Network_Optimization_Zero_Redundancy.md) *(前端专项实现细则)*
- [Cloudflare Workers Migration POC](./1_Engineering/33_Cloudflare_Workers_Migration_POC_20260318.md) *(POC 证据与测量数据，不是实施主计划)*
- [Stock News Fetching Implementation](./1_Engineering/33_Stock_News_Fetching_Implementation.md)
- [Dashboard Page Refactoring Design](./1_Engineering/34_Dashboard_Page_Refactoring_Design.md)
- [Broadcast Layer A Operations Runbook](./1_Engineering/35_Broadcast_LayerA_Operations_Runbook_20260319.md) *(上线运行与应急收口标准)*
- [International V1 Release Engineering Review](./1_Engineering/45_International_V1_Release_Engineering_Review_20260411.md) *(国际版 v1 发布前工程检查清单与当前结论)*
- [International Onboarding Performance Optimization Plan](./1_Engineering/46_International_Onboarding_Performance_Optimization_Plan_20260416.md) *(国际版 invite/OB 首屏性能专项，只收问题、测量口径、优化范围与验收标准)*
- [Decision Model Implementation Plan](./1_Engineering/39_Decision_Model_Implementation_Plan_20260325.md)
- [Trade Management Research Architecture](./1_Engineering/42_Trade_Management_Research_Architecture_20260327.md)

### Current Source of Truth: Investment Mode / Tradeability
- [Dual-Lane Operations](./2_Intelligence/27C_Dual_Lane_Operations_Manual.md)
- [Investment Mode Backend Runbook](./1_Engineering/14_Investment_Mode_Backend_Runbook.md)
- [Investment Mode Product Layer](./3_Product/Specs/47_Investment_Mode_Product_Layer.md)
- [Admin Tradeability Control Tower](./3_Product/Specs/48_Admin_Tradeability_Control_Tower.md)

### [2_Intelligence/](./2_Intelligence/) - How (Brain)
> Project "AI Logic": Prompt engineering, model strategies, and core algorithms.
- **[Quant Strategy & Methodology]**
  - [Methods & Masters Research Framework](./2_Intelligence/22Q_Quant_Research_Framework.md)
  - [Method Registry Design](./2_Intelligence/23Q_Method_Registry_Design.md)
- [Dual-Lane Operations Manual](./2_Intelligence/27C_Dual_Lane_Operations_Manual.md)
- [AI Context Limits (DeepSeek)](./2_Intelligence/25A_AI_Context_Limits_DeepSeek.md)
- [Quant + AI Acceptance Criteria](./2_Intelligence/26C_Quant_AI_Acceptance_Criteria.md)
- [Quant Backtesting Methodology](./2_Intelligence/28Q_Quant_Backtesting_Methodology.md)
- [Trade Management Research Framework](./2_Intelligence/30Q_Trade_Management_Research_Framework.md)
- [Validation Logic Research (Legacy)](./2_Intelligence/31Q_Validation_Logic_Research_Legacy.md)

### [3_Product/](./3_Product/) - What & UX
> Project "Body": Feature manifest and specific product delivery specs.
- [Features Manifest](./3_Product/03_Product_Features_Manifest.md)
- [Membership Design Plan](./3_Product/31_Membership_Design_Plan.md)
- [Nightly Plan Feature Spec](./3_Product/32_Nightly_Plan_Feature_Spec.md)
- **[Specs/](./3_Product/Specs/)**
  - [Quant/AI Dual-Layer UX (40)](./3_Product/Specs/40_Quant_AI_Dual_Layer_UX.md)
  - [Stock Radar (45)](./3_Product/Specs/45_Stock_Radar_Discovery_Engine.md)
  - [SWR Architecture (46)](./3_Product/Specs/46_Frontend_SWR_Architecture_Upgrade.md)
  - [Investment Mode Product Layer (47)](./3_Product/Specs/47_Investment_Mode_Product_Layer.md)
  - [Admin Tradeability Control Tower (48)](./3_Product/Specs/48_Admin_Tradeability_Control_Tower.md)
  - [Phase 3 Protection (41)](./3_Product/Specs/41_Phase3_Protection_Spec.md)

### [4_Growth_Ops/](./4_Growth_Ops/) - Growth
> Project "Energy": Marketing, content, and user operation workflows.
- [Annual Content Strategy 2026](./4_Growth_Ops/40_Annual_Content_Strategy_2026.md)
- [Growth Content Alignment Checklist](./4_Growth_Ops/41_Growth_Content_Alignment_Checklist.md)
- [Chinese SEO/GEO Foundation Plan](./4_Growth_Ops/43_Chinese_SEO_GEO_Foundation_Plan.md)
- [Content Traceability Matrix](./4_Growth_Ops/44_Content_Traceability_Matrix.md)
- [Traceability Debt Cleanup Plan](./4_Growth_Ops/45_Traceability_Debt_Cleanup_Plan.md)
- [User Invitation Campaign Plan](./4_Growth_Ops/45_User_Invitation_Campaign_Plan.md)
- [Content Operations Master Guide](./4_Growth_Ops/46_Content_Operations_System_Blueprint.md)
- [Content Operations Registry](./4_Growth_Ops/content/README.md)
- [Learn Center: ZISO 101 Syllabus](./4_Growth_Ops/content/ZISO_101_SYLLABUS.md)
- **[content/](./4_Growth_Ops/content/)** (Original Learn Center Case Studies)
- **[wechat-drafts/](./4_Growth_Ops/wechat-drafts/)** (Drafts for Support Center Articles)

### [5_Support_Ops/](./5_Support_Ops/) - Support
> Project "Shield": Support Center content, troubleshooting, and user outcome alignment.
- **[content/](./5_Support_Ops/content/)** (Official Support Center Articles)
  - [投研决议逻辑 (Investment Decision)](./5_Support_Ops/content/ai-council-logic.md)
  - [策略内参指南 (Tactical Brief)](./5_Support_Ops/content/tactical-brief-guide.md)
  - [四态语义释义 (Four States)](./5_Support_Ops/content/four-states-semantics.md)
  - [四态语义验证规则 (Validation Rules)](./5_Support_Ops/content/four-state-validation-rules.md)
  - [双轨制架构说明 (Dual-Lane)](./5_Support_Ops/content/dual-lane-architecture.md)
  - [投资模式配置 (Investment Mode)](./5_Support_Ops/content/investment-mode-config.md)

### [6_UX_Mockups/](./6_UX_Mockups/) - Body (UI)
> Project "Visuals": Screen mockups, navigation flows, and UI component designs.
- [User Center Notification Upgrade](./6_UX_Mockups/01_User_Center_Notification_Upgrade.md)

---

## 🛠️ Maintenance Guidelines
1. **Backlog Driven**: For daily tasks and brainstorming, refer to [Backlog.md](./Backlog.md).
2. **Archiving Principle**: Move outdated or deprecated plans to `archive/` subdirectories.
3. **Consistency Checks**: When code implementation conflicts with documentation, the code takes precedence. Always update documentation promptly to reflect actual implementations.

## 🗂️ Document Lifecycle Rules
1. **Strategy 只写长期原则**：放在 `0_Strategy/`，避免混入事故细节、阶段性补丁和临时验证日志。
2. **Engineering 只写实现与专项**：放在 `1_Engineering/`，适合架构、故障复盘、性能专项、发布 gate；不承载渠道投放执行。
3. **Product Specs 只写功能定义**：放在 `3_Product/Specs/`，说明产品行为边界，不记录临时事故修复过程。
4. **Growth/Ops 只写渠道与运营执行**：放在 `4_Growth_Ops/`，适合 launch plan、campaign plan、内容运营，不承载底层技术根因。
5. **Support 内容只写用户可消费口径**：放在 `5_Support_Ops/content/`，不写内部实现细节。
6. **同主题长期演进才续写旧文档**：如果仍是同一长期主题、旧文档仍是当前主依据，可以续写。
7. **独立专项新建短文档**：如果是一次有明确时间窗口、目标和验收标准的专项，单独新建文档，不继续把旧文档堆大。
8. **主路径只保留当前有效版本**：历史方案、旧事故稿、已被替代的执行稿，默认迁到 `archive/`，不要留在主路径混淆判断。
9. **删除是最后手段**：只有明显重复、无引用价值、且不会再作为审计材料的草稿才删除；默认优先归档。
10. **新文档必须写清范围**：开头必须说明“解决什么 / 不解决什么 / 验收什么”，避免再次膨胀成混合文档。

---
**Last Updated**: April 16, 2026
