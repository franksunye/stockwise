---
title: "09 决策栈与 Producer 架构 (Decision Stack & Producer Architecture)"
doc_id: "strategy-decision-stack-and-producer-architecture"
doc_domain: "strategy"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-25"
summary: "统一量化规则、AI 判断、解释职能、实验/生产双场景与投资模式之间的分层关系，作为后续 glossary、engineering 与 support 口径的上游事实源。"
---

# 09 决策栈与 Producer 架构 (Decision Stack & Producer Architecture)

## 0. 为什么需要这篇文档

随着 `VCP-like`、`TrendStrategy`、AI 独立判断、AI 语义解读、投资模式等能力并行增长，系统内开始出现一个高频混淆：

1. `VCP-like` 和 `趋势策略` 到底是不是“投资模式”？
2. AI 是只负责解释，还是也能产出自己的判断？
3. `mode_decision_log` 记录的究竟应是规则、模式，还是最终决策？
4. 实验和生产两种场景是否应使用同一套概念？

这份文档用于给出统一答案，并作为后续 glossary、engineering、support 文档的上游母本。

---

## 1. 两条轴：来源轴与环境轴

我们后续讨论所有“决策”问题，都必须同时放在两条轴上看。

### 1.1 来源轴（Who produces judgment）

来源轴回答：**谁在产出判断？**

主要有三类：

1. `Quant Producer`
   - 量化规则或量化策略的产出者
   - 例子：`VCP-like`、`TrendStrategy`
2. `AI Producer`
   - 可独立生成判断的 AI 分析者
   - 例子：`DeepSeek`、`Hunyuan`
3. `Interpreter`
   - 基于共享量化事实，对结果做指标解读、纪律说明、语义转述
   - 可由 AI 承担，也可由规则模板承担

### 1.2 环境轴（Where does it run）

环境轴回答：**这个判断运行在什么场景里？**

1. `Production`
   - 面向用户正式展示
   - 必须稳定、唯一、可审计
2. `Experiment`
   - 面向研究、校准、版本对比
   - 允许多版本、多结果并存

### 1.3 结论

- `来源轴` 解决“谁在说”
- `环境轴` 解决“在哪条链路说”
- 同一个 Producer 可以同时存在于 `Production` 与 `Experiment`
- 同一个方法在实验中可并行多个版本，但生产中应有明确主版本

---

## 2. 三类角色：Producer、Interpreter、Mode

### 2.1 Producer

`Producer` 指任何可以针对“某标的、某日、某上下文”产出原始判断的主体。

它只负责回答：

- 当前是否有 setup
- 当前更偏看多、观察、防守还是无机会
- 其判断基于什么证据

它**不负责**最终持仓动作。

### 2.2 Interpreter

`Interpreter` 不是新的信号源，而是解释层能力。

它可以消费：

- 量化事实
- 单个 Producer 的结果
- 裁决结果
- 模式后的执行结果

它负责：

- 技术指标解读
- 关键位说明
- 纪律翻译
- 面向用户的语义转述

同一个 AI 模型既可以是 `AI Producer`，也可以在另一条链路中扮演 `Interpreter`。

### 2.3 Investment Mode

`Investment Mode` 不属于 Producer，也不属于 Interpreter。

它的职责是：

- 接收已经裁决后的市场判断
- 结合用户风格与持仓上下文
- 生成最终动作风格

例如：

- `steady_v1`
- `balanced_v1`
- `aggressive_v1`
- `observe_only_v1`

### 2.4 一个关键判断

`VCP-like`、`TrendStrategy`、`DeepSeek 独立判断`、`Hunyuan 独立判断` 都应视为平行的 `Producer`。

而 `稳健 / 平衡 / 进取` 是 `Mode`，不是 Producer。

---

## 3. 三类结果：Outcome、Arbitration、Action

为了避免“决策”一词继续混用，内部必须区分三类结果。

### 3.1 Producer Outcome

Producer 自己的原始判断结果。

例子：

- `vcp_like -> TriggeredLong`
- `trend_strategy -> Watch`
- `deepseek -> 建议看多`
- `hunyuan -> 建议观察`

这是“各自观点”，不是系统最终动作。

### 3.2 Arbitration Result

多个 Producer 同时存在时，系统对它们做综合后的统一裁决。

它解决的问题是：

- 谁是主判断
- 分歧如何处理
- 是否加权、投票、优先级覆盖

这是“系统统一市场判断”，但仍不等于最终执行动作。

### 3.3 Action Decision

