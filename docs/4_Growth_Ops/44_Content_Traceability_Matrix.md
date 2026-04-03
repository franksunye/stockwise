# Content Traceability Matrix 溯源总控表

> 这是一份由 `/content-audit` 命令自动生成的核心物料与外部发布内容追踪表。
> **生成时间**: 2026-04-03T08:09:30.103Z

## 🚨 预警区：逻辑过期风险 (Outdated)

底层战略/工程文档已经更新，对应的外部内容需要复核以防止文案逻辑冲突。

- 🔴 [`docs/4_Growth_Ops/content/April_Content_Matrix_Engineering_2026.md`](../../docs/4_Growth_Ops/content/April_Content_Matrix_Engineering_2026.md) -> 需复核底层更新 `docs/3_Product/Specs/48_Admin_Tradeability_Control_Tower.md`
- 🔴 [`docs/4_Growth_Ops/content/GRSAI_IMAGE_TOOL.md`](../../docs/4_Growth_Ops/content/GRSAI_IMAGE_TOOL.md) -> 需复核底层更新 `docs/4_Growth_Ops/46_Content_Operations_System_Blueprint.md`
- 🔴 [`docs/4_Growth_Ops/content/IMAGE_GENERATION_WORKFLOW.md`](../../docs/4_Growth_Ops/content/IMAGE_GENERATION_WORKFLOW.md) -> 需复核底层更新 `docs/4_Growth_Ops/46_Content_Operations_System_Blueprint.md`
- 🔴 [`docs/4_Growth_Ops/content/MASTER_SERIES_CONTENT_INTEGRATION_2026.md`](../../docs/4_Growth_Ops/content/MASTER_SERIES_CONTENT_INTEGRATION_2026.md) -> 需复核底层更新 `docs/4_Growth_Ops/content/README.md`
- 🔴 [`docs/4_Growth_Ops/content/March_Content_Matrix_Execution_2026.md`](../../docs/4_Growth_Ops/content/March_Content_Matrix_Execution_2026.md) -> 需复核底层更新 `docs/0_Strategy/07_Growth_and_GTM_Roadmap.md`
- 🔴 [`docs/4_Growth_Ops/content/WECHAT_LAYOUT_PLAYBOOK_FINANCE_EDITORIAL.md`](../../docs/4_Growth_Ops/content/WECHAT_LAYOUT_PLAYBOOK_FINANCE_EDITORIAL.md) -> 需复核底层更新 `docs/4_Growth_Ops/46_Content_Operations_System_Blueprint.md`
- 🔴 [`docs/4_Growth_Ops/content/WECHAT_VISUAL_PLAYBOOK_10W_2026Q2.md`](../../docs/4_Growth_Ops/content/WECHAT_VISUAL_PLAYBOOK_10W_2026Q2.md) -> 需复核底层更新 `docs/4_Growth_Ops/46_Content_Operations_System_Blueprint.md`

## ⚠️ 预警区：孤儿内容 (Orphaned)

缺乏底层文档支撑（没有 source_docs 字段或指向丢失）。属于纯脑洞散点营销，需绑定源头。

- 🟠 [`docs/4_Growth_Ops/content/MASTER_SERIES_CONTENT_INTEGRATION_2026.md (Missing Source: docs/4_Growth_Ops/content/101_academy/ZISO_101_SYLLABUS.md)`](../../docs/4_Growth_Ops/content/MASTER_SERIES_CONTENT_INTEGRATION_2026.md (Missing Source: docs/4_Growth_Ops/content/101_academy/ZISO_101_SYLLABUS.md))

## 🧭 预警区：引用了已废弃源文档 (Deprecated Sources)

如果某篇内容仍然依赖已标记为 `deprecated` 或 `archived` 的上游文档，说明它的事实基础可能已不是现行版本。

- *当前无内容引用已废弃源文档*

## 🧱 预警区：引用了未补规范元数据的源文档 (Source Metadata Missing)

如果某篇内容引用的上游文档还没有补齐 `doc_id / doc_domain / doc_status`，系统虽可追踪路径，但还不能稳定判断它是否属于现行事实源。

