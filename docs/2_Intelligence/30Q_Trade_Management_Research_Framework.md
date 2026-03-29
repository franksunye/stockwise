---
title: "30Q 交易管理研究框架 (Trade Management Research Framework)"
doc_id: "intelligence-trade-management-research-framework"
doc_domain: "intelligence"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-29"
summary: "定义 StockWise 交易管理研究的目标、边界、方法、评估尺子、正式基线与下一阶段路线，是后续启动与迭代的研究母本。"
---

# 30Q 交易管理研究框架 (Trade Management Research Framework)

## 1. 文档定位

本文件只保留交易管理这条能力线后续真正需要反复对齐的内容：

1. 我们到底在研究什么
2. 和信号发现的边界是什么
3. 研究方法和评估标准是什么
4. 当前已经证明到哪一步
5. 下一阶段该怎么继续

不再保留：

- 过程性讨论
- 中间试错痕迹
- 早期局部结论的完整流水账

专项工程细节与阶段性证据，统一下沉到：

- [42 交易管理研究架构草图](/Users/yesun/Code/stockwise/docs/1_Engineering/42_Trade_Management_Research_Architecture_20260327.md)
- [43 交易管理工程与性能基线](/Users/yesun/Code/stockwise/docs/1_Engineering/43_Trade_Management_POC_02171_20260328.md)

---

## 2. 一句话定义

**StockWise 的交易管理研究，不是寻找一个抽象的“最会卖股票”的万能规则，而是在明确信号、持仓状态和目标函数后，用历史样本持续比较哪种管理动作更适合被产品化。**

---

## 3. 研究对象与边界

### 3.1 交易管理回答什么

交易管理研究回答：

- 已有仓位后，如何继续持有、减仓、退出或等待确认
- 如何减少利润回吐
- 如何控制回撤
- 如何把经验动作转成可验证规则

### 3.2 信号研究回答什么

信号研究回答：

- 这个 setup 值不值得参与
- 结构质量是否足够
- 方向判断是否成立

### 3.3 必须写死的边界

1. `Signal Quality` 不等于 `Trade Management Quality`
2. 交易管理与信号发现必须逻辑解耦、数据相连
3. 信号层回答“市场现在是什么机会状态”
4. 管理层回答“这笔仓现在该怎么处理”

---

## 4. 总目标与阶段目标

### 4.1 长期目标

长期目标可以写成：

**与信号系统联动后，逐步形成一个在长窗口里更稳、并最终具备长期跑赢市场潜力的完整决策系统。**

### 4.2 当前阶段目标

当前阶段不应直接写成“必须长期稳定跑赢市场”，而应分三层推进：

1. 先成为可靠的风险结构优化器
2. 再在部分市场和窗口里实现收益增强
3. 最后才追求长期稳定跑赢市场

### 4.3 当前正式定位

截至当前阶段，`Trade Management v1` 的正式定位是：

**已证明的风险结构优化器。**

它已经能改善：

- 回撤
- 利润回吐
- 风险收益质量

但还不是已证明“长期稳定跑赢市场”的终局模型。

---

## 5. 研究方法

### 5.1 基本方法

当前统一方法是：

1. 先建立持仓状态机
2. 再定义管理策略
3. 再做同入场、同观察窗的策略比较
4. 再扩到组合级表现
5. 最后才讨论产品默认规则

### 5.2 当前方法约束

1. 先方法成立，后样本扩大
2. 不把样本内最优当成产品默认
3. 不把个别成功 case 当成模型证明
4. 先证明“增益存在”，再证明“整机业绩”

### 5.3 当前研究底座

分市场正式研究池已经固定为：

- `CN core 500`
- `HK core 180`

当前正式输入链固定为：

- `daily_prices`
- `ai_predictions_v2 (rule-engine primary)`
- `quant_tradeability_signals (tradeability_v2)`

---

## 6. 模型骨架

### 6.1 状态机 V1

固定六状态：

1. `EntryTriggered`
2. `BreakoutPending`
3. `TrendHolding`
4. `ProfitProtection`
5. `FailureRisk`
6. `ExitCompleted`

当前状态机回答的不是“股票是什么”，而是：

**这笔仓当前处于什么阶段。**

### 6.2 路由结构

当前正式采用双 lane：

1. `baseline_3d`
   - 默认 first pass
2. `low_risk_5d`
   - 仅对低分端 second pass 复核

当前默认路由规则：

- 先跑 `baseline_3d`
- 若落入 `score_low`，再跑 `low_risk_5d`
- 只有 second pass 风险分数 `>= 8`，才允许接管

### 6.3 当前管理策略集合

当前正式比较和路由所依赖的策略包括：

- `buy_and_hold_baseline`
- `partial_take_profit_33`
- `partial_take_profit_50`
- `discipline_exit_only`
- `failure_risk_reduce_50`
- `failure_risk_exit_all`

---

## 7. 评估标准

交易管理模型之后一律按统一评分板评估，而不是只看收益。

### 7.1 五项正式评估标准

1. `结果分布改善`
   - `avg_return`
   - `median_return`
   - `tail_loss`
   - `best_case_gap`
