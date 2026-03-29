---
title: "43 交易管理 POC：02171 科济药业-B（2026-03-28）"
doc_id: "engineering-trade-management-poc-02171-20260328"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-28"
summary: "记录交易管理状态机 V1 在 02171 科济药业-B 上的三组正式 case，以及一个本地港股医药负样本对照，用于证明 POC 已从概念进入可回放、可比较的闭环。"
---

# 43 交易管理 POC：02171 科济药业-B（2026-03-28）

## 1. POC 目标

本 POC 不追求证明“哪种管理策略已经统计最优”。

本阶段只验证三件事：

1. `Trade Management State Machine V1` 能否在真实个股上跑通
2. 同一标的在不同入场上下文下，是否会进入不同状态路径
3. 基础管理策略是否已经可以在同一状态机之上做可比较输出

核心标的：

- `02171 科济药业-B`

对照负样本：

- `01167 加科思-B`

---

## 2. 使用的状态机与策略

### 2.1 状态机 V1

固定六状态：

1. `EntryTriggered`
2. `BreakoutPending`
3. `TrendHolding`
4. `ProfitProtection`
5. `FailureRisk`
6. `ExitCompleted`

### 2.2 基础策略集

1. `buy_and_hold_baseline`
2. `partial_take_profit_33`
3. `partial_take_profit_50`
4. `discipline_exit_only`
5. `failure_risk_reduce_50`
6. `failure_risk_exit_all`

---

## 3. 02171 的三组正式 case

### Case A：2026-03-09 入场，成本 13.92

#### 状态路径

`BreakoutPending -> ProfitProtection -> FailureRisk -> ProfitProtection`

#### 观察

1. 这是典型的“快速进入盈利保护期”的路径。
2. 该 case 证明：
   - 状态机不仅能识别上涨后的保护状态
   - 也能识别中途风险回撤，再重新回到盈利保护期

#### 策略比较

1. `buy_and_hold_baseline`
   - 最终收益约 `+25.43%`
2. `partial_take_profit_33`
   - 最终收益约 `+21.70%`
3. `partial_take_profit_50`
   - 最终收益约 `+19.83%`
4. `discipline_exit_only`
   - 与 `buy_and_hold_baseline` 在该窗口内等同

#### 结论

这是当前最能拉开策略差异的 case。

它说明：

- 当个股很早进入 `ProfitProtection` 时，部分止盈会自然牺牲一部分最终收益
- 但这类策略的意义不在“更赚”，而在“为后续利润回吐控制预留正式研究对象”

---

### Case B：2026-03-18 入场，成本 16.62

#### 状态路径

`BreakoutPending -> FailureRisk -> BreakoutPending`

#### 观察

1. 这是最像“真假突破博弈”的路径。
2. 关键窗口出现在 `2026-03-20` 到 `2026-03-24`：
   - 系统明确进入 `FailureRisk`
3. 之后又回到 `BreakoutPending`
   - 说明系统不是单向线性判断，而能反映结构修复

#### 策略比较

1. 最终收益约 `+5.05%`
2. 最大回撤约 `-9.99%`
3. 四个策略在该短窗口内没有显著拉开差异

#### 结论

这个 case 的价值不在于策略收益比较，而在于：

- `FailureRisk` 已经具备真实含义
- 状态机可以把“突破失败风险抬升”单独识别出来

这说明后续“减仓 / 退出”类策略有正式插入点。

补充观察：

- 在本轮工程补充 `failure_risk_reduce_50` 与 `failure_risk_exit_all` 后，这个 case 已能拉开风险路径差异
- 对 `02171` 的 `2026-03-18` case，`FailureRisk` 触发后：
  - `failure_risk_reduce_50` 约为 `-9.27%`
  - `failure_risk_exit_all` 约为 `-8.54%`
- 这说明在“快速进入 FailureRisk、但后续又修复”的路径中，过早风险处置可能显著牺牲后续修复收益

---

### Case C：2026-03-24 入场，成本 15.54

#### 状态路径

`FailureRisk -> BreakoutPending -> ProfitProtection`

#### 观察

1. 这是一个“修复后二次启动”的短路径。
2. 起点本身仍处于 `RiskOff` 背景，因此初始状态是 `FailureRisk`
3. 到 `2026-03-27` 时，快速进入 `ProfitProtection`

#### 策略比较

1. 最终收益约 `+12.36%`
2. `partial_take_profit_33 / 50` 在最后一天触发动作
3. 由于未来窗口到此为止，策略差异暂未在收益上拉开

#### 结论

这个 case 证明：

- 同一只股票并不是只能从“看多起点”进入状态机
- 即使从 `FailureRisk` 起步，也可能在后续转入 `ProfitProtection`

---

## 4. 02171 POC 的阶段性结论

### 4.1 已经被证明的事情

1. 状态机方向成立
   - `02171` 在不同入场日期下进入了不同路径
2. `FailureRisk` 和 `ProfitProtection` 都已经有真实案例支撑
3. 基础策略集已经能在同一状态机之上输出可比较结果
4. 脚本已具备：
   - 最新状态
   - 状态时间线
   - 策略比较
   - 动作日志

### 4.2 还没有被证明的事情

1. 哪种管理策略具有统计上的泛化最优性
2. 部分止盈在更大样本上是否显著降低利润回吐
3. `FailureRisk` 下“减仓 vs 清仓”哪种更优

因此，当前 POC 结论应理解为：

**交易管理状态机已经从概念进入可运行闭环，但策略优劣仍处于小样本研究阶段。**

补充说明：

- 本轮工程已补上 `failure_risk_reduce_50` 与 `failure_risk_exit_all`
- 因此 `FailureRisk` 已不再只是状态标签，而是正式进入策略比较集合
- 但要判断“减仓优于清仓”仍需要扩充更多真实样本

---

## 5. 小样本对照：01167 加科思-B

本地同阶段、同赛道、同市场中，可作为对照的样本非常少。

在 `2026-03-18` 到 `2026-03-27` 的港股医药/生物标的中：

- `02171 科济药业-B` 是主要正样本
- `01167 加科思-B` 是可用的负样本对照

### 5.1 01167 Case A：2026-03-18 入场，成本 6.93

#### 状态路径

`BreakoutPending -> FailureRisk -> EntryTriggered`

#### 观察

1. 与 `02171` 不同，它没有重新进入明确的强趋势状态
2. 中间长期停留在 `FailureRisk`
3. 到 `2026-03-27` 虽然价格反弹，但状态只回到 `EntryTriggered`

#### 策略结果

1. 最终收益约 `+3.17%`
2. 最大回撤约 `-10.10%`
3. 没有进入 `ProfitProtection`
4. 因此部分止盈类策略没有动作

### 5.2 01167 Case B：2026-03-23 入场，成本 6.23

#### 状态路径

`FailureRisk -> ProfitProtection`

#### 观察

1. 这是一个“低位反弹直接进入盈利保护”的短路径
2. 最终收益约 `+14.77%`
3. 但未来窗口过短，部分止盈动作虽触发，策略差异尚未拉开

### 5.3 对照结论

这个负样本说明：

1. 状态机不会把所有反弹都解释成同一种路径
2. 在 `01167` 这类持续停留 `FailureRisk` 的路径里，风险类策略会明显早于基准仓位退出
3. 对 `2026-03-18` case：
   - `failure_risk_reduce_50` 约为 `-3.17%`
   - `failure_risk_exit_all` 约为 `-2.74%`
   - 均显著好于持有到窗口末尾前经历的更深回撤，但也放弃了后段反弹修复
