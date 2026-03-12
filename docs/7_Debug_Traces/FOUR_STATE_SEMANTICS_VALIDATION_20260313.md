# 四状态语义有效性核查（2026-03-13）

## 1. 结论

当前使用的四状态语义：

- `TriggeredLong`
- `Watch`
- `RiskOff`
- `NoSetup`

是合理的，而且在仓库内有正式依据。

它们不是照搬某个外部行业标准词表，但与公开交易语境中的常见动作分层高度一致：

- `TriggeredLong` 对应 `entry trigger / breakout / buy point`
- `Watch` 对应 `watchlist / wait for confirmation`
- `RiskOff` 对应 `risk-off / defensive posture / reduce risk`
- `NoSetup` 对应 `no setup / no trade / no signal`

因此，这四个语义本身不需要推翻。当前问题不在语义框架，而在边界表达是否足够锋利。

## 2. 内部正式依据

### 2.1 产品与内容口径

[`four-states-semantics.md`](/Users/yesun/Code/stockwise/docs/5_Support_Ops/content/four-states-semantics.md)

明确写出：

- `TriggeredLong` = 建议进场
- `Watch` = 建议观察
- `RiskOff` = 建议防守
- `NoSetup` = 暂无信号

### 2.2 架构口径

[`13_Quant_Engine_Architecture.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/13_Quant_Engine_Architecture.md)

明确写出：

- QuantEngine 对外暴露的状态永远只有 4 种
- `NoSetup / Watch / TriggeredLong / RiskOff`

### 2.3 领域实体词汇表

[`00_Domain_Entities_Glossary.md`](/Users/yesun/Code/stockwise/docs/3_Product/00_Domain_Entities_Glossary.md)

明确写出：

- `TriggeredLong -> 建议进场`
- `Watch -> 建议观察`
- `RiskOff -> 建议防守`
- `NoSetup -> 暂无信号`

并特别说明：

- `signal` 不存在“休息”概念
- `暂无信号` 仅由 `NoSetup` 表达

这条说明非常关键。它说明 `NoSetup` 不是普通中性观望，而是一个独立动作语义。

### 2.4 兼容映射方案

[`17_Investment_Mode_API_Signal_Unification_Plan.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/17_Investment_Mode_API_Signal_Unification_Plan.md)

明确写出兼容映射：

- `TriggeredLong -> Long`
- `Watch -> Side`
- `RiskOff -> Short`
- `NoSetup -> Side`

这说明旧三态只是兼容投影，不是四状态的来源。

## 3. 外部参照

以下资料不是在证明“行业标准就是这四个词”，而是在验证这四个动作层是否符合公开交易语言。

### 3.1 TriggeredLong 对应 entry trigger / breakout

- TraderLion 关于突破、入场触发、VCP 入场策略：
  - https://traderlion.com/lesson/inside-bars/
  - https://traderlion.com/lesson/module-5-entry-tactics-for-vcp-patterns/

对应判断：

- `TriggeredLong` 不是“看多观点”
- 而是“触发条件成立，可以进入进攻候选状态”

### 3.2 Watch 对应 watchlist / wait for confirmation

- TraderLion 关于 watch、等待确认、突破前观察：
  - https://traderlion.com/profile/richard-moglen/crcl-breakout/
  - https://traderlion.com/profile/richard-moglen/caution-signs-the-market-breaks-lower/

对应判断：

- `Watch` 不是“无机会”
- 而是“有关注价值，但未到出手点”

### 3.3 RiskOff 对应 defensive posture / reduce risk

- StockCharts 关于 risk-on / risk-off 语境：
  - https://articles.stockcharts.com/article/stockcharts-insider-how-to-read-wall-streets-risk-on-playbook/
- TraderLion 关于 long position risk management：
  - https://traderlion.com/lesson/risk-management-for-long-positions/

对应判断：

- `RiskOff` 是独立防守动作
- 不是普通 `Watch`
- 更不是泛泛的中性 `Side`

### 3.4 NoSetup 对应 no setup / no trade

- 公开交易规则里常见的 no-trade / no setup 条件：
  - https://cursa.app/en/page/a-beginners-day-trading-plan-setup-rules-entry-triggers-exits-and-no-trade-conditions
- 社区语境也普遍使用 `no setup` 表达“当前没有高质量机会”：
  - https://www.reddit.com/r/Forex/comments/1j8i4c7

对应判断：

- `NoSetup` 不是“继续观察”
- 它更接近“当前没有值得出手的 setup”

## 4. 当前真正的问题

当前需要解决的，不是四状态本身是否成立，而是这两个边界：

1. `Watch` vs `NoSetup`
   - `Watch` = 有关注价值，但还缺确认
   - `NoSetup` = 当前根本没有值得执行的 setup

2. `TriggeredLong` vs 旧 `Long`
   - `TriggeredLong` = 满足进攻触发条件，可进入候选执行状态
   - 不是旧式的泛方向性“看多”

## 5. 对提示词修订的直接要求

下一轮 prompt 修订应直接围绕以下原则：

1. 不再争论是否保留四状态
   - 保留

2. 强化边界，而不是重复枚举名称
   - 重点写清：
     - `Watch` 不是 `NoSetup`
     - `NoSetup` 不是中性观望
     - `TriggeredLong` 不是旧 `Long`

3. 优先把动作定义写成交易执行语义
   - 而不是抽象标签解释

一句话：

**四状态框架成立，下一步不是换语义，而是把语义边界写得让模型无法偷懒回退。**
