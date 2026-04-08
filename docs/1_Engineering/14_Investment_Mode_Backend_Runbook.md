# 14 Investment Mode Backend & API Unification Runbook

更新时间：2026-04-06
范围：本地开发环境（SQLite / Turso-compat SQL）与前端 API 信号收口
文档角色：Investment Mode 后端运行手册与 API 信号统一执行方案
专项状态：Backend 已完成，API Unification 处于 Draft/执行阶段

补充说明：

- `docs/1_Engineering/21_Decision_Data_Model_Architecture.md`
  - 定义目标数据模型中的 `producer_outcome / arbitration_result / mode_action_decision`
- 本文件
  - 继续描述当前 mode 生产链路如何运行
  - 不等于目标模型的最终形态说明

---

## Part I: Backend Operations (原 14 Runbook 内容)

## 1. 目标

保证 Investment Mode 在后端形成闭环：
- 数据结构：`user_investment_mode` / `mode_decision_log` / `mode_simulated_trade_ledger` / `mode_performance_snapshot`
- 审计字段：`job_id` / `rule_version` / `triggered_by`
- 产数程序：`prediction -> decision -> ledger -> snapshot`
- API：`/api/user/mode`、`/api/modes`、`/api/modes/performance`、`/api/modes/performance/summary`、`/api/modes/performance/ledger`、`/api/modes/decisions`

## 1.1 口径定义：Investment Mode 不等于 sidecar

Investment Mode 与 `tradeability sidecar` 都使用真实 market 数据，但职责不同，不得混称：

术语约定：
- 中文统一使用“生产线 / 实验线”。
- 中文统一使用“生产池 / 研究池”。
- 英文保留 `Production Decision Lane / Research Quant Lane`。

1. **Investment Mode**：
   - 属于正式产品数据链路。
   - 输入来自线上 `daily_prices` 与 `ai_predictions_v2`。
   - 输出到：`mode_decision_log`、`mode_simulated_trade_ledger`、`mode_performance_snapshot`。
   - 前台 `/api/modes/*` 系列接口读取的是这些表。

2. **tradeability sidecar**：
   - 属于量化研究与参数治理链路。
   - 输入主要来自 `daily_prices`。
   - 输出到：`quant_tradeability_signals`。
   - 用于 Layer-1 状态观测、版本并行实验、weekly calibration，不是当前 Investment Mode 的前台主展示数据源。

3. **语义提醒**：
   - Investment Mode 的 `mode_simulated_trade_ledger` 是模拟交易台账，不是用户真实成交。
   - sidecar 也不是“假数据”，它同样基于真实行情，只是研究用途而非正式展示用途。

## 1.2 两层池子定义

当前统一采用两层池子，避免把实验设计与产品现实混在一起：
1. **研究池**：服务量化实验。用于校准、对照、验收、扩样验证。可以独立设计，不受当前用户关注池直接限制。
2. **生产池**：服务正式产品。由真实用户形成，不作为研究实验的样本设计边界。
3. **原则**：研究池负责找结论。生产池负责承接结论。不允许让生产池反过来决定研究实验应该覆盖哪些股票。

补充口径：
1. 当前模式升级的最小发布单元应理解为“模式发布物”，而不是裸参数。
2. 模式发布物至少包含：参数包、研究窗口与研究样本、研究绩效摘要 / 候选比较结论。
3. 线下研究负责形成模式发布物。
4. 生产环境负责承接已发布的模式发布物，并在生产数据、生产池和用户池上生成正式效果。

## 1.3 当前数据血缘

线上 Investment Mode 的数据血缘为：
1. 数据同步任务写入 `daily_prices`
2. 预测主流程写入 `ai_predictions_v2`
3. `run_mode_pipeline()` 读取 `daily_prices + ai_predictions_v2`
4. 产出：`mode_decision_log`、`mode_simulated_trade_ledger`、`mode_performance_snapshot`
5. 前台 `/api/modes`、`/api/modes/performance`、`/api/modes/decisions` 读取 mode 三层结果表

实验线的血缘为：
1. 数据同步任务写入 `daily_prices`
2. 盘后样本补量可继续扩充 `daily_prices` 覆盖面
3. `run_tradeability_sidecar.py` 基于 `daily_prices` 计算 `quant_tradeability_signals`
4. `run_tradeability_weekly_calibration.py` 基于研究样本和 sidecar 输出做周度参数校准

补充边界：
1. 实验线可以持续并行运行，用于形成下一轮模式发布物。
2. 实验线 artifact 不直接写成前台正式表现。
3. 若当前模式参数已发布到生产，实验线仍可继续跑，不影响生产线按既定口径产数。

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
1. `daily_pipeline_cn_main.yml` / `daily_pipeline_hk.yml`
   - 先完成行情同步与预测分析
2. `daily_pipeline_us.yml`（或等价 US 独立链）
   - 先完成 `data_sync_us`，再执行 `verify_predictions --market US` 与 `ai_analyze_us`
   - 与 CN/HK 分时执行，避免抢占同一关键窗口
3. `tradeability_postclose_pipeline.yml`
   - 先执行盘后样本补量（实验线）
   - 再执行 `tradeability_sidecar_daily.yml`
4. `run_mode_pipeline()`
   - 默认随 `--analyze` 自动执行，属于生产线
5. `tradeability_sidecar_weekly_calibration.yml`
   - 周末独立执行，属于实验线周度治理

