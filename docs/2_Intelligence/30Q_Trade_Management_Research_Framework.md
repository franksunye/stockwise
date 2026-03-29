---
title: "30Q 交易管理研究框架 (Trade Management Research Framework)"
doc_id: "intelligence-trade-management-research-framework"
doc_domain: "intelligence"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-27"
summary: "定义 StockWise 交易管理研究的目标、边界、目标函数、研究对象与第一期路线，是未来执行卡与管理策略产品化的研究母本。"
---

# 30Q 交易管理研究框架 (Trade Management Research Framework)

## 1. 这份文档解决什么问题

本文件只回答一件事：

**当 StockWise 已经能给出“建议进场 / 观察 / 防守 / 暂无信号”后，系统如何进一步研究“已有仓位该怎么管”。**

它不讨论：

- 物理交易执行
- 券商接口
- 高频撮合
- 账户托管

它聚焦的是第二条核心主线：

**Trade Management**

也就是：

- 何时部分止盈
- 何时继续持有
- 何时跌破纪律位退出
- 何时允许加仓
- 何时移动止损

---

## 2. 先给结论

### 2.1 交易管理是独立研究对象

交易管理不是信号层的附属提示，也不是 `Investment Mode` 的一句文案延伸。

它必须作为独立研究对象成立。

### 2.2 交易管理不存在脱离目标函数的“唯一最优”

任何“最优管理方案”都必须先回答：

1. 你优化的是期望收益吗？
2. 你优化的是回撤吗？
3. 你优化的是利润回吐吗？
4. 你优化的是稳定性与可执行性吗？

因此，未来所有交易管理研究，必须显式绑定目标函数。

### 2.3 正确路线不是重造通用回测引擎

StockWise 不应自己重造完整通用回测基础设施。

更合理的路线是：

1. 采用成熟量化框架承接回测与模拟基础能力
2. 自己构建：
   - `Position State`
   - `Management Policy`
   - `Evaluation Objective`
   - 用户侧执行卡映射

---

## 3. 交易管理研究和信号研究的边界

### 3.1 信号研究回答什么

信号研究回答：

- 这个入场点有没有抓到值得出手的机会
- 这个 setup 是否具备足够的结构质量
- 这个判断是否通过验证

### 3.2 交易管理研究回答什么

交易管理研究回答：

- 机会已经出现后，怎样处理持仓更合理
- 如何减少利润回吐
- 如何控制回撤
- 如何把“主观经验”变成“可验证规则”

### 3.3 一个必须写死的判断

同一个信号可以是“对的”，但某种持有方式仍然可能很差。

因此：

- `Signal Quality` 不等于 `Trade Management Quality`
- `Validator` 不应继续承担交易管理优劣判定
- 交易管理必须建立独立研究口径

---

## 4. 交易管理研究的核心对象

### 4.1 Position State

交易管理研究必须新增一个对象：

`Position State`

它至少应描述：

- `entry_price`
- `position_size`
- `holding_days`
- `unrealized_pnl_pct`
- `max_favorable_excursion`
- `max_adverse_excursion`
- `partial_exit_done`
- `current_stop`
- `current_target`

### 4.2 Management Policy

`Management Policy` 是一组状态到动作的映射规则。

例如：

- 浮盈达到阈值且接近压力位，卖出 1/3
- 突破确认且量能延续，继续持有
- 有效跌破纪律位，全部退出
- 失败突破，优先反弹减仓

### 4.3 Policy Result

每个策略最终都必须转成一组可比较结果：

- 收益
- 最大回撤
- 利润回吐
- 胜率
- 稳定性

### 4.4 Trade Management State Machine V1

第一阶段正式采用六状态，不再继续泛化：

1. `EntryTriggered`
   - 新信号刚成立，核心任务是控制初始错误。
2. `BreakoutPending`
   - 接近或刚触及确认位，核心任务是防假突破。
3. `TrendHolding`
   - 趋势延续条件仍在，核心任务是避免过早下车。
4. `ProfitProtection`
   - 已有明确浮盈，核心任务是防利润回吐。
5. `FailureRisk`
   - 结构失真或风险抬升，核心任务是先降风险。
6. `ExitCompleted`
   - 本轮管理结束，转入观察与复盘。

这六个状态的作用不是“描述股票是什么”，而是“描述这笔仓当前处于什么阶段”。

### 4.5 状态转移原则 V1

第一阶段只允许少量、可解释的状态转移：

