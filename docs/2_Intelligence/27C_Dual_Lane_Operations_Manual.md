# Tradeability 双轨运行手册（执行对齐版）

**文档状态**: Active  
**日期**: 2026-03-09  
**定位**: 双轨体系主定义文档  
**专项状态**: Investment Mode / Tradeability 已完成，本文继续作为现行运行依据  
**当前主口径**: 共享底层数据，结果表与统计口径严格分离

---

## 1. 双轨定义

1. 轨道 A：Layer-1 可交易性量化（状态机 + 方向裁决）
2. 轨道 B：Layer-2 战术解释（LLM / Rule Engine）

执行原则：

1. 方向由 Layer-1 裁决。
2. Layer-2 不得覆盖方向，只负责解释和战术。

### 1.1 生产线 vs 实验线

为避免后续讨论混淆，`Investment Mode` 与 `tradeability sidecar` 必须明确区分为两条不同职责的数据链路：

1. 生产线（Production Decision Lane）：
   - 面向用户正式展示。
   - 共享底层市场数据与预测输入，服务正式用户结果与正式模式口径。
   - 生产输入主要来自生产池、正式预测链路和正式绩效聚合链路。
   - 结果表为：
     - `mode_decision_log`
     - `mode_simulated_trade_ledger`
     - `mode_performance_snapshot`
   - 其中 `ledger` 是**基于真实行情和真实预测生成的模拟台账**，不是券商真实成交记录。

2. 实验线（Research Quant Lane）：
   - 面向量化研究、参数校准、版本并行观测。
   - 共享底层市场数据，但独立维护实验结果表与研究统计口径。
   - 实验线运行在“研究池”上；研究池服务于规则验证，不受当前生产池直接限制。
   - 结果表为：
     - `quant_tradeability_signals`
   - 默认允许并行存在 `tradeability_v1 / tradeability_v2 / future_v3` 等多个版本，不直接作为前台正式口径。

3. 边界原则：
   - 两条链路都不是“假数据”，当前共享底层数据，但属于不同业务口径。
   - 但只有生产线属于正式产品口径；实验线属于策略实验与治理口径。
   - 生产线运行在“生产池”上；生产池由真实用户形成，不作为研究实验的样本设计约束。
   - 允许复用同一套 Layer-1 计算内核；但不应把生产与研究的结果表和统计口径强行合并。

### 1.2 研究池 vs 生产池

为避免把“规则问题”和“样本设计问题”混在一起，当前统一采用两层池子定义：

1. 研究池：
   - 只服务量化实验。
   - 目标是科学验证规则是否有效。
   - 可以独立设计、分组对照、定期调整。
   - 不受当前用户关注池直接限制。

2. 生产池：
   - 只服务正式产品承接。
   - 由真实用户形成，不作为实验样本设计对象。
   - 用户前台、正式模式、正式运营口径都以生产池为准。

3. 运行原则：
   - 研究池负责找结论。
   - 生产池负责承接结论。
   - 不允许反过来让生产池决定研究实验应看哪些股票。

### 1.3 为什么不直接合并成一套结果表

1. 生产线追求口径稳定，实验线追求版本并行与快速试错。
2. 生产线要回答“用户当时看到什么”；实验线要回答“某版本在样本上表现如何”。
3. 若直接共用最终结果表，会导致实验参数变更污染前台展示、审计和周报口径。
4. 当前推荐架构是：
   - 共享底层数据：`daily_prices`、`ai_predictions_v2` 等基础输入可复用
   - Layer-1 内核可复用：状态机、参数加载、特征计算
   - 最终结果分流：`Investment Mode` 生产表 / `sidecar` 研究表
   - 若未来升级到逻辑分层或物理分离，应单独立项，不把目标态误写为当前事实

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
6. 盘后样本扩充（实验线，不影响盘中实时同步）：
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
   - 这是“研究池上的日常规则实验”
   - 这是量化规则实验，不依赖线上 AI 重新出结论；当前 `Watch / TriggeredLong / RiskOff` 由 `tradeability` 规则决定。
3. `tradeability_experiment_weekly.yml`
   - 每周产出 v1/v2 对比 artifact
4. `acceptance_weekly.yml`
   - 默认按 `tradeability_v2` 生成周验收快照
5. `tradeability_shadow_universe_experiment.yml`
   - 用于受控验证固定研究池扩样是否能改善研究门禁与产品完成度
   - 这同样属于量化规则实验；shadow universe 的意义是扩研究池，而不是额外调用线上 AI。

补充口径：

1. 当前线上 `sidecar` 与 `shadow universe` 的核心输出都由量化规则产生。
2. AI 在这条链路里目前主要承担解释层职责，不负责决定实验结论。
3. 因此，`现有样本池` 与 `扩展 shadow 样本池` 的差异，本质是量化样本设计差异，不是 AI 模型差异。
4. 长期目标不是保留“旧池子 + shadow 池子”两套概念，而是逐步把研究实验统一到明确维护的研究池上。

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
   - 对 `sidecar` / `shadow universe` 而言，验证对象是量化规则和样本池设计，不是 AI 解释文本。

### 4.9 线上实验的约束

线上受控实验必须满足以下约束：

1. 实验对象必须固定：
   - 使用仓库内 manifest / 固定配置。
   - 不允许在线上临时手改研究池。
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
   - 它本质上是“研究池扩样实验”的第一版线上入口。
2. 该实验用于验证：
   - `TriggeredLong coverage`
   - `Watch -> Triggered`
   - `consistency`
   - `observability`
   - 后续 `mode_performance_snapshot`
   - 核心是在云端真实编排下验证“扩样本池是否让量化结果更完整”，不是验证 AI 是否更会解释。
3. 连续观察未达标前，不允许进入 promotion。

### 4.11 两个线上实验如何区分

当前线上最容易混淆的两个实验，其实只差在“研究池是否扩样”：

1. `tradeability_sidecar_daily`
   - 在当前研究池上跑日常规则实验。
   - 回答的是：“按我们现在定义的研究池，规则表现怎么样？”

2. `tradeability_shadow_universe_experiment`
   - 在扩大的研究池上跑同样的规则实验。
   - 回答的是：“如果把研究池设计得更科学、更宽一些，规则结果会不会更完整？”

一句话：

- `sidecar daily` = 当前研究池实验
- `shadow universe` = 研究池扩样实验

### 4.12 单票分析（功能验证）

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