在 `Arbitration Result` 基础上，再结合 `Investment Mode` 与持仓上下文后，得到最终动作。

例子：

- `Open`
- `Hold`
- `Add`
- `Reduce`
- `Exit`
- `Ignore`

对外仍可映射为：

- `建议看多`
- `建议观察`
- `建议防守`
- `暂无信号`

但在内部架构上，这一层属于动作决策，而不是原始规则结果。

---

## 4. 共享底座：Quant Fact Layer

AI 和量化规则可以共享同一套底层量化数据，但这不代表它们是同一个对象。

我们建议明确一个中间层概念：

`Quant Fact Layer`

它承载：

- 技术指标
- 关键位
- 共振评分
- 形态特征
- VCP 收缩/突破状态
- 趋势状态
- 风险状态

`Quant Producer` 与 `AI Producer` 都可以消费这一层。

`Interpreter` 也可以消费这一层做语义解释。

### 4.1 结论

- 共享的是事实层，不是角色层
- `Quant Fact Layer` 不等于 `Quant Producer`
- `AI Producer` 也不等于 `Interpreter`

---

## 5. 端到端链路

统一推荐采用以下决策栈：

```text
Market Data
  -> Quant Fact Layer
  -> Producer Outcomes (Quant / AI)
  -> Arbitration Result
  -> Investment Mode
  -> Action Decision
  -> Ledger / Performance / Notification
```

解释能力可横切挂在多个节点：

```text
Quant Fact Layer / Producer Outcome / Arbitration / Action
  -> Interpretation Output
```

---

## 6. 当前系统映射

### 6.1 当前对象如何落位

| 当前对象 | 推荐定位 |
| --- | --- |
| `tradeability_v2 / Layer-1` | 当前主 `Quant Producer` 的工程实现 |
| `TrendStrategy` | 独立 `Quant Producer` |
| `DeepSeek` / `Hunyuan` 独立判断 | `AI Producer` |
| AI 对指标、关键位、纪律的解读 | `Interpreter` |
| `steady / balanced / aggressive / observe_only` | `Investment Mode` |
| `mode_decision_log` | 应逐步收口为 `Action Decision` 记录表 |
| `quant_tradeability_signals` | 偏研究口径的 Producer 结果表 |

### 6.2 当前主要历史包袱

当前系统最大的历史混淆有三点：

1. `Layer-1 / tradeability_v2` 同时承担了底层信号引擎和模式输入源角色
2. `mode_decision_log` 同时混入了规则来源与模式结果语义
3. `TrendStrategy` 与部分 AI 原始判断被 Layer-1 覆盖后，原始 Producer 独立性不清晰

---

## 7. 对表结构与命名的原则性影响

### 7.1 推荐方向

后续表结构建议至少按以下语义拆分：

1. `producer_outcome_log`
   - 记录每个 Quant / AI Producer 的原始结果
2. `arbitration_log`
   - 记录综合裁决结果
3. `mode_action_log`
   - 记录模式层后的最终动作决策

### 7.2 语义治理不是旁支

随着 `Producer Outcome`、`Arbitration Result`、`Action Decision` 被拆开，系统中会同时存在多种“信号/语义/动作”字段。

因此必须同步建立统一的语义治理原则：

1. `signal_state` 只表示结构化市场判断
2. `decision_semantic` 只表示判断层的人类可读表达
3. `action_decision` 只表示动作层内部枚举
4. `action_semantic` 只表示面向用户的动作文案

任何新规则、新 AI、新模式进入体系时，都不应自行发明一套新术语，而应接入统一语义契约。

### 7.2 当前阶段允许的过渡

在现有代码仍未完全重构前，可以允许沿用旧表名，但文档语义必须先收口：

- `mode_decision_log` 对内按 `Action Decision` 理解
- 原始规则 / AI 判断不再口头上称为“mode 决策”

---

## 8. 命名禁区

以下表达不应再混用：

- `量化规则` 不等于 `投资模式`
- `Producer Outcome` 不等于 `Action Decision`
- `AI Producer` 不等于 `Interpreter`
- `共享量化数据` 不等于 `共享角色`
- `Production` 不等于 `Experiment`
- `Layer-1` 不应替代未来所有 Producer 架构的总概念

---

## 9. 一句话总定义

StockWise 的统一决策栈应理解为：

**数据先沉淀为量化事实，再由 Quant / AI 两类 Producer 产出原始判断，经系统裁决后，由 Investment Mode 映射为最终动作，并在生产与实验两种环境中分别落账、观测与解释。**
