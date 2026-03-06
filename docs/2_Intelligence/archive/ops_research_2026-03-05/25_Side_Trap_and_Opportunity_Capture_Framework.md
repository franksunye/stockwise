# Side Trap 与短线机会捕获框架（仅基于现有数据）

**文档状态**: Draft  
**作者**: Codex  
**日期**: 2026-03-05  
**范围**: 仅使用当前系统已存在的数据表与字段，不引入外部新数据源。

---

## 1. 问题定义

你的核心问题不是“有没有机会”，而是：

1. 机会存在时，系统为什么还在 `Side`。  
2. 现有 LLM 预测与量化规则为什么都抓不到短线上涨。  
3. 仅靠现有数据，如何把“方向判断”升级成“高概率机会捕获”。

---

## 2. 结论先行

当前系统存在“`Side` 偏置闭环”：

1. 提示词默认观望。  
2. 低置信方向信号被熔断回 `Side`。  
3. 主信号按模型优先级路由到高优先级模型，而该模型长期 `Side`。  
4. 验证逻辑存在 `Side` 判定缺陷，导致 `Side` 历史准确率被高估。  

结果是：系统在“可交易机会”出现时依然输出 `Side`，并被历史统计再次强化。

---

## 3. 证据（本地数据快照）

数据源：`data/stockwise.db`  
快照时点：2026-03-05

### 3.1 模型信号分布（2026-01-01 以来）

`ai_predictions_v2` 聚合结果：

- `deepseek-v3`: `Side=158`（`Long=0`, `Short=0`）
- `deepseek-v3.2-exp`: `Side=148`（`Long=0`, `Short=0`）
- `hunyuan-lite`: `Side=844`, `Short=1`
- `gemini-3-flash`: `Side=296`, `Long=7`, `Short=1`
- `rule-engine`: `Long=321`, `Short=440`, `Side=240`

解释：在多模型里，主 LLM 层几乎全部保守到 `Side`。

### 3.2 最新主信号退化

- `is_primary=1` 的最新日期：`2026-03-05`
- 当天主信号统计：`Side=26`（全体主信号均为 `Side`）

### 3.3 `Side` 验证异常

统计：

- `signal='Side' AND validation_status='Correct'`：`1292`
- 其中 `ABS(actual_change) > 1`：`750`（约 `58.0%`）

解释：大量超过噪声阈值的波动仍被记为 `Side Correct`，会污染模型历史反馈。

### 3.4 新易盛（300502）个案

- 日线覆盖：`2025-10-13 ~ 2026-03-05`，共 `96` 根。
- 2026-03-05：`401.24`，单日 `+8.63%`，成交量 `69,677,874`。
- 当日三模型输出：`deepseek-v3/rule-engine/hunyuan-lite` 全是 `Side`（deepseek 为主）。
- 历史上该股“单日涨幅 >= 7%”样本：`8` 次；可回看样本中：
  - 次日胜率 `71.4%`，平均 `+1.70%`
  - 3日胜率 `71.4%`，平均 `+1.63%`

解释：机会存在，但当前标签体系没有有效表达“机会状态”。

---

## 4. 代码级根因定位

### 4.1 提示词先验偏置（默认观望）

文件：`backend/templates/prompts/stock_analysis_user.j2`  
关键位置：默认输出 `Side` 的强约束（约第 93 行）。

影响：LLM 在边界条件下更可能选择 `Side`，而不是输出可执行方向。

### 4.2 熔断机制二次压制方向

文件：`backend/engine/ai_service.py`  
关键逻辑：`safe_threshold = 0.75`，低于阈值的 `Long/Short` 被强制改写为 `Side`（约第 43-53 行）。

影响：即使模型识别到方向，也会被后处理抹平。

### 4.3 主信号路由偏置

文件：`backend/engine/runner.py`  
关键逻辑：主信号由模型优先级选出（约第 173-189 行）。  
当前 DB 中 `deepseek-v3` 优先级高于其他模型且处于 active 状态，导致主信号长期受其 `Side` 输出主导。

### 4.4 验证器 Side 判定条件错误

文件：`backend/engine/validator.py`  
关键逻辑（约第 124 行）：

```python
verdict = 'Correct' if cumulative_change <= NOISE_THRESHOLD else 'Incorrect'
```

正确语义应为：

```python
verdict = 'Correct' if abs(cumulative_change) <= NOISE_THRESHOLD else 'Incorrect'
```

影响：下跌较大的 `Side` 也会被记为正确，回流到准确率统计，形成错误正反馈。

---

## 5. 目标函数重定义：从“方向分类”到“机会捕获”

当前输出是 3 分类：`Long/Side/Short`。  
短线交易真正需要的是 2 层输出：

1. **机会层**：是否存在可交易非对称机会（Setup）  
2. **执行层**：是否触发入场（Trigger）

建议输出状态机（可兼容现有结构）：

1. `NoSetup`：真观望（没有赔率优势）  
2. `Watch`：机会存在，但未触发  
3. `TriggeredLong`：触发做多执行  
4. `RiskOff`：防守/回避

