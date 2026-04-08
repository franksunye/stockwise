# StockWise Method Registry 设计稿

**文档状态**: Draft for Adoption  
**日期**: 2026-03-12  
**作者**: Codex  
**用途**: 为 StockWise 建立一套统一的 Method Registry（方法注册表），把人物、方法、策略、指标、风控规则纳入同一套记录、筛选、评估与演进机制。

---

## 1. 为什么要有 Method Registry

随着 StockWise 持续演进，团队一定会不断遇到新的外部输入：

1. 某位大师
2. 某套交易法
3. 某个量化策略
4. 某个技术指标
5. 某种风控规则
6. 某种组合配置思想

如果没有统一注册表，系统很容易变成：

1. 靠记忆管理
2. 靠口头印象推进
3. 靠个别人的偏好决定优先级
4. 靠零散实验积累，没有结构化沉淀

Method Registry 的目标不是“收藏方法”，而是：

**把所有外部方法输入，变成可被追踪、比较、筛选、复用的内部知识资产。**

> [!TIP]
> **评估公理**：在对各类型方法进行登记与评估时，必须遵循 [05 量化信号验证与执行公理](../0_Strategy/05_Quant_Signal_and_Execution_Axioms.md) 中的“信号与执行分离”原则。

---

## 2. 它到底登记什么

Method Registry 不是只登记“策略”。

它应该登记五类对象：

### A. 人物 / 思想源

例如：

1. 巴菲特
2. 芒格
3. 埃尔德
4. 海龟团队
5. 威廉欧奈尔
6. Minervini

作用：

- 记录思想来源，不直接等于可执行规则

### B. 方法 / 体系

例如：

1. 海龟交易法
2. Triple Screen
3. CAN SLIM
4. 价值投资框架
5. 趋势跟随体系

作用：

- 记录完整方法学体系

### C. 策略原型

例如：

1. `trend_breakout`
2. `multi_timeframe_trend`
3. `quality_growth`
4. `mean_reversion`
5. `value_guardrail`

作用：

- 成为 Research Quant Lane 的核心母策略分类

### D. 规则组件

例如：

1. `macd_crossover`
2. `dual_ma_trend`
3. `atr_stop`
4. `donchian_breakout`
5. `volume_expansion`
6. `boll_reversion`

作用：

- 成为可组合、可替换、可回测的策略零件

### E. 风控 / 组合规则

例如：

1. 固定止损 5%
2. ATR 风险单位
3. 最大回撤闸门
4. 波动率仓位调整
5. 单行业暴露上限

作用：

- 成为正式治理与上线约束的一部分

---

## 3. 注册表的顶层模型

每个登记对象，都应该统一抽象为一个 `Method Card`。

不管它是：

1. 大师
2. 方法
3. 策略
4. 指标
5. 风控规则

都先进入同一个对象模型。

## 3.1 Method Card 的最小字段

### 基础识别

1. `id`
2. `name`
3. `type`
4. `source`
5. `created_at`
6. `updated_at`

### 类型字段

`type` 只能取以下值之一：

1. `master`
2. `methodology`
3. `strategy_archetype`
4. `rule_component`
5. `risk_rule`
6. `portfolio_rule`
7. `explanation_framework`

### 方法归属字段

1. `worldview_layer`
2. `research_layer`
3. `product_layer`
4. `belongs_to`
5. `inspired_by`

### 评估字段

1. `quantifiability`
2. `explainability`
3. `data_requirements`
4. `execution_feasibility`
5. `fit_for_stockwise`
6. `current_status`

### 运行字段

1. `registry_status`
2. `research_status`
3. `production_status`
4. `owner`
5. `notes`

---

## 4. 每种对象在注册表中的差别

虽然统一成一张卡，但不同类型的重点不同。

## 4.1 `master`

例如：

- 巴菲特
- 芒格
- 埃尔德

重点记录：

1. 世界观
2. 研究原则
3. 可转译的思想
4. 不可直接量化的部分

通常不直接进入回测引擎。

## 4.2 `methodology`

例如：

- 海龟交易法
- Triple Screen
- CAN SLIM

重点记录：

1. 母策略类型
2. 核心纪律
3. 可拆出的规则组件
4. 适合进入研究线还是解释层

## 4.3 `strategy_archetype`

例如：

- `trend_breakout`
- `quality_growth`

重点记录：

1. 属于哪类市场假设
2. 适用市场环境
3. 当前是否是重点研究方向

## 4.4 `rule_component`

例如：

- `macd_crossover`
- `dual_ma_trend`
- `atr_stop`

重点记录：

1. 输入数据
2. 规则定义
3. 可组合位置
4. 是否已回测
5. 是否为 baseline / shadow / candidate

## 4.5 `risk_rule`

例如：

- 固定止损 5%
- ATR 风险单位

重点记录：

1. 风险类型
2. 作用范围
3. 与哪些策略兼容
4. 是否强制

---

## 5. 注册表的状态机

每张卡必须处在一个清晰状态里。

## 5.1 Registry 状态

表示它在知识库中的登记状态：

1. `captured`
2. `classified`
3. `reviewed`
4. `deprecated`

## 5.2 Research 状态

表示它在后台研究中的状态：

1. `parked`
2. `researching`
3. `baseline`
4. `shadow`
5. `candidate`
6. `rejected`