1. `EntryTriggered -> BreakoutPending`
   - 当价格接近或触及确认位，但尚未形成稳定趋势
2. `BreakoutPending -> TrendHolding`
   - 当突破确认成立且趋势延续条件仍在
3. `TrendHolding -> ProfitProtection`
   - 当浮盈达到阈值，管理目标从“抓机会”切换为“保利润”
4. `BreakoutPending / TrendHolding / ProfitProtection -> FailureRisk`
   - 当信号转弱、纪律位失守或结构明显失真
5. `FailureRisk -> ExitCompleted`
   - 当退出动作完成

说明：

- `Investment Mode` 不改写状态定义
- `Investment Mode` 只影响同一状态下动作强度

---

## 5. 研究目标函数

未来比较管理策略时，默认至少比较以下四类目标：

1. `expected_return`
   - 期望收益
2. `max_drawdown_control`
   - 最大回撤控制
3. `profit_giveback_control`
   - 利润回吐控制
4. `stability_score`
   - 稳定性与跨样本一致性

补充说明：

对于 StockWise 这类 2C 决策产品，未来未必把“收益最大化”作为单一核心目标。

更现实的目标往往是：

- 在可接受收益损失下，显著减少回撤与利润回吐
- 提供用户可执行、可坚持的管理纪律

---

## 5A. 交易管理模型的正式评估标准

从当前阶段开始，StockWise 之后讨论“某个交易管理模型是否更好”，必须默认用同一把尺子比较。

这把尺子不是单一收益，而是五项正式评估标准。

### 5A.1 标准一：结果分布改善 (Distribution Improvement)

先看模型是否真的改善了结果分布，而不是只看个别 case 是否更赚钱。

默认至少比较：

1. `avg_return`
2. `median_return`
3. `tail_loss`
   - 极差样本是否减少
4. `best_case_gap`
   - 与样本内最优动作之间还差多少

这项标准要回答的是：

- 模型有没有把长期结果分布往更好的方向推
- 还是只是把少数样本“做漂亮”

### 5A.2 标准二：回撤与利润回吐控制 (Risk & Giveback Control)

交易管理不能只看“多赚多少”，必须看它有没有实质管住坏结果。

默认至少比较：

1. `max_drawdown`
2. `profit_giveback`
3. `failure_risk_loss`
   - 在 `FailureRisk` 路径下是否显著减少错误硬扛

这项标准要回答的是：

- 它有没有把回撤压下来
- 有没有减少“赚钱票最后没赚到”的情况

### 5A.3 标准三：稳定性与泛化 (Stability & Generalization)

任何交易管理模型，必须能跨样本、跨时间、跨市场站得住。

默认至少比较：

1. `temporal_split_consistency`
   - 时间切分外样本是否仍成立
2. `cross_market_consistency`
   - `CN` 与 `HK` 是否方向一致

### 5C. 当前阶段已经证明了什么

截至 `2026-03-29`，StockWise 对交易管理模型已经正式证明的是：

1. 它已经能作为 `buy-and-hold baseline` 的增益层比较
   - 不是只会讲故事，而是已经能在正式样本池上比较结果
2. 它已经能在 `CN500 / HK180 / CN+HK680` 上持续改善平均结果分布
   - 核心不是单次最优，而是同入场、同观察窗下的平均增益
3. 它已经能明显改善平均回撤与利润回吐
4. 它已经初步通过时间切分外样本检验

当前最硬的一组证明来自：

- 正式样本池：`CN500`
- 观察窗：`2026-03-18` 到 `2026-03-25` 的 6 个入场日，管理窗口 `3` 个交易日
- 对照基线：同入场、同观察窗 `buy-and-hold baseline`
- 参考基准：同窗口 `沪深300`

结果是：

1. `CN500` 平均基线收益约 `-0.48%`
2. `CN500` 路由后平均收益约 `-0.03%`
3. 相对基线改善约 `+0.44%`
4. 同窗口 `沪深300` 平均收益约 `-1.36%`
5. 路由后结果相对 `沪深300` 的平均超额约 `+1.32%`
6. 平均回撤由 `-0.62%` 降到 `-0.30%`
7. 平均利润回吐由 `0.64%` 降到 `0.30%`
8. 时间切分 holdout 为正：`4 / 5`

这些数字证明的是：

- 当前模型已经不是“能不能给建议”
- 而是“已经能在正式样本池上，把同入场基线仓位管理得更好”

但它还没有证明：

