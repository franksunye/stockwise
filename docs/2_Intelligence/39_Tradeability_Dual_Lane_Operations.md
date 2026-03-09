# Tradeability 双轨运行手册（执行对齐版）

**文档状态**: Active  
**日期**: 2026-03-06  
**分支口径**: `feat/layer1-state-machine-v1`

---

## 1. 双轨定义

1. 轨道 A：Layer-1 可交易性量化（状态机 + 方向裁决）
2. 轨道 B：Layer-2 战术解释（LLM / Rule Engine）

执行原则：

1. 方向由 Layer-1 裁决。
2. Layer-2 不得覆盖方向，只负责解释和战术。

### 1.1 生产链路 vs 研究链路

为避免后续讨论混淆，`Investment Mode` 与 `tradeability sidecar` 必须明确区分为两条不同职责的数据链路：

1. 生产链路（Production Decision Lane）：
   - 面向用户正式展示。
   - 真实输入来自线上 `daily_prices` 与 `ai_predictions_v2`。
   - 结果表为：
     - `mode_decision_log`
     - `mode_simulated_trade_ledger`
     - `mode_performance_snapshot`
   - 其中 `ledger` 是**基于真实行情和真实预测生成的模拟台账**，不是券商真实成交记录。

2. 研究链路（Research Quant Lane）：
   - 面向量化研究、参数校准、版本并行观测。
   - 真实输入同样来自线上/本地 `daily_prices`。
   - 结果表为：
     - `quant_tradeability_signals`
   - 默认允许并行存在 `tradeability_v1 / tradeability_v2 / future_v3` 等多个版本，不直接作为前台正式口径。

3. 边界原则：
   - 两条链路都建立在真实市场数据上，因此都不是“假数据”。
   - 但只有生产链路属于正式产品口径；研究链路属于策略实验与治理口径。
   - 允许复用同一套 Layer-1 计算内核；不建议将最终结果表强行合并为一套。

### 1.2 为什么不直接合并成一套结果表

1. 生产链路追求口径稳定，研究链路追求版本并行与快速试错。
2. 生产链路要回答“用户当时看到什么”；研究链路要回答“某版本在样本上表现如何”。
3. 若直接共用最终结果表，会导致实验参数变更污染前台展示、审计和周报口径。
4. 当前推荐架构是：
   - 底层输入共用：`daily_prices`、`ai_predictions_v2`
   - Layer-1 内核共用：状态机、参数加载、特征计算
   - 最终结果分流：`Investment Mode` 生产表 / `sidecar` 研究表

---

## 2. 当前运行组件

1. 日常 sidecar 计算：
   - `backend/scripts/run_tradeability_sidecar.py`
2. 周度参数校准：
   - `backend/scripts/run_tradeability_weekly_calibration.py`
3. 策略并行实验：
   - `backend/scripts/run_tradeability_experiment.py`
   - `.github/workflows/tradeability_experiment_weekly.yml`
4. 参数配置：
   - `backend/strategy_config/tradeability_params_v1.json`
   - `backend/strategy_config/tradeability_params_v2.json`
5. 预测主链路（含 Layer-1 快照注入与强制对齐）：
   - `backend/engine/runner.py`
6. 盘后样本扩充（研究链路，不影响盘中实时同步）：
   - `backend/scripts/run_tradeability_sample_sync.py`
   - `.github/workflows/tradeability_sample_sync_daily.yml`
   - `.github/workflows/tradeability_postclose_pipeline.yml`

---

## 3. 研发验证口径（默认）

1. 默认本地 SQLite：
```powershell
$env:DB_SOURCE="local"
```
2. 模型验证优先：
   - `hunyuan-lite`
   - `gemini-3-flash`（gemini local）

---

## 4. 常用命令

### 4.1 sidecar dry-run

```powershell
$env:DB_SOURCE="local"
python backend/scripts/run_tradeability_sidecar.py --market CN --strategy-versions tradeability_v1,tradeability_v2 --dry-run
```

### 4.2 weekly calibration

```powershell
$env:DB_SOURCE="local"
python backend/scripts/run_tradeability_weekly_calibration.py --market CN --strategy-versions tradeability_v1,tradeability_v2
```

### 4.3 strategy experiment

```powershell
$env:DB_SOURCE="local"
python backend/scripts/run_tradeability_experiment.py --market CN --strategy-versions tradeability_v1,tradeability_v2
```

### 4.4 local data enhancement

```powershell
$env:DB_SOURCE="local"
python backend/scripts/enhance_local_tradeability_data.py --market CN --target-symbols 300 --start-date 2024-01-01 --max-workers 4
```

### 4.5 historical sidecar backfill

```powershell
$env:DB_SOURCE="local"
python backend/scripts/backfill_tradeability_history.py --market CN --strategy-versions tradeability_v1,tradeability_v2 --start-date 2024-01-01
```

### 4.6 window observability