2. `02171` 的“多次 TriggeredLong + Watch + RiskOff 交替”是更完整、更适合做主 POC 的结构样本
3. 在本地当前样本池下，港股医药/生物这段时间可用于同赛道对照的样本确实稀缺

因此，下一步不应假装已经有大样本结论，而应诚实进入：

- `02171` 主样本
- `01167` 负样本
- 再逐步扩到更广的高波动港股或跨市场相似 setup

---

## 6. 当前可交付结论

截至 2026-03-28，POC 已经形成一个可验收闭环：

1. 有正式状态机 V1
2. 有正式策略集
3. 有单票多 case 回放
4. 有小样本负样本对照

## 7. 从 POC 到正式表现证明

截至 `2026-03-29`，交易管理已经不再只有 `02171` 的单票 POC，而是进入正式表现证明阶段。

### 7.1 已完成的正式证明对象

1. `CN500`
2. `HK180`
3. `CN+HK680`

三者都基于：

- 近 `3` 个月正式研究底座
- `rule-engine primary + tradeability_v2 + daily_prices`
- 自动生成正式 case pool
- 统一 `buy-and-hold baseline` 对照

### 7.2 当前最重要的数字

`CN500`：

1. 平均基线收益：约 `-0.48%`
2. 路由后平均收益：约 `-0.03%`
3. 相对基线改善：约 `+0.44%`
4. 平均回撤：由约 `-0.62%` 改善到 `-0.30%`
5. 平均利润回吐：由约 `0.64%` 降到 `0.30%`
6. 时间切分 holdout 为正：`4 / 5`

同窗口 `沪深300` 参考：

1. 平均收益约 `-1.36%`
2. 当前路由后结果相对 `沪深300` 的平均超额约 `+1.32%`

`HK180`：

1. 平均基线收益：约 `-0.62%`
2. 路由后平均收益：约 `-0.47%`
3. 相对基线改善：约 `+0.15%`
4. 时间切分 holdout 为正：`5 / 5`

`CN+HK680`：

1. 平均基线收益：约 `-0.52%`
2. 路由后平均收益：约 `-0.15%`
3. 相对基线改善：约 `+0.37%`
4. 平均回撤与利润回吐都进一步改善

### 7.3 这组证明意味着什么

它证明的是：

1. 当前交易管理模型已经能稳定改善“同入场、同观察窗”的仓位处理结果
2. 当前模型已经不只是一个能给建议的解释系统，而是一个有正式增益的管理层
3. 当前最值得信任的业绩表述，是：
   - 相对同入场 `buy-and-hold baseline` 的改善
   - 以及 `CN500` 对 `沪深300` 同窗口的参考超额

它还不证明：

1. 这是完整 `6M / 12M` 组合级回测的最终答案
2. 这套路由已经足够直接作为终版产品默认模型

所以，当前正确结论不是“已经交出最终业绩”，而是：

**交易管理模型 v1 的正式表现证明已经成立。**

---

## 7. 下一阶段已识别规划（暂不立即开工）

当前 POC 已经从“单笔静态持仓建议”进入“持仓主记录 + 成交事件时间线 + 最新建议”的后台闭环。

下一阶段最值得做、但当前先不继续实现的两条主线如下。

### 7.1 事件时间线驱动的已实现盈亏计算

#### 目标

让系统不再只知道：

- 原始仓位
- 当前剩余仓位
- 最近一次操作

而是正式知道：

- 每一次加仓/减仓对应的已实现盈亏
- 整笔仓位到当前时点的：
  - 已实现盈亏
  - 未实现盈亏
  - 合并总盈亏

#### 为什么重要

如果交易管理要真正进入“生命周期管理”，只看剩余仓位是不够的。

例如：

- 先卖掉的一部分，是否已经锁定主要利润
- 剩余仓位亏损时，整体仍可能是盈利交易
- 同样的 `FailureRisk`，对“已实现利润很厚”和“还没锁利润”的用户，建议强度不应完全相同

#### 预计对象

1. `user_trade_position_events`
   - 保持为真实成交事件源
2. 新增逐事件 realized PnL 计算规则
   - 可采用 FIFO 作为默认成本归因
3. 在 position detail 与 advice source_ref 中补：
   - `realized_pnl_amount`
   - `realized_pnl_pct`
   - `unrealized_pnl_amount`
   - `total_pnl_amount`

#### 阶段顺序建议

1. 先做 SELL 事件的 realized PnL
2. 再处理多次 BUY/SELL 混合的完整成本归因
3. 最后再决定是否支持更复杂的 lot matching

### 7.2 建议卡 / 时间线 / 实际执行偏差视图

#### 目标

把以下三类信息放到同一视角下：

1. 系统当时给出的建议
2. 用户后来实际做的动作
3. 两者之间的偏差

#### 为什么重要

交易管理要成立，不能只回答“系统建议了什么”，还必须回答：

- 用户有没有执行
- 是没执行，还是执行晚了
- 是系统建议本身差，还是用户偏离导致结果变差

这会直接决定：

- 研究口径是否干净
- 产品解释是否可信
- 后续能否进入“执行纪律反馈”

#### 预计视图结构

在单持仓详情页中形成三联动：

1. `Advice Timeline`
   - 每个交易日系统给过什么建议
2. `Execution Timeline`
   - 用户真实发生了哪些加仓/减仓/退出
3. `Drift View`
   - 哪些事件与建议一致
   - 哪些事件偏离建议
   - 偏离后结果是更好还是更差

#### 阶段顺序建议

1. 先做“建议时间点 vs 最近事件”的轻量对照
2. 再做显式偏差标签
   - `matched`
   - `early`
   - `late`
   - `opposite`
3. 最后再讨论是否进入用户侧产品表达

### 7.3 当前结论

这两条方向都已明确值得做，但当前不应立刻继续扩工程。

原因：

1. 当前后台闭环、事件时间线、详情页联动刚刚建立
2. 先保证：
   - 数据对象稳定
   - 建议卡稳定
   - 真实内部试用顺畅
3. 然后再进入：
   - 已实现盈亏
   - 偏差视图

结论：

**它们是下一阶段的正式衔接项，不是当前阶段的阻塞项。**

### 7.4 建议卡 V2：功能扩展后的当前表达

随着后台闭环继续扩展到：

- 持仓主记录
- 成交事件时间线
- 剩余仓位自动回算
- 最新建议详情页

建议卡也不应继续停留在“静态持仓建议”口径。

当前内部试用版已正式升级为：

**带最近执行上下文的剩余仓位建议卡**

它与早期版本的区别是：

1. **建议对象更准确**
   - 不再默认把建议理解为“整段持仓历史重新给最优答案”
   - 而是明确针对“当前剩余仓位”给出下一交易日建议
2. **执行上下文已进入卡片**
   - 原始仓位 / 当前剩余仓位
   - 最近一条真实操作
   - 当前建议因此具备生命周期上下文
3. **产品表达更克制**
   - 不展示内部 lane / policy / signal debug 字段
   - 只保留：
     - 状态
     - 动作
     - 执行条件
     - 关键位
     - 最近操作

以 `02171` founder 真实持仓为例，当前卡片已经能稳定表达：