- 在 `6M / 12M` 的完整组合级回测里一定稳定跑赢指数
- 它已经是最终产品默认模型

因此，本阶段最准确的结论是：

**交易管理模型的增益已经成立；完整整机业绩背书仍需要后续组合级正式回测。**
3. `lane_stability`
   - 同一 lane 是否只在样本内有效

这项标准要回答的是：

- 它是不是稳定有效
- 还是仅仅在当前样本内有效

### 5A.4 标准四：可解释与可执行 (Explainability & Executability)

对 StockWise 这类 2C 决策产品，黑盒更高收益并不自动等于更好模型。

模型必须能明确回答：

1. 当前状态是什么
2. 为什么建议持有 / 减仓 / 退出
3. 纪律线在哪里
4. 用户能不能照着执行

这项标准要回答的是：

- 模型是不是能被产品化
- 能不能被翻译成用户执行卡

### 5A.5 标准五：目标函数一致性 (Objective Alignment)

交易管理不存在脱离目标函数的统一最优。

因此，每次比较模型时，都必须先说明它主要优化的是哪一类目标：

1. `expected_return`
2. `max_drawdown_control`
3. `profit_giveback_control`
4. `stability_score`
5. `user_executability`

这项标准要回答的是：

- 这个模型到底在为哪类用户价值服务
- 它的优势是不是和产品目标一致

### 5A.6 当前阶段的默认比较顺序

在当前研究阶段，默认按下面顺序比较：

1. 先看 `结果分布改善`
2. 再看 `回撤与利润回吐控制`
3. 再看 `稳定性与泛化`
4. 最后才看 `是否值得产品化`

说明：

- 如果一个模型只能在样本内提高收益，但明显破坏稳定性，不应进入产品默认路线
- 如果一个模型收益略低，但显著改善回撤、利润回吐与执行稳定性，它仍可能更适合 StockWise

### 5A.7 一句话标准

**StockWise 交易管理模型的“好”，不是指它是否总能让单笔交易赚更多，而是指它能否在可解释、可执行的前提下，长期改善收益分布、回撤、利润回吐与外样本稳定性。**

---

## 5B. 行业标准、最佳实践与我们的评分板

### 5B.1 行业上没有“一把最好尺子”

这一点必须先写死：

- 行业没有跨市场、跨资产、跨频率统一适用的单一“最好指标”
- 更准确地说，行业使用的是一套 **评分板 (Scoreboard)**，而不是单一冠军指标

典型量化平台与研究工具默认都会同时输出多类指标，而不是只看收益：

- 收益类：`Net Profit`、`CAGR`
- 风险调整收益：`Sharpe`、`Sortino`
- 回撤类：`Max Drawdown`
- 相对基准：`Alpha`、`Beta`、`Information Ratio`
- 实施成本：`Turnover`
- 尾部风险：`VaR`

### 5B.2 行业最佳实践更接近“四层尺子”

结合主流平台与研究文献，当前最稳定的行业实践可理解为四层：

1. **结果尺子**
   - 收益、收益分布、收益稳定性
2. **风险尺子**
   - 回撤、尾部风险、利润回吐
3. **统计有效性尺子**
   - 外样本、walk-forward、过拟合控制
4. **实施尺子**
   - 是否可执行、是否可解释、是否具备真实可落地性

### 5B.3 对 StockWise 最重要的外部参考

当前阶段最值得固定参考的外部标准，不是“某个绝对 Sharpe 数字”，而是这些方法论：

1. **平台标准统计项**
   - QuantConnect / Backtrader / Pyfolio 都默认输出：
     - 收益
     - Sharpe / Sortino
     - Drawdown
     - Alpha / Beta / Information Ratio
     - Turnover / Tear Sheet 风险项
2. **Walk-forward / 时间切分**
   - 行业不会只看样本内最优结果
3. **PBO：Probability of Backtest Overfitting**
   - 用来衡量样本内最优是否只是过拟合
4. **DSR：Deflated Sharpe Ratio**
   - 对多重测试、非正态分布和选择偏差做修正后的 Sharpe 显著性

### 5B.4 哪些行业线可以被当作“硬约束”

当前可被视为较硬约束的，不是 `Sharpe > X` 这类经验数，而是：

1. `PBO < 0.05`
   - 若显著高于这一水平，应视为高过拟合风险
2. `DSR / PSR` 需要足够高
   - 本质上是在问：当前表现不是运气的概率够不够高

说明：

