---
title: "VCP Visualization Transparency Spec"
doc_id: "spec-vcp-visualization-transparency"
doc_domain: "product"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-24"
summary: "定义如何将 Shen Ce Layer-1 的 VCP-like 结构、四状态信号与真实股票数据连接起来，形成可解释、可审计、可演示的单票可视化表达。"
---

# VCP Visualization Transparency Spec

## 1. Purpose

本说明文档用于回答一个非常具体的问题：

- 我们是否应该把 Shen Ce / Layer-1 的 VCP-like 逻辑做成单票可视化展示？
- 如果要做，应该展示什么，不应该展示什么？
- 前端画面、数据结构、规则输出、文案语义之间应如何对齐？

本方案的目标不是再造一个“炫酷海报”，而是建立一套可持续迭代的 **算法透明化表达协议**：

1. 让用户看见系统为什么给出 `Watch / TriggeredLong / RiskOff / NoSetup`。
2. 让设计表达建立在真实价格、真实成交量、真实规则命中之上。
3. 让未来的前端实现、营销物料、产品讲解、投资模式页面共用同一套结构骨架。

---

## 2. Product Intent

### 2.1 我们真正要解释的对象

我们要解释的不是“米勒维尼教科书原版 VCP”本身，而是：

- **Shen Ce 当前工程实现的 VCP-like Layer-1 状态机**
- 它如何从真实 OHLCV 数据中收敛出四状态
- 它为何将某一只股票判定为：
  - `Watch`
  - `TriggeredLong`
  - `RiskOff`
  - `NoSetup`

换句话说，前台不是在展示一套抽象交易哲学，而是在展示：

> “系统如何从混乱价格中识别出收缩、等待、触发、失效这条因果链。”

### 2.2 为什么值得做

该能力同时服务三类目标：

- **用户信任**：从“你告诉我结论”升级为“你让我看见结论是怎么来的”。
- **产品教育**：把四状态从标签升级为结构化叙事。
- **品牌资产**：把 StockWise 的核心方法论沉淀成可复用的视觉语言，而不只是一次性 POC。

---

## 3. Scope and Non-Goals

### 3.1 In Scope

- 单只股票的 VCP-like 结构解释图
- 四状态与图形结构的映射
- 价格、成交量、pivot、breakout、risk line 的可视化规范
- 可供前端消费的最小数据契约
- 对当前 `poc/shen-ce-vcp/index.html` 的改造方向约束

### 3.2 Out of Scope

- 不在本阶段承诺“自动识别所有经典 VCP 教科书形态”
- 不将该图直接作为交易建议或收益承诺页面
- 不把底层所有超参数原样暴露给终端用户
- 不在本阶段同步重写 Layer-1 交易规则

---

## 4. Source of Truth

本 spec 依赖以下现有资产：

- 四状态与 Layer-1 工程化定义：
  - `docs/2_Intelligence/research/01_Quant_Trading_Schools_Taxonomy.md`
  - `docs/5_Support_Ops/content/four-states-semantics.md`
- Layer-1 当前规则实现：
  - `backend/engine/layer1_state.py`
- 前端四状态语义资产：
  - `frontend/src/lib/layer1-ui.ts`
- 当前 POC：
  - `poc/shen-ce-vcp/index.html`

关键事实：

1. 当前系统已经拥有稳定的四状态协议。
2. 当前 Layer-1 已经输出可审计 payload，但该 payload 更偏规则调试，不适合直接前台消费。
3. 当前 POC 右侧图是概念示意，不是由真实数据和真实规则直接生成的结构图。

---

## 5. Core Product Judgment

### 5.1 方向判断

当前研发方向成立，但必须收紧目标定义：

- 错误目标：把 VCP 画得“像一个好看的概念图”
- 正确目标：把四状态背后的结构因果链画清楚

因此，产品的核心表达对象应为：

1. **收缩是否建立**
2. **量能是否枯竭**
3. **突破是否被确认**
4. **结构是否被破坏**

### 5.2 对用户的最终价值

用户看完图后，应能回答四个问题：

1. 这只股票现在处于哪一个状态？
2. 系统凭什么这么判断？
3. 关键触发位和失效位在哪里？
4. 这是一个正在收缩的结构，还是一个已经失真的结构？

如果用户只能感到“很酷”，但说不出上述四点，则视为失败。

---

## 6. Conceptual Model

### 6.1 VCP 在本产品中的最小叙事

对外表达时，VCP 不应被描述为神秘秘诀，而应被表达为一条简单、可重复理解的链条：

