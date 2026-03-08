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

## 1.1 口径定义：Investment Mode 不等于 sidecar

Investment Mode 与 `tradeability sidecar` 都使用真实市场数据，但职责不同，不得混称：

1. Investment Mode：
   - 属于正式产品数据链路。
   - 输入来自线上 `daily_prices` 与 `ai_predictions_v2`。
   - 输出到：
     - `mode_decision_log`
     - `mode_simulated_trade_ledger`
     - `mode_performance_snapshot`
   - 前台 `/api/modes/*` 系列接口读取的是这些表。

2. tradeability sidecar：
   - 属于量化研究与参数治理链路。
   - 输入主要来自 `daily_prices`。
   - 输出到：
     - `quant_tradeability_signals`
   - 用于 Layer-1 状态观测、版本并行实验、weekly calibration，不是当前 Investment Mode 的前台主展示数据源。

3. 语义提醒：
   - Investment Mode 的 `mode_simulated_trade_ledger` 是模拟交易台账，不是用户真实成交。
   - sidecar 也不是“假数据”，它同样基于真实行情，只是研究用途而非正式展示用途。

## 1.2 当前数据血缘

线上 Investment Mode 的数据血缘为：

1. 数据同步任务写入 `daily_prices`
2. 预测主流程写入 `ai_predictions_v2`
3. `run_mode_pipeline()` 读取 `daily_prices + ai_predictions_v2`
4. 产出：
   - `mode_decision_log`
   - `mode_simulated_trade_ledger`
   - `mode_performance_snapshot`
5. 前台 `/api/modes`、`/api/modes/performance`、`/api/modes/decisions` 读取 mode 三层结果表

研究链路的血缘为：

1. 数据同步任务写入 `daily_prices`
2. 盘后样本补量可继续扩充 `daily_prices` 覆盖面
3. `run_tradeability_sidecar.py` 基于 `daily_prices` 计算 `quant_tradeability_signals`
4. `run_tradeability_weekly_calibration.py` 基于研究样本和 sidecar 输出做周度参数校准

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

## 3.1 生产编排顺序（线上）

Investment Mode 当前依赖的生产编排顺序应理解为：

1. `daily_pipeline_cn.yml` / `daily_pipeline_hk.yml`
   - 先完成行情同步与预测分析
2. `tradeability_postclose_pipeline.yml`
   - 先执行盘后样本补量（研究链路）
   - 再执行 `tradeability_sidecar_daily.yml`
3. `run_mode_pipeline()`
   - 默认随 `--analyze` 自动执行，属于生产链路
4. `tradeability_sidecar_weekly_calibration.yml`
   - 周末独立执行，属于研究链路周度治理

注意：
- `sidecar` 不应被误认为是 Investment Mode 的前台直接数据源。
- 盘后样本补量和 sidecar 的顺序影响研究链路样本质量，但不改变 Investment Mode 的正式表结构定义。

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
  - 参数变更模板：`docs/1_Engineering/templates/Layer1_Param_Change_Template.md`
- Admin 可观测看板（PC）：
  - 页面：`/admin/observability`
  - API：`/api/admin/observability`
- 可观测阈值与异常定义：
  - `docs/1_Engineering/16_Observability_Thresholds_and_Incidents.md`
