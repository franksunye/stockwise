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

1. `tradeability_sidecar_daily.yml`
   - 默认并行写入 `tradeability_v1,tradeability_v2`
2. `tradeability_experiment_weekly.yml`
   - 每周产出 v1/v2 对比 artifact
3. `acceptance_weekly.yml`
   - 默认按 `tradeability_v2` 生成周验收快照

### 4.8 单票分析（功能验证）

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
7. 如发现异常，可先关闭方向强制开关排查：
```powershell
$env:LAYER1_SIGNAL_ENFORCE="0"
```
8. 生产观察阶段不直接替换默认版本，先累计 `2~4` 周 `quant_tradeability_signals` 历史后再判断是否切默认。

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