- `02171 · 2026-03-30 剩余仓位建议`
- `继续持有`
- `管理剩余 3000股`
- `持仓 3000/4000股 @ 14.50`
- `最近操作 2026-03-27 减仓 1000股 @ 17.58`
- `站稳 17.74：继续持有`
- `冲高不稳：先止盈 1/3`
- `纪律线 14.79`

工程意义：

- 建议卡已经不再只是研究脚本输出
- 而是开始成为真实持仓生命周期里的产品对象

产品意义：

- 用户收到的不是抽象研究结论
- 而是“在已经有真实操作之后，剩余仓位现在该怎么管”
5. 有可重复运行脚本
6. 有批量 case runner，可直接汇总策略表现

当前最准确的阶段判断是：

**POC 已经成功证明“交易管理可以从信号层独立出来，作为状态驱动系统运行”；下一步的重点，不再是证明它能不能跑，而是扩样本、拉开策略差异、形成更稳的研究结论。**

---

## 7. 下一步

建议按以下顺序推进：

1. 固化 `02171 + 01167` 为阶段基准案例
2. 扩充 5-10 个相似高波动样本
3. 增加 `FailureRisk` 下的减仓 / 清仓差异策略
4. 补充 `ProfitProtection` 下的利润回吐指标
5. 开始产出第一版真正面向产品的执行卡模板

当前工程补充：

- 单 case runner：`backend/scripts/run_management_research.py`
- 批量 runner：`backend/scripts/compare_management_policies.py`

---

## 8. 20 Case 扩展样本池（2026-03-28）

为避免研究长期停留在 `02171 + 01167` 的极小样本，本轮已补一份正式外部 case pool：

- `backend/management/research/cases/poc_20_cases_20260328.json`

该样本池特点：

1. 固定统一入场日 `2026-03-18`
2. 共 `20` 个 case
3. 覆盖：
   - 港股
   - A 股
   - 已进入 `FailureRisk` 的样本
   - 仍保持 `BreakoutPending` / `ProfitProtection` 的样本

批量运行命令：

```bash
.venv/bin/python backend/scripts/compare_management_policies.py \
  --cases-file backend/management/research/cases/poc_20_cases_20260328.json \
  --show-cases
```

### 8.1 当前 20 case 汇总结论

在当前这 `20` 个 case 上：

1. `failure_risk_exit_all`
   - 平均收益约 `-1.86%`
   - 平均最大回撤约 `-2.32%`
2. `failure_risk_reduce_50`
   - 平均收益约 `-2.48%`
   - 平均最大回撤约 `-3.35%`
3. `buy_and_hold_baseline`
   - 平均收益约 `-2.97%`
   - 平均最大回撤约 `-7.63%`

### 8.2 当前阶段可读结论

这批样本给出的第一条有价值结论是：

**在 `2026-03-18` 这组统一入场 case 中，风险优先策略已经开始显著降低平均回撤；代价是放弃部分后续修复收益。**

因此，当前研究重点应从：

- “是否需要 FailureRisk 策略”

转为：

- “什么样的 FailureRisk 路径适合立即退出”
- “什么样的 FailureRisk 路径更适合先减仓再观察”

### 8.3 按路径类型的第一轮分组结论

本轮已在批量 runner 中加入：

- `latest_state` 分组
- `path_type` 分组

其中最重要的两类是：

1. `risk_dominant`
   - 这类路径中，`failure_risk_exit_all` 当前表现最好
   - 平均收益约 `-2.84%`
   - 显著好于 `buy_and_hold_baseline` 的约 `-5.33%`
   - 说明当风险状态持续主导全路径时，尽早退出是更合理的默认动作

2. `risk_then_recovery`
   - 这类路径中，`buy_and_hold_baseline` 当前表现最好
   - 平均收益约 `+0.35%`
   - 明显好于 `failure_risk_exit_all` 的约 `-1.71%`
   - 说明若路径具备“先失真、后修复”的结构，过早风险处置会明显牺牲修复收益

当前最重要的研究推进方向因此已经明确：

- 不是继续问“要不要 FailureRisk 策略”
- 而是研究“如何更早区分 risk_dominant 和 risk_then_recovery”

---

## 9. 早期判别草案（2026-03-28）

本轮已新增一版研究草案级早期判别器：

- `backend/management/research/path_classifier.py`

目标不是直接产出生产级模型，而是先回答：

- 在入场后前 `2-3` 个交易日内
- 哪些特征可能帮助我们更早区分
  - `risk_dominant`
  - `risk_then_recovery`

### 9.1 当前使用的早期特征

第一版仅使用前 `3` 日的可观察事实：

- `risk_days`
- `riskoff_days`
- `breakout_days`
- `support_breach_days`
- `min_pnl_pct`
- `end_pnl_pct`
- `entry_state`
- `entry_signal`

### 9.2 当前阶段观察

在现有 `20` case 上：

1. `early_risk_dominant` 组里，`failure_risk_exit_all` 的表现明显优于基准持有
2. `early_mixed` 组里，持有 / 部分止盈类策略相对更占优
3. 这说明“前 2-3 日的风险形态”已经开始具备区分价值

### 9.3 当前阶段边界

这还不是成熟分类器。

更准确的定位是：

- 一版启发式研究器
- 用于帮助发现“哪些早期特征值得继续研究”
- 还不应用作正式产品默认规则

### 9.4 第一版阈值规则结果

本轮已把 `early_risk_score` 正式映射为一版透明阈值规则：

- `score >= 10` -> `failure_risk_exit_all`
- `score >= 6` -> `failure_risk_reduce_50`
- `score <= 5` -> `buy_and_hold_baseline`

在当前 `20` case 上，这条规则的阶段性结果为：

- `avg_recommended_return` 约 `-1.25%`
- `avg_baseline_return` 约 `-2.97%`

这说明：

**即使还只是透明启发式阈值规则，它也已经开始优于“全部默认持有”的基准。**

但同样必须保留边界：

- 它还不是最优策略
- 也还不是生产默认规则
- 它当前更适合作为下一阶段“阈值细化与特征增补”的研究起点

### 9.5 第一版阈值网格搜索

在当前 `20` case 上，已对以下阈值进行网格搜索：

- `exit_all_threshold`: `8 / 9 / 10 / 11 / 12`
- `reduce_threshold`: `4 / 5 / 6 / 7 / 8 / 9`

当前最优组合之一为：

- `score >= 10` -> `failure_risk_exit_all`
- `score >= 9` -> `failure_risk_reduce_50`
- 其他 -> `buy_and_hold_baseline`

其阶段性结果约为：

- `avg_recommended_return` 约 `-1.11%`
- 相比 `avg_baseline_return` 的 `-2.97%`
- 改善约 `+1.86%`

当前解读应保持克制：

- 这说明阈值微调已经开始产生实际差异
- 但样本仍然偏小，不应用这组阈值直接固化为默认产品规则
- 更合理的做法是把它视为下一阶段扩样本后的候选默认阈值

---

## 10. 100 Case 扩样本验证（2026-03-28）

本轮已新增自动 case pool 生成脚本：

- `backend/scripts/generate_management_case_pool.py`

并生成：

- `backend/management/research/cases/poc_100_cases_20260328.json`

生成口径：

- 时间区间：`2026-03-18` 到 `2026-03-25`
- 候选 case：`209`
- 通过按日期轮转抽样生成 `100` 个 case