补充说明（US）：
1. US 生产链建议按美东收盘后窗口执行（北京时间清晨），不与 CN/HK 盘后链串行堆叠。
2. `mode_pipeline` 口径不变，US 也遵循“分析后自动触发 mode 管线”的生产规则。

## 3.2 线上实验的运行纪律

1. **本地**：允许互动式试错、快改参数。目标是找方向。
2. **线上**：必须全自动。必须通过 workflow 执行。不允许依赖人工盯跑。目标是验证连续稳定性。

## 3.3 线上受控实验的部署要求

必须满足：固定输入、固定数据源（Cloud）、固定输出（Artifact）、固定边界（实验线不改前台）、固定升级纪律。

## 3.4 当前 shadow universe 入口

1. workflow：`.github/workflows/tradeability_shadow_universe_experiment.yml`
2. 实验清单：`backend/strategy_config/shadow_universe/cn_top30_shadow.json`
3. 执行脚本：`backend/scripts/run_shadow_universe_light_backfill.py`

## 4. 稳定性边界与验收

- 不回写历史结论。
- Free/Pro 权限边界在 API 层执行。
- `sample_size < 30` 返回不足样本状态。
- 验收：后端单测 `backend.tests.test_mode_pipeline`、回归测试、前端构建。

---

## Part II: API Signal Unification Plan (原 17 Plan 内容)

## 1. 目标

解决当前一个明确的生产问题：
1. PRO 用户已具备多投资模式（steady, balanced, aggressive, observe_only）。
2. 后端 mode 管线已经能为不同模式产出不同决策。
3. 但前端主展示链路仍主要读取 `ai_predictions_v2`，没有把用户当前 `mode_id` 的最终决策完整收口。

本专项目标：让用户可见信号统一收口到 API 层，确保口径一致，且差异来自 mode 决策。

## 2. 当前事实（As-Is）

### 2.1 已经成立的能力
- 后端 mode 定义与管线（已写入 `mode_decision_log` 等表）。
- 前台/API 已支持 `/api/user/mode`, `/api/modes` 等。

### 2.2 当前不一致点
Dashboard 主卡片（`/api/stock/batch`）与详情历史（`/api/predictions`）仍以 `ai_predictions_v2` 为主。
导致：mode 管线已得出差异，但前端主信号仍可能一样；各卡片口径不一。

## 3. 设计原则

1. **单一解释权**：最终动作信号统一归属于 `mode_decision_log`。
2. **保留原始预测底稿**：`ai_predictions_v2` 保留为原始底稿、模型身份、reasoning 来源。
3. **统一收口位置**：优先收口到 API 层，复用现有 `AIPrediction` 结构。

说明：

- 在目标模型中，这相当于过渡期采用：
  - `ai_predictions_v2 ~= producer_outcome`
  - `mode_decision_log ~= mode_action_decision`
- 当前阶段仍未把 `arbitration_result` 物理显式落表

## 4. 目标口径（To-Be）

- **最终动作信号**：当前用户 `mode_id` 下，对应 `symbol + decision_date` 的 `mode_decision_log` 结果。
- **原始内容**：继续来自 `ai_predictions_v2` (reasoning, confidence, model 等)。
- **API 返回限制**：采用 “overlay” 模式。仅覆盖 `signal` 和 `layer1_status`；不覆盖 `model`, `display_name`, `actual_change` 等。

## 5. 四语义映射

| mode_decision_log.decision_semantic | overlay signal | overlay layer1_status |
|---|---|---|
| 建议看多 | `Long` | `TriggeredLong` |
| 建议观察 | `Side` | `Watch` |
| 建议防守 | `Short` | `RiskOff` |
| 暂无信号 | `Side` | `NoSetup` |

## 6. 推荐实现方案

### 6.1 采用批量查询 + 内存 merge
推荐流程：
1. 按现有接口逻辑查出 prediction 主体。
2. 提取 `mode_id`, `symbol`, `decision_date`。
3. 批量查询 `mode_decision_log`。
4. 在 API 层内存做 merge / overlay。

### 6.2 不优先做单 SQL 大 join 的原因
1. 减少聚合复杂度。
2. 便于观测命中率与延迟。
3. 见 `docs/1_Engineering/20_Investment_Mode_Signal_Unification_Experiments.md` 中的实验结论。

## 7. 性能判断与纪律

- **可控性**：单次 Watchlist 最多 50 个 symbol；每个用户切换模式频率低；批量查询性能通常可控。
- **纪律**：不允许逐条补查；不允许在 React 层重复查；必须使用批量查询；必须提供适配索引。

## 8. 推荐索引
1. `idx_mode_decision_lookup`: `(mode_id, symbol, decision_date)`
2. `(mode_id, decision_date DESC, symbol)` (若需范围回看)

## 9. API 改造范围与页面影响面

- **改造 API**：`stock/batch` 与 `predictions`。
- **影响页面**：Dashboard 卡片、HistoricalCard、AICouncil。

## 10. 分阶段落地

- **Phase 1: API 收口**。目标：统一信号，验收切换模式后的差异。
- **Phase 2: 可观测**。记录命中率与耗时。
- **Phase 3: 结构优化**。视情况决定是否下沉为单 SQL join。

## 11. 最终决策总结

1. 保留 `ai_predictions_v2` 做底稿。
2. 保留 `mode_decision_log` 做最终信号源。
3. 在 API 层做批量 merge。
4. 这种路径改动最小，见效最快。