- 🟡 `docs/4_Growth_Ops/46_Content_Operations_System_Blueprint.md` 缺少 `doc_id`, `doc_domain`, `doc_status`；当前影响 4 篇内容（例如：`docs/4_Growth_Ops/content/GRSAI_IMAGE_TOOL.md`、`docs/4_Growth_Ops/content/IMAGE_GENERATION_WORKFLOW.md`、`docs/4_Growth_Ops/content/WECHAT_LAYOUT_PLAYBOOK_FINANCE_EDITORIAL.md`）
- 🟡 `docs/2_Intelligence/registry/MASTER_SERIES_NOTEBOOKLM_PLAN.md` 缺少 `doc_id`, `doc_domain`, `doc_status`；当前影响 1 篇内容（例如：`docs/4_Growth_Ops/content/MASTER_SERIES_CONTENT_INTEGRATION_2026.md`）
- 🟡 `docs/4_Growth_Ops/content/CONTENT_ASSET_TEMPLATE.md` 缺少 `doc_id`, `doc_domain`, `doc_status`；当前影响 1 篇内容（例如：`docs/4_Growth_Ops/content/MASTER_SERIES_CONTENT_INTEGRATION_2026.md`）
- 🟡 `docs/4_Growth_Ops/content/README.md` 缺少 `doc_id`, `doc_domain`, `doc_status`；当前影响 1 篇内容（例如：`docs/4_Growth_Ops/content/MASTER_SERIES_CONTENT_INTEGRATION_2026.md`）

## 💡 IP 闲置榜 (Under-utilized Internal Docs)

以下高价值的内部战略或工程架构，尚未被转化为任意一篇对外 Growth 营销或客服物料。