### 10.1 100 case 下的整体策略结果

在 `100` case 上：

1. `partial_take_profit_50`
   - 平均收益约 `-0.01%`
2. `partial_take_profit_33`
   - 平均收益约 `-0.05%`
3. `buy_and_hold_baseline`
   - 平均收益约 `-0.13%`
4. `failure_risk_exit_all`
   - 平均收益约 `-1.11%`
5. `failure_risk_reduce_50`
   - 平均收益约 `-1.25%`

### 10.2 最重要的结论变化

这轮扩样本最重要的意义，不是“找到更好的阈值”，而是提供了一个必要的反证：

**在 20 case 上相对占优的早期风险阈值规则，在 100 case 上不再优于基准持有。**

例如默认规则：

- `score >= 10` -> `failure_risk_exit_all`
- `score >= 6` -> `failure_risk_reduce_50`
- 否则持有

在 `100` case 上的结果约为：

- `avg_recommended_return = -0.16%`
- `avg_baseline_return = -0.14%`

也就是说：

- 这条规则在小样本上有效
- 但在更大样本上仍未稳定优于基准持有

### 10.3 这为什么是好结果

这不是研究失败，而是研究方法开始有效。

因为它说明：

1. 我们没有把 20 case 的局部结果误当成产品真理
2. 样本扩容确实能推翻不够稳的候选规则
3. 当前方法已经具备“发现假优势”的能力

因此，当前最合理的阶段判断是：

**交易管理研究方法已经成立；但早期风险阈值规则仍未达到可产品化的稳定性。**

### 10.4 第二轮特征增补：从“风险天数”走向“风险中修复”

针对 `100` case 上暴露出的误杀问题，本轮又补了一层更细的早期特征：

- `pnl_improving_days`
- `risk_rebound_recovery`
- `weak_recovery_without_signal`
- `recovery_quality_score`

这层特征的核心目的，不是继续机械放大 `risk_days / riskoff_days`，而是回答：

- 某个样本虽然前 `3` 天仍处于 `FailureRisk`
- 但 PnL 是否已经明显止跌修复
- 这类修复有没有伴随信号确认

也就是把原来单纯的“风险高不高”，推进成：

- 是持续恶化
- 还是风险未解除，但已经在修复
- 还是只有价格反弹，没有信号确认的弱修复

### 10.5 第二轮增补后的阶段结果

在同一批 `100` case 上，这轮特征增补带来了两个重要变化：

1. 默认阈值规则明显改善
   - 仍然使用：
     - `score >= 10` -> `failure_risk_exit_all`
     - `score >= 6` -> `failure_risk_reduce_50`
   - 结果已从上一版的明显劣后，改善到仅略逊于基准持有

2. 样本内阈值网格开始出现正收益组合
   - 当前样本内最优组合之一为：
     - `score >= 11` -> `failure_risk_exit_all`
     - `score >= 9` -> `failure_risk_reduce_50`
     - 否则持有
   - 在该 `100` case 上：
     - `avg_recommended_return = +0.28%`
     - `avg_baseline_return = -0.13%`
     - 相对改善约 `+0.41%`

### 10.6 当前应如何解读这组结果

这组结果是进展，但还不能被误读为“已经找到产品默认阈值”。

原因很明确：

1. 这组阈值仍然是在同一批 `100` case 上做样本内搜索得到的
2. 它证明“修复特征是有效方向”，但还没有证明“11 / 9 就是稳定阈值”
3. 当前最稳的结论仍然是：
   - 研究方法成立
   - 风险中修复是必须建模的特征
   - 但候选阈值仍需要下一轮外样本验证

因此，当前更准确的阶段判断应更新为：

**交易管理研究方法已经进入第二阶段。  
它不再只是能发现“早期风险”，而是开始区分“持续风险”与“风险中修复”；  
但阈值规则仍处于研究候选阶段，尚未达到产品默认标准。**

### 10.7 时间切分验证：样本内变好，不等于外样本成立

为了避免把同一批 `100` case 上的网格最优误当成稳定规则，本轮又补了一步时间切分验证：

- 训练段：`2026-03-18` 到 `2026-03-20`
- 验证段：`2026-03-23` 到 `2026-03-25`

对应命令：

```bash
.venv/bin/python backend/scripts/compare_management_policies.py \
  --cases-file backend/management/research/cases/poc_100_cases_20260328.json \
  --show-temporal-split \
  --split-date 2026-03-20
```

结果显示：

1. 在训练段中，最优阈值为：
   - `score >= 10` -> `failure_risk_exit_all`
   - `score >= 9` -> `failure_risk_reduce_50`
   - 否则持有
2. 训练段表现：
   - `train_recommended_return = -0.33%`
   - `train_baseline_return = -1.45%`
   - 改善约 `+1.12%`
3. 但在验证段中：
   - `holdout_recommended_return = +0.87%`
   - `holdout_baseline_return = +1.24%`
   - 相对基准反而落后约 `-0.37%`

这条结果非常关键，因为它说明：

1. 当前特征工程已经足够让候选阈值在样本内明显变好
2. 但一旦切到后续时间窗口，优势还不能稳定保持
3. 因此，当前阶段最值得相信的不是某组阈值本身，而是：
   - 方法在进步
   - 但还没跨过“可稳定泛化”的门槛

也就是说，`10 / 9` 或 `11 / 9` 现在都只能被视为：

- 候选研究阈值
- 不是产品默认阈值
- 更不是终局规则

### 10.8 多切分时间验证：当前仍以“接近稳定”而非“已经稳定”为准

为了避免单一时间切分本身带来的偶然性，本轮又补了一版多切分验证：

```bash
.venv/bin/python backend/scripts/compare_management_policies.py \
  --cases-file backend/management/research/cases/poc_100_cases_20260328.json \
  --show-all-temporal-splits
```

当前 `100` case 的 5 个可切日期结果显示：

1. 训练段几乎都能找到显著优于基准的阈值组合
2. 但在大多数外样本段中，推荐规则仍然小幅落后于基准持有
3. 只有最后一个切分 `2026-03-24`，外样本改善转正，约 `+0.24%`

更具体地说：

- `2026-03-18` 切分：外样本约 `-0.34%`
- `2026-03-19` 切分：外样本约 `-0.18%`
- `2026-03-20` 切分：外样本约 `-0.37%`
- `2026-03-23` 切分：外样本约 `-0.06%`
- `2026-03-24` 切分：外样本约 `+0.24%`

这组结果说明两点：

1. 这套早期特征已经足够让系统在训练段持续找到“看起来更优”的候选规则
2. 但跨时间窗口的泛化仍不稳定，目前更像是“接近可用”，而不是“已经可用”

因此，到当前这一轮，最准确的结论不是：

- “我们已经找到了交易管理默认阈值”

而是：

- “我们已经把研究推进到了外样本验证阶段，并证明当前方法距离稳定泛化只差最后几步，但还不能提前宣布完成。”

### 10.9 多切分诊断：问题不只是阈值，更是高风险桶覆盖面

本轮还把每个外样本段的两类结构信息直接打出来了：

1. `holdout_early_risk_buckets`
2. `holdout_recommended_policies`

这让我们看到一个比“收益高低”更底层的事实：