## 5.3 Production 状态

表示它在正式产品中的状态：

1. `not_allowed`
2. `indirect_only`
3. `overlay_only`
4. `mode_candidate`
5. `adopted_component`

这三套状态不能混用。

例如：

- 巴菲特可以是：
  - `registry_status = reviewed`
  - `research_status = parked`
  - `production_status = indirect_only`

- `atr_stop` 可以是：
  - `registry_status = reviewed`
  - `research_status = baseline`
  - `production_status = adopted_component`

---

## 6. 一张卡如何被评估

每个对象进入注册表后，都应该按统一问题评估。

## 6.1 通用评估维度

1. `Is it quantifiable?`
   - 能否量化
2. `Is it testable?`
   - 能否回测与验证
3. `Is it explainable?`
   - 能否进入用户解释层
4. `Is it composable?`
   - 能否和已有组件组合
5. `Is it product-safe?`
   - 是否适合产品化
6. `Is it execution-realistic?`
   - 是否符合当前执行现实

## 6.2 评分建议

每一维可用三档：

1. `low`
2. `medium`
3. `high`

也可以未来升级成 1-5 分制。

## 6.3 结论输出

最终只能进入以下之一：

1. `thought_source`
2. `research_principle`
3. `archetype_baseline`
4. `component_library`
5. `risk_overlay`
6. `explanation_overlay`
7. `mode_candidate`
8. `reject`

---

## 7. 这张表怎么和产品模型对接

Method Registry 不是孤立文档。

它必须和 StockWise 现有产品模型对接。

## 7.1 与动作语义的关系

注册表中的对象，**默认不能直接面向用户输出**。

用户最终仍然只看：

1. 建议看多
2. 建议观察
3. 建议防守
4. 暂无信号

## 7.2 与投资模式的关系

注册表中的对象，也**默认不能直接变成用户模式**。

用户模式仍应保持：

1. 稳健
2. 平衡
3. 进取
4. 仅观察

只有当某个对象真正影响：

1. 风险风格
2. 动作密度
3. 模式分层

它才有资格成为 `mode_candidate`。

## 7.3 与后台研究的关系

这是 Method Registry 最重要的落点。

它将决定：

1. 哪些对象进入 Research Quant Lane
2. 哪些对象成为 baseline
3. 哪些对象进入组件库
4. 哪些对象只保留为思想来源

---

## 8. 典型对象如何建卡

## 8.1 巴菲特

```yaml
id: master_buffett
name: Warren Buffett
type: master
source: Berkshire Hathaway letters / value investing tradition
worldview_layer: business_quality_long_term
research_layer: research_principle
product_layer: indirect_only
quantifiability: low
explainability: high
fit_for_stockwise: medium
registry_status: reviewed
research_status: parked
production_status: indirect_only
notes:
  - Good for worldview and valuation guardrails
  - Not suitable as direct user-facing mode
```

## 8.2 海龟交易法

```yaml
id: methodology_turtle
name: Turtle Trading
type: methodology
source: trend-following breakout system
worldview_layer: trend_following
research_layer: strategy_archetype
product_layer: indirect_only
quantifiability: high
explainability: medium
fit_for_stockwise: high
registry_status: reviewed
research_status: baseline
production_status: indirect_only
notes:
  - Good as breakout trend baseline
  - Should not directly become turtle_mode
```

## 8.3 MACD 金叉

```yaml
id: component_macd_crossover
name: MACD Crossover
type: rule_component
source: indicator-based timing signal
worldview_layer: momentum_confirmation
research_layer: component_library
product_layer: indirect_only
quantifiability: high
explainability: medium
fit_for_stockwise: medium
registry_status: classified
research_status: researching
production_status: not_allowed
notes:
  - Candidate timing component
  - Needs regime testing before adoption
```

## 8.4 ATR 止损

```yaml
id: riskrule_atr_stop
name: ATR Stop
type: risk_rule
source: volatility-based stop control
worldview_layer: risk_first
research_layer: risk_overlay
product_layer: adopted_component
quantifiability: high
explainability: high
fit_for_stockwise: high
registry_status: reviewed
research_status: baseline
production_status: adopted_component
notes:
  - Strong candidate for replacing fixed stop in some archetypes
```

---

## 9. 对工程实现的建议

## 9.1 第一阶段：先做文档化注册表

先不要急着做数据库和后台页面。

第一步先做：

1. `registry/masters/`
2. `registry/methodologies/`
3. `registry/archetypes/`
4. `registry/components/`
5. `registry/risk_rules/`

每个对象一张 yaml / json / md 卡。

## 9.2 第二阶段：再做研究联动

让 Research Quant Lane 能读取这些卡，形成：

1. baseline 候选池
2. 组件候选池
3. reject / parked 清单

## 9.3 第三阶段：再做后台 UI

最终再做成后台可视化：

1. 方法注册表总览
2. 当前状态
3. 最近实验
4. 是否允许进入生产候选

---

## 10. 最终原则

Method Registry 的目的不是让团队变成“策略收藏家”。

它的目的，是把所有外部输入统一变成可管理资产。

一句话结论：

> 大师、方法、策略、指标、风控规则，  
> 都可以进入 StockWise 的统一框架；  
> 但它们进入的不是同一层，  
> 也不是都能直接变成产品模式。