- `Sharpe > 1`、`> 1.5`、`> 2` 这类数字更像行业经验带
- 不应直接写成跨场景通用真理
- 更适合被用作 StockWise 的内部研究阈值，而不是“行业绝对线”

### 5B.5 StockWise 为什么不能照搬单一行业尺子

因为我们不是纯量化基金研究系统，也不是机构 OMS。

我们的对象是：

- 普通投资者
- 中低频趋势 / 突破 / 风险否决型决策
- 以“状态、动作、纪律”作为最终产品输出

因此，StockWise 的交易管理评估必须在行业评分板之上，再加一层：

- **可解释**
- **可执行**
- **可产品化**

这正是我们与纯量化平台的差异。

### 5B.6 我们的正式做法：内部多尺子，外部单结论

因此，StockWise 正式采用：

1. **研究层**
   - 用多把尺子同时评估模型
2. **系统层**
   - 把研究结果收敛成状态机、动作、纪律线
3. **产品层**
   - 不向用户暴露整套评分板
   - 只输出：
     - 当前状态
     - 建议动作
     - 纪律线

这意味着，行业标准进入 StockWise 的方式不是“直接展示给用户”，而是：

**用行业最佳实践约束内部研究，再把复杂研究压缩成简单、可信、可执行的用户结论。**

### 5B.7 参考来源

- QuantConnect Backtest Statistics  
  https://www.quantconnect.com/docs/v2/cloud-platform/api-reference/backtest-management/read-backtest/backtest-statistics
- QuantConnect Walk Forward Optimization  
  https://www.quantconnect.com/docs/v2/writing-algorithms/optimization/walk-forward-optimization
- Backtrader Analyzers  
  https://www.backtrader.com/docu/analyzers/analyzers/
- Pyfolio API / Tear Sheet  
  https://pyfolio.ml4trading.io/api-reference.html
- Bailey & López de Prado, *The Deflated Sharpe Ratio*  
  https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf
- Bailey et al., *The Probability of Backtest Overfitting*  
  https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf
- Goldberg & Mahmoud, *Drawdown: From Practice to Theory and Back Again*  
  https://arxiv.org/abs/1404.7493

---

## 6. 第一阶段要研究什么

第一阶段不要做复杂多资产组合管理。

只研究最直接、最有产品价值的问题：

### 6.1 已有浮盈仓位的管理

比较这些基础策略：

1. `全持有`
2. `先卖 1/3`
3. `先卖 1/2`
4. `只守纪律位退出`

### 6.2 失败突破处理

研究：

- 跌回确认位是否必须减仓
- 是立即退出，还是反弹减仓更优

### 6.3 二次确认后是否允许加仓

研究：

- 放量站稳确认位后加仓，是否真的提升收益/回撤比

---

## 7. 第一阶段工程与研究原则

### 7.1 先单票案例，再扩展样本

先用真实案例验证框架能不能工作，例如：

- `02171 科济药业-B`

然后再扩展到：

- 同类 setup 小样本
- 研究池多标的样本

这里补一条必须坚持的研究顺序：

**第一阶段以“方法成立”优先于“样本结论成立”。**

也就是说，这一阶段最重要的不是过早宣布某个策略已经统计最优，而是先固定：

- `case` 如何定义
- `Position State` 如何定义
- `path_type` 如何定义
- `policy` 如何比较
- `objective` 如何声明

结论：

- 小样本足以验证方法和方向
- 小样本通常不足以支持产品级规则固化
- 在方法未稳定之前，不应急于追求“最优策略”结论

### 7.2 先做最小策略集

第一阶段只需要：

1. `buy_and_hold_baseline`
2. `partial_take_profit_33`
3. `partial_take_profit_50`
4. `discipline_exit_only`

### 7.3 不把研究结论直接当产品规则

研究层输出的是：

- 候选策略比较
- 适用样本
- 目标函数表现

产品层是否采用，仍要经过：

- 口径审查
- 生产观察
- 用户表达设计

### 7.4 当前阶段基线（2026-03-28）

截至当前，第一阶段已经从“方法能不能成立”推进到“研究基线是否开始稳定”。

当前已经成立的部分：

1. `Trade Management State Machine V1` 已跑通
2. `02171` 单票 POC 与 `100-case` 多标的研究池已形成可复跑闭环
3. 研究已进入外样本时间切分验证
4. 当前最稳的一版透明规则，已经在整体样本与多数时间切分上接近或略优于基准持有

当前仍未成立的部分：