2. `回撤与利润回吐控制`
   - `max_drawdown`
   - `profit_giveback`
   - `failure_risk_loss`
3. `稳定性与泛化`
   - `temporal_split_consistency`
   - `cross_market_consistency`
   - `lane_stability`
4. `可解释与可执行`
   - 状态是否清楚
   - 动作是否明确
   - 纪律线是否可执行
5. `目标函数一致性`
   - 比较任何策略前，必须先说明优先优化什么

### 7.2 产品层收口原则

内部研究允许复杂，前台必须收口成：

1. `状态`
2. `动作`
3. `纪律`

交易管理产品价值，不是展示更多指标，而是把复杂研究压缩成可执行纪律。

---

## 8. 行业参考与我们的判断

### 8.1 行业现实

行业里有很多公开的量化模型、开源框架和阶段性跑赢策略，但几乎没有一个公开、通用、长期稳定跑赢市场的“开源圣杯模型”。

因此：

1. 不应闭门造车
2. 也不应幻想直接拿一个开源策略解决问题

### 8.2 正确路线

StockWise 应该：

- 借行业成熟框架做研究和验证
- 守住自己的产品骨架：
  - 状态机
  - 管理策略
  - 执行方式
  - 建议卡

一句话：

**借框架，不借灵魂。**

---

## 9. 当前正式基线

### 9.1 研究级结论

截至当前阶段，交易管理这条线已经正式证明：

1. 它不是概念，而是可运行、可比较、可回测的研究系统
2. 它已经拥有：
   - 正式样本池
   - 正式状态机
   - 正式路由规则
   - 正式评分卡

### 9.2 组合级 12M 基线

当前最新正式性能基线来自：

- [trade_management_portfolio_baseline_cn500_12m_20260329.json](/Users/yesun/Code/stockwise/backend/management/research/cases/trade_management_portfolio_baseline_cn500_12m_20260329.json)
- [trade_management_portfolio_baseline_hk180_12m_20260329.json](/Users/yesun/Code/stockwise/backend/management/research/cases/trade_management_portfolio_baseline_hk180_12m_20260329.json)
- [trade_management_portfolio_baseline_cnhk680_12m_20260329.json](/Users/yesun/Code/stockwise/backend/management/research/cases/trade_management_portfolio_baseline_cnhk680_12m_20260329.json)
- [trade_management_performance_proof_v2_12m_20260329.json](/Users/yesun/Code/stockwise/backend/management/research/cases/trade_management_performance_proof_v2_12m_20260329.json)

#### CN500（12M）

- baseline：`+6.36%`
- routed：`+5.38%`
- 改善：`-0.98%`
- 回撤：`-6.91% -> -6.02%`
- 相对 `沪深300ETF`：
  - baseline：`-0.11%`
  - routed：`-1.09%`

正式判断：

- 更稳，但不是更赚
- 当前更像风险优化器，而不是收益放大器

#### HK180（12M）

- baseline：`+0.42%`
- routed：`+0.72%`
- 改善：`+0.30%`
- 回撤：`-1.11% -> -0.88%`
- 相对 `恒生指数ETF`：
  - baseline：`-2.42%`
  - routed：`-2.11%`

正式判断：

- 在池内继续实现收益与回撤双改善
- 但仍未跑赢市场基准

#### CN+HK680（12M）

- baseline：`+4.79%`
- routed：`+4.15%`
- 改善：`-0.64%`
- 回撤：`-5.23% -> -4.53%`

正式判断：

- 合并组合依然体现为：
  - 更低回撤
  - 更低波动
  - 略优风险收益质量
- 但没有把总收益进一步做高

### 9.3 当前最准确的用户表达

当前最准确的对外表达，不是：

- “这是一套已经成熟的跑赢指数模型”

而是：

**这是一套已经证明能改善持仓风险结构、并在部分市场环境里提升收益质量的交易管理模型。**

---

## 10. 产品化方向

### 10.1 当前产品化对象

交易管理当前已长出正式产品对象：

- 持仓主记录
- 成交事件时间线
- 建议卡
- 建议历史
- 后台 advice loop

### 10.2 当前消息产品化原则

建议卡已经从“静态建议卡”升级成：

**带最近执行上下文的剩余仓位决策卡。**

执行决策输出按三层理解：

1. `判断层`
   - 当前状态、成功分支、失败分支
2. `执行层`
   - 默认执行方式、备选执行方式
3. `依据层`
   - 为什么推荐这个执行方式

在企业微信 webhook 里，当前最合适的布局是：

- 主卡承载：判断层 + 主执行层
- 第二条文本承载：依据层

---

## 11. 下一阶段

当前已经不需要继续证明“有没有交易管理模型”，下一阶段重点是：

1. 做更真实的组合级证明：
   - 资金复用
   - 交易成本
   - 仓位约束
2. 做整机联动回测：
   - 信号发现 + 交易管理
3. 做用户侧表现页：
   - 收益
   - 回撤
   - 超额
   - 风险收益比

一句话：

**当前阶段的任务已经从“证明交易管理存在”转为“把它做成一条更真实、更长期、更能对用户交代清楚的能力线”。**