- 🔵 [`docs/0_Strategy/00_Product_Business_Vision.md`](../../docs/0_Strategy/00_Product_Business_Vision.md)
- 🔵 [`docs/0_Strategy/01_Product_Positioning_and_Boundaries.md`](../../docs/0_Strategy/01_Product_Positioning_and_Boundaries.md)
- 🔵 [`docs/0_Strategy/02_Monetization_Pricing_Strategy.md`](../../docs/0_Strategy/02_Monetization_Pricing_Strategy.md)
- 🔵 [`docs/0_Strategy/03_Team_Responsibility_Matrix.md`](../../docs/0_Strategy/03_Team_Responsibility_Matrix.md)
- 🔵 [`docs/0_Strategy/04_Milestones_Execution_Log.md`](../../docs/0_Strategy/04_Milestones_Execution_Log.md)
- 🔵 [`docs/0_Strategy/05_Quant_Signal_and_Execution_Axioms.md`](../../docs/0_Strategy/05_Quant_Signal_and_Execution_Axioms.md)
- 🔵 [`docs/0_Strategy/06_Quant_Industry_Positioning_Map.md`](../../docs/0_Strategy/06_Quant_Industry_Positioning_Map.md)
- 🔵 [`docs/0_Strategy/08_Globalization_Strategy_and_Evolution.md`](../../docs/0_Strategy/08_Globalization_Strategy_and_Evolution.md)
- 🔵 [`docs/0_Strategy/09_Decision_Stack_and_Producer_Architecture.md`](../../docs/0_Strategy/09_Decision_Stack_and_Producer_Architecture.md)
- 🔵 [`docs/0_Strategy/10_RFC_2026Q2_GTM_and_Product_Strategy_Pivot.md`](../../docs/0_Strategy/10_RFC_2026Q2_GTM_and_Product_Strategy_Pivot.md)
- 🔵 [`docs/0_Strategy/history/MILESTONE_2025.md`](../../docs/0_Strategy/history/MILESTONE_2025.md)
- 🔵 [`docs/2_Intelligence/20_Doc_Index_and_Governance.md`](../../docs/2_Intelligence/20_Doc_Index_and_Governance.md)
- 🔵 [`docs/2_Intelligence/22Q_Quant_Research_Framework.md`](../../docs/2_Intelligence/22Q_Quant_Research_Framework.md)
- 🔵 [`docs/2_Intelligence/23Q_Method_Registry_Design.md`](../../docs/2_Intelligence/23Q_Method_Registry_Design.md)
- 🔵 [`docs/2_Intelligence/24Q_Method_Mapping_Examples.md`](../../docs/2_Intelligence/24Q_Method_Mapping_Examples.md)
- 🔵 [`docs/2_Intelligence/26C_Quant_AI_Acceptance_Criteria.md`](../../docs/2_Intelligence/26C_Quant_AI_Acceptance_Criteria.md)
- 🔵 [`docs/2_Intelligence/27C_Dual_Lane_Operations_Manual.md`](../../docs/2_Intelligence/27C_Dual_Lane_Operations_Manual.md)
- 🔵 [`docs/2_Intelligence/28Q_Quant_Backtesting_Methodology.md`](../../docs/2_Intelligence/28Q_Quant_Backtesting_Methodology.md)
- 🔵 [`docs/2_Intelligence/29Q_Mode_Params_Promotion.md`](../../docs/2_Intelligence/29Q_Mode_Params_Promotion.md)
- 🔵 [`docs/2_Intelligence/30Q_Trade_Management_Research_Framework.md`](../../docs/2_Intelligence/30Q_Trade_Management_Research_Framework.md)
- 🔵 [`docs/2_Intelligence/31Q_Validation_Logic_Research_Legacy.md`](../../docs/2_Intelligence/31Q_Validation_Logic_Research_Legacy.md)
- 🔵 [`docs/2_Intelligence/legacy_specs/Multi_Model_Prediction_Design.md`](../../docs/2_Intelligence/legacy_specs/Multi_Model_Prediction_Design.md)
- 🔵 [`docs/2_Intelligence/registry/archetypes/trend_breakout.md`](../../docs/2_Intelligence/registry/archetypes/trend_breakout.md)
- 🔵 [`docs/2_Intelligence/registry/components/macd_crossover.md`](../../docs/2_Intelligence/registry/components/macd_crossover.md)
- 🔵 [`docs/2_Intelligence/registry/masters/alexander_elder.md`](../../docs/2_Intelligence/registry/masters/alexander_elder.md)
- 🔵 [`docs/2_Intelligence/registry/masters/mark_minervini.md`](../../docs/2_Intelligence/registry/masters/mark_minervini.md)
- 🔵 [`docs/2_Intelligence/registry/masters/pradeep_bonde.md`](../../docs/2_Intelligence/registry/masters/pradeep_bonde.md)
- 🔵 [`docs/2_Intelligence/registry/masters/warren_buffett.md`](../../docs/2_Intelligence/registry/masters/warren_buffett.md)
- 🔵 [`docs/2_Intelligence/registry/methodologies/episodic_pivot_bonde.md`](../../docs/2_Intelligence/registry/methodologies/episodic_pivot_bonde.md)
- 🔵 [`docs/2_Intelligence/registry/methodologies/sepa_minervini.md`](../../docs/2_Intelligence/registry/methodologies/sepa_minervini.md)
- 🔵 [`docs/2_Intelligence/registry/methodologies/turtle_trading.md`](../../docs/2_Intelligence/registry/methodologies/turtle_trading.md)
- 🔵 [`docs/2_Intelligence/registry/risk_rules/atr_stop.md`](../../docs/2_Intelligence/registry/risk_rules/atr_stop.md)
- 🔵 [`docs/2_Intelligence/research/01_Quant_Trading_Schools_Taxonomy.md`](../../docs/2_Intelligence/research/01_Quant_Trading_Schools_Taxonomy.md)
- 🔵 [`docs/2_Intelligence/research/42_Local_Tradeability_Experiment_Preparation.md`](../../docs/2_Intelligence/research/42_Local_Tradeability_Experiment_Preparation.md)
- 🔵 [`docs/2_Intelligence/research/Daily_Tracking_Concept_Initial.md`](../../docs/2_Intelligence/research/Daily_Tracking_Concept_Initial.md)
- 🔵 [`docs/2_Intelligence/research/Validation_Logic_Research.md`](../../docs/2_Intelligence/research/Validation_Logic_Research.md)
- 🔵 [`docs/1_Engineering/10_Architecture.md`](../../docs/1_Engineering/10_Architecture.md)
- 🔵 [`docs/1_Engineering/11_Reliability_Protocol.md`](../../docs/1_Engineering/11_Reliability_Protocol.md)
- 🔵 [`docs/1_Engineering/12_Release_Quality_Gates.md`](../../docs/1_Engineering/12_Release_Quality_Gates.md)
- 🔵 [`docs/1_Engineering/13_Quant_Engine_Architecture.md`](../../docs/1_Engineering/13_Quant_Engine_Architecture.md)
- 🔵 [`docs/1_Engineering/14_Investment_Mode_Backend_Runbook.md`](../../docs/1_Engineering/14_Investment_Mode_Backend_Runbook.md)
- 🔵 [`docs/1_Engineering/15_Layer1_Indicator_and_Param_Governance.md`](../../docs/1_Engineering/15_Layer1_Indicator_and_Param_Governance.md)
- 🔵 [`docs/1_Engineering/16_Observability_Thresholds_and_Incidents.md`](../../docs/1_Engineering/16_Observability_Thresholds_and_Incidents.md)
- 🔵 [`docs/1_Engineering/18_Backend_Workflow_Orchestration_Map.md`](../../docs/1_Engineering/18_Backend_Workflow_Orchestration_Map.md)
- 🔵 [`docs/1_Engineering/19_Dual_Track_Decision_Architecture_Proposal.md`](../../docs/1_Engineering/19_Dual_Track_Decision_Architecture_Proposal.md)
- 🔵 [`docs/1_Engineering/20_Investment_Mode_Signal_Unification_Experiments.md`](../../docs/1_Engineering/20_Investment_Mode_Signal_Unification_Experiments.md)
- 🔵 [`docs/1_Engineering/21_Decision_Data_Model_Architecture.md`](../../docs/1_Engineering/21_Decision_Data_Model_Architecture.md)
- 🔵 [`docs/1_Engineering/22_ai_predictions_v2_Data_Dictionary.md`](../../docs/1_Engineering/22_ai_predictions_v2_Data_Dictionary.md)
- 🔵 [`docs/1_Engineering/23_PWA_Dashboard_Refresh_Strategy_Regression_20260313.md`](../../docs/1_Engineering/23_PWA_Dashboard_Refresh_Strategy_Regression_20260313.md)
- 🔵 [`docs/1_Engineering/24_AICouncil_Review_Opinion_Current_State_20260313.md`](../../docs/1_Engineering/24_AICouncil_Review_Opinion_Current_State_20260313.md)
- 🔵 [`docs/1_Engineering/25_AICouncil_Collaboration_Routes_20260318.md`](../../docs/1_Engineering/25_AICouncil_Collaboration_Routes_20260318.md)
- 🔵 [`docs/1_Engineering/25_Onboarding_First_Load_Recovery_Plan_20260314.md`](../../docs/1_Engineering/25_Onboarding_First_Load_Recovery_Plan_20260314.md)
- 🔵 [`docs/1_Engineering/26_Global_First_ISR_Architecture_Design.md`](../../docs/1_Engineering/26_Global_First_ISR_Architecture_Design.md)
- 🔵 [`docs/1_Engineering/27_API_Data_Payload_Optimization.md`](../../docs/1_Engineering/27_API_Data_Payload_Optimization.md)
- 🔵 [`docs/1_Engineering/29_Almanac_Data_Lightweight_Protocol_20260316.md`](../../docs/1_Engineering/29_Almanac_Data_Lightweight_Protocol_20260316.md)
- 🔵 [`docs/1_Engineering/30_Stock_Data_Layers_And_API_Boundaries_20260316.md`](../../docs/1_Engineering/30_Stock_Data_Layers_And_API_Boundaries_20260316.md)
- 🔵 [`docs/1_Engineering/32_Frontend_Network_Optimization_Zero_Redundancy.md`](../../docs/1_Engineering/32_Frontend_Network_Optimization_Zero_Redundancy.md)
- 🔵 [`docs/1_Engineering/33_Cloudflare_Workers_Migration_POC_20260318.md`](../../docs/1_Engineering/33_Cloudflare_Workers_Migration_POC_20260318.md)
- 🔵 [`docs/1_Engineering/33_Stock_News_Fetching_Implementation.md`](../../docs/1_Engineering/33_Stock_News_Fetching_Implementation.md)
- 🔵 [`docs/1_Engineering/34_Dashboard_Page_Refactoring_Design.md`](../../docs/1_Engineering/34_Dashboard_Page_Refactoring_Design.md)
- 🔵 [`docs/1_Engineering/35_Broadcast_LayerA_Operations_Runbook_20260319.md`](../../docs/1_Engineering/35_Broadcast_LayerA_Operations_Runbook_20260319.md)
- 🔵 [`docs/1_Engineering/36_Quant_Engine_Bias_Enforcement_20260323.md`](../../docs/1_Engineering/36_Quant_Engine_Bias_Enforcement_20260323.md)
- 🔵 [`docs/1_Engineering/37_VCP_Visualization_Adapter_Design_20260324.md`](../../docs/1_Engineering/37_VCP_Visualization_Adapter_Design_20260324.md)
- 🔵 [`docs/1_Engineering/38_VCP_First_Demo_Case_02171_20260324.md`](../../docs/1_Engineering/38_VCP_First_Demo_Case_02171_20260324.md)
- 🔵 [`docs/1_Engineering/39_Decision_Model_Implementation_Plan_20260325.md`](../../docs/1_Engineering/39_Decision_Model_Implementation_Plan_20260325.md)
- 🔵 [`docs/1_Engineering/40_Decision_Model_Phase1_Closure_20260325.md`](../../docs/1_Engineering/40_Decision_Model_Phase1_Closure_20260325.md)
- 🔵 [`docs/1_Engineering/41_Frontend_Architecture_Baseline_20260327.md`](../../docs/1_Engineering/41_Frontend_Architecture_Baseline_20260327.md)
- 🔵 [`docs/1_Engineering/42_Trade_Management_Research_Architecture_20260327.md`](../../docs/1_Engineering/42_Trade_Management_Research_Architecture_20260327.md)
- 🔵 [`docs/1_Engineering/43_Trade_Management_POC_02171_20260328.md`](../../docs/1_Engineering/43_Trade_Management_POC_02171_20260328.md)
- 🔵 [`docs/1_Engineering/44_CEnd_Trade_Management_Phase0_Implementation_Plan_20260330.md`](../../docs/1_Engineering/44_CEnd_Trade_Management_Phase0_Implementation_Plan_20260330.md)
- 🔵 [`docs/1_Engineering/GLOBALIZATION_IMPLEMENTATION_DESIGN.md`](../../docs/1_Engineering/GLOBALIZATION_IMPLEMENTATION_DESIGN.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/0_Handover_Report.md`](../../docs/1_Engineering/LLM_Debug_Traces/0_Handover_Report.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/B2_LAB_VS_B2_PROD_SAFE_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/B2_LAB_VS_B2_PROD_SAFE_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/B2_PRODUCTION_MIGRATION_PLAN_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/B2_PRODUCTION_MIGRATION_PLAN_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/B2_VARIANT_CLARIFICATION_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/B2_VARIANT_CLARIFICATION_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/CURRENT_BASELINE_STATUS_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/CURRENT_BASELINE_STATUS_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/CURRENT_LOCAL_GEMINI_BASELINE_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/CURRENT_LOCAL_GEMINI_BASELINE_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/EVAL_RUNNER_README.md`](../../docs/1_Engineering/LLM_Debug_Traces/EVAL_RUNNER_README.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/EXPERIMENT_MAP_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/EXPERIMENT_MAP_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/FOUR_STATE_PROMOTION_PLAN_20260313.md`](../../docs/1_Engineering/LLM_Debug_Traces/FOUR_STATE_PROMOTION_PLAN_20260313.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/FOUR_STATE_PROMOTION_RESULT_20260313.md`](../../docs/1_Engineering/LLM_Debug_Traces/FOUR_STATE_PROMOTION_RESULT_20260313.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/FOUR_STATE_SEMANTICS_VALIDATION_20260313.md`](../../docs/1_Engineering/LLM_Debug_Traces/FOUR_STATE_SEMANTICS_VALIDATION_20260313.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/FOUR_STATE_TASK_LOG_20260313.md`](../../docs/1_Engineering/LLM_Debug_Traces/FOUR_STATE_TASK_LOG_20260313.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/INDEPENDENT_REVIEW_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/INDEPENDENT_REVIEW_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/LAYER1_PROMPT_INJECTION_COMPARISON_20260313.md`](../../docs/1_Engineering/LLM_Debug_Traces/LAYER1_PROMPT_INJECTION_COMPARISON_20260313.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/LOCAL_GEMINI_LEGACY_VS_B2_BASELINE_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/LOCAL_GEMINI_LEGACY_VS_B2_BASELINE_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/LOCAL_WRITE_REGRESSION_README_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/LOCAL_WRITE_REGRESSION_README_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/MODEL_OUTPUT_COMPARISON_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/MODEL_OUTPUT_COMPARISON_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/PHASE3_5_LOCAL_WRITE_VALIDATION_PLAN_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/PHASE3_5_LOCAL_WRITE_VALIDATION_PLAN_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/PHASE3_5_LOCAL_WRITE_VALIDATION_RESULT_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/PHASE3_5_LOCAL_WRITE_VALIDATION_RESULT_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/PHASE4_SMALL_ROLLOUT_PLAN_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/PHASE4_SMALL_ROLLOUT_PLAN_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/PRODUCTION_DEFAULT_SWITCH_DECISION_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/PRODUCTION_DEFAULT_SWITCH_DECISION_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/PRODUCTION_GROUND_TRUTH_CHECK_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/PRODUCTION_GROUND_TRUTH_CHECK_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/PRODUCTION_PROMOTION_RECOMMENDATION_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/PRODUCTION_PROMOTION_RECOMMENDATION_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/PROD_DEEPSEEK_VS_LOCAL_B2_DEEPSEEK_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/PROD_DEEPSEEK_VS_LOCAL_B2_DEEPSEEK_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/PROMPT_AUDIT_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/PROMPT_AUDIT_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/RERUN_AUDIT_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/RERUN_AUDIT_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/SHADOW_CASE_SET_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/SHADOW_CASE_SET_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/SHADOW_VALIDATION_PLAN_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/SHADOW_VALIDATION_PLAN_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/SHADOW_VALIDATION_RESULT_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/SHADOW_VALIDATION_RESULT_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/STRUCTURED_OUTPUT_POLICY_20260313.md`](../../docs/1_Engineering/LLM_Debug_Traces/STRUCTURED_OUTPUT_POLICY_20260313.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/TEST_MATRIX_20260312.md`](../../docs/1_Engineering/LLM_Debug_Traces/TEST_MATRIX_20260312.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/prompts/B1_Minimal_User.md`](../../docs/1_Engineering/LLM_Debug_Traces/prompts/B1_Minimal_User.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/prompts/B2_No_L1_User.md`](../../docs/1_Engineering/LLM_Debug_Traces/prompts/B2_No_L1_User.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/prompts/B2_Rich_User.md`](../../docs/1_Engineering/LLM_Debug_Traces/prompts/B2_Rich_User.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/prompts/B3_Adversarial_System.md`](../../docs/1_Engineering/LLM_Debug_Traces/prompts/B3_Adversarial_System.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/prompts/B3_Distilled_User.md`](../../docs/1_Engineering/LLM_Debug_Traces/prompts/B3_Distilled_User.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/prompts/B4_FourState_System.md`](../../docs/1_Engineering/LLM_Debug_Traces/prompts/B4_FourState_System.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/prompts/B4_STRICT_SYSTEM.md`](../../docs/1_Engineering/LLM_Debug_Traces/prompts/B4_STRICT_SYSTEM.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/prompts/Baseline_Old_System.md`](../../docs/1_Engineering/LLM_Debug_Traces/prompts/Baseline_Old_System.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/prompts/Baseline_Old_User.md`](../../docs/1_Engineering/LLM_Debug_Traces/prompts/Baseline_Old_User.md)
- 🔵 [`docs/1_Engineering/LLM_Debug_Traces/prompts/Shared_Optimized_System.md`](../../docs/1_Engineering/LLM_Debug_Traces/prompts/Shared_Optimized_System.md)
- 🔵 [`docs/1_Engineering/legacy_designs/Stock_News_Fetching.md`](../../docs/1_Engineering/legacy_designs/Stock_News_Fetching.md)
- 🔵 [`docs/1_Engineering/legacy_designs/Technical_Design.md`](../../docs/1_Engineering/legacy_designs/Technical_Design.md)
- 🔵 [`docs/1_Engineering/legacy_designs/refactoring-dashboard-page.md`](../../docs/1_Engineering/legacy_designs/refactoring-dashboard-page.md)
- 🔵 [`docs/1_Engineering/templates/Layer1_Param_Change_Template.md`](../../docs/1_Engineering/templates/Layer1_Param_Change_Template.md)
- 🔵 [`docs/3_Product/00_Domain_Entities_Glossary.md`](../../docs/3_Product/00_Domain_Entities_Glossary.md)
- 🔵 [`docs/3_Product/03_Product_Features_Manifest.md`](../../docs/3_Product/03_Product_Features_Manifest.md)
- 🔵 [`docs/3_Product/30_Notification_Strategy_Design.md`](../../docs/3_Product/30_Notification_Strategy_Design.md)
- 🔵 [`docs/3_Product/31_Membership_Design_Plan.md`](../../docs/3_Product/31_Membership_Design_Plan.md)
- 🔵 [`docs/3_Product/32_Nightly_Plan_Feature_Spec.md`](../../docs/3_Product/32_Nightly_Plan_Feature_Spec.md)
- 🔵 [`docs/3_Product/32_v1_Logic_First_Product_Spec.md`](../../docs/3_Product/32_v1_Logic_First_Product_Spec.md)
- 🔵 [`docs/3_Product/Specs/00_SPEC_TEMPLATE.md`](../../docs/3_Product/Specs/00_SPEC_TEMPLATE.md)
- 🔵 [`docs/3_Product/Specs/40_Quant_AI_Dual_Layer_UX.md`](../../docs/3_Product/Specs/40_Quant_AI_Dual_Layer_UX.md)
- 🔵 [`docs/3_Product/Specs/45_Stock_Radar_Discovery_Engine.md`](../../docs/3_Product/Specs/45_Stock_Radar_Discovery_Engine.md)
- 🔵 [`docs/3_Product/Specs/46_Frontend_SWR_Architecture_Upgrade.md`](../../docs/3_Product/Specs/46_Frontend_SWR_Architecture_Upgrade.md)
- 🔵 [`docs/3_Product/Specs/47_Investment_Mode_Product_Layer.md`](../../docs/3_Product/Specs/47_Investment_Mode_Product_Layer.md)
- 🔵 [`docs/3_Product/Specs/49_Investment_Mode_Decision_Local_Snapshot_Spec_20260316.md`](../../docs/3_Product/Specs/49_Investment_Mode_Decision_Local_Snapshot_Spec_20260316.md)
- 🔵 [`docs/3_Product/Specs/50_VCP_Visualization_Transparency_Spec.md`](../../docs/3_Product/Specs/50_VCP_Visualization_Transparency_Spec.md)
- 🔵 [`docs/3_Product/Specs/trade_management/51_CEnd_Trade_Management_Open_Spec_20260330.md`](../../docs/3_Product/Specs/trade_management/51_CEnd_Trade_Management_Open_Spec_20260330.md)
- 🔵 [`docs/3_Product/Specs/trade_management/52_CEnd_Trade_Management_Phase0_UX_Review_20260330.md`](../../docs/3_Product/Specs/trade_management/52_CEnd_Trade_Management_Phase0_UX_Review_20260330.md)
- 🔵 [`docs/3_Product/Specs/trade_management/53_Trade_Management_CN_HK_Market_Aware_Routing_Spec_20260331.md`](../../docs/3_Product/Specs/trade_management/53_Trade_Management_CN_HK_Market_Aware_Routing_Spec_20260331.md)
- 🔵 [`docs/3_Product/Specs/trade_management/54_HK_Trade_Management_Value_Proof_20260331.md`](../../docs/3_Product/Specs/trade_management/54_HK_Trade_Management_Value_Proof_20260331.md)
- 🔵 [`docs/3_Product/UX_Design/UX_Concept_TikTok_Weather.md`](../../docs/3_Product/UX_Design/UX_Concept_TikTok_Weather.md)
- 🔵 [`docs/3_Product/legacy_specs/42_Product_Updates_4_States_Semantic_Upgrade.md`](../../docs/3_Product/legacy_specs/42_Product_Updates_4_States_Semantic_Upgrade.md)
- 🔵 [`docs/3_Product/legacy_specs/Membership_Design_Plan.md`](../../docs/3_Product/legacy_specs/Membership_Design_Plan.md)
- 🔵 [`docs/3_Product/legacy_specs/Nightly_Plan_Feature_Spec.md`](../../docs/3_Product/legacy_specs/Nightly_Plan_Feature_Spec.md)
- 🔵 [`docs/3_Product/legacy_specs/Product_Spec.md`](../../docs/3_Product/legacy_specs/Product_Spec.md)
- 🔵 [`docs/3_Product/legacy_specs/UserCenterDrawer_Notification_Upgrade.md`](../../docs/3_Product/legacy_specs/UserCenterDrawer_Notification_Upgrade.md)