1. 还没有达到“稳定可产品化”的默认规则强度
2. 仍存在少量高分误杀与低分漏判
3. 当前优势仍应理解为“有希望的研究基线”，而非“最终规则”

因此，当前阶段的最准确定位是：

- 不是“已经找到默认交易管理规则”
- 而是“已经形成一条经过外样本验证的研究基线，并开始进入误差结构收敛阶段”

补充说明：

截至当前，这条研究基线可以正式记为：

- `Trade Management Research Baseline v1`

它的含义不是“最终规则定稿”，而是：

- 第一条已经通过单票 POC、`100-case`、多切分外样本验证的可持续研究主线

补充更新：

在继续纯化高风险桶后，研究又新增了一条极窄的保留增量：

- `late_rebuild_seed_candidate`

它的价值不是扩大发散覆盖，而是进一步削减“晚于第 3 日才重新拿回结构”的残余高分硬误杀。  
截至当前，`score_high` 的有害误杀已压到 `0`，且多切分外样本改善仍保持为正。

同时，也已经验证过一版低分补防试探：

- 针对“持续 `RiskOff` 无确认”
- 以及“持续 `NoSetup` 且仍亏损”的停滞路径

这版试探会拉低整体默认规则与外样本稳定性，因此已明确回退，不纳入当前基线。

为保证后续研究可重复推进，当前低分端的 `7` 个有害漏判样本也已固化为独立负样本池，用于后续“二次失真特征”研究。

当前这部分研究也已经明确采用一条更克制的原则：

- 先增加“研究型特征”做审计
- 不直接进入默认规则
- 只有在负样本池与完整样本上都通过验证，才进入基线候选

从当前低分负样本池看，这些研究型特征也开始表现出“分工覆盖”而不是单一重复：

- 一部分样本属于 `FailureRisk -> EntryTriggered/NoSetup` 的假修复回路
- 一部分样本属于“持续 RiskOff，但 PnL 短暂转正”的伪稳定
- 还有极少数属于“持续 NoSetup 且仍亏损”的入场漂移

其中，`secondary_failure_loop_candidate` 已经完成过一轮单独评估：

- 在低分负样本池里局部有效
- 但放回其自然覆盖组后，仍混入较多应继续持有的样本

因此它当前应被视为“值得继续缩窄边界的研究主线”，而不是可以直接进入默认规则的候选。

进一步的阶段判断是：

- 仅凭当前前 `3` 日特征，尚未出现足够干净的早期分界线
- 低分端后续更可能需要“更长观察窗”或“二次失真确认信号”，而不是继续在同一批特征里硬调阈值

当前这条判断也已经得到新的工程验证：

- `5-day early window` 已开始把一部分“假修复后再转坏”的路径直接显性化
- 尤其是 `re_failure_after_recovery` 这类变量，在 `3-day` 下尚不可见，但在 `5-day` 下已开始出现

因此，下一阶段更合理的研究入口是：

- 保持 `3-day` 作为当前基线窗口
- 同时把 `5-day` 作为低分端的下一阶段专门研究窗口

当前这条判断已经有正式对照结果支撑：

- 在完整 `100-case` 上，`5-day` 默认规则整体优于 `3-day`
- 在多切分外样本上，`5-day` 没有破坏稳定性
- 在低分有害样本池上，`5-day` 对“假修复再转坏”路径的识别明显更强

所以现在更准确的表述应该是：

- `3-day` 是当前基线窗口
- `5-day` 是当前低分端的正式 research lane

并且，这条双轨结构已经有了正式工程入口：

- `backend/scripts/compare_management_lanes.py`

也就是说，`3-day baseline lane` 与 `5-day low-risk lane` 不再只是研究口径，而已经成为可重复调用、可对比输出的正式研究入口。

进一步收口后的正式边界是：

1. `3-day baseline lane`
   - 身份：当前默认基线入口
   - 作用：作为全样本 first pass，优先处理整体默认规则与高风险桶判断
   - 使用时机：所有 case 默认先跑这一条
   - 不负责：专门修复低分端“假修复再转坏”路径

2. `5-day low-risk research lane`
   - 身份：当前低分端专项 research lane
   - 作用：补看 `3-day` 下落在 `score_low` 的样本，尤其是二次失真与假修复路径
   - 使用时机：只在 `3-day baseline lane` 首轮结果为 `score_low`，或在 low-side false negatives 专项审计时启用
   - 接管条件：当前只在 `5-day` second pass 自身风险分数达到 `>= 8` 时，才允许覆盖 baseline 的默认推荐
   - 不负责：替代 `3-day baseline lane` 的全样本默认入口，也不单独承担高风险即时退出判断

