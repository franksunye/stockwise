# StockWise 文档索引

本目录用于维护产品、商业、工程与运营的统一事实源（single source of truth）。

## 🗂️ 文档命名与归类规范 (Naming Convention)

根目录下的文档第一位数字代表其所属的业务/层级维度：

- **0x 系列：产品战略与大盘总纲 (Strategy & Vision)**
  - 最顶层的商业规划、产品形态基线和执行记录（如 `00_Product_Business_Vision.md`、`03_Product_Features_Manifest.md`）。
- **1x 系列：核心架构与技术基建 (Architecture & Infra)**
  - 全栈架构图、系统降级与可靠性规范、数据库设计（如 `10_Architecture.md`）。
- **2x 系列：AI 引擎与算法策略 (AI & Prompts)**
  - 系统的智力核心，如 Prompt 架构、量化策略（如 `20_AI_Prompt_Design.md`）。
- **3x 系列：交互体验与触达层 (Experience & Notification)**
  - 与用户直接接触的 UI/UX 原则、推送和运营机制（如 `30_Notification_Strategy_Design.md`）。
- **4x 系列：具体专项功能研发 (Feature Sub-Specs & Research)**
  - 各阶段、各模块的具体落地设计方案，随做随归档（如 `41_Phase3_Protection_Spec.md`）。
- **5x 系列：市场增长与内容运营 (Marketing, Growth & Ops)**
  - 获客、内容营销、推广规划大纲文档（如 `50_Growth_Roadmap_333_Plan.md`）。

*提示：6x ~ 8x 原则上留空，用于日后开放平台接入、合规审计、客服体系等扩展项；日常灵感汇总使用 `Backlog.md`。*

---

## 核心文档

1. [00_Product_Business_Vision.md](./00_Product_Business_Vision.md)
2. [01_Monetization_Pricing_Strategy.md](./01_Monetization_Pricing_Strategy.md)
3. [03_Product_Features_Manifest.md](./03_Product_Features_Manifest.md)
4. [10_Architecture.md](./10_Architecture.md)
5. [11_Reliability_Protocol.md](./11_Reliability_Protocol.md)
6. [30_Notification_Strategy_Design.md](./30_Notification_Strategy_Design.md)

## 内容与增长

1. `docs/content/`：年度与月度内容矩阵、长文素材。
2. `docs/wechat-drafts/`：Support Center 与社媒草稿源文件。

## 归档与历史

1. `docs/archive/`：历史方案与旧里程碑，仅供追溯，不作为当前实现依据。
2. 当前有效实现以代码与“核心文档”中的最新版为准。

