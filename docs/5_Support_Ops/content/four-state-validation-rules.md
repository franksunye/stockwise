---
title: "四态语义验证规则（修订版）"
category: "量化逻辑与纪律"
lastUpdated: "2026-03-13"
---

# 四态语义验证规则（修订版）

## 1. 目的

本文档定义 StockWise 四态语义的正式验证口径，用于：

- 对齐产品、运营、工程对“验证正确”的共同理解
- 约束后端 `verify_predictions` 的判定逻辑
- 为后续规则修订、阈值调整、前端解释文案提供统一依据

这份文档优先级高于临时讨论，但低于已经上线的代码实现。
如果代码与本文档冲突，应尽快修正文档或实现，避免长期漂移。

## 2. 当前问题

当前线上/历史实现的核心错位，不是“四态是否合理”，而是：

- 语义层已经升级为四态动作建议
- 验证层仍停留在三态方向判断
- `RiskOff` 被旧逻辑隐含投影成 `Short`
- `Watch` 与 `NoSetup` 尚未被当作两种不同的业务对象验证
- 固定阈值未区分不同市场结构

这会导致一个根本问题：

产品表达的是“建议怎么做”，验证考核的却还是“有没有猜中涨跌”。

## 3. 核心原则

四态不是四个“方向预测”，而是四个“行动建议”：

- `TriggeredLong`：建议进场
- `Watch`：建议观察
- `RiskOff`：建议防守
- `NoSetup`：暂无信号

因此，验证不能只看“涨跌对不对”，而要看：

1. 这个动作建议本身是否合理
2. 后续价格表现是否支持这个建议

## 4. 语义定义

## 4.1 正式中文语义

- `TriggeredLong`：建议进场
- `Watch`：建议观察
- `RiskOff`：建议防守
- `NoSetup`：暂无信号

## 4.2 对英文内部名的约束

当前内部名仍保留：

- `TriggeredLong`
- `Watch`
- `RiskOff`
- `NoSetup`

这是兼容现有主链与数据库字段的现实做法。

但从产品语义一致性看，内部名并不完全对称：

- `TriggeredLong` 带方向色彩
- `RiskOff` 带资产配置色彩
- `Watch` / `NoSetup` 更接近动作语义

后续若做统一命名升级，推荐参考：

- `EntryReady`
- `Watch`
- `Defensive`
- `NoAction`

在完成全链迁移前，现阶段不强制改名，但文档、验证、前端解释都应按中文动作语义理解，而不是按英文词面理解。

## 4.3 对 `RiskOff` 的正式约束

`RiskOff` 不是 `Short`。

它的正式业务定义应为：

- 防守
- 回避新增多头
- 若已有仓位，则优先减风险或收缩暴露

不得在产品口径或验证口径里把 `RiskOff` 解释为“做空建议”。

## 5. 验证分层

每条预测的验证应至少拆成两层：

### 5.1 语义验证 `semantic_verdict`

验证这条建议在当时是否合理：

- `Validated`
- `WeakValidated`
- `Invalidated`

### 5.2 结果验证 `outcome_verdict`

验证后续价格表现强弱：

- `Strong`
- `Neutral`
- `Weak`
- `Adverse`

当前如果数据库仍只保留一个 `validation_status`，建议先由 `semantic_verdict` 投影生成。

## 6. 窗口与指标

### 6.1 推荐窗口

- `T+1`：保留为快速观测
- `T+3`：作为默认正式验证窗口

原因：

- `TriggeredLong`、`RiskOff` 可较快验证
- `Watch`、`NoSetup` 需要更长一点的观察窗口才能判断“先不行动”是否合理

### 6.2 推荐指标

- `t1_change`：T+1 单日涨跌幅
- `cum_change`：窗口结束累计涨跌幅
- `max_cum_change`：窗口内最大累计有利变动
- `min_cum_change`：窗口内最大累计不利变动
- `days_evaluated`：已评估交易日数
- `followup_state`：窗口内后续更接近的状态，例如 `TriggeredLong` / `RiskOff`

### 6.3 阈值治理原则

不建议长期使用全市场统一固定阈值。

更合理的顺序是：

1. 先有统一默认阈值，完成规则切换
2. 再逐步升级为按市场、按波动率治理

### 6.4 第一阶段默认阈值

建议第一阶段先使用下面这版统一阈值：

- `bull_threshold = +2%`
- `bear_threshold = -2%`
- `noise_band = [-1%, +1%]`
- `hard_adverse_long = -3%`

这些阈值属于策略治理参数，不应长期散落在代码里。

### 6.5 第二阶段市场适配原则

不同市场结构不同，正式规则应逐步转为 `market-aware`：

- A 股：存在涨跌幅限制，且日内回转约束更强
- 港股：价格弹性更大，波动结构与 A 股不同
- 美股：事件驱动和跳空特征更明显

因此后续应支持：

- `market_thresholds[CN/HK/US]`
- 波动率分层阈值
- 或 ATR / sigma 类动态阈值

在完成市场适配前，不应把固定阈值视为长期最终方案。

## 7. 四态逐条规则

## 7.1 `TriggeredLong`

业务语义：当前已满足进场条件，建议采取进攻动作。

验证重点：不是“有没有涨一点”，而是“进场建议是否值得”。

建议规则：

- `Validated`
  - `max_cum_change >= +2%`
