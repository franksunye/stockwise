---
title: "ZISO 2.0 Second Panel Spec"
doc_id: "spec-ziso-2-second-panel-20260428"
doc_domain: "product"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-04-28"
summary: "定义 ZISO 2.0 作为交易第二仪表盘的产品目标、成立条件、Mini Panel 交互、信号契约、MVP 边界与验收标准。"
---

# ZISO 2.0 Second Panel Spec

Version: v0.9

Positioning: Second Trading Panel

Primary question: **ZISO 2.0 是否能成立，取决于它是否能成为用户交易过程中的第二仪表盘。**

---

## 1. Purpose

本 Spec 用于将 ZISO 2.0 从方向判断收敛为可进入设计、原型和开发的产品规格。

它解决三个问题：

1. ZISO 2.0 的产品定位是什么。
2. Mini Panel 必须满足哪些不可妥协的成立条件。
3. 第一版可运行原型应该做什么、不做什么、如何验收。

它不解决：

1. 完整交易系统设计。
2. 交易执行、券商连接、订单管理。
3. 社区、长文研报、策略回测。
4. 完整 Signal Engine 的长期算法路线。

---

## 2. Product Objective

ZISO 2.0 的唯一目标是：

> 在用户看盘过程中，提供持续存在、低干扰、高价值的决策辅助信息层。

它不是新的分析工具，不是复盘工具，也不是社区。

它是：

> 盘中实时的决策辅助 UI Layer。

一句话描述：

> ZISO sits next to your chart and tells you what matters, right now.

---

## 3. Core Product Judgment

ZISO 2.0 成立的核心判断不是功能数量，而是用户是否愿意让它一直开着。

如果用户只在需要时主动打开，它会退化成普通分析页面。

如果它能常驻在 TradingView、IB、富途等主看盘软件旁边，并在关键事件发生时用低干扰方式改变用户注意力，它才是 Second Panel。

因此，第一版原型只验证一个问题：

> 用户是否愿意在盘中让 Mini Panel 持续可见。

---

## 4. Non-Negotiable System Constraints

以下四项必须同时成立。任意一项不成立，Second Panel 的产品价值都会明显坍塌。

| Constraint | Requirement | Failure Mode |
| --- | --- | --- |
| Persistent | 不需要打开网页，启动即在，可开机自启 | 用户忘记打开，信号价值消失 |
| Low Context Switch | 不打断主看盘软件，不需要 Alt+Tab，最多一次注意力转移 | 变成另一个需要切换的工具 |
| Reliable Trigger | 不依赖用户主动查看，必须由事件驱动 UI 变化 | 用户错过关键变化 |
| Visible During Trading | Always-on-top 或贴边，不被窗口覆盖 | 盘中不可见，无法成为仪表盘 |

产品设计、技术选型和 MVP 验收都必须围绕这四项约束展开。

---

## 5. Product Scope

### 5.1 In Scope

- Mac 桌面 Mini Panel 原型。
- Always-on-top 或贴边常驻。
- Mock Signal 驱动 UI 状态变化。
- 单票 Active Signal 展示。
- 多票信号列表展示。
- Hover / click 展开上下文。
- 新信号触发时的低干扰 UI 高亮。
- 信号强度、方向、简短上下文和更新时间展示。

### 5.2 Out of Scope

- 完整看盘图表。
- K 线、技术指标图、复杂图表组件。
- 交易执行。
- 券商账户连接。
- 移动端 App。
- 推送通知。
- 长文本分析。
- 策略回测。
- 社区互动。

### 5.3 Design Reference Boundary

本次附带的 UI 初稿用于确认以下方向：

- 深色、克制、常驻型小窗。
- 左侧 Compact 列表与右侧 Expanded 详情的双形态。
- 信号状态、更新时间、关键数值、轻量操作按钮可以共存。
- 视觉上接近系统级 floating utility，而不是网页卡片。