## ✅ 健康溯源映射表 (Healthy Reference Map)

### [`docs/0_Strategy/07_Growth_and_GTM_Roadmap.md`](../../docs/0_Strategy/07_Growth_and_GTM_Roadmap.md)
- -> `docs/4_Growth_Ops/content/April_Content_Matrix_Engineering_2026.md`
- -> `docs/4_Growth_Ops/content/March_Content_Matrix_Execution_2026.md`

### [`docs/2_Intelligence/25A_AI_Context_Limits_DeepSeek.md`](../../docs/2_Intelligence/25A_AI_Context_Limits_DeepSeek.md)
- -> `docs/4_Growth_Ops/content/April_Content_Matrix_Engineering_2026.md`

### [`docs/2_Intelligence/registry/MASTER_SERIES_NOTEBOOKLM_PLAN.md`](../../docs/2_Intelligence/registry/MASTER_SERIES_NOTEBOOKLM_PLAN.md)
- -> `docs/4_Growth_Ops/content/MASTER_SERIES_CONTENT_INTEGRATION_2026.md`

### [`docs/1_Engineering/28_Price_Sync_Zero_Stale_Protocol_20260316.md`](../../docs/1_Engineering/28_Price_Sync_Zero_Stale_Protocol_20260316.md)
- -> `docs/4_Growth_Ops/content/April_Content_Matrix_Engineering_2026.md`

