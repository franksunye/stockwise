# StockWise 智能通知策略与设计研究
> **版本**: 1.0 (Draft)
> **日期**: 2026-01-03
> **状态**: 研究与设计阶段 (Research & Design Phase)

## 1. 执行摘要 (Executive Summary)
本文档概述了 StockWise 通知系统的战略转型方向。
**核心假设**: 简单的价格预警（如“股价上涨 3%”）是同质化的“大宗商品”，价值极低。特别是对于 PWA 应用，我们在网络延迟上无法与原生 App 竞争毫秒级推送。
**战略方向**: 从“行情播报员”转型为 **“AI 投资助理”**。
**核心目标**: 通过提供高价值、可执行且稀缺的智能情报来实现商业化——具体包括 **AI 信号翻转 (Signal Flips)**、**预测验证成功 (Validation Successes)** 以及 **个性化风险分析 (Personalized Risk Analysis)**。

---

## 2. 行业分析与对标 (Industry Analysis & Benchmarking)
我们分析了顶级金融科技产品（Robinhood, Webull, eToro）以及高端投研工具（Trade Ideas, Seeking Alpha）的最佳实践。

### 第一梯队：基础工具层 (The "Noise")
*   **代表产品**: 同花顺, 富途, Robinhood, Apple Stocks
*   **功能**: 单纯的价格阈值提醒（例如：“苹果股价上涨 5%”）、成交量异动。
*   **价值**: ⭐️ **低**。数据是免费且泛滥的。用户经常因为被打扰而关闭此类通知。
*   **StockWise 现状**: 我们的 MVP 版本目前处于此阶段。

### 第二梯队：资讯驱动层 (The "Context")
*   **代表产品**: Bloomberg, Seeking Alpha, Benzinga
*   **功能**: 消息驱动的提醒（“财报超出预期”、“分析师上调评级”）。
*   **价值**: ⭐️⭐️ **中**。提供了价格变动背后的“原因”，但仍需用户自己进行综合判断。

### 第三梯队：智能策略层 (The "Alpha")
*   **代表产品**: **Trade Ideas (Holly AI)**, **LevelFields**
*   **功能**: 基于策略和信号的推送。
    *   *“AI 策略‘Alpha Predator’刚刚触发了特斯拉的买入信号。”*
    *   *“形态确认：杯柄形态突破。”*
*   **价值**: ⭐️⭐️⭐️ **高**。这是稀缺且可直接指导交易的建议。用户愿意为此支付高昂的订阅费（如 $2000+/年）。
*   **StockWise 目标**: **我们必须以此为演进目标。**

---

## 3. PWA 的局限与优势 (The PWA Constraint & Advantage)
**局限 (Constraint)**: PWA (Progressive Web Apps) 依赖 Service Worker 和 Push API。在 iOS 上，后台保活能力有限。我们无法与原生 App (Native Sockets) 竞争“实时行情”的速度。
**优势 (Advantage)**: 我们的核心价值在于 **算力 (Compute)**，而非速度。我们花费数分钟调用 LLM 对股票进行深度分析。我们的通知应当代表这一昂贵计算过程的**最终产出**。

**战略转型**:
*   🚫 **停止**: 在速度上竞争（实时价格预警）。
*   ✅ **开始**: 在深度上竞争（深度推理结果）。

---

## 4. 高价值通知设计 (The Killer Features)

我们建议废除通用的平庸提醒，专注于开发以下三类高价值通知场景：

### A. 信号翻转 (Signal Flip) —— 制造“FOMO” (错失恐惧)
仅当 AI 改变主意时通知用户。这意味着出现了**新趋势**或**基本面反转**。
*   **触发条件**: `Current_Signal != Previous_Signal` (当前信号 不等于 昨日信号)
*   **逻辑**:
    *   为每对 用户/股票 跟踪记录状态（上一次的信号）。
    *   如果昨天是 `Side` (观望)，今天是 `Long` (看多)，**立即推送**。
*   **文案示例**:
    > 🚨 **AI 信号升级: 科济药业 (02171)**
    > 评级已由 [观望] 上调至 [看多]。基本面发现关键催化剂。点击查看深度推理链。

### B. 验证高光 (Validation Glory) —— 建立信任 (Trust Builder)
利用后台的验证逻辑向用户展示 AI 的“战绩”。
*   **触发条件**: `Yesterday_Signal == Correct` (昨日预测正确) AND `Today_Return > Threshold` (今日涨幅明显)
*   **逻辑**:
    *   如果 AI 昨天预测 `Long`，且今天股价大涨 >3%。
*   **文案示例**:
    > 🎯 **预测成功验证**
    > AI 昨日对 [腾讯控股] 的看多预测已验证 (+4.5%)。模型置信度提升。点击复盘 AI 预判逻辑。

### C. 个性化风险预警 (Personalized Risk Alert) —— 安全感 (The Guardian)
深度扫描用户持仓（Watchlist）中隐藏的危险。
*   **触发条件**: `Signal == Short` (看空) AND `Volatility == High` (高波动)
*   **逻辑**:
    *   AI 监测到用户关注的股票出现技术面破位或情绪面崩盘。
*   **文案示例**:
    > ⚠️ **持仓风险预警: 美团**
    > AI 监测到潜在的趋势反转信号，下行风险升高。建议操作：检查止损位。

---

## 5. 实施路线图 (Implementation Plan)

### 第一阶段：清理与降噪 (Phase 1: Reduction)
*   **目标**: 减少无效打扰。
*   **行动**: 禁用或大幅提高简单“价格变动”通知的触发阈值。除非有重大情况，否则不发送“日报”。

### 第二阶段：状态追踪 (Phase 2: State Tracking)
*   **目标**: 实现“信号翻转”逻辑。
*   **行动**:
    *   更新 `user_watchlist` 或新建 `notification_state` 表，用于存储 `last_notified_signal` (上次通知的信号)。
    *   在 `runner.py` 分析脚本中，加入对比 `new_result.signal` vs `db.last_signal` 的逻辑。

### 第三阶段：智能闭环 (Phase 3: The "Smart" Loop)
*   **目标**: 交付价值。
*   **行动**:
    *   重构 `notifications.py`，使其支持结构化的 `NotificationEvent` (翻转、验证、风险)。
    *   更新 LLM Prompt，让 AI 在分析结果特别显著时，输出一个 explicit 的“值得通知 (Announcementworthy)” 标记。

---

## 6. 商业化启示 (Commercial Implications)
*   **变现 (Monetization)**: 这些通知应定义为核心的 **Pro 功能**。
    *   免费用户: 仅接收通用的“每日摘要”。
    *   Pro 用户: 接收实时的“AI 信号翻转”与“风险预警”。
*   **留存 (Retention)**: “验证高光”类通知不断强化用户订阅决策的正确性，从而降低流失率 (Churn)。
