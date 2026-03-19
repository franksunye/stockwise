# 20_Intelligence 文档索引与治理（对齐版）

**文档状态**: Active  
**日期**: 2026-03-09

---

## 1. 现行主文档（长期维护）

1. `27C_Dual_Lane_Operations_Manual.md`  
   运行手册：双轨执行、命令、核验 SQL、回滚
2. `../0_Strategy/06_Quant_Industry_Positioning_Map.md`  
   量化行业地图与道法术器：战略定位与路线图
3. `22Q_Quant_Research_Framework.md`  
   量化方法与大师研究框架
4. `23Q_Method_Registry_Design.md`  
   量化方法库设计规范
5. `28Q_Quant_Backtesting_Methodology.md`  
   量化回测方法审计与行业对照
6. `26C_Quant_AI_Acceptance_Criteria.md`  
   验收门槛：一致性、收益质量、风险、输出完整性
7. `25A_AI_Context_Limits_DeepSeek.md`  
   研究边界与证据登记

当前这条线的现行主依据补充为：

1. `docs/1_Engineering/14_Investment_Mode_Backend_Runbook.md`
2. `docs/3_Product/Specs/47_Investment_Mode_Product_Layer.md`
3. `docs/3_Product/Specs/48_Admin_Tradeability_Control_Tower.md`

## 1.1 已归档或研究中

1. `archive/40_Gemini_Quant_AI_Two_Layer_Refactoring_Plan.md`
   已完成阶段文档：Layer-1 裁决，Layer-2 解释
2. `archive/41_Tradeability_Quality_and_Actionability_Plan.md`
   阶段性研究计划记录：收益质量优化、风险立场产品化、线上影子运行
3. `research/42_Local_Tradeability_Experiment_Preparation.md`
   本地定向实验工作单，仅供研究轮次参考

---

## 2. 冲突优先级（口径冲突时）

1. 运行口径：`27C`
2. 后端运行口径：`docs/1_Engineering/14_Investment_Mode_Backend_Runbook.md`
3. 验收口径：`26C_Quant_AI_Acceptance_Criteria`
4. 产品与后台口径：`47 / 48`
5. 研究边界：`25A_AI_Context_Limits_DeepSeek`
6. 标记为 `Historical Reference`、位于 `archive/` 或位于 `research/` 的文档：仅作历史记录，不作为现行执行依据

---

## 3. 维护规则（防膨胀）

1. 同主题不新增平行主文档，优先更新现有主文档。
2. 实验先写 `archive/` 或 `research/`，复验后再回写主文档。
3. 关键结论必须可追溯（SQL、测试、代码或流程证据）。
4. 关键变更需同步更新文档头部日期与状态。
5. 文档状态最少分为：`Active`、`Completed`、`Historical Reference`。

---

## 4. 触发更新条件

1. `layer1_state.py` 状态机或映射规则变更
2. `runner.py` 强制对齐逻辑变更
3. `rule_based.py` 职责边界（裁决/解释）变更
4. `ai_predictions_v2` 的 Layer-1 字段或写入规则变更
5. 验收阈值调整（覆盖率、一致率、MDD、输出完整性）