### [`docs/1_Engineering/31_Capacity_Planning_And_Scaling_Strategy_20260317.md`](../../docs/1_Engineering/31_Capacity_Planning_And_Scaling_Strategy_20260317.md)
- -> `docs/4_Growth_Ops/content/April_Content_Matrix_Engineering_2026.md`

### [`docs/3_Product/Specs/41_Phase3_Protection_Spec.md`](../../docs/3_Product/Specs/41_Phase3_Protection_Spec.md)
- -> `docs/4_Growth_Ops/content/April_Content_Matrix_Engineering_2026.md`

### [`docs/3_Product/Specs/48_Admin_Tradeability_Control_Tower.md`](../../docs/3_Product/Specs/48_Admin_Tradeability_Control_Tower.md)
- -> `docs/4_Growth_Ops/content/April_Content_Matrix_Engineering_2026.md`

### [`docs/4_Growth_Ops/46_Content_Operations_System_Blueprint.md`](../../docs/4_Growth_Ops/46_Content_Operations_System_Blueprint.md)
- -> `docs/4_Growth_Ops/content/GRSAI_IMAGE_TOOL.md`
- -> `docs/4_Growth_Ops/content/IMAGE_GENERATION_WORKFLOW.md`
- -> `docs/4_Growth_Ops/content/WECHAT_LAYOUT_PLAYBOOK_FINANCE_EDITORIAL.md`
- -> `docs/4_Growth_Ops/content/WECHAT_VISUAL_PLAYBOOK_10W_2026Q2.md`

### [`docs/4_Growth_Ops/content/CONTENT_ASSET_TEMPLATE.md`](../../docs/4_Growth_Ops/content/CONTENT_ASSET_TEMPLATE.md)
- -> `docs/4_Growth_Ops/content/MASTER_SERIES_CONTENT_INTEGRATION_2026.md`

### [`docs/4_Growth_Ops/content/README.md`](../../docs/4_Growth_Ops/content/README.md)
- -> `docs/4_Growth_Ops/content/MASTER_SERIES_CONTENT_INTEGRATION_2026.md`