但第一版 MVP 不承诺完整实现附图中的计划区间、止损、目标区间、小折线图、Override Trade 等交易计划功能。那些能力可以进入后续 Plan Status 或 Trade Management 扩展，不进入 Second Panel MVP 的必需范围。

---

## 6. Functional Architecture

ZISO 2.0 第一版只保留三层。

```text
Market Data / Mock Data
  -> Signal Layer
  -> Context Layer
  -> Mini Panel UI Layer
```

### 6.1 Signal Layer

Signal Layer 的职责是把输入数据收敛成结构化的机会或风险。

第一版信号类型：

| Type | Meaning | Direction |
| --- | --- | --- |
| Breakout | 突破关键位或结构上沿 | Bullish / Risk-dependent |
| Pullback | 回调接近关键观察区 | Neutral / Bullish setup |
| VolumeSpike | 成交量异常放大 | Context-dependent |
| RiskAlert | 风险、失效、远离计划区间 | Bearish / Defensive |

最小输出契约：

```ts
type SignalType = 'Breakout' | 'Pullback' | 'VolumeSpike' | 'RiskAlert'
type SignalDirection = 'up' | 'down' | 'neutral'

interface Signal {
  id: string
  symbol: string
  companyName?: string
  type: SignalType
  direction: SignalDirection
  strength: 1 | 2 | 3 | 4 | 5
  timestamp: number
  description: string
}
```

Signal Layer 原则：

- 不解释完整模型。
- 不暴露复杂参数。
- 不生成长分析。
- 只输出结论、方向、强度、时间和一句描述。

### 6.2 Context Layer

Context Layer 的职责是让信号可理解，但不能变成研报。

内容结构：

| Field | Requirement |
| --- | --- |
| Current state | 趋势、区间、接近关键位、风险状态等短语 |
| Key level | 支撑、阻力、计划区间、失效位等最关键的一项 |
| Strategy sentence | 一句话策略提醒 |

最小输出契约：

```ts
interface SignalContext {
  signalId: string
  state: string
  keyLevel?: string
  strategy: string
}
```

文案限制：

- Compact 状态最多一行。
- Expanded 状态最多两行。
- 禁止长段落、模型解释、研报式输出。

示例：

```text
Near resistance, weak momentum. Breakout needs volume.
```

### 6.3 Mini Panel UI Layer

Mini Panel 是 ZISO 2.0 的核心竞争力。

它不是 Dashboard 的缩小版，而是交易行为旁边的常驻信息层。

UI Layer 的职责：

- 在没有信号时保持安静。
- 在出现信号时用低干扰方式改变视觉状态。
- 允许用户用 hover 或 click 获取极简上下文。
- 在多信号情况下快速扫描优先级。
- 始终保持对主看盘软件的低遮挡、低打断。

---

## 7. Mini Panel Product Spec

### 7.1 Form Factor

| Item | Requirement |
| --- | --- |
| Platform | Mac desktop first |
| Window behavior | Always-on-top or edge-pinned |
| Default width | 280-320px |
| Default height | 120-300px, content-driven |
| Default mode | Compact |
| Expanded mode | Hover or click |
| Startup | Supports launch-on-login in post-MVP phase |

### 7.2 UI States

#### State A: Idle

Idle 表示当前没有活跃信号。此时 UI 必须安静，不争夺注意力。

```text
AAPL
No active signal
Last update: 10:32
```

Required fields:

- symbol
- idle status
- last update time

#### State B: Active Signal

Active Signal 是核心状态。它必须一眼可读。

```text
AAPL  Breakout ↑  Strong

Above 185 resistance
Volume expanding

Confidence ●●●●○
```

Required fields:

- symbol
- signal type
- direction
- strength label or confidence dots
- one-line description
- one-line context
- last update time

#### State C: Multiple Signals

Multiple Signals 用于盘中同时出现多个机会或风险。

```text
AAPL  Breakout ↑
TSLA  Pullback ↓
NVDA  Volume Spike ↑
```

Sort order:

1. Critical / risk signals first.
2. Higher strength first.
3. Newer signal first.

### 7.3 Interaction Rules