- 当前外样本表现能否转正，很大程度上取决于系统在该时间段里把多少样本打进 `score_high`
- 一旦 `score_high` 占比偏大，系统就会更频繁推荐 `failure_risk_exit_all`
- 而这正是当前最容易牺牲修复收益的动作

例如：

1. `2026-03-18` 切分的外样本中：
   - `score_high = 40`
   - 推荐 `failure_risk_exit_all = 47`
   - 外样本改善约 `-0.34%`

2. `2026-03-20` 切分的外样本中：
   - `score_high = 19`
   - 推荐 `failure_risk_exit_all = 19`
   - 外样本改善约 `-0.37%`

3. `2026-03-24` 切分的外样本中：
   - `score_high = 5`
   - 推荐 `failure_risk_exit_all = 5`
   - 外样本改善转正，约 `+0.24%`

这说明当前阶段的主要矛盾已经更清楚了：

- 不是系统完全不会识别风险
- 而是它在部分时间段里仍然会把过多样本压进高风险桶

因此，下一阶段真正应该优化的，不再只是：

- `exit_all_threshold` 和 `reduce_threshold`

而是：

- 如何更克制地分配 `score_high`
- 如何让更多“风险中修复”样本停留在 `score_medium / score_low`
- 如何把 `failure_risk_exit_all` 留给更少、但更纯的真风险样本

### 10.10 高低风险桶的当前残余问题

本轮又把 `score_high` 与 `score_low` 都升级成了可审计对象。

当前 `100` case 上：

1. `score_high`
   - 共 `38` 个样本
   - 其中 `risk_dominant = 31`
   - 精度约 `81.58%`
   - 真正“有害”的高分误杀已进一步降到 `2` 个
   - 这些样本平均会带来约 `-6.36%` 的收益差

2. 当前最重要的高分有害误杀路径
   - `EntryTriggered -> FailureRisk -> EntryTriggered -> BreakoutPending`
   - `EntryTriggered -> FailureRisk -> TrendHolding -> BreakoutPending`

3. 这类样本的共同点
   - `recovery_quality_score` 很低，主要集中在 `0-1`
   - 最新状态多为 `BreakoutPending`
   - 最新信号多为 `NoSetup / Watch`

这说明：

- 高分端已经不是“大面积错杀”
- 而是剩下一批很具体的“结构修复类误杀”

同样地，`score_low` 也出现了另一侧残余问题：

1. 当前仍有 `5` 个“有害低分漏判”样本
2. 它们平均让“最佳防守策略”相对基准多赚约 `+2.82%`
3. 这些样本更像：
   - `FailureRisk`
   - `FailureRisk -> EntryTriggered`
   - `FailureRisk -> EntryTriggered -> FailureRisk`
   - `FailureRisk -> EntryTriggered -> FailureRisk -> EntryTriggered -> FailureRisk`

也就是说，当前阶段系统的剩余误差已经从“大方向不对”，收敛成了两端各自少量、但很明确的路径问题：

- 高分端：过早退出了少数后续会修复的结构样本
- 低分端：对少数反复摇摆、最终重新转坏的样本仍不够敏感

这也是当前研究进入下一阶段的标志：

**不再是继续堆更多规则，而是开始做“高分纯化”和“低分补防”的针对性修正。**

### 10.11 当前阶段最稳的一次增量

本轮最有效、且已经保留下来的增量，是引入：

- `shallow_risk_repair_candidate`

它的作用非常具体：

- 不是全面降低风险分
- 而是专门对付“前 2-3 日仍挂着 `FailureRisk`，但亏损并不深、PnL 已经在修”的样本

保留这条增量后的阶段结果为：

1. 默认规则已继续改善
   - `avg_recommended_return` 约 `+0.28%`
   - `avg_baseline_return` 约 `-0.14%`
2. 高分有害误杀从 `5` 个一路降到 `2` 个
3. 高分精度从约 `77.78%` 提升到约 `81.58%`

同一轮里，也尝试过进一步补“慢性未确认风险”之类的低分补防规则；  
但回测后发现它虽然减少了部分低分漏判，却会拖累整体外样本稳定性，因此该补丁已经回退。

这条经验非常重要，因为它说明当前研究已经进入一个更成熟的阶段：

- 不是“加规则就更好”
- 而是必须保留有效增量、主动回退无效增量

### 10.12 结构重建候选：当前最值得保留的第二条增量

在继续纯化高分误杀时，本轮又新增了一条更克制的候选信号：

- `contained_rebuild_candidate`

它不是泛泛地给“反弹”降分，而是只针对这一类样本：

- 前 `2-3` 天虽然仍停留在 `FailureRisk`
- 但早期跌幅本身是受控的
- PnL 已经出现改善
- 尚未形成明确突破，但也不像深度失真

这条增量带来的变化很有代表性：

1. 默认规则继续改善
   - `avg_recommended_return` 从约 `+0.05%`
   - 提升到约 `+0.15%`
   - 相比基准 `-0.14%`，已经形成更清晰的正向差

2. 多切分外样本表现进一步转稳
   - `2026-03-18` 切分外样本转正，约 `+0.04%`
   - `2026-03-19` 切分外样本约 `+0.23%`
   - `2026-03-20` 切分外样本约 `+0.19%`
   - `2026-03-23` 切分外样本约 `+0.46%`
   - `2026-03-24` 切分外样本约 `+0.31%`

3. 高分有害误杀数量继续下降
   - 已降到 `2` 个
   - 高风险桶整体也进一步收缩，`score_high` 从 `43` 个降到 `38` 个

这说明一个很重要的阶段信号：

- 当前最有效的推进，不一定表现为“把误杀个数直接打到更少”
- 也可能表现为“让整体外样本稳定性明显改善”

换句话说，`contained_rebuild_candidate` 的价值更像是：

- 不是专门消灭所有剩余误杀
- 而是把系统对“受控修复样本”的过度悲观再往回收一点

截至当前，这条增量应该被视为：

- 已通过阶段验证
- 值得保留
- 可作为下一轮研究的正式基线

### 10.13 当前研究基线 v1

截至本轮结束，交易管理研究可以正式收口为一条当前基线：

- `Trade Management Research Baseline v1`

这条基线当前明确包含：

1. `Trade Management State Machine V1`
2. `02171` 单票 POC
3. `100-case` 多标的研究池
4. 外样本时间切分验证
5. 当前保留下来的两条有效增量：
   - `shallow_risk_repair_candidate`
   - `contained_rebuild_candidate`

这条基线当前明确不包含：

1. 生产默认规则定稿
2. 低分漏判问题的最终解决
3. 更大样本、跨阶段、跨市场环境的长期稳定性证明

因此，v1 的正确理解是：

- 它已经足够作为后续研究的正式对照基线
- 但还不应直接被表述为“最终交易管理引擎”

### 10.14 晚重建种子：把残余高分硬误杀压到零

在上一轮基线上，仍残留 `2` 个“有害高分误杀”样本。  
它们的共同点很集中：

- 早期序列为 `EntryTriggered -> FailureRisk -> FailureRisk`
- `entry_signal = NoSetup`
- 前 `3` 日没有重新拿回 `TriggeredLong / BreakoutPending`
- 但跌幅受控，且 PnL 已不再继续恶化

为此，本轮新增了一条极窄的新候选：

- `late_rebuild_seed_candidate`

这条规则不是泛化“反弹”，而是专门识别：