```powershell
$env:DB_SOURCE="local"
python backend/scripts/observe_tradeability_windows.py --market CN --strategy-versions tradeability_v1,tradeability_v2
```

### 4.7 cloud continuous observation

1. `tradeability_postclose_pipeline.yml`
   - 盘后编排顺序：`daily pipeline -> sample sync -> sidecar daily`
2. `tradeability_sidecar_daily.yml`
   - 在盘后样本补量之后执行，默认并行写入 `tradeability_v1,tradeability_v2`
3. `tradeability_experiment_weekly.yml`
   - 每周产出 v1/v2 对比 artifact
4. `acceptance_weekly.yml`
   - 默认按 `tradeability_v2` 生成周验收快照
5. `tradeability_shadow_universe_experiment.yml`
   - 用于受控验证固定 shadow universe 是否能改善研究门禁与产品完成度

### 4.8 本地实验 vs 线上实验

必须明确区分两种工作方式：

1. 本地实验：
   - 允许互动式试错。
   - 允许快速改参数、改候选清单、重跑局部窗口。
   - 目标是判断“这个想法值不值得进线上验证”。
   - 本地结论不能直接当作 production promotion 依据。

2. 线上实验：
   - 必须全自动运行。
   - 必须通过 workflow 触发，不允许依赖人工 SSH 或临时手敲命令。
   - 必须固定输入、固定脚本、固定输出、固定审计。
   - 目标是验证“这件事在真实云端数据与真实编排里能否连续成立”。

### 4.9 线上实验的约束

线上受控实验必须满足以下约束：

1. 实验对象必须固定：
   - 使用仓库内 manifest / 固定配置。
   - 不允许在线上临时手改 universe。
2. 数据源必须固定：
   - 必须使用 cloud 数据源。
   - 明确 `DB_SOURCE=cloud`，并通过 `TURSO_DB_URL`、`TURSO_AUTH_TOKEN` 运行。
3. 入口必须固定：
   - 只能由 GitHub Actions workflow 触发。
   - 不允许把线上服务器当本地实验室使用。
4. 产物必须固定：
   - 每次运行都要落 artifact。
   - 至少包含 manifest、窗口、summary、关键 gate 指标。
5. 研究结果不得直接污染前台：
   - 线上实验结果属于 Research Quant Lane。
   - 不能直接替换 Production Decision Lane 的正式口径。
6. promotion 必须另走审批链：
   - `verdict -> approval -> execute -> rollback`
   - 线上实验成功不等于允许直接切生产。

### 4.10 当前 shadow universe 线上实验口径

当前新增的线上受控实验入口为：

1. workflow：
   - `.github/workflows/tradeability_shadow_universe_experiment.yml`
2. 固定实验清单：
   - `backend/strategy_config/shadow_universe/cn_top30_shadow.json`
3. 轻量执行脚本：
   - `backend/scripts/run_shadow_universe_light_backfill.py`
4. 汇总脚本：
   - `backend/scripts/summarize_shadow_universe_results.py`

当前约束：

1. 该实验属于 shadow experiment，不是生产默认切换。
2. 该实验用于验证：
   - `TriggeredLong coverage`
   - `Watch -> Triggered`
   - `consistency`
   - `observability`
   - 后续 `mode_performance_snapshot`
3. 连续观察未达标前，不允许进入 promotion。

### 4.11 单票分析（功能验证）

```powershell
$env:DB_SOURCE="local"
python backend/main.py --analyze --symbol 600519 --model hunyuan-lite --force
python backend/main.py --analyze --symbol 600519 --model gemini-3-flash --force
python backend/main.py --analyze --symbol 600519 --model rule-engine --force
```

---

## 5. 关键核验 SQL

### 5.1 状态分布

```sql
SELECT market, date, strategy_version, setup_state, COUNT(*) AS n
FROM quant_tradeability_signals
WHERE date = '2026-03-05'
GROUP BY market, date, strategy_version, setup_state
ORDER BY market, setup_state;
```

### 5.2 Layer-1 与最终方向一致性

```sql
SELECT
  model_id,
  COUNT(*) AS total,
  SUM(
    CASE
      WHEN layer1_status = 'TriggeredLong' AND signal = 'Long' THEN 1
      WHEN layer1_status IN ('NoSetup','Watch','RiskOff') AND signal = 'Side' THEN 1
      ELSE 0
    END
  ) AS aligned
FROM ai_predictions_v2
WHERE date = '2026-03-05'
  AND layer1_status IS NOT NULL
  AND layer1_status <> ''
GROUP BY model_id
ORDER BY model_id;
```

### 5.3 v1/v2 连续观测面板

