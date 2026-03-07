# 14 Investment Mode Backend Runbook

更新时间：2026-03-07  
范围：本地开发环境（SQLite / Turso-compat SQL）

发布状态：
- 已发布到 `main`（commit: `a941edf`）

## 1. 目标

保证 Investment Mode 在后端形成闭环：
- 数据结构：`user_investment_mode` / `mode_decision_log` / `mode_simulated_trade_ledger` / `mode_performance_snapshot`
- 审计字段：`job_id` / `rule_version` / `triggered_by`
- 产数程序：`prediction -> decision -> ledger -> snapshot`
- API：`/api/user/mode`、`/api/modes`、`/api/modes/performance`、`/api/modes/performance/summary`、`/api/modes/performance/ledger`、`/api/modes/decisions`

## 2. 已落地代码位置

- 数据库初始化与补列：`backend/database.py`
- 预测落库（含 `mode_id`）：`backend/db_repo/queries.py`、`backend/engine/runner.py`
- Mode 管线：`backend/analysis/mode_pipeline.py`
- Mode 管线脚本：`backend/scripts/run_mode_pipeline.py`
- CLI 入口：`backend/main.py`（`--mode-pipeline`）
- API 实现：`frontend/src/lib/investment-mode.ts`
  - `frontend/src/app/api/user/mode/route.ts`
  - `frontend/src/app/api/modes/route.ts`
  - `frontend/src/app/api/modes/performance/route.ts`

## 3. 本地执行顺序

1. 初始化/迁移数据库（由主程序 `init_db()` 自动执行）
2. 运行预测主流程（写 `ai_predictions_v2`）
3. 运行 mode 管线（可独立，也可随 `--analyze` 自动执行）：
   - `python backend/main.py --mode-pipeline --date YYYY-MM-DD`
   - 或 `python backend/scripts/run_mode_pipeline.py --date YYYY-MM-DD`
   - 如需仅跑分析不跑 mode 管线：`python backend/main.py --analyze --skip-mode-pipeline`
4. 前端通过 API 拉取模式与表现

## 4. 稳定性边界

- 不回写历史结论：模式切换仅影响后续产数与表现聚合。
- Free/Pro 权限边界在 API 层执行：
  - Free 默认仅 `balanced_v1 + universal + 30d`
- `sample_size < 30` 返回不足样本状态，不给结论。

## 5. 最小验收

- 后端单测：
  - `python -m unittest backend.tests.test_mode_pipeline`
- 回归相关：
  - `python -m unittest backend.tests.test_runner_layer1_enforcement backend.tests.test_backfill_v2_query`
- 前端构建：
  - `cd frontend && npm run build`

## 6. Workflow 全量演练（本地等价）

- 已按 `.github/workflows` 后端相关 job 做本地等价执行（2026-03-07）：
  - 数据同步：`meta_sync` / `data_sync_cn` / `data_sync_hk` / `data_sync_realtime` / `data_sync_single` / `sync_hk_short`
  - 分析验证：`ai_analyze_cn` / `ai_analyze_hk` / `ai_backfill` / `verify_predictions`
  - 运营与质量：`daily_brief_push` / `daily_validation_check` / `daily_morning_call(dry-run)` / `layer1_consistency` / `acceptance_weekly` / `trading_day_gate` / `user_maintenance(dry-run)` / `admin_codes`
  - 策略实验：`tradeability_sidecar_daily(dry-run)` / `tradeability_experiment_weekly` / `tradeability_sidecar_weekly_calibration`
- 结果归档：
  - `tmp/workflow_e2e/light_jobs_result.json`
  - `tmp/workflow_e2e/heavy_jobs_result.json`

## 7. 关联治理与可观测

- Layer-1 指标与参数治理：
  - `docs/1_Engineering/15_Layer1_Indicator_and_Param_Governance.md`
- Admin 可观测看板（PC）：
  - 页面：`/admin/observability`
  - API：`/api/admin/observability`