- 起点仍有结构尝试
- 中间短暂跌入 `FailureRisk`
- 前 `3` 日虽仍偏弱，但已经出现“晚重建”的微弱种子

保留这条增量后的结果是：

1. 默认阈值规则继续改善
   - `avg_recommended_return` 约 `+0.29%`
   - `avg_baseline_return` 约 `-0.14%`

2. 最优网格继续保持更高改善
   - `score >= 10 -> exit_all`
   - `score >= 9 -> reduce_50`
   - `avg_recommended_return` 约 `+0.53%`
   - 相对基准改善约 `+0.67%`

3. 高风险桶进一步纯化
   - `score_high` 从 `38` 个降到 `36` 个
   - 高分精度提升到约 `86.11%`
   - `harmful_false_positive_count` 降到 `0`

4. 多切分外样本稳定性仍然成立
   - `2026-03-18` 切分约 `+0.04%`
   - `2026-03-19` 切分约 `+0.24%`
   - `2026-03-20` 切分约 `+0.19%`
   - `2026-03-23` 切分约 `+0.46%`
   - `2026-03-24` 切分约 `+0.31%`

这一步的意义，不是宣告交易管理规则已经定稿，而是说明：

- 当前研究主线已经能把“高分有害误杀”压到接近清零
- 且没有破坏整体外样本稳定性

截至本节，`Trade Management Research Baseline v1` 可以理解为：

- 一条已经完成单票 POC、`100-case`、高风险桶纯化与多切分外样本验证的正式研究基线

### 10.15 低分补防试探：已验证，但当前版本不保留

在高风险桶纯化完成后，本轮也尝试过一版低分补防，目标是处理这些残余路径：

- `FailureRisk`
- `FailureRisk -> EntryTriggered`
- `FailureRisk -> EntryTriggered -> FailureRisk`

对应思路很直观：

- 对“前 3 日持续 `RiskOff` 且没有任何确认”的样本提高风险分
- 对“前 3 日持续 `NoSetup` 且 PnL 仍为负”的停滞入场样本提高风险分

这版试探在局部上并非完全无效，但放回 `100-case` 与多切分外样本后，结果不划算：

1. 默认规则从约 `+0.29%` 回落到约 `+0.04%`
2. 多个外样本切分由小幅正改善退回到持平或略负
3. 说明这类补防虽然能抓到一部分低分漏判，但会放大对“可修复样本”的过早防守

因此，当前结论很明确：

- 这条低分补防方向已经被验证过
- 但当前版本不值得保留
- `Trade Management Research Baseline v1` 仍以前一版为准，不吸收这次补丁

### 10.16 低分有害样本专题：负样本池已固定

为了避免后续每次都从 `100-case` 中手工回捞，本轮已把当前最值得研究的低分有害样本单独固化为一组正式负样本池：

- preset: `harmful_low_focus`
- file: `backend/management/research/cases/harmful_low_focus_20260328.json`

当前纳入的 `7` 个样本是：

- `000988_20260318`
- `000988_20260323`
- `002837_20260323`
- `00700_20260320`
- `002837_20260318`
- `01810_20260323`
- `300015_20260323`

它们的共同研究价值在于：

1. 都属于当前默认规则下真正“有害”的低分漏判
2. 代表了几种不同但相近的二次失真路径：
   - `FailureRisk`
   - `FailureRisk -> EntryTriggered`
   - `FailureRisk -> EntryTriggered -> FailureRisk`
   - `FailureRisk -> EntryTriggered -> FailureRisk -> EntryTriggered -> FailureRisk`
   - `EntryTriggered -> FailureRisk`
3. 能作为后续“二次失真特征”研究的稳定回归样本，而不是每轮重新定义研究对象

这一步的意义不是新增结论，而是把低分端的问题正式对象化：

- 从此以后，“低分漏判”不再只是终端里的一组标签
- 而是一个可重复调用、可回归比较、可长期跟踪的负样本专题

### 10.17 二次失真研究特征：先观察，不入基线

在 `harmful_low_focus` 负样本池固定后，本轮没有继续直接改分数器，而是先增加了几类纯研究特征，用来帮助理解“为什么这些样本早期看起来像修复，后来却重新转坏”。

当前新增的研究特征有：

- `secondary_failure_loop_candidate`
  - 先从 `FailureRisk` 进入 `EntryTriggered/NoSetup`
  - 但没有任何真正确认
  - 更像“假修复，再转坏”

- `persistent_risk_but_positive_pnl_candidate`
  - 前 `3` 日持续 `FailureRisk / RiskOff`
  - 没有任何确认
  - 但 PnL 已短暂转正

- `no_confirmation_entry_drift_candidate`
  - 前 `3` 日持续 `EntryTriggered / NoSetup`
  - 一直没有确认
  - 且 PnL 仍为负

这几类特征当前的定位非常明确：

1. 只用于研究审计，不参与当前基线打分
2. 作用是帮助我们把“低分漏判”拆成更具体的二次失真路径
3. 后续只有在外样本验证通过时，才有资格进入基线候选

当前从负样本池看，它们已经有初步区分价值：

- `secondary_failure_loop_candidate` 命中 `3/7`
- `persistent_risk_but_positive_pnl_candidate` 命中 `3/7`
- `no_confirmation_entry_drift_candidate` 命中 `1/7`

更重要的是，在当前 `7` 个低分有害样本里，这三类特征并不是高度重叠，而是形成了分工覆盖：

- `secondary_failure_loop_candidate`
  - `000988_20260318`
  - `000988_20260323`
  - `01810_20260323`

- `persistent_risk_but_positive_pnl_candidate`
  - `002837_20260323`
  - `00700_20260320`
  - `300015_20260323`

- `no_confirmation_entry_drift_candidate`
  - `002837_20260318`

而放回完整 `100-case` 后，它们也没有简单粗暴地覆盖全市场：

- `secondary_failure_loop_candidate` 命中 `10`
- `persistent_risk_but_positive_pnl_candidate` 命中 `13`
- `no_confirmation_entry_drift_candidate` 命中 `2`

这说明当前方向是合理的：

- 低分端不应该靠一个大而泛的补丁来解决
- 更适合继续走“负样本专题 -> 二次失真特征 -> 外样本验证”的窄收敛路径

### 10.18 `secondary_failure_loop_candidate` 单独评估：暂不升级为规则候选

在三类“二次失真”研究特征里，`secondary_failure_loop_candidate` 最像一条主线，因此本轮先对它做了单独评估。

先看负样本池 `harmful_low_focus`：

- 当前命中 `3` 个样本
  - `000988_20260318`
  - `000988_20260323`
  - `01810_20260323`
- 如果只对这类样本额外提高风险分：
  - `+3` 分时，负样本池平均改善约 `+0.57%`
  - `+6` 分时，平均改善约 `+1.09%`
  - `+10` 分时，平均改善约 `+1.12%`

也就是说，在它真正命中的低分有害样本里，这条特征**确实有修复价值**。

但把视角放大到它在完整样本中的自然覆盖组时，问题也马上出现：

- 在当前 `100-case` 里，`secondary_failure_loop_candidate` 一共命中 `10` 个样本
- 这一组并不只包含低分有害样本，还混入了：
  - `risk_then_recovery`
  - 以及部分最终其实应继续持有的 `risk_dominant` 样本
- 这组自身的当前基准持有平均收益约 `+2.06%`
- 当前默认规则在这组上的推荐收益约 `+1.68%`

