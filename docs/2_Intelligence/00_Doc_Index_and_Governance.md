# 2_Intelligence 文档索引与治理（对齐版）

**文档状态**: Active  
**日期**: 2026-03-06

---

## 1. 主文档（长期维护）

1. `39_Tradeability_Dual_Lane_Operations.md`  
   运行手册：双轨执行、命令、核验 SQL、回滚
2. `40_Gemini_Quant_AI_Two_Layer_Refactoring_Plan.md`  
   策略与工程边界：Layer-1 裁决，Layer-2 解释
3. `27_Acceptance_Criteria_v1.md`  
   验收门槛：一致性、收益质量、风险、输出完整性
4. `27_DeepSeek_V3_Rich_Context_Limits.md`  
   研究边界与证据登记

---

## 2. 冲突优先级（口径冲突时）

1. 运行口径：`39`
2. 架构与职责口径：`40`
3. 验收口径：`27_Acceptance_Criteria_v1`
4. 研究边界：`27_DeepSeek_V3_Rich_Context_Limits`
5. 归档文档：仅作历史记录，不作为现行执行依据

---

## 3. 维护规则（防膨胀）

1. 同主题不新增平行主文档，优先更新现有主文档。
2. 实验先写 `archive/` 或 `research/`，复验后再回写主文档。
3. 关键结论必须可追溯（SQL、测试、代码或流程证据）。
4. 关键变更需同步更新文档头部日期与状态。

---

## 4. 触发更新条件

1. `layer1_state.py` 状态机或映射规则变更
2. `runner.py` 强制对齐逻辑变更
3. `rule_based.py` 职责边界（裁决/解释）变更
4. `ai_predictions_v2` 的 Layer-1 字段或写入规则变更
5. 验收阈值调整（覆盖率、一致率、MDD、输出完整性）
