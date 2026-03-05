# 2_Intelligence 文档索引与治理规则

**文档状态**: Active  
**日期**: 2026-03-06  
**分支**: `main`

## 1. 当前文档分层

### A. 主文档（长期维护，作为对外/对内统一口径）

1. `25_Side_Trap_and_Opportunity_Capture_Framework.md`
2. `26_Independent_Research_AI_Quant_Tradeability_Framework.md`
3. `27_Acceptance_Criteria_v1.md`
4. `37_Capital_Evaluation_1M_2026-03-05.md`
5. `38_Tradeability_Sidecar_Production_Runbook.md`
6. `39_Tradeability_Dual_Lane_Operations.md`

### B. 实验日志（可追溯，不作为最终口径）

1. `28_Minimum_Iteration_Closure_2026-03-05.md`
2. `29_Minimum_Iteration_Closure_WF3_Baseline_2026-03-05.md`
3. `30_AB_Test_VCP_Ratio_2026-03-05.md`
4. `31_AB_Test_StopLoss_vcp09_2026-03-05.md`
5. `32_Parameter_Decision_Log_2026-03-05.md`
6. `33_AB_Test_Breakout_Volume_Mult_2026-03-05.md`
7. `34_AB_Test_StrongClose_Threshold_2026-03-05.md`
8. `35_AB_Test_Momentum_Threshold_2026-03-05.md`
9. `36_AB_Test_VCP_09_vs_10_2026-03-05.md`

### C. 已归档（历史参考）

1. `archive/gemini_2026-03-05/*`

## 2. 管理规则（从现在开始）

1. 口径优先级：`39 > 38 > 37 > 27 > 26 > 25`。
2. 新实验结论先写“实验日志”，只有复验稳定后才回写主文档。
3. 主文档发生关键变更时，必须更新文档头部的日期与状态。
4. 同类内容避免新增平行文档，优先追加到既有主文档章节。

## 3. 本轮上线对应关系

1. 策略执行链路：`run_tradeability_sidecar.py` + `tradeability_sidecar_daily.yml`
2. 周度校准链路：`run_tradeability_weekly_calibration.py` + `tradeability_sidecar_weekly_calibration.yml`
3. 参数配置：`backend/strategy_config/tradeability_params_v1.json`

## 4. 下一次文档维护触发条件

1. 连续 2-3 周校准结果稳定优于基线（需更新 37/39）。
2. 验收标准调整（需更新 27）。
3. 策略结构变化（需更新 38/39）。
