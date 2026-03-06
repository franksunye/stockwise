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
3. 参数配置：
   - `backend/strategy_config/tradeability_params_v1.json`
4. 预测主链路（含 Layer-1 快照注入与强制对齐）：
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
python backend/scripts/run_tradeability_sidecar.py --market CN --dry-run
```

### 4.2 weekly calibration

```powershell
$env:DB_SOURCE="local"
python backend/scripts/run_tradeability_weekly_calibration.py --market CN
```

### 4.3 单票分析（功能验证）

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

---

## 6. 运维注意事项

1. 研发期允许在本地反复 `--force` 覆盖同日记录，用于链路验证。
2. 周度脚本默认不自动写回生产参数，只产出建议 artifacts。
3. 如发现异常，可先关闭方向强制开关排查：
```powershell
$env:LAYER1_SIGNAL_ENFORCE="0"
```

---

## 7. 回滚策略

1. 暂停 sidecar workflow（不影响主预测链路可用性）。
2. 必要时回退 `tradeability_params_v1.json` 到上一个稳定版本。
3. 对方向强制可用环境变量临时回退（`LAYER1_SIGNAL_ENFORCE=0`）。
