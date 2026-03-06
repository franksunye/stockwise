# 2_Intelligence 文档索引与治理规则

**文档状态**: Active  
**日期**: 2026-03-06  
**分支**: `main`

## 1. 当前主文档（长期维护）

1. `39_Tradeability_Dual_Lane_Operations.md`  
   唯一运行手册（daily + weekly calibration + 回滚）
2. `40_Gemini_Quant_AI_Two_Layer_Refactoring_Plan.md`  
   双层解耦执行计划（Phase 0~3）
3. `27_Acceptance_Criteria_v1.md`  
   验收标准与上线门槛
4. `27_DeepSeek_V3_Rich_Context_Limits.md`  
   研究边界与证据登记（A/B/C）

## 2. 归档区（历史研究与实验）

1. `archive/gemini_2026-03-05/*`（Gemini 初稿归档）
2. `archive/ops_research_2026-03-05/*`（本轮瘦身归档）
   - 包含旧 prompt/playbook、Side Trap 框架、A/B 实验日志、资本评估、旧 runbook 等

## 3. 口径优先级（冲突时）

1. 运行口径：`39`
2. 改造计划：`40`
3. 验收门槛：`27_Acceptance_Criteria_v1`
4. 研究边界：`27_DeepSeek_V3_Rich_Context_Limits`
5. 归档文档：仅作历史证据，不作为当前执行口径

## 4. 维护规则（防止再次膨胀）

1. 同主题禁止新增平行主文档，优先更新现有主文档章节。
2. 新实验先写到 `archive/ops_research_yyyy-mm-dd/`，连续复验后再回写主文档。
3. 凡涉及关键数字（交易额、TAM、CAGR、胜率提升），无可追溯来源不得写成确定性结论。
4. 每次主文档关键变更必须更新头部 `日期` 与 `文档状态`。

## 5. 触发更新条件

1. sidecar 工作流、参数文件或表结构变化（更新 `39`）。
2. 双层解耦阶段顺序或动作变更（更新 `40`）。
3. 验收指标或阈值调整（更新 `27_Acceptance_Criteria_v1`）。
4. 研究证据等级或核心引用变更（更新 `27_DeepSeek_V3_Rich_Context_Limits`）。