| Behavior | Result |
| --- | --- |
| Hover signal row | 展开 Context |
| Click signal row | 固定展开 |
| Click pinned signal again | 取消固定 |
| New passive signal | UI 内容更新 |
| New active signal | 轻微闪动和高亮 |
| New critical signal | 颜色强化和短动画 |
| No interaction for 5s | 自动回到 Compact，除非用户已固定展开 |

### 7.4 Trigger Intensity

| Trigger Type | UI Behavior | Audio / Push |
| --- | --- | --- |
| Passive | 内容静默更新 | No |
| Active | 轻微闪动、边框或背景高亮 | No |
| Critical | 明显颜色变化、短动画、置顶在列表上方 | No |

第一版不做系统推送通知。所有提醒必须在 Panel 内完成。

### 7.5 Visual Rules

Mini Panel 必须克制。

Required:

- 深色背景，建议基准色 `#0B0B0F`。
- 单一主强调色，优先 Indigo 或 Green。
- 风险状态允许使用 Red，但只能用于明确风险或失效。
- 字号层级少，信息密度高。
- 圆角、阴影、毛玻璃可以使用，但不能让它变成营销页组件。

Forbidden:

- K 线图。
- 复杂技术指标图。
- 大面积渐变装饰。
- 研报式长文。
- 多卡片堆叠。
- Dashboard 式导航。

---

## 8. Trigger System

### 8.1 Trigger Path

```text
Market Data
  -> Signal Engine
  -> Trigger Classifier
  -> Mini Panel UI Update
```

MVP 可以用 Mock Data 替代 Market Data 和真实 Signal Engine：

```text
Mock Signal Feed
  -> Trigger Classifier
  -> Mini Panel UI Update
```

### 8.2 Trigger Classifier

触发强度由信号类型、强度和风险属性共同决定。

Suggested mapping:

| Condition | Trigger Type |
| --- | --- |
| strength <= 2 and non-risk | Passive |
| strength >= 3 and non-risk | Active |
| RiskAlert with strength >= 3 | Critical |
| Any signal explicitly marked urgent | Critical |

### 8.3 Reliability Requirements

- 新信号进入后，UI 状态必须在 1 秒内更新。
- 同一信号重复进入时不能无限闪动。
- 用户固定展开后，新信号不能强行打断正在阅读的上下文，除非是 Critical。
- 最近更新时间必须可见，防止用户误以为旧信号仍然新鲜。

---

## 9. MVP Technical Path

### 9.1 Recommended Path: Mac Desktop Mini Window

第一优先级是 Mac 桌面小窗。

Candidate technologies:

- Tauri
- Electron

Decision guidance:

| Option | Pros | Risks |
| --- | --- | --- |
| Tauri | 更轻，系统感更强，资源占用低 | Rust / native packaging 心智成本更高 |
| Electron | 前端开发成本低，生态成熟 | 体积和资源占用更高 |

MVP 判断：

- POC 阶段选择 Tauri。
- 原因：本阶段要验证 Second Panel 是否具备系统级常驻感，而不是最快复用 Web 应用栈。
- Electron 作为备选保留，仅在 Tauri 工程成本明显阻碍 POC 验证时回退。

### 9.2 Backup Path: Browser Floating Window

Chrome Extension 或浏览器浮窗只作为备选。

Risks:

- 容易被浏览器上下文吞没。
- 不像系统级工具。
- 常驻和 always-on-top 能力弱。

### 9.3 Explicitly Not Recommended: Mobile App

Mobile App 不符合盘中看盘场景。

它会带来更高上下文切换成本，也无法稳定扮演第二仪表盘。

---

## 10. MVP Delivery Plan

### Step 1: Static Mini Panel Prototype

Goal:

- 建立 Mac Mini Panel 的视觉和窗口形态。

Must include:

- Compact mode。
- Expanded mode。
- Idle / Active / Multiple 三种 UI 状态。
- 深色视觉基线。
- 无复杂图表。

### Step 2: Mock Signal Runtime

Goal:

