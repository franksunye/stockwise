# Phase 1: MVP Review & Graduation (The Foundation)

> **当前状态**: 已完成 (Graduated) but needs Hardening.
> **核心目标**: 建立可信的最小可行性产品 (Minimum Viable Product)，验证 "AI 分析股票" 这一核心假设的价值。
> **质量标准**: 从 "Demo 级" 提升至 "Production Ready (Day 1)"。

---

## 1. 成果回顾 (Achievement Review)

Phase 1 我们成功构建了 StockWise 的核心骨架：
1.  **数据层 (Data Grounding)**:
    *   ✅ 搞定了 Turso (LibSQL) 作为云数据库。
    *   ✅ 接入了 AkShare (Technical) + EastMoney (News) 实现了中港股的双覆盖。
    *   ✅ *Gap*: 数据抓取的错误处理还比较初级。
2.  **智能层 (Intelligence)**:
    *   ✅ 跑通了 Local LLM (Gemini/Hunyuan) 的链路。
    *   ✅ 实现了 "Strategy Pattern" (`brief_strategies.py`)，支持模型热切换。
    *   ✅ Prompt 调优：从简单的 "summarize" 进化到了 "Financial Columnist" 角色扮演。
    *   ✅ *Gap*: AI 仍有幻觉风险，且输出格式偶尔不稳定。
3.  **交互层 (Interface)**:
    *   ✅ Mobile-First 的 Next.js 前端，极度流畅（TikTok 风格滑动）。
    *   ✅ "Daily Brief" 抽屉式设计 成为这一阶段的亮点。

---

## 2. 深度复盘与加固计划 (Hardening Plan)

虽然功能跑通了，但对着 "10,000 用户" 和 "世界级标准"，我们需要回头补课：

### A. 数据坚固性 (Data Robustness)
*   **问题**: 目前脚本里虽然有 `try/except`，但在网络波动（如 EastMoney 封禁 IP）时的表现未经验证。
*   **改进标准**: 
    1.  **Circuit Breaker (熔断器)**: 如果连续 3 个请求失败，自动停止抓取并报错，防止 IP 被封。
        - 📌 *状态*: **按需实施 (YAGNI)** - 当前未遇到实际问题，等有症状再做。
    2.  **Data Validation**: 必须校验 `close_price > 0` 和 `volume >= 0`，防止脏数据。
        - ✅ *状态*: **已完成** (2026-01-23) - 见 `sync/prices.py` 第 66-86 行。
        - ⚠️ 注: 不校验涨跌幅范围，因为新股首日和港股可能大幅波动。

### B. AI 稳定性 (AI Reliability)
*   **问题**: `brief_generator.py` 中直接拼接 JSON 结果。如果 AI 输出的 Markdown 包含破坏性字符，前端可能渲染崩溃。
*   **改进标准**: 
    1.  **Structured Output (JSON Mode)**: 强制 LLM 输出 JSON 而非 Markdown 字符串，然后再由后端渲染成 Markdown。这样可以 100% 保证格式安全。
        - 📌 *状态*: **按需实施 (YAGNI)** - 改动大，当前未遇到渲染崩溃问题。
    2.  **Hallucination Check**: 增加一层简单的规则校验，例如 AI 说 "大涨"，但数据是 `-5%`，直接丢弃该结果并重试。
        - 📌 *状态*: **按需实施 (YAGNI)** - 当前靠 Prompt 约束，等用户反馈再做。

### C. 核心代码规范 (Code Quality)
*   **问题**: `page.tsx` 有 250 行，包含了大量业务逻辑。
*   **改进标准**:
    1.  **Extract Components**: 将 Header, Footer, 和各类 Modals 彻底拆分。
        - 📌 *状态*: **按需实施** - 开发体验问题，不影响用户。
    2.  **Custom Hooks**: 所有 `fetch` 逻辑必须封装在 hooks 中 (如 `useUserProfile`)，UI 层只负责展示。
        - 📌 *状态*: **按需实施** - 同上，可以在重构时一并处理。

---

## 3. 标准化协议 (Standardized Protocols)

为了确保后续阶段不 "烂尾"，我们将 Phase 1 的经验固化为以下协议：

### 协议 1: The "No-Nonsense" Data Protocol
> *任何展示给用户的数据，必须有源头可查。*
*   **Bad**: AI 说 "主力资金大幅流入"。
*   **Good**: AI 说 "主力资金流入 5000 万 (Source: EastMoney Flow API)"。
*   **Action**: 在 Backend 增加 `citations` 字段，强制要求 AI 附带来源。
    - ✅ *状态*: **已完成（轻量级）** (2026-01-23) - AI 输入数据已标注来源，见 `brief_generator.py` 第 266-286 行。
    - 📌 *后续*: 如需结构化存储，可在 `stock_briefs` 表增加 `citations` 字段。

### 协议 2: The "Graceful Failure" Protocol
> *用户永远不应该看到 500 页面。*
*   **场景**: 用户点开简报，后端挂了。
*   **UI 表现**: 展示 "AI 正在重新思考... (暂无数据)" 的骨架屏，并自动重试 1 次，而不是显示红色的 Error Toast。
    - 📌 *状态*: **按需实施 (YAGNI)** - 后端很少挂，等出现再做。

---

## 4. 结论 (Conclusion)

Phase 1 是成功的，它证明了 concept 是可行的。
但它是 **"脆弱的成功"**。

我们现在的首要任务是在进入 Phase 3 之前，把 Phase 1 的地基 (API Robustness & AI Safety) 打得像混凝土一样坚硬。

### 📊 改进进度 (2026-01-23 更新)

| 改进项                  | 状态     | 说明                        |
| ----------------------- | -------- | --------------------------- |
| A2. Data Validation     | ✅ 已完成 | 校验 close > 0, volume >= 0 |
| D1. Citations           | ✅ 已完成 | AI 输入数据添加来源标注     |
| A1. Circuit Breaker     | 📌 按需   | 等遇到 IP 封禁问题再做      |
| B1. Structured Output   | 📌 按需   | 等遇到渲染问题再做          |
| B2. Hallucination Check | 📌 按需   | 靠 Prompt 约束，等用户反馈  |
| C1/C2. Code Refactor    | 📌 按需   | 开发体验，不影响用户        |
| D2. Graceful Failure    | 📌 按需   | 后端稳定，暂不需要          |