- `WeakValidated`
  - 窗口内有正收益，但未达到强确认阈值
- `Invalidated`
  - 窗口结束累计收益仍 `<= 0%`
  - 或窗口内先出现明显不利回撤，例如 `min_cum_change <= -3%`

典型 reason code：

- `triggered_confirmed`
- `triggered_weak_followthrough`
- `triggered_failed`
- `triggered_stopped_out`

## 7.2 `RiskOff`

业务语义：当前风险优先，应该防守、减仓、回避新增进攻。

验证重点：不是“能不能做空赚钱”，而是“防守建议是否必要”。

建议规则：

- `Validated`
  - `min_cum_change <= -2%`
- `WeakValidated`
  - 没有明显下跌，但也没有形成可进攻机会
- `Invalidated`
  - `max_cum_change >= +2%`

典型 reason code：

- `riskoff_confirmed`
- `riskoff_flat_but_safe`
- `riskoff_overdefensive`

## 7.3 `Watch`

业务语义：标的接近机会，但当前尚未满足进场条件，适合继续观察。

验证重点：验证“延迟决策”是否合理。

建议规则：

- `Validated`
  - T+1 未出现明确单边大机会
  - 且窗口内表现为震荡待确认
  - 或 T+2 / T+3 才出现明确转强
- `WeakValidated`
  - 窗口内整体仍在噪音区，没有明显证伪
- `Invalidated`
  - T+1 就快速转强，达到 `+2%` 级别，说明过于保守
  - 或 T+1 就快速走坏，达到 `-2%` 级别，说明过于乐观

典型 reason code：

- `watch_delayed_breakout`
- `watch_still_unconfirmed`
- `watch_too_conservative`
- `watch_missed_risk`

## 7.4 `NoSetup`

业务语义：当前没有值得进入候选池的交易机会。

验证重点：验证“忽略它是否合理”。

建议规则：

- `Validated`
  - 整个窗口内都没有形成明确机会或明确风险
- `WeakValidated`
  - 处于低价值噪音区，虽有波动但不构成可操作信号
- `Invalidated`
  - 窗口内很快达到 `+2%`，说明漏掉机会
  - 窗口内很快达到 `-2%`，说明漏掉风险

典型 reason code：

- `nosetup_true_neutral`
- `nosetup_low_value_noise`
- `nosetup_missed_opportunity`
- `nosetup_missed_risk`

## 8. `Watch` 与 `NoSetup` 的区别

这两者都不是进攻信号，但业务语义不同，不能共用一套验证规则。

- `Watch`：进入候选池，等待确认
- `NoSetup`：不进入候选池，不占用注意力

如果把它们都按“横盘算对”处理，会丢失两个核心能力：

- `Watch` 的候选价值无法衡量
- `NoSetup` 的误漏成本无法衡量

因此它们必须分别验证。

## 9. 规则表（可直接映射实现）

建议后端验证器优先按下面这张表实现：

| signal | 主要验证问题 | `Validated` | `WeakValidated` | `Invalidated` |
| --- | --- | --- | --- | --- |
| `TriggeredLong` | 现在进场是否合理 | `max_cum_change >= bull_threshold` | 有正收益但未达强确认 | 窗口结束仍 `<= 0` 或 `min_cum_change <= hard_adverse_long` |
| `RiskOff` | 现在防守是否必要 | `min_cum_change <= bear_threshold` | 未下跌但也未形成进攻机会 | `max_cum_change >= bull_threshold` |
| `Watch` | 先观察是否合理 | T+1 未强突破，且 T+2/T+3 才确认，或持续待确认 | 整体在噪音区，无明确证伪 | T+1 就强突破，或 T+1 就明显走坏 |
| `NoSetup` | 忽略它是否合理 | 整窗无明显机会也无明显风险 | 低价值噪音波动 | 快速形成明确机会或明确风险 |

## 10. 最小落地口径

在正式升级后端验证器前，建议先采用如下最小实现：

- 窗口：`3` 个交易日
- 最终状态：使用 `semantic_verdict` 投影到现有 `validation_status`

投影建议：

- `Validated` -> `Correct`
- `WeakValidated` -> `Correct`
- `Invalidated` -> `Incorrect`

这是兼容旧字段的过渡方案，不代表最终最优设计。

## 11. 推荐保存结构

建议在 `validation_data` 中逐步收敛为：

```json
{
  "window": 3,
  "days_evaluated": 3,
  "trajectory": [],
  "t1_change": 0.8,
  "cum_change": 1.6,
  "max_cum_change": 2.4,
  "min_cum_change": -0.9,
  "semantic_verdict": "Validated",
  "outcome_verdict": "Strong",
  "reason_code": "watch_delayed_breakout"
}
```

## 12. 修订建议

基于当前行业通用做法与不同市场结构差异，后续建议按下列顺序修订：

1. 先完成四态验证替代三态验证
2. 明确 `RiskOff != Short`
3. 将统一阈值升级为按市场治理
4. 再考虑内部英文命名统一升级

不建议反过来先改命名，再讨论规则，否则会拖慢验证闭环。

## 13. 维护规则

后续若要修订阈值或规则，建议按以下顺序：

1. 先改本文档
2. 再改验证实现
3. 最后补对应测试与回放验证

不建议先改代码再补业务口径，否则会再次出现“代码已变、语义未对齐”的问题。
