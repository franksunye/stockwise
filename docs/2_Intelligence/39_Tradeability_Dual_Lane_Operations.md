# Tradeability 双脚本上线说明

**日期**: 2026-03-06  
**目标**: 补齐并上线“执行信号 + 周度校准”双脚本闭环，且不影响现有主预测链路。

## 1. 当前双脚本结构

1. 日常执行脚本（写 sidecar 表）  
`backend/scripts/run_tradeability_sidecar.py`
2. 周度校准脚本（不写业务表，只产出建议）  
`backend/scripts/run_tradeability_weekly_calibration.py`
3. 参数配置文件（按市场）  
`backend/strategy_config/tradeability_params_v1.json`

## 2. 对应工作流

1. 日常 sidecar 执行  
`.github/workflows/tradeability_sidecar_daily.yml`
2. 周度参数校准  
`.github/workflows/tradeability_sidecar_weekly_calibration.yml`

## 3. 职责边界（避免干扰主链路）

1. `tradeability_sidecar_daily.yml` 只负责计算并写入 `quant_tradeability_signals`。
2. `tradeability_sidecar_weekly_calibration.yml` 只负责评估参数并输出 artifact：
   - `*_weekly_calibration.json`
   - `*_weekly_calibration.md`
   - `*_updated_params.json`（候选，不自动生效）
3. 不改动 `ai_predictions_v2` 及现有 `daily_pipeline_cn/hk`。

## 4. 上线后的最小运维节奏

1. 每个交易日：看 sidecar 状态分布是否异常（TriggeredLong/Watch/RiskOff 结构是否突变）。
2. 每周：看 calibration artifact 中 `base_robust_score` 与 `best_robust_score` 差值。
3. 仅当连续 2-3 周“best 稳定优于 base”，才手动更新 `backend/strategy_config/tradeability_params_v1.json` 并发版。

## 5. 本地验证命令

```powershell
# 1) sidecar dry-run（本地）
$env:DB_SOURCE="local"
python backend/scripts/run_tradeability_sidecar.py --market CN --dry-run

# 2) weekly calibration（本地）
$env:DB_SOURCE="local"
python backend/scripts/run_tradeability_weekly_calibration.py --market CN
```

## 6. 风险控制

1. 周度脚本默认不自动覆盖生产参数，避免“参数抖动”。
2. 参数更新保持“人工审核 + PR 合并”。
3. 若 sidecar 异常，可单独暂停 sidecar 工作流，不影响主链路。