因此，当前双轨结构的正式原则不是“二选一”，而是：

- 先用 `3-day baseline lane` 做默认 first pass
- 再用 `5-day low-risk research lane` 做低分端 second pass review
- 只有当 second pass 自己也达到接管阈值时，才让 `5-day` 覆盖默认推荐

工程上，这条边界已经在 lane registry 中固化：

- `backend/management/research/lanes.py`

同时，这条双轨方法已经不只存在于 lane compare 工具里，而是进入了默认研究 runner：

- `backend/scripts/compare_management_policies.py`
- `backend/scripts/run_management_research.py`

当前默认路由规则是：

- 先跑 `baseline_3d`
- 若 baseline 落入 `score_low`，再运行 `low_risk_5d`
- 只有当 `5-day` second pass 风险分数达到 `>= 8` 时，才让 second pass 接管最终推荐

### 9.5 分市场研究池底座已经进入正式研究期

交易管理研究现在不应再建立在“零散 AI 主预测 + 短窗 case”之上。

截至当前阶段，本地底座已经完成一轮关键升级：

- 研究窗口正式拉长到近三个月：`2025-12-27..2026-03-27`
- 研究池按市场拆分：
  - `CN core 500`
  - `HK core 180`
- 第一量化模型统一收口为：
  - `rule-engine`
- 输入链正式固定为：
  - `daily_prices`
  - `ai_predictions_v2 (rule-engine primary)`
  - `quant_tradeability_signals (tradeability_v2)`

当前阶段可以把它理解为：

1. `CN`
   - 已有 `425` 个标的同时满足：
     - 三个月价格天数 `>= 50`
     - `rule-engine` 主预测已补齐
     - `tradeability_v2` 已补齐

2. `HK`
   - 已有 `80` 个标的同时满足：
     - 三个月价格天数 `>= 50`
     - `rule-engine` 主预测已补齐
     - `tradeability_v2` 已补齐

这件事的重要性在于：

- 交易管理研究第一次拥有了按市场拆分、输入链完整、且不依赖 LLM 主预测的正式研究底座
- 之后的样本扩展、lane 稳定性、外样本验证，都应建立在这版底座上
- 因此，当前阶段的主任务已经从“补底座”转为“用正式底座继续做研究”

进一步地，当前阶段已经形成正式研究交付物：

- `CN full-stack 500-case`
- `HK full-stack 180-case`
- `CN+HK full-stack 680-case`
- 一份独立交付索引：
  - `backend/management/research/cases/formal_research_delivery_20260328.json`

因此，交易管理研究现在不只是“有方法”，而是已经有一版可复核、可重复运行、可交付的正式研究资产。

这条路由的当前意义，不是宣布产品默认规则已经定型，而是：

- 我们已经有了正式的双轨研究流程
- 这个流程比“无条件让 5-day 接管所有低分样本”更稳
- 它开始把 lane 从研究对象推进成默认方法骨架

---

## 8. 推荐工具路线

### 8.1 推荐原则

不自研通用回测引擎，自研交易管理语言。

### 8.2 推荐路线

1. 用成熟量化框架承接：
   - 回测
   - 参数扫描
   - 绩效计算
2. 在 StockWise 内自研：
   - `Position State Schema`
   - `Management Policy DSL`
   - `Policy Evaluation`
   - `Execution Card Renderer`

### 8.3 采用现成框架的原因

这类框架已经解决了大量基础问题：

- 路径模拟
- 订单事件
- 参数组合比较
- 收益与回撤指标计算

而 StockWise 的真正护城河不在这里，而在于：

- 如何定义管理动作
- 如何把研究结果翻译成用户动作语言

---

## 9. 对产品层的直接影响

当交易管理研究体系成立后，产品层会出现新的正式对象：

1. `Execution Card`
   - 高开 / 平开 / 低开预案
2. `Discipline Line`
   - 明确失效条件
3. `Partial Take Profit Plan`
   - 明确部分止盈比例与触发器
4. `Failed Breakout Plan`
   - 明确突破失败后的动作

但这些能力都必须建立在研究层先成立的前提上。

---

## 10. 一句话总定义

**StockWise 的交易管理研究，不是在寻找一个抽象的“最会卖股票”的万能规则，而是在明确信号、持仓状态和目标函数后，用历史样本持续比较哪种管理动作更适合被产品化。**