`Side` 可以作为 UI 映射值，但内部必须拆分为 `NoSetup/Watch`，否则无法行动化。

---

## 6. 仅用现有数据的可执行方案

全部字段已在 `daily_prices` 中存在：

- 价格：`open/high/low/close/change_percent`
- 量能：`volume`
- 结构：`ma5/ma10/ma20/ma60/boll_*`
- 动能：`rsi/macd_hist/kdj_*`

### 6.1 机会评分（Opportunity Score）

定义一个 0-100 的分数，不替换模型，只作为二级决策层：

1. 价格动量子分：`change_percent`、收盘位置 `(close-low)/(high-low)`  
2. 趋势结构子分：`close vs ma20`、`ma5>ma10>ma20`  
3. 动能修复子分：`macd_hist` 斜率、`rsi` 区间  
4. 波动赔率子分：基于 `ATR` 或近 14 日真实波动估计风险/收益比

输出两个概率：

1. `P_up_1d`：未来 1 日收涨概率  
2. `P_surge_3d`：未来 3 日内出现可交易冲高概率（可参考 `max_perf_in_window` 定义）

### 6.2 触发规则（不追求预测，追求执行）

以 `Watch -> TriggeredLong` 为核心：

1. `Watch` 条件：`OpportunityScore` 超阈值，且风险收益比 >= 2。  
2. `TriggeredLong` 条件：突破确认或回踩确认（二选一）。  
3. 失效条件：跌破 `stop_loss_reference` 或关键支撑失守。

### 6.3 与现系统兼容的最小改造

1. 保留 `Long/Side/Short` 对外接口。  
2. 在 `ai_reasoning` JSON 内新增：
   - `opportunity_score`
   - `setup_state` (`NoSetup/Watch/TriggeredLong/RiskOff`)
   - `trigger_rule_hit`
3. 前端先读 `setup_state` 再映射视觉标签。

---

## 7. 分阶段落地计划

### Phase 0（立即修复）

1. 修复 `validator.py` 的 `Side` 判定（`abs`）。  
2. 回填最近样本验证，清洗被污染的 `Correct/Incorrect`。  

### Phase 1（低风险增量）

1. 新增 `opportunity_score` 计算模块（纯读现有表）。  
2. 在 runner 存储层增加 `setup_state` 到 reasoning JSON。  
3. 不改 UI 结构，只增加调试展示。

### Phase 2（策略上线）

1. 在通知/选股页面增加 `Watch` 与 `TriggeredLong` 过滤。  
2. 将“机会触发”作为 push 条件之一，不再只依赖 `Side->Long` 翻转。

### Phase 3（校准）

1. 每周重算分层指标：
   - `Watch` 的触发率  
   - `TriggeredLong` 的 `T+1/T+3` 收益与胜率  
   - 回撤与赔率分布  
2. 以交易结果校准阈值，不靠主观调参数。

---

## 8. 关键指标（上线后必须看）

1. `Coverage`: 每日 `Watch` 覆盖率（不能过低或过高）  
2. `HitRate`: `TriggeredLong` 的 `T+1` 胜率  
3. `Payoff`: `avg_win / avg_loss`  
4. `Expectancy`: `HitRate * avg_win - (1-HitRate) * avg_loss`  
5. `False Side Rate`: 被标记为 `NoSetup` 但后续出现 `max_perf>=5%` 的比例

---

## 9. 风险与边界

1. 数据窗口较短时，参数易过拟合。  
2. 仅日线数据无法覆盖盘中抢筹细节，触发规则需保守。  
3. 行业切换期（比如高波动主题）阈值可能需要分市场/分板块。  

---

## 10. 本文档对应的执行建议

优先顺序：

1. 先修验证器 bug（否则所有后续评估基线失真）。  
2. 再做 `opportunity_score + setup_state`，先旁路运行，不立即替代主信号。  
3. 最后再讨论是否调整 prompt 的 `Side` 默认策略和熔断阈值。  

这条路径能在“最小改动、最小风险”下，把系统从“只会观望”推进到“可执行的机会捕获”。

---

## 11. 融合补充：短线突破信号库（吸收外部方案后的可执行版）

以下信号全部限定为“仅使用当前已入库字段”：

1. `VCP-like 收缩`：近 5 日振幅均值显著低于近 20 日振幅均值。  
2. `放量突破`：`volume > 1.5 * avg(volume,5)` 且 `close > ma10 && close > ma20`。  
3. `强势收盘`：`(close - low) / NULLIF(high - low, 0) >= 0.7`。  
4. `动量修复`：`macd_hist` 较前日抬升，`rsi` 从中性区向上脱离。

状态映射建议：

1. 同时满足 1+2，记为 `Watch`。  
2. 满足 1+2+3，且 `change_percent > 5`，记为 `TriggeredLong`。  
3. `TriggeredLong` 后若 `close < ma10` 或跌破入场失效位，记为 `RiskOff`。

说明：本节用于把“突破直觉”转成标准化计算，不替代第 6 节机会评分，而是作为高优先级触发器。
