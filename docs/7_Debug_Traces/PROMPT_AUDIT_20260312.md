# Prompt Engineering Audit & Analysis (2026-03-12)

本位档记录了在审计 2026-03-12 线上 DeepSeek Trace 数据时发现的提示词工程 (Prompt Engineering) 问题及优化建议。

## 1. 逻辑误导：错配的“回填模式” (Backfill Mode)
*   **现象**：在旧版 `prompts.py` 中，只要传入了 `as_of_date` 参数，系统就会自动在提示词中加入 `👉 回填模式：请假装今天是 2026-03-12...`。
*   **问题**：即使在生产环境的当日增量预测中，任务调度器也会显式传入 `as_of_date`。这导致 AI 在处理**真实当天数据**时，杯强行戴上了“假装”和“测试”的帽子。
*   **风险**：AI 可能会因此降低“实战警觉性”，产生模拟感，或在推理时变得机械，因为它认为这可能是一次历史回测而非真实交易。
*   **优化建议**：保留 `as_of_date` 作为“分析基准日”参数，但文案统一为“历史复盘模式：本次分析基准日为 X，仅基于该日及之前数据判断”。若为当日实时场景，则使用 `👉 实时分析`。

> 更新说明（2026-03-12）：
> 当前主链已完成第一轮修复，不再使用“请假装今天是 ...”的提示语气。本节保留原表述，是为了记录审计时发现的旧问题。

## 2. 职责越权：User Prompt 中的 Schema 强约束
*   **现象**：在 `user_prompt` 的底部，存在大量针对 JSON 结构的“输出验证要点”（如：`immediate_support` 必须是长度为 2 的数组，且满足 `L2 < L1`）。
*   **问题**：这属于提示词职责错配。字段结构、验证逻辑、Level 的数学关系属于“静态协议 (Static Schema)”，应当由 `system_prompt` 统一定义。
*   **后果**：
    1.  **Token 浪费**：每日预测数百只股票，每只都会重复发送这些静态规则，无法被部分模型的 System Prompt Cache 覆盖。
    2.  **指令被稀释**：在大量个股数据输入后，User Prompt 尾部的超长规则可能让模型产生注意力偏移。
*   **优化建议**：将所有 **Schema 验证契约** 彻底上移到 `system_prompt` 的“严格约束”板块，保持 `user_prompt` 为纯粹的“数据素材 + 当日变量”。

## 3. 中英文混杂的“补丁感” (Prompt Aesthetics)
*   **现象**：提示词中出现了 `IMPORTANT OUTPUT RULE: Generate PURE JSON only. NO Markdown...` 等全英文强力指令，夹杂在全中文的环境中。
*   **分析**：
    *   **合理性**：英文在控制逻辑（JSON, Markdown）和金融原语（Risk-Off, ATR）上对 LLM 具有更强的“锁定力”。
    *   **问题**：缺乏系统感，呈现出一种“为了应付模型报错而打补丁”的痕迹，可能会导致模型在处理内部中文语义时出现生硬感。
*   **优化建议**：不一定要删除英文，但应将其**协议化 (Protocolized)**。例如封装在 `【输出协议 / OUTPUT PROTOCOL】` 这样的标准化板块中，而不是零散地贴在结尾。

## 4. “绝对锚点” (Absolute Anchor) 的执行权重
*   **现象**：指令要求 AI 必须以当日收盘价为“绝对锚点”，历史数据仅为“辅助”。
*   **价值确认**：这是防止 AI 产生“趋势惯性”和“刻舟求剑”的关键。通过强行锚定当日 K 线，AI 才能在 03-12 的破位行情中给出果断的 `RiskOff` 解释，而非受长期牛市幻觉误导。
*   **优化建议**：保留并强化此逻辑，建议在 `system_prompt` 中加入“权重分配原则”，明确当日数据的像素级地位。

---

## 5. 行业最佳实践：高阶优化建议

结合 OpenAI、DeepSeek 及 Gemini 的官方指南，针对 StockWise 提出以下深度优化方向：

### A. 协议上移与解耦 (Schema Consolidation)
*   **核心逻辑**：将所有的 JSON Schema 校验、验证要点、字段数学逻辑彻底从 `User Prompt` 移入 `System Prompt`。
*   **收益**：
    1. **Prompt Caching**：显著降低重复发送静态规则的 Token 成本。
    2. **抗干扰性**：防止 AI 在处理大量个股数据后对末尾指令产生疲劳。

### B. 引入 XML 定界符 (XML Delimiters)
*   **建议**：在 `User Prompt` 中使用 `<market_data>`, `<technical_signals>`, `<layer1_constraints>` 等标签包裹数据块。
*   **收益**：LLM 对 XML 标签的边界识别能力优于 Markdown 标题，能有效防止模型将数据误认为指令（Prompt Injection Prevention）。

### C. 注入“黄金样本” (Few-Shot Learning)
*   **建议**：在 `System Prompt` 中植入 1-2 个标准化的“大师级”分析案例（一个 Long，一个 Side）。
*   **收益**：AI 会模仿样本中的推理深度和“笔触”，减少机械的术语堆砌。

### D. 显式推理链 (Structured Chain-of-Thought)
*   **建议**：在输出 JSON 之前，要求模型在内部字段（如 `internal_reasoning`）进行不少于 200 字的非结构化自由思考。
*   **收益**：强制“慢思考”有助于识别复杂的市场陷阱，提升结论的实战价值。

### E. 专家人格微调 (Persona Refinement)
*   **建议**：将角色从“AI 助手”细化为“**遵循 VCP 模式与盈亏比风险管理的顶级量化交易专家**”。
*   **收益**：通过人格锚定，自动引导模型对特定技术形态（如收缩整理、缩量回调）赋予更高权限。

## 6. 信号语义脱节 (Signal Semantics Mismatch)
*   **现象**：当前提示词和后端解析器 (`SignalEnum`) 仍在使用 `Long / Short / Side` 三阶语义。
*   **问题**：这与产品定义手册 (`four-states-semantics.md`) 中的“四动作语义”（`TriggeredLong`, `Watch`, `RiskOff`, `NoSetup`）存在严重断层。
*   **后果**：
    1.  **评估精度下降**：无法区分“由于趋势未明而观望 (Watch)”与“由于完全无机会而休息 (NoSetup)”。
    2.  **UX 表达不匹配**：前端预期展示的精细化建议在 AI 核心层被降级为泛化的 `Side`，导致分析深度被“吞噬”。
*   **优化建议**：在下一阶段重构中，应在 `System Prompt` 中升级信号枚举，并同步更新 `SignalEnum` 及其对应的标准化逻辑。

---
**审计人**: Antigravity & User
**日期**: 2026-03-12
**状态**: 待优化建议执行 (Checkpoint 2 Ready)