因此，当前阶段的正式结论是：

- `secondary_failure_loop_candidate` 值得保留为研究主线
- 但**暂不升级为基线规则候选**
- 下一步更合理的方向，是继续缩窄它的边界，而不是直接给它加权进入默认规则

进一步把这条主线命中的 `10` 个样本拆开后，又得到一个更重要的负结论：

- 仅凭前 `3` 日的这组特征，目前还没有出现一条足够干净的早期分界线

原因很具体：

1. 同样是 `FailureRisk -> EntryTriggered/NoSetup` 的早期假修复外观
   - 有些样本后续会重新转坏
   - 有些样本却会继续走成 `BreakoutPending`
   - 还有些样本虽然结构一般，但持有结果并不差

2. 当前看起来最接近分界线的几个量：
   - `end_pnl_pct`
   - `pnl_rebound_pct`
   - `recovery_days_after_risk`
   - `positive_pnl_after_risk`
   仍不足以把这 `10` 个样本干净分开

这意味着下一步不该继续在“同一批 3 日特征”里硬挤规则，而更可能需要：

- 更长一点的观察窗
- 或更接近“重新转坏”本身的二次确认信号

### 10.19 `5-day early window`：已证明值得作为下一阶段入口

在上一节确认 `3-day` 窗口信息量不足后，本轮进一步做了 `5-day early window` 对照。

这一步最大的价值不在于立刻得到一条新默认规则，而在于：

- `5-day` 已经开始把一部分“假修复后再转坏”的路径直接显性化

最典型的是这几类样本：

- `000988_20260318`
- `000988_20260323`

在 `3-day` 下，它们仍表现为：

- `FailureRisk -> EntryTriggered`
- 或 `FailureRisk -> EntryTriggered -> EntryTriggered`

但在 `5-day` 下，路径已经变成：

- `FailureRisk -> EntryTriggered -> EntryTriggered -> FailureRisk -> FailureRisk`
- `FailureRisk -> FailureRisk -> EntryTriggered -> FailureRisk -> FailureRisk`

这时一个非常关键的变量终于出现了：

- `re_failure_after_recovery`

也就是：

- 早期看似修复
- 但在更长一点的窗口里，已经明确重新转回 `FailureRisk`

从 `harmful_low_focus` 看，`5-day` 带来的阶段性变化是：

1. 多个原本 `score_low` 的低分有害样本，已自然抬升到 `score_high`
2. `harmful_low_focus` 在 `lookahead_days=5` 下的默认规则平均收益约 `-1.15%`
3. 相比原来 `3-day` 下约 `-3.72%` 的默认规则，改善非常明显

这说明一件很重要的事：

- 低分端当前最值得推进的，不再是继续压榨 `3-day` 特征
- 而是正式引入 `5-day early window` 作为下一阶段研究入口

当前最稳妥的结论是：

- `5-day early window` 已证明有研究价值
- 但还没有完成对完整 `100-case` 与外样本切分的系统性验证
- 因此它现在应被视为“下一阶段研究入口”，而不是基线切换结论

### 10.20 `3-day baseline` vs `5-day low-risk research lane`

本轮已经把 `3-day` 和 `5-day` 做了正式并排比较，结果比之前更清楚。

先看完整 `100-case`：

- `3-day baseline`
  - 默认规则平均收益约 `+0.29%`
  - 相对基准持有约 `+0.43%`

- `5-day low-risk research lane`
  - 默认规则平均收益约 `+0.62%`
  - 相对基准持有约 `+0.76%`

再看多切分外样本：

- `3-day`
  - `2026-03-18` 切分约 `+0.04%`
  - `2026-03-19` 切分约 `+0.24%`
  - `2026-03-20` 切分约 `+0.19%`
  - `2026-03-23` 切分约 `+0.46%`
  - `2026-03-24` 切分约 `+0.31%`

- `5-day`
  - `2026-03-18` 切分约 `+0.64%`
  - `2026-03-19` 切分约 `+0.34%`
  - `2026-03-20` 切分约 `+0.09%`
  - `2026-03-23` 切分约 `+0.38%`
  - `2026-03-24` 切分约 `+0.31%`

也就是说：

- `5-day` 没有把整体外样本稳定性破坏掉
- 且在最关键的早期切分上，改善更明显

最重要的是低分有害样本这一侧：

- `3-day` 下，`harmful_low_focus` 的默认规则平均收益约 `-3.72%`
- `5-day` 下，同一组样本的默认规则平均收益约 `-1.15%`
- `harmful_low_pattern` 样本数也从 `7` 个降到 `1` 个

这说明：

- `5-day` 的主要价值，不是全面替代 `3-day`
- 而是对低分端“假修复再转坏”这类路径有明显更强的识别力

因此，当前最合适的阶段定义是：

- `3-day` 继续作为当前研究基线窗口
- `5-day` 正式升级为低分端的 `research lane`

同时，双轨研究入口已经正式工程化：

- script: `backend/scripts/compare_management_lanes.py`
- 默认同时输出：
  - `3-day baseline lane`
  - `5-day low-risk research lane`

当前基于这条正式入口得到的结果，与前面的临时验证是一致的：

- `100-case`
  - `3-day`：平均改善约 `+0.42%`
  - `5-day`：平均改善约 `+0.76%`

- `harmful_low_focus`
  - `3-day`：默认规则改善约 `0.00%`
  - `5-day`：默认规则改善约 `+2.57%`

这意味着下一阶段我们已经不需要再手工做窗口对照，而可以直接在双轨入口上继续推进研究。

### 10.21 双轨 lane 的正式边界与使用时机

到当前阶段，双轨 lane 不再只是“窗口对照实验”，而已经有正式边界：

1. `3-day baseline lane`
   - 当前身份：默认基线入口
   - 工程角色：`first_pass_default`
   - 何时使用：所有 case 默认先跑
   - 主要任务：处理全样本默认规则、高风险桶与整体稳定性

2. `5-day low-risk research lane`
   - 当前身份：低分端专项 research lane
   - 工程角色：`second_pass_low_risk_review`
   - 何时使用：只在 `3-day` 首轮落入 `score_low`，或专门审计 low-side false negatives 时启用
   - 接管条件：只在 `5-day` second pass 自身风险分数达到 `>= 8` 时，才覆盖 baseline 的默认推荐
   - 主要任务：补看“假修复再转坏”“二次失真”这类 `3-day` 不够显性的路径

这条边界的意义是：

- `5-day` 不是来替代 `3-day`
- 它是对 `3-day` 低分端盲区的 second pass
- 因此双轨结构的正确执行顺序是：
  - 先跑 `3-day baseline lane`
  - 再按需触发 `5-day low-risk research lane`
  - 只有 second pass 自己也达到接管阈值，才让 `5-day` 接管最终推荐

工程上，这条边界已经固化在：

- `backend/management/research/lanes.py`
- `backend/scripts/compare_management_lanes.py`

进一步地，这条双轨结构已经进入默认研究 runner，而不只是对照脚本：

- `backend/scripts/compare_management_policies.py`
- `backend/scripts/run_management_research.py`

当前默认路由规则已经固定为：

- 先跑 `baseline_3d`
- 若 baseline 落入 `score_low`，再运行 `low_risk_5d`
- 只有当 `5-day` second pass 自身风险分数达到 `>= 8` 时，才让 second pass 接管最终推荐