```sql
SELECT
  strategy_version,
  COUNT(*) AS total_states,
  ROUND(100.0 * SUM(CASE WHEN setup_state='TriggeredLong' THEN 1 ELSE 0 END) / COUNT(*), 2) AS triggered_pct,
  ROUND(100.0 * SUM(CASE WHEN setup_state='Watch' THEN 1 ELSE 0 END) / COUNT(*), 2) AS watch_pct,
  ROUND(100.0 * SUM(CASE WHEN setup_state='RiskOff' THEN 1 ELSE 0 END) / COUNT(*), 2) AS riskoff_pct,
  ROUND(100.0 * SUM(CASE WHEN setup_state='NoSetup' THEN 1 ELSE 0 END) / COUNT(*), 2) AS nosetup_pct
FROM quant_tradeability_signals
WHERE market='CN'
  AND date BETWEEN '2026-03-01' AND '2026-03-31'
GROUP BY strategy_version
ORDER BY strategy_version;
```

### 5.4 v1/v2 日度覆盖率轨迹

```sql
SELECT
  date,
  strategy_version,
  ROUND(100.0 * SUM(CASE WHEN setup_state='TriggeredLong' THEN 1 ELSE 0 END) / COUNT(*), 2) AS triggered_pct,
  ROUND(100.0 * SUM(CASE WHEN setup_state='RiskOff' THEN 1 ELSE 0 END) / COUNT(*), 2) AS riskoff_pct
FROM quant_tradeability_signals
WHERE market='CN'
  AND strategy_version IN ('tradeability_v1','tradeability_v2')
GROUP BY date, strategy_version
ORDER BY date DESC, strategy_version;
```

### 5.5 线上是否具备切默认资格

```sql
SELECT
  strategy_version,
  MIN(date) AS start_date,
  MAX(date) AS end_date,
  COUNT(DISTINCT date) AS active_days,
  ROUND(AVG(CASE WHEN setup_state='TriggeredLong' THEN 1.0 ELSE 0.0 END) * 100, 2) AS avg_triggered_pct,
  ROUND(AVG(CASE WHEN setup_state='RiskOff' THEN 1.0 ELSE 0.0 END) * 100, 2) AS avg_riskoff_pct
FROM quant_tradeability_signals
WHERE market='CN'
  AND strategy_version IN ('tradeability_v1','tradeability_v2')
GROUP BY strategy_version
ORDER BY strategy_version;
```

---

## 6. 运维注意事项

1. 研发期允许在本地反复 `--force` 覆盖同日记录，用于链路验证。
2. 周度脚本按 `breakout_volume_mult -> momentum_change_threshold -> strong_close_threshold -> vcp_ratio -> risk_off_ma` 的顺序做单参数小步迭代，并产出决策日志 artifacts。
3. 本地历史研究推荐先执行“数据增强 -> 历史回灌 -> 窗口观测”，不要只看单次 experiment 汇总。
4. 当前本地 CN 研究底座已扩展到 `499` 个标的；后续若继续扩样，应保持分层抽样口径，不要退回简单按代码顺序抓数。
5. 当前本地 `tradeability_v2` 研究基线参数为：
```json
{
  "vcp_ratio": 1.0,
  "breakout_volume_mult": 0.9,
  "strong_close_threshold": 0.55,
  "momentum_change_threshold": 2.3,
  "risk_off_ma": 5
}
```
6. 本地 `quant_tradeability_signals` 历史回灌在大样本下应使用分批提交；不要将接近 `500` 标的的 sidecar 重建一次性放进单事务提交。
7. 面向普通投资者的动作语言应基于 Layer-1 状态固定映射，不要在前台临时改口径：
   - `TriggeredLong -> 可尝试建仓`
   - `Watch -> 继续观察`
   - `RiskOff -> 暂停新增仓位 / 已有仓位应收缩`
   - `NoSetup -> 不建议出手`
8. 如发现异常，可先关闭方向强制开关排查：
```powershell
$env:LAYER1_SIGNAL_ENFORCE="0"
```
9. 生产观察阶段不直接替换默认版本，先累计 `2~4` 周 `quant_tradeability_signals` 历史后再判断是否切默认。

## 7. v2 Default Promotion Gate

仅当 `tradeability_v2` 连续观察达到以下条件时，才允许考虑替换默认版本：

1. 观察期不少于 `2~4` 周，且 `quant_tradeability_signals` 已形成连续日度历史。
2. `TriggeredLong` 周均覆盖率稳定 `> 5%`，不能仅由单周尖峰拉高。
3. `RiskOff` 占比不继续上行，且应稳定在最近实验观察水平附近或以下。
4. `Max Drawdown` 不得劣于当前实验基线；若回撤重新恶化，则不允许切默认。
5. `Watch -> TriggeredLong` 不应长期显著高于 `40%`，否则视为触发过松。
6. Layer-1 方向一致率持续满足 `>= 99.5%`，目标维持 `100%`。
7. 上述条件满足后，仍应先保留一段并行观察窗口，再执行默认切换。

---

## 7. 回滚策略

1. 暂停 sidecar workflow（不影响主预测链路可用性）。
2. 必要时回退 `tradeability_params_v1.json` 到上一个稳定版本。
3. 对方向强制可用环境变量临时回退（`LAYER1_SIGNAL_ENFORCE=0`）。
