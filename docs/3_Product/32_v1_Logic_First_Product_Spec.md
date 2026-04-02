---
title: "v1 Logic First 产品规格说明书 (Product Spec)"
doc_id: "product-spec-v1-logic-first"
doc_domain: "product"
doc_status: "draft"
owner: "founder"
last_reviewed_at: "2026-04-02"
summary: "定义 v1 阶段 (Free, Go, Plus) 的核心交互逻辑、国际化标准、智力分发路由及信任验证 UI 规范。"
---

# v1.0 "Logic First" 产品规格说明书 (Product Spec)

> **核心使命**：将产品的认知负担降至最低，将 AI 的推理逻辑魅力放至最大。通过这一 Spec，建立散户对 StockWise 逻辑确定性的底层信任。

## 0. 产品大规划与阶段定义 (Vision & Roadmap)

我们通过三个大阶段实现从“认知驱动”到“执行驱动”的演进：

*   **v1.0 [本期目标]: 发现与解释 (Discovery & Reasoning)**
    *   **核心**: 利用 LLM 进行行情信号发现与叙事化逻辑解释。
    *   **阶梯发布序列 (Sub-Phasing)**:
        *   **v1.0 (ZH Initial)**: 首发 Free & Go 中文版。覆盖 A 股/港股。验证 AI 逻辑解释权在国内市场的变现。
        *   **v1.1 (EN Preview)**: 推出英文版 UI。AI 推理报告支持 English，但暂不接入美股数据。
        *   **v1.2 (Global Full)**: 正式支持美股 (US) 市场数据。开启全球化营销与 Plus 档位推广。
    *   **并行任务**: 升级英文版官站 (`ziso.cc/en`)，同步完成 101 学院核心内容的英文化。
    *   **目标**: 解决“为什么买”的信任问题，提供跨市场的逻辑透明度。
*   **v2 [中远期]: 量化与管理 (Quant & Management)**
    *   **核心**: 引入量化引擎与自动化交易管理逻辑。
    *   **价值项目**: Pro。
    *   **目标**: 解决“怎么管好”的闭环问题，将逻辑转化为纪律执行。
*   **v3 [终局]: 优化与超越 (Alpha Optimization)**
    *   **核心**: 全自动对冲与算力独占，追求行业领先的阿尔法收益。
    *   **价值项目**: Alpha。
    *   **目标**: 解决“持续超额赢”的终极问题，超越行业标准。

---

## 1. 核心交互逻辑与界面简化 (UI & Interaction)

### 1.1 逻辑研判 (Actionable Insights) - 核心单 Tab 架构
*   **重命名与合并**：废弃原有的“择时”与“决议”双标签，在 `TacticalBriefDrawer.tsx` 中通过 `activeTab === 'brief'` 统一展示。
*   **UI 布局规格**：
    *   **顶部：Actionable Insights 动作锚点**。清晰展示单模型的建议动作（看多/观察/防守）与置信度。
    *   **中部：操盘预案卡片**。维持原有的 Scenarios 滚屏体验。
    *   **底部：研判依据 (Rationale)**。根据用户等级动态渲染。
*   **代码隔离策略**：对于 **v1.0 用户** (Free/Go/Plus)，在 `TacticalBriefDrawer.tsx` 的 Header 中利用 `tier !== 'pro' && tier !== 'alpha'` 动态隐藏 `management` 标签按钮。

### 1.2 简化决策流规格 (v1 Simplified Resolution)
在 v1 阶段，我们取消复杂的“联席会议”交互，直接转化为不同深度的“后台计算路由”：

| 等级 (Tier) | 研判引擎规格 | 用户感知的“研判依据” |
| :--- | :--- | :--- |
| **Free** | 单 LLM (Hunyuan Lite) | **研判摘要**：极简逻辑支撑点。 |
| **Go** | 单 LLM (DeepSeek-R1) | **深度推演**：展示 AI 完整的思考轨迹 (`thought` 过程)。 |
| **Plus** | 双 LLM (DS + Gemini) | **专家共识**：展示两个顶级模型的意见重合点与潜在分歧点。 |

---

## 2. 国际化与全球市场规格 (Globalization & Markets)