1. 大波动逐步收窄
2. 成交量同步下降
3. 价格逼近临界点
4. 右侧出现放量确认
5. 若确认失败或结构破坏，则立即进入防守

### 6.2 四状态映射

#### `NoSetup`

- 含义：没有形成值得跟踪的收缩结构，或整体环境杂乱无序
- 用户语义：当前不建议出手
- 图形语义：不应该强行画出优雅包络

#### `Watch`

- 含义：收缩结构基本建立，接近 pivot，但尚未完成有效确认
- 用户语义：先观察，不急着出手
- 图形语义：包络开始收敛，量能明显枯竭，价格接近 pinch / pivot

#### `TriggeredLong`

- 含义：价格突破关键位，并获得强收盘、量能或动能确认
- 用户语义：建议看多
- 图形语义：突破 K 线、触发位、放量柱必须明确锚定在真实数据上

#### `RiskOff`

- 含义：结构被破坏，或价格重新落入风险区
- 用户语义：建议防守
- 图形语义：必须明确显示失效线，而不是只写一句抽象文案

---

## 7. Visual Grammar

### 7.1 设计原则

视觉上必须满足以下四条：

1. **真实骨架优先于概念装饰**
2. **结构线条优先于文案堆砌**
3. **关键点位优先于抽象情绪**
4. **优雅可以保留，但必须建立在真实锚点之上**

### 7.2 图层结构

推荐将右侧图拆为 5 层：

1. **价格层**
   - 真实 K 线
   - 真实时间轴和价格轴

2. **成交量层**
   - 收缩期量能衰减
   - 突破期量能扩张

3. **结构层**
   - 上包络 `upperHull`
   - 下包络 `lowerHull`
   - pivot
   - risk line

4. **状态层**
   - `Watch`
   - `TriggeredLong`
   - `RiskOff`
   - `NoSetup`

5. **解释层**
   - 简短理由标签
   - 关键数值摘要，例如：
     - 最近收缩幅度
     - breakout volume ratio
     - strong close 命中

### 7.3 关于“优雅包络线”的具体约束

参考图中最动人的部分，是“收缩中的能量感”。这部分应保留，但必须遵守：

1. 线条必须来自真实 swing highs / swing lows 或其平滑拟合结果。
2. 包络线允许适度艺术平滑，但不能脱离真实 pivot 区域。
3. 收缩节奏应和真实价格摆动次数一致，不能随意补几条漂亮的贝塞尔曲线。
4. `RiskOff` 的失效表达应来自结构破坏，而不是任意摆在图中一个角落。

---

## 8. Data Contract for Visualization

### 8.1 原则

前端不应直接消费 `layer1_payload` 的全部调试字段，而应由后端或中间转换层提供一个更稳定的 `visualization payload`。

### 8.2 Minimum Payload

建议输出结构如下：

```json
{
  "symbol": "AAPL",
  "as_of_date": "2026-03-24",
  "setup_state": "Watch",
  "opportunity_score": 68.0,
  "price_bars": [],
  "volume_bars": [],
  "contractions": [
    {
      "start": "2026-02-10",
      "end": "2026-02-18",
      "swing_high": 182.4,
      "swing_low": 168.2,
      "amplitude_pct": 8.45
    }
  ],
  "upper_hull": [],
  "lower_hull": [],
  "pivot": {
    "date": "2026-03-22",
    "price": 179.8
  },
  "breakout_bar": {
    "date": "2026-03-24",
    "price": 181.6,
    "volume_ratio_vs_prev5": 1.42
  },
  "risk_line": {
    "type": "structure_low",
    "price": 174.3
  },
  "reason_codes": [
    "vcp_like",
    "volume_dry_up",
    "strong_close",
    "breakout_confirmed"
  ]
}
```

### 8.3 Why This Contract

这层契约用于把三个世界分开：

- **交易规则世界**：参数、阈值、内部中间量
- **可视化世界**：结构、锚点、状态
- **用户语义世界**：建议看多 / 建议观察 / 建议防守 / 暂无信号

这样可以避免前台和底层规则过度耦合。

---

## 9. Alignment with Current Layer-1

### 9.1 已有能力

当前 `backend/engine/layer1_state.py` 已能稳定提供：

- `cond_vcp_like`
- `cond_breakout`
- `cond_breakout_soft`
- `cond_strong_close`
- `cond_momentum`
- `cond_momentum_recovery`
- `watch`
- `trigger`
- `risk_off`
- `score`

