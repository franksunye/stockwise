# 量化 + AI 双层重构计划（对齐版）

**文档状态**: Active  
**日期**: 2026-03-06  
**当前分支口径**: `feat/layer1-state-machine-v1`  
**关联文档**: `39_Tradeability_Dual_Lane_Operations.md`, `27_Acceptance_Criteria_v1.md`, [Spec 40 (UX)](../3_Product/Specs/40_Quant_AI_Dual_Layer_UX.md)

---

## 1. 目标定义（最终口径）

1. Layer-1（量化层）拥有方向裁决权（Single Source of Truth）。
2. Layer-2（LLM / Rule Engine）负责解释、战术、风控表达，不再拥有最终方向裁决权。
3. 用户界面与输出结构保持稳定，不通过改 UI 来掩盖架构问题。

---

## 2. 当前已落地能力（2026-03-06）

### 2.1 Layer-1 状态机与映射

1. 状态机已落地：`NoSetup / Watch / TriggeredLong / RiskOff`
2. 方向映射已固定：
   - `TriggeredLong -> Long`
   - `NoSetup / Watch / RiskOff -> Side`

### 2.2 执行链路约束

1. `runner` 在模型返回后执行 Layer-1 方向强制对齐（可通过 `LAYER1_SIGNAL_ENFORCE` 应急开关回退）。
2. LLM 提示词与 synthesis 均注入 Layer-1 硬约束说明。
3. `rule-engine` 已改为“分析器角色”：
   - 可保留自身原始规则信号用于解释。
   - 最终输出方向对齐 Layer-1。

### 2.3 数据落库与可观测

`ai_predictions_v2` 已落库 Layer-1 关键字段：

1. `layer1_status`
2. `layer1_score`
3. `layer1_trigger_hit`
4. `layer1_risk_off_hit`
5. `layer1_strategy_version`
6. `layer1_payload`

---

## 3. 职责边界（策略与工程统一）

### 3.1 Layer-1（量化裁决层）

负责：

1. 可交易性判断
2. 方向裁决（Long/Side）
3. 风险否决（RiskOff）

不负责：

1. 长文本叙事
2. 用户沟通文案

### 3.2 Layer-2（解释与战术层）

负责：

1. 解释“为什么”
2. 输出战术分支（持盈/持亏/空仓）
3. 风险提示与反方观点

不负责：

1. 覆写最终方向

---

## 4. 研发与验证口径

1. 研发与功能验证默认使用本地 SQLite（与生产同构 schema）。
2. 模型测试按当前约束执行：优先 `hunyuan-lite` 与 `gemini local`。
3. 验证优先级：
   - 方向一致性（Layer-1 与最终 signal）
   - 输出完整性（summary/reasoning_trace/tactics）
   - 稳定性与耗时

### 4.1 当前在线口径实测基线（SQLite 回放，2026-03-06）

口径：以当前在线 LLM 模型（`deepseek-v3` + `gemini-3-flash` + `hunyuan-lite`）的历史 `ai_predictions_v2` 记录作为基线，对同一批 `symbol+date` 使用 `tradeability_v1` 重算 Layer-1 状态并映射 `Long/Side`。

1. 样本量：`n=1327`（date range: `2025-01-09` ~ `2026-03-05`）
2. 原始 LLM Long 占比：`0.60%`（`8/1327`）
3. Layer-1 重算 Long 占比：`1.51%`（`20/1327`）
4. Long 提升：`+0.90pp`（约 `2.50x`）
5. 状态分布：
   - `NoSetup`: `553` (`41.67%`)
   - `Watch`: `27` (`2.03%`)
   - `RiskOff`: `727` (`54.79%`)
   - `TriggeredLong`: `20` (`1.51%`)

结论：Layer-1 已经把“全 Side 黑盒”拆解为可解释的子状态，但当前参数下 `TriggeredLong` 覆盖仍偏低，后续迭代主目标是“在不显著恶化风险的前提下，提高 TriggeredLong 覆盖”。

---

## 5. 下一阶段（不改 UI 的前提下）

1. 扩展 Layer-1 策略版本（`tradeability_v2`）并保持同一裁决接口。
2. 增加策略实验框架（v1/v2 并行评估），不改用户前台结构。
3. 固化观测面板：方向一致率、状态分布、触发率、回撤控制。
4. 参数调优固化执行顺序（单参数小步迭代）：
   - 优先放宽进场触发相关阈值（`breakout_volume_mult` / `momentum_change_threshold`），观察 `TriggeredLong coverage`。
   - 同步监控 `RiskOff` 占比与最大回撤，避免以覆盖率换风险失控。
   - 每轮仅改 1 个参数，按周固化决策日志。

---

## 6. 非目标（当前阶段）

1. 不以“压缩 token”作为目标本身。
2. 不为追求速度牺牲分析信息完整性。
3. 不在本阶段改动前端交互与视觉层。
