---
title: "43 交易管理工程与性能基线（Trade Management Engineering & Baseline）"
doc_id: "engineering-trade-management-poc-02171-20260328"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-29"
summary: "收口交易管理专项的工程闭环、核心对象、代表性单票验证、组合级性能基线与当前产品化状态，用于后续启动与衔接。"
---

# 43 交易管理工程与性能基线

## 1. 文档定位

本文件不再保留专项全过程流水账，只保留工程侧真正需要继续承接的内容：

1. 当前已经完成了什么
2. 当前有哪些正式对象和链路
3. 单票 POC 证明了什么
4. 组合级性能基线是什么
5. 当前产品化已经走到哪一步

研究母本见：

- [30Q 交易管理研究框架](/Users/yesun/Code/stockwise/docs/2_Intelligence/30Q_Trade_Management_Research_Framework.md)

---

## 2. 当前工程闭环

截至当前阶段，交易管理已经不是研究草图，而是一条可运行的后台产品闭环：

1. 用户持仓对象
2. 成交事件时间线
3. 持仓状态快照
4. 交易管理建议生成
5. 建议历史留痕
6. webhook 建议卡发送
7. ADMIN 持仓管理与详情页联动

### 2.1 已形成的核心对象

#### `user_trade_positions`

持仓主记录，负责：

- 用户
- 标的
- 原始仓位
- 当前剩余仓位
- 建仓成本
- 当前状态

#### `user_trade_position_events`

成交事件时间线，负责：

- 多次加仓
- 多次减仓
- 清仓
- 最近操作摘要

#### `trade_management_advice_log`

建议历史，负责：

- 当前建议
- 发送状态
- 卡片内容
- 调试上下文

### 2.2 当前后台链路

正式链路已经是：

`持仓主记录 -> 事件时间线 -> 剩余仓位回算 -> 状态快照 -> 建议生成 -> webhook 卡片 -> advice log`

这意味着交易管理已经开始具备真正的持仓生命周期能力，而不是静态建议。

---

## 3. 当前模型与路由

### 3.1 状态机

当前固定使用 `Trade Management State Machine V1`：

1. `EntryTriggered`
2. `BreakoutPending`
3. `TrendHolding`
4. `ProfitProtection`
5. `FailureRisk`
6. `ExitCompleted`

### 3.2 当前路由

正式双 lane：

- `baseline_3d`
- `low_risk_5d`

当前默认逻辑：

1. 先跑 `baseline_3d`
2. 若落入 `score_low`，再跑 `low_risk_5d`
3. second pass 分数 `>= 8` 才允许接管

### 3.3 当前策略集合

- `buy_and_hold_baseline`
- `partial_take_profit_33`
- `partial_take_profit_50`
- `discipline_exit_only`
- `failure_risk_reduce_50`
- `failure_risk_exit_all`

---

## 4. 单票 POC 结论：02171

### 4.1 为什么保留 `02171`

`02171 科济药业-B` 是当前专项最好的主 POC：

- 有明确盈利路径
- 有 `ProfitProtection`
- 有 `FailureRisk`
- 有部分止盈与剩余仓位管理语境

### 4.2 当前单票结论

单票 POC 已经证明：

1. 同一标的在不同入场上下文下，会进入不同状态路径
2. `ProfitProtection` 与 `FailureRisk` 都有真实案例支撑
3. 策略集合可以基于同一状态机做正式比较
4. 用户真实持仓现在已经可被表达为：
   - 原始仓位
   - 当前剩余仓位
   - 最近操作
   - 当前建议

### 4.3 当前真实持仓产品化表达

当前真实样例已支持：

- 原始 `4000`
- 当前剩余 `3000`
- 最近减仓：`2026-03-27 减仓 1000 @ 17.58`
- 对剩余仓位继续给出决策卡

这说明当前系统已经从“给一笔仓建议”进化到：

**对一段持仓生命周期给建议。**

---

## 5. 当前性能基线资产

### 5.1 研究样本池

当前正式样本池包括：

- `CN full-stack 500-case`
- `HK full-stack 180-case`
- `CN+HK full-stack 680-case`

正式资产：