这意味着：

- 四状态结论已经存在
- 解释性中间量已经存在
- 我们并不是从零开始

### 9.2 当前缺口

当前引擎尚未显式输出以下“视觉骨架字段”：

- 多段收缩的分段结果
- 每一段收缩的 swing high / low
- 上下包络拟合点
- 明确的 pivot 点
- 可前台直接消费的 risk line 类型

因此下一阶段最合理的工程动作不是重写交易规则，而是新增一层：

- `layer1_visualization_adapter`

它的职责是：

1. 消费现有 daily history 与 Layer-1 snapshot
2. 计算视觉所需锚点
3. 输出稳定、轻量、可前台使用的 visualization payload

---

## 10. Current POC Assessment

当前 `poc/shen-ce-vcp/index.html` 的价值在于：

- 左侧文案语义已经接近目标
- 右侧整体版式已经初步抓到“系统解释图”的方向
- 它证明了品牌调性和构图是可以成立的

但当前版本仍属于半成品，主要问题如下：

### 10.1 右侧结构图未绑定真实数据

- SVG 包络与标记是固定坐标
- 并未锚定到图表中的具体 bar / 价格 / 日期

### 10.2 K 线是随机生成

- 不能解释真实股票
- 无法承载“算法透明化”目标

### 10.3 缺少成交量面板

- VCP 的“收缩 + 放量突破”没有被完整展示

### 10.4 状态层未和规则命中强绑定

- `Watch / Triggered / RiskOff / NoSetup` 目前更像视觉标签
- 不是规则结果的可视化映射

### 10.5 风控表达不够精确

- 当前 `RiskOff` 更像一句概念文案
- 尚未形成可执行的“失效线”表达

---

## 11. POC Upgrade Requirements

下一版 POC 至少应满足以下条件：

1. 使用一只真实股票的真实日线 OHLCV 数据
2. 显示独立成交量区域
3. `Watch / TriggeredLong / RiskOff / NoSetup` 必须锚定真实日期和真实价格
4. 包络线由真实 swing points 拟合生成
5. pivot 与 risk line 必须明确显示
6. 左侧文案应解释“为什么是这个状态”，而不是重复状态名
7. 允许保留艺术化风格，但装饰线不能与真实结构冲突

---

## 12. Recommended Delivery Phases

### Phase 1: Explainability First

目标：先做“可信解释图”

交付：

- 真实 OHLCV
- 真实 volume pane
- 真实 pivot
- 真实 breakout bar
- 真实 risk line
- 半抽象但数据驱动的上下包络

### Phase 2: Poster Language

目标：在不破坏可信度的前提下增强品牌视觉张力

交付：

- 更优雅的包络平滑
- 更完整的场景文案
- 可用于官网 / 海报 / 分享物料的视觉语法

### Phase 3: Product Integration

目标：将单票可解释图接入真实产品流

候选落点：

- Dashboard 单票详情
- Tactical Brief / Investment Decision
- 官网品牌页
- 教学内容与营销物料

---

## 13. Success Criteria

该项目的成功不以“画得像不像参考图”为标准，而以以下结果为标准：

1. 用户能一眼说出当前四状态属于哪一种
2. 用户能理解触发位和失效位
3. 图中每个关键视觉元素都能追溯到真实数据或真实规则
4. 设计语言优雅，但不牺牲可解释性
5. 前端实现具备重复生成不同股票案例的能力，而不是单张手工海报

---

## 14. Immediate Next Step

在本 spec 之后，建议立刻补一份配套执行文档，范围只覆盖：

1. `visualization payload` 字段定义
2. swing / hull / pivot / risk line 的算法口径
3. `poc/shen-ce-vcp/index.html` 的重构任务拆分
4. 先选哪一只真实股票作为首个演示案例

在此之前，不建议直接进入大规模前端细节打磨。

---

## 15. Related Docs

- `/Users/yesun/Code/stockwise/docs/2_Intelligence/research/01_Quant_Trading_Schools_Taxonomy.md`
- `/Users/yesun/Code/stockwise/docs/5_Support_Ops/content/four-states-semantics.md`
- `/Users/yesun/Code/stockwise/docs/3_Product/Specs/40_Quant_AI_Dual_Layer_UX.md`
- `/Users/yesun/Code/stockwise/backend/engine/layer1_state.py`
- `/Users/yesun/Code/stockwise/frontend/src/lib/layer1-ui.ts`
- `/Users/yesun/Code/stockwise/poc/shen-ce-vcp/index.html`