### 2.1 UI 多语言 (i18n UI)
*   **技术标准**：基于 `next-intl` 实现映射。支持 `zh` (简体中文) 和 `en` (英文)。
*   **覆盖范围**：
    *   静态菜单、标签名。
    *   动态系统提示语（Toast, Alert）。
    *   **101 学院 / 大师系列** 在 v1 阶段优先翻译核心高频章节。

### 2.2 AI 推理多语言 (Reasoning i18n)
*   **提示词分发**：在 `brief_strategies.py` 的 `get_system_prompt` 中引入 `locale` 参数：
    *   `if locale == 'en': output_language = 'English'`
*   **模板实现**：在 `prompts/briefs/system_*.j2` 中增加 Jinja2 分支逻辑，强制约束 LLM 在解析美股标的时采用全英文叙事。

### 2.3 跨市场数据接入 (Market Data)
*   **A股 / 港股**：维持现有数据源。
*   **美股 (NASDAQ/NYSE)**：通过 `yfinance` 实现高频刷新（v1 阶段为 1 小时/次或日线级）。满足全球化逻辑预测。

---

## 3. 研备引擎与模型路由规格 (Reasoning Engine Spec)

系统后端通过 `ModelRouter` 依据用户内部代号 (v1/v2) 与 Tier 派发算力资源：

| 方案 (Tier) | 内部阶段 | 研备引擎路由 (LLM Registry Role) | 研判详情 (Rationale) 表现 |
| :--- | :--- | :--- | :--- |
| **Free** | **v1** | `brief_free` (Hunyuan Lite) | **极简版**：纯文本动作摘要。 |
| **Go** | **v1** | `brief_go` (DeepSeek-R1) | **推演版**：展示实时 `thought` 推理过程。 |
| **Plus** | **v1** | `brief_plus` (Gemini + DS) | **共识版**：双模型交叉复核，展示共识点。 |
| **Pro** | **v2** | **AI + 量化规则引擎** | **双轨版**：AI 逻辑研判 + 量化硬规则校验。 |
| **Alpha** | **v3** | **全私有化算力独占** | **优化版**：极致择时与成本防御。 |

---

## 4. 信任与验证 UI 规格 (Trust & Validation)

### 4.1 逻辑验证勋章 (The Performance Badge)
*   **背景数据**：读取 `AIPrediction.max_perf_in_window` 与 `validation_status`。
*   **UI 规范**：
    *   **位置**：AICouncil 卡片右上角。
    *   **样式**：
        *   `Verified ✅`: 信号发出后 T+3 股价达到预期。
        *   `Performance +5.2%`: 显性化最大涨幅。
    *   **色值**：验证通过使用 ZISO Green (#34D399)，未通过不显示勋章。

### 4.2 Time Machine (历史回溯)
*   **功能**：允许用户查看 3 天前的 AI 推理原件，并与当前的股价走势进行“逻辑复查”。
*   **目的**：证明逻辑的真实性与确定性，而非“事后诸葛亮”。

---

## 5. 资源容量分发 (Quota Management)

| 等级 | 自选容量 (席位) | 分析频率 |
| :--- | :--- | :--- |
| **Free** | 3 只 | EOD (盘后) |
| **Go** | 10 只 | EOD (盘后) + 重要节点推送 |
| **Plus** | 10 只 | EOD (盘后) + 交易时间动态感知 |

---

## 6. 物理实现指南 (Technical Implementation Guide)

为了确保 Spec 的落地性，本手册直接锚定以下物理文件：

| 业务逻辑 | 核心物理路径 (File Path) | 实现要点 |
| :--- | :--- | :--- |
| **UI 合并与隐藏** | `frontend/src/components/dashboard/TacticalBriefDrawer.tsx` | 修改 `activeTab` 指向与 `tier` 过滤。 |
| **分级智力路由** | `backend/engine/llm_registry.py` | 向 `prediction_models` 表注入新 `roles`。 |
| **推理报告策略** | `backend/engine/models/brief_strategies.py` | 处理 `tier` 到 `role` 的映射及其模板注入。 |
| **English 推理模板** | `backend/prompts/briefs/system_*.j2` | 增加基于 `locale` 的语言指令分支。 |
| **跨市场接入配置** | `backend/management/research/market_routing.py` | 新增 `US` 市场元数据项（yfinance 适配）。 |

---

**备注**：本 Spec 随着 v1 内测反馈动态调整。任何代码层面的 v1 开发必须以此为最终版本依据。