- [cn_fullstack_12m_cases_20260329.json](/Users/yesun/Code/stockwise/backend/management/research/cases/cn_fullstack_12m_cases_20260329.json)
- [hk_fullstack_12m_cases_20260329.json](/Users/yesun/Code/stockwise/backend/management/research/cases/hk_fullstack_12m_cases_20260329.json)
- [cnhk_fullstack_12m_cases_20260329.json](/Users/yesun/Code/stockwise/backend/management/research/cases/cnhk_fullstack_12m_cases_20260329.json)

### 5.2 组合级性能基线

当前正式组合基线资产：

- [trade_management_portfolio_baseline_cn500_12m_20260329.json](/Users/yesun/Code/stockwise/backend/management/research/cases/trade_management_portfolio_baseline_cn500_12m_20260329.json)
- [trade_management_portfolio_baseline_hk180_12m_20260329.json](/Users/yesun/Code/stockwise/backend/management/research/cases/trade_management_portfolio_baseline_hk180_12m_20260329.json)
- [trade_management_portfolio_baseline_cnhk680_12m_20260329.json](/Users/yesun/Code/stockwise/backend/management/research/cases/trade_management_portfolio_baseline_cnhk680_12m_20260329.json)
- [trade_management_performance_proof_v2_12m_20260329.json](/Users/yesun/Code/stockwise/backend/management/research/cases/trade_management_performance_proof_v2_12m_20260329.json)

### 5.3 当前正式数字

#### CN500（12M）

- baseline：`+6.36%`
- routed：`+5.38%`
- 改善：`-0.98%`
- 回撤：`-6.91% -> -6.02%`

#### HK180（12M）

- baseline：`+0.42%`
- routed：`+0.72%`
- 改善：`+0.30%`
- 回撤：`-1.11% -> -0.88%`

#### CN+HK680（12M）

- baseline：`+4.79%`
- routed：`+4.15%`
- 改善：`-0.64%`
- 回撤：`-5.23% -> -4.53%`

### 5.4 当前工程侧结论

工程侧当前最重要的结论不是“模型已经赢麻了”，而是：

1. 交易管理模型已经有正式的长窗口组合级基线
2. 它已经稳定证明了风险结构改善
3. 它还没有证明自己是长窗口的统一收益放大器

这意味着：

**后续优化不应再只盯收益，而应围绕“风险优化器 -> 收益与风险双优化器”的升级展开。**

---

## 6. 当前产品化状态

### 6.1 当前卡片定位

当前 webhook / 后台建议卡已经不是静态建议卡，而是：

**带最近执行上下文的剩余仓位决策卡。**

### 6.2 当前卡片结构

当前产品化卡片按三层理解：

1. `判断层`
   - 当前状态
   - 成功分支
   - 失败分支
2. `执行层`
   - 默认执行方式
   - 备选执行方式
   - 当前建议对象是整笔仓还是剩余仓位
3. `依据层`
   - 为什么默认推荐这个执行方式

在企业微信 webhook 中，当前最佳落地方式是：

- 主卡承载判断层 + 主执行层
- 第二条文本承载依据层

### 6.3 当前后台产品状态

当前可以把交易管理正式视为：

**Internal Beta v1**

它已经具备：

- 后台录入与管理
- 自动 advice loop
- webhook 卡片
- 去重发送
- ADMIN 界面
- 详情联动

---

## 7. 之后怎么继续

当前后续重点已经很清楚：

### 7.1 研究侧

1. 更真实的资金复用
2. 交易成本
3. 仓位约束
4. 信号发现 + 交易管理的完整系统回测

### 7.2 产品侧

1. 已实现盈亏
2. 建议 vs 实际执行偏差视图
3. 更多执行模式与用户风格路由

### 7.3 工程侧

1. 保持核心对象稳定：
   - 持仓
   - 事件
   - 建议
2. 保持表现层可替换：
   - webhook
   - ADMIN
   - 未来 C 端

---

## 8. 一句话总结

截至当前阶段，交易管理专项已经完成从：

- 研究想法
- 单票 POC
- 正式样本池
- 组合级性能基线
- 后台内部试用产品

的一次完整收口。

后续不再是“要不要做交易管理”，而是：

**如何把当前这条已经成立的能力线，继续做得更真实、更长期、更像完整产品。**
