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

### [1_Engineering/](./1_Engineering/) - How (System)
> Project "Backbone": System architecture, reliability, and quality standards.
- [Architecture (As-Is & To-Be)](./1_Engineering/10_Architecture.md)
- [Reliability & Quality Gates](./1_Engineering/11_Reliability_Protocol.md)
- [Quant-Engine Architecture](./1_Engineering/13_Quant_Engine_Architecture.md)
- [Investment Mode Backend Runbook](./1_Engineering/14_Investment_Mode_Backend_Runbook.md)
- [Stock News Fetching Implementation](./1_Engineering/33_Stock_News_Fetching_Implementation.md)
- [Dashboard Page Refactoring Design](./1_Engineering/34_Dashboard_Page_Refactoring_Design.md)

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
- [Missing Features & Optimization Plan](./4_Growth_Ops/51_Missing_Features_Plan.md)
- [Annual Content Strategy 2026](./4_Growth_Ops/52_Annual_Content_Strategy_2026.md)
- [Chinese SEO/GEO Foundation Plan](./4_Growth_Ops/53_Chinese_SEO_GEO_Foundation_Plan.md)
- [SEO/GEO Execution Log 2026Q1](./4_Growth_Ops/54_SEO_GEO_Execution_Log_2026Q1.md)
- [User Invitation Campaign Plan](./4_Growth_Ops/55_User_Invitation_Campaign_Plan.md)
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

---
**Last Updated**: March 18, 2026
