# Tradeability 收益质量与动作化计划（Plan 41）

**文档状态**: Active  
**日期**: 2026-03-06  
**承接文档**: `40_Gemini_Quant_AI_Two_Layer_Refactoring_Plan.md`  
**关联文档**: `39_Tradeability_Dual_Lane_Operations.md`, `27_Acceptance_Criteria_v1.md`

---

## 1. 阶段定位

`Plan 40` 已完成 Layer-1 / Layer-2 双层架构重构、策略版本化、历史回灌与窗口观测闭环。

`Plan 41` 不再解决“架构是否成立”，而是解决三个更接近产品落地的问题：

1. `tradeability_v2` 是否能从“更积极”进化到“收益质量更好”。
2. `RiskOff / Watch / TriggeredLong / NoSetup` 是否能稳定翻译成普通投资者可执行的动作语言。
3. 本地研究结论是否能够通过线上 sidecar 影子运行得到验证。

---

## 2. 当前基线（承接自 Plan 40）

### 2.1 本地研究底座

1. 本地 CN `daily_prices` 已扩展到 `499` 个标的。
2. 最近交易日覆盖 `495` 个标的。
3. `quant_tradeability_signals` 已回灌 `487924` 行，覆盖 `498` 个标的、`tradeability_v1 / tradeability_v2` 两个版本。

### 2.2 当前本地 `tradeability_v2` 研究基线

```json
{
  "vcp_ratio": 1.0,
  "breakout_volume_mult": 0.9,
  "strong_close_threshold": 0.55,
  "momentum_change_threshold": 2.3,
  "risk_off_ma": 5
}
```

### 2.3 当前关键现实

1. `tradeability_v2` 已在接近 `500` 标的样本下稳定跨过 `TriggeredLong coverage > 5%`。
2. 但从资金曲线看，`v2` 目前仍未在收益上超越 `v1`。
3. 因此下一阶段的关键，不再是继续提高覆盖率，而是优化“单位风险下的收益质量”。

---

## 3. 阶段目标

### 3.1 收益质量目标

1. 不以进一步抬高 `TriggeredLong coverage` 为优先目标。
2. 优先优化：
   - `Watch -> TriggeredLong` 转化质量
   - `RiskOff` 占比
   - 最大回撤
   - 单位交易的有效性

### 3.2 产品动作化目标

将 Layer-1 状态稳定映射为普通投资者可执行动作：

1. `TriggeredLong -> 可尝试建仓`
2. `Watch -> 继续观察`
3. `RiskOff -> 暂停新增仓位 / 已有仓位应收缩`
4. `NoSetup -> 不建议出手`

要求：

1. 映射口径固定，不因模型输出风格漂移。
2. 不改前台大结构，仅改输出文案与战术表达。

### 3.2.a 面向未来策略产品层的约束

`Plan 41` 的产出，不只是为了把 `tradeability_v2` 调得更顺手，也是在为未来的“策略产品层”打底。

约束如下：

1. 后台允许继续扩展多版本、多策略族与多市场适配。
2. 但当前阶段对外仍只暴露统一动作语言，不把裸策略参数直接抛给普通用户。
3. 后续如果形成“稳健型 / 平衡型 / 进取型 / 防守模式”等模式商店，其底层也必须建立在当前这套 Layer-1 状态机、收益质量评估与动作语言映射之上。

### 3.3 线上验证目标

1. 将当前 `v2` 基线作为实验版本持续 sidecar 并行观察。
2. 验证本地研究结论是否与线上连续样本一致。
3. 在满足 `39` 中 `v2 Default Promotion Gate` 前，不切默认版本。

---

## 4. 执行顺序

### Step 1: 冻结当前 `v2` 基线

目标：

1. 将当前参数组视为标准比较点。
2. 在没有明确证据前，不再做大幅参数漂移。

验收：

1. 所有后续实验都以当前 `v2` 参数为 baseline。

### Step 2: 收益质量导向微调

调优原则：

1. 每轮只改 1 个参数。
2. 优先参数：
   - `vcp_ratio`
   - `strong_close_threshold`
   - 其次才是 `risk_off_ma`
3. 不再优先放宽 `breakout_volume_mult / momentum_change_threshold`。

观测指标：

1. `TriggeredLong coverage`
2. `Watch -> TriggeredLong`
3. `RiskOff` 占比
4. `Max Drawdown`
5. `100万` 起始资金的资金曲线结果

### Step 3: 动作语言固化

目标：

1. 保证 summary 和 tactics 的用户语言与 Layer-1 状态一致。
2. 让普通投资者看到的是“该不该出手 / 该不该收手”，而不是纯策略术语。

验收：

1. 所有模型输出都通过统一映射层收口。
2. `rule-engine` 与 LLM synthesis 的动作语言一致。

### Step 4: 线上 sidecar 影子观察

目标：

1. 持续积累线上 `quant_tradeability_signals`。
2. 验证本地 `499` 样本下的结论是否在真实运行中保持稳定。

验收：

1. 至少连续 `2~4` 周可观察历史。
2. 满足 `39` 的默认切换门槛前，不进入默认替换。

---

## 5. 当前决策

当前阶段结论如下：

1. `tradeability_v2` 保留为下一阶段主研究版本。
2. `tradeability_v1` 继续保留为保守基准版本。
3. 下一阶段不再回答“架构对不对”，而回答“用户能不能据此做动作，以及收益质量能不能提升”。

---

## 6. 退出条件

当以下任一条件满足时，可认为 `Plan 41` 完成：

1. `v2` 在收益质量上明显优于当前基线，并通过线上影子观察。
2. 动作语言已在线上/前台口径稳定运行，且不再依赖模型自由措辞。
3. 项目已形成是否允许 `v2` 切默认的正式决策结论。