- 用假数据驱动真实 UI 状态变化。

Must include:

- 定时生成或手动触发 Mock Signal。
- Signal strength 影响 UI 表现。
- Passive / Active / Critical 三类触发表现。
- Last update 正确刷新。

### Step 3: Persistent Behavior Validation

Goal:

- 验证用户是否愿意让它一直开着。

Must include:

- Always-on-top 或贴边。
- 自动收缩。
- Hover 展开。
- Click 固定展开。
- 长时间运行不遮挡主看盘窗口。

---

## 11. Success Metrics

ZISO 2.0 的核心指标不是 DAU，也不是普通停留时长。

### 11.1 Primary Metrics

| Metric | Meaning |
| --- | --- |
| Intraday open-time ratio | 盘中 Mini Panel 打开时长 / 可交易时段 |
| Visible-time ratio | Panel 实际可见时长 / 打开时长 |

### 11.2 Secondary Metrics

| Metric | Meaning |
| --- | --- |
| Signal viewed rate | 信号触发后是否被用户看见或展开 |
| Expansion rate | Active Signal 被 hover / click 展开的比例 |
| Pin rate | 用户固定展开某个信号的比例 |
| External action proxy | 信号后用户是否切回主交易软件或观察目标股票 |

### 11.3 MVP Qualitative Test

核心问题：

> 你是否愿意明天开盘时继续让它一直开着？

如果答案不是明确的 yes，优先修正常驻形态、干扰程度和信号价值，而不是增加功能。

---

## 12. Acceptance Criteria

MVP 可进入下一阶段的验收标准：

- [ ] Mini Panel 可以作为 Mac 桌面常驻小窗运行。
- [ ] Panel 可保持 always-on-top 或贴边可见。
- [ ] Compact / Expanded / Multiple Signals 三种状态可用。
- [ ] Hover 可展开 Context。
- [ ] Click 可固定展开。
- [ ] 无操作 5 秒后自动收缩。
- [ ] Mock Signal 可以驱动 Passive / Active / Critical UI 变化。
- [ ] 新信号 UI 更新延迟不超过 1 秒。
- [ ] 文案不超过 Spec 限制：Compact 1 行，Expanded 2 行。
- [ ] UI 不包含 K 线、复杂图表、长分析或交易执行功能。
- [ ] 用户可以连续运行 30 分钟以上，不觉得遮挡主看盘软件。

---

## 13. Product Risks

| Risk | Symptom | Product Response |
| --- | --- | --- |
| 变成普通分析工具 | 用户只在想分析时打开 | 优先强化常驻和触发，不扩展分析页 |
| 干扰过强 | 用户关闭 Panel | 降低动画、颜色和提醒强度 |
| 信息过弱 | 用户觉得一直开着没价值 | 提高信号选择质量，不增加长文 |
| 像小 Dashboard | 功能越来越多，信息密度失控 | 回到三层结构：Signal / Context / UI |
| 技术形态不成立 | 浏览器浮窗容易被忽略 | 回到 Mac desktop window |

---

## 14. Next Design Decisions

进入 UI 高保真或工程原型前，需要确认以下决策：

1. Compact 默认展示单票状态，还是多票列表。
2. Signal strength 用文字标签、点阵，还是二者并存。
3. 是否保留附图中的 plan status 语义，作为后续 Trade Management 扩展。
4. Mock Signal 的第一批股票池和场景样本。
5. Tauri POC 是否需要开机自启、贴边吸附和拖拽保存位置。

建议优先顺序：

1. 先做 Mac Mini Panel 可运行原型。
2. 再用 Mock Signal 驱动 UI。
3. 最后评估真实 Signal Engine 的最小规则。

---

## 15. Final Summary

ZISO 2.0 不是一个更好的分析工具。

它的本质是：

> 一个嵌入到交易行为中的信息器官。

只要用户需要主动想起它、打开它、切换到它，它就失败了。

只要它能常驻在图表旁边，在关键时刻用极低成本告诉用户现在发生了什么，它就具备成为 2.0 的资格。
