# 知守 AI (ZISO AI) 验收标准 v1.1（两层架构）

**文档状态**: Active  
**日期**: 2026-03-06  
**用途**: 定义“量化 + AI”上线达标条件，统一战略与工程口径。

---

## 1. 适用范围

1. Layer-1 状态机：`NoSetup / Watch / TriggeredLong / RiskOff`
2. Layer-2 输出：`summary + reasoning_trace + tactics + key_levels`
3. 评估口径：成本后结果（含手续费、滑点近似）

---

## 2. Level-1（上线门槛）

### 2.1 方向一致性（强约束）

1. 对所有带 `layer1_status` 的预测记录：
   - `TriggeredLong -> signal=Long`
   - `NoSetup/Watch/RiskOff -> signal=Side`
2. 一致率门槛：`>= 99.5%`（目标 100%）

### 2.2 交易能力

1. `TriggeredLong` 覆盖率：`5% ~ 20%`
2. `Watch -> TriggeredLong` 转化率：`15% ~ 40%`

### 2.3 收益质量

1. `Expectancy > 0`
2. `Payoff >= 1.3`
3. 短线 `T+3` 胜率 `>= 52%`

### 2.4 风险控制

1. 单笔最大亏损 `<= 1R`
2. 策略 MDD 不高于旧基线的 `80%`

### 2.5 输出完整性（用户体验保护）

1. `reasoning_trace` 步数完整（目标 6 步）
2. `tactics` 三场景完整：`holding_profit / holding_loss / empty`
3. 缺失率需低于阈值（建议 `< 0.5%`）

---

## 3. Level-2（中长期优秀线）

1. 跨市场/跨板块/跨周期稳定
2. 风险调整收益显著优于简单趋势基线
3. 显著性检验通过（防数据挖掘幻觉）

---

## 4. 验收结论模板（周复用）

1. 是否满足 Level-1：`Yes/No`
2. 未达标项：逐项列出
3. 下周修复动作与责任人
4. 是否允许扩大实盘权重：`Yes/No`

---

## 5. 文档关系

1. 运行手册：`39_Tradeability_Dual_Lane_Operations.md`
2. 重构计划：`40_Gemini_Quant_AI_Two_Layer_Refactoring_Plan.md`
3. 本文只定义“什么叫达标”，不承担运行步骤说明。