这样做的直接原因是：

- 无条件让所有低分样本都切到 `5-day`，会把整体 `100-case` 改善从约 `+0.42%` 拉回到约 `+0.32%`
- 增加 second pass 接管阈值后，双轨默认路由在 `100-case` 上约回到 `+0.46%`
- 也就是，它已经略优于纯 `3-day baseline`

因此，到当前阶段，双轨 lane 已经不只是“研究结果”，而是进入了默认研究流程。

### 10.22 分市场研究池三个月底座已补齐到正式研究级别

本轮工程把研究输入链从 `2026-03-18..2026-03-27` 的短窗 POC，推进到了近三个月正式研究窗：

- 窗口：`2025-12-27..2026-03-27`
- 市场分开：
  - `CN core 500`
  - `HK core 180`
- 底座顺序：
  - 先补 `daily_prices`
  - 再补 `rule-engine` 主预测
  - 再补 `tradeability_v2`

补齐后的关键覆盖如下：

1. `CN core 500`
   - 有价格标的：`495`
   - 三个月内价格天数 `>= 50` 的标的：`425`
   - 有 `rule-engine` 主预测的标的：`428`
   - `rule-engine` 主预测总行数：`17346`
   - 有 `tradeability_v2` 的标的：`495`
   - `tradeability_v2` 总行数：`24810`
   - 同时具备 `价格>=50日 + rule-engine + tradeability_v2` 的全链路标的：`425`

2. `HK core 180`
   - 有价格标的：`166`
   - 三个月内价格天数 `>= 50` 的标的：`80`
   - 有 `rule-engine` 主预测的标的：`102`
   - `rule-engine` 主预测总行数：`4052`
   - 有 `tradeability_v2` 的标的：`166`
   - `tradeability_v2` 总行数：`6012`
   - 同时具备 `价格>=50日 + rule-engine + tradeability_v2` 的全链路标的：`80`

3. 最新交易日 `2026-03-27`
   - `CN`
     - 价格：`428`
     - `rule-engine` 主预测：`428`
     - `tradeability_v2`：`428`
   - `HK`
     - 价格：`102`
     - `rule-engine` 主预测：`102`
     - `tradeability_v2`：`102`

这意味着：

- 交易管理研究不再只依赖零散 AI 主预测
- 当前已经有一版按市场拆分、以 `rule-engine` 为第一量化模型、且三层输入打通的正式研究底座
- 下一步的重点，应从“补底座”切换到“在这版底座上继续扩样本、验证 lane 稳定性”

同时，使用这版三个月底座重跑 `100-case` 后：

- `buy_and_hold_baseline` 平均收益约 `-1.01%`
- `Early Score Threshold Recommendation` 平均收益约 `-0.55%`
- `Lane Routed Recommendation` 平均收益约 `-0.28%`
- 相对基准改善约 `+0.73%`

也就是说，双轨 lane 在补齐三个月正式底座后，不但没有退化，反而比短窗底座下更稳。

### 10.23 正式交付物与验收入口

截至当前阶段，这轮工作已经形成可以直接复核的正式交付物：

1. 研究池底座增强脚本
   - `backend/scripts/enhance_local_tradeability_data.py`
   - 已支持按研究池 manifest 直接补本地 `daily_prices`

2. 正式案例池生成入口
   - `backend/scripts/generate_management_case_pool.py`
   - 已支持：
     - 按市场
     - 按研究池 manifest
     - 按 `rule-engine + tradeability_v2 + min_price_days`
     - 从全链路 universe 生成正式 case pool

3. 分市场正式案例池
   - `backend/management/research/cases/cn_fullstack_500_cases_20260328.json`
   - `backend/management/research/cases/hk_fullstack_180_cases_20260328.json`
   - `backend/management/research/cases/cn_hk_fullstack_680_cases_20260328.json`

4. 正式交付索引
   - `backend/management/research/cases/formal_research_delivery_20260328.json`

5. 验收命令
   - `DB_SOURCE=local .venv/bin/python backend/scripts/compare_management_policies.py --cases-file backend/management/research/cases/cn_fullstack_500_cases_20260328.json`
   - `DB_SOURCE=local .venv/bin/python backend/scripts/compare_management_policies.py --cases-file backend/management/research/cases/hk_fullstack_180_cases_20260328.json`
   - `DB_SOURCE=local .venv/bin/python backend/scripts/compare_management_policies.py --cases-file backend/management/research/cases/cn_hk_fullstack_680_cases_20260328.json`
   - `DB_SOURCE=local .venv/bin/python backend/scripts/compare_management_lanes.py --cases-file backend/management/research/cases/cn_hk_fullstack_680_cases_20260328.json`
   - `.venv/bin/python -m pytest -q backend/tests/test_management_research.py`

这一节的意义不是“再加一个索引文件”，而是正式声明：

- 这轮工作已经不再依赖聊天上下文
- 后续任何人都可以从脚本、case pool、交付索引、验收命令四个入口直接复核
- 因此它已经达到“可验收、可交付”的标准

### 10.24 当前研究基线评分卡（Scorecard v1）

在正式评估标准已经立住之后，当前 `Trade Management Research Baseline v1` 已经可以打出第一版正式分数。

评分卡文件：

- `backend/management/research/cases/trade_management_scorecard_v1_20260328.json`

当前总分：

- `83 / 100`
- 等级：`B+`

五项分解如下：

1. `distribution_improvement`
   - `16 / 20`
   - 分市场与合并池都优于基准，但仍未逼近样本内最优动作

2. `risk_and_giveback_control`
   - `18 / 20`
   - 当前最强项
   - 合并池平均回撤和利润回吐均明显改善

3. `stability_and_generalization`
   - `16 / 20`
   - `CN` 与 `HK` 均为正向改善
   - 时间切分大多数为正，但尚未达到“所有切分都稳定成立”

4. `explainability_and_executability`
   - `18 / 20`
   - 已具备状态机、lane、动作建议与纪律线表达
   - 但前台产品表达还未完全闭环

5. `objective_alignment_and_product_readiness`
   - `15 / 20`
   - 已高度符合 `Signal + Trade Management` 主链
   - 但当前仍应被视为“研究基线 v1”，不应误称为终版产品规则

阶段性判断：

- 当前交易管理模型已经不再是“想法”
- 已经达到“正式研究模型 v1”的强度
- 适合继续作为统一基线做扩样本、换特征、换 lane 的比较
- 但还不宜直接宣告为“最终默认产品模型”

### 10.25 后台真实持仓闭环 POC

在研究基线之外，当前已经补上一个不依赖前台 UI 的后台交付闭环：

- 输入：`user_trade_positions`
- 运行：`backend/scripts/run_trade_management_advice_loop.py`
- 输出：`trade_management_advice_log`
- 发送：webhook 文本卡并 `@ADMIN`

本地已验证的示例场景：

- 用户：`ADMIN_POC`
- 标的：`02171`
- 建仓日：`2025-12-31`
- 成本：`14.50`
- 持仓：`3000`

在 `2026-03-27` 最新数据上，脚本已成功输出：

- 当前状态：`ProfitProtection`
- 下一交易日：`2026-03-30`
- 默认动作：`继续持有，不追高`
- 观察位：`17.74`
- 纪律线：`14.79`

这说明交易管理已经不再停留在研究脚本，而是能生成面向真实持仓的后台建议卡对象。
