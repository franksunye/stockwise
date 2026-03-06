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

---

## 5. 下一阶段（不改 UI 的前提下）

1. 扩展 Layer-1 策略版本（`tradeability_v2`）并保持同一裁决接口。
2. 增加策略实验框架（v1/v2 并行评估），不改用户前台结构。
3. 固化观测面板：方向一致率、状态分布、触发率、回撤控制。

---

## 6. 非目标（当前阶段）

1. 不以“压缩 token”作为目标本身。
2. 不为追求速度牺牲分析信息完整性。
3. 不在本阶段改动前端交互与视觉层。
