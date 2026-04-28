---
title: "47. Prediction Pipeline Scaling RFC"
doc_id: "engineering-prediction-pipeline-scaling-rfc-20260428"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-04-28"
summary: "定义 Daily AI Prediction Pipeline 从几十只股票扩展到 1000 只股票时的分阶段架构、SLA、队列、分片与会员模型路由。"
---

# 47. Prediction Pipeline Scaling RFC

更新时间：2026-04-28

适用范围：

- `daily_pipeline_cn_main.yml`
- `ai_analyze_cn.yml` / `ai_analyze_hk.yml` / `ai_analyze_us.yml`
- `backend/analysis/runner.py`
- `backend/engine/runner.py`
- `ai_predictions_v2`
- 未来 `prediction_jobs` / context 预物化表

## 1. 背景与问题

当前 Daily Pipeline - A-Share (CN) 的主要耗时不来自 GitHub Actions 启动，而来自预测主链的执行形态：

1. workflow 编排是 `sync -> verify -> analyze`。
2. `analyze` 只有一个 job。
3. `backend/analysis/runner.py` 按股票串行循环。
4. `backend/engine/runner.py` 只在单票内部并发多个模型。
5. 每只股票预测前都会构建完整上下文，包括价格、周期、宏观、市场资金流、个股资金流与模型历史。

本地快照显示，当前 CN 池约 30+ 只股票时，单次 CN AI Analysis 已经是 20 分钟级。近期单模型平均耗时大致为：

| 模型 | 平均耗时 | 主要用途 |
| --- | ---: | --- |
| `hunyuan-lite` | 约 25s / symbol / locale | free 低成本解释 |
| `deepseek-aliyun` | 约 45s / symbol / locale | go / plus 主模型 |
| `rule-engine` | 近似 0s | 全量规则层 |

如果未来扩展到 1000 只股票，并同时支持 `free / go / plus` 用户，当前串行链路会不可接受。单纯增加 workflow timeout 不是生产标准方案。

## 2. 目标

本 RFC 的目标是把预测系统从“长跑脚本”升级为“可切片、可恢复、可限流、可降级、可按商业价值分配成本”的生产流水线。

目标能力：

1. 支持 1000 只股票的日级预测生产。
2. 对 `free / go / plus` 形成明确 SLA 和模型预算。
3. 单只股票、单个模型、单个外部上下文失败不拖垮整批。
4. 任意时刻可回答：哪些已完成、哪些跳过、哪些降级、哪些失败、哪些还在排队。
5. 预测结果仍以 `ai_predictions_v2` 为正式用户可见快照。

## 3. 核心设计原则

### 3.1 先全量规则层，后选择性 LLM

1000 只股票不应全部直接进入 LLM。

日级生产应拆成两层：

1. `Layer-1 Quant Scan`
   - 全量覆盖 1000 只股票。
   - 使用 rule-engine / quant engine。
   - 产出 setup、risk、rank、watcher demand、candidate score。
2. `Layer-2 AI Explanation`
   - 只对候选股票、用户自选股、持仓相关股票或高 tier demand 股票调用 LLM。
   - 产出可读解释、战术建议、AICouncil 视角。

规则层负责覆盖率，LLM 层负责解释深度。

### 3.2 预测单位是 symbol，不是 user

系统必须继续保留“去重机制红利”：

`symbol + trade_date + model_id + content_locale` 只生成一次，多用户共享。

用户 tier 只决定：

1. 该 symbol 是否值得进入 LLM 队列。
2. 使用哪个模型。
3. 结果如何投影给前端。
4. 失败时如何降级解释。

### 3.3 作业状态必须数据化

GitHub Actions log 不能作为预测缺口的唯一事实源。

需要新增独立队列表，建议名为 `prediction_jobs`。它是执行状态事实源；`ai_predictions_v2` 仍是用户可见结果事实源。

建议唯一键：

```text
market + symbol + trade_date + model_id + content_locale
```

建议状态：

| 状态 | 语义 |
| --- | --- |
| `queued` | 已入队，等待执行 |
| `running` | 已被 worker claim |
| `skipped_existing` | 目标预测已存在，正常跳过 |
| `succeeded` | 已成功写入 `ai_predictions_v2` |
| `degraded` | 主路径失败但有可展示兜底结果 |
| `retryable_failed` | 可重试失败 |
| `terminal_failed` | 不再自动重试 |
| `cancelled` | 被新批次或人工操作取消 |

建议字段：

```text
job_id
pipeline_run_id
market
symbol
trade_date
model_id
content_locale
tier_reason
priority
status
attempts
max_attempts
locked_by
locked_at
started_at
finished_at
error_code
error_message
context_version
prompt_version
token_usage_input
token_usage_output
execution_time_ms
created_at
updated_at
```

## 4. 四阶段落地路线

### Phase 1: GitHub Actions 分片与并发止血

目标：在不大改数据模型的前提下，把单个长跑 job 拆成可控并发。

范围：

1. 为 `ai_analyze_*` 增加 shard 参数，例如：
   - `--shard-index`
   - `--shard-total`
   - `--max-symbol-concurrency`
2. 在 workflow 中使用 matrix 拆分，例如 CN 先从 4-8 个 shard 起步。
3. runner 内部改为 async queue，限制股票并发，不再每票 `asyncio.run(...)`。
4. provider 级限流先用进程内 semaphore。
5. 保持写入 `ai_predictions_v2` 的主语义不变。

验收：

1. CN 30+ 股票不慢于当前基线。
2. 单 shard 失败不影响其他 shard 完成。
3. 汇总日志能输出每个 shard 的 `total / success / skipped / failed / duration`。
4. 默认并发保守，不能因并发放大 provider 429。

### Phase 2: prediction_jobs 队列化执行

目标：把预测执行从“脚本循环”升级为“入队、领取、执行、回写”的可恢复模型。

范围：

1. 新增 `prediction_jobs`。
2. Daily Pipeline 的 analyze 阶段先 enqueue jobs。
3. worker 通过 `queued -> running` 原子 claim 获取任务。
4. 每个 job 独立记录 attempts、error_code、latency、tokens。
5. backfill 与 analyze 复用同一执行策略。

验收：

1. 任意时刻可 SQL 查询预测缺口。
2. rerun 不重复生成已存在预测。
3. 中断后可从 `queued / retryable_failed` 恢复。
4. `task_logs` 记录 run 级摘要，`prediction_jobs` 记录 symbol/model/locale 级细节。

### Phase 3: context 预物化与两层生产

目标：把上下文构建从 LLM 请求关键路径移出，降低单票波动。

范围：

1. 新增日级 context 预物化表，建议名：
   - `prediction_context_daily`
   - 或 `stock_analysis_context_daily`
2. sync 完成后先批量生成：
   - latest price snapshot
   - daily / weekly / monthly summary
   - Layer-1 snapshot
   - market mood
   - macro context
   - market flow context
   - stock flow context
   - profile summary
3. LLM worker 只读取 context JSON，不实时调用 AkShare。
4. rule-engine 全量跑，LLM 只跑候选集合。
5. context 字段带 `quality` / `freshness` / `lineage`，外部数据缺失不阻塞主预测。

验收：

1. LLM job 的 p95 不再被 `stock_flow` 或宏观外部源拖长。
2. 1000 股票 rule-engine 全量产出可在分钟级完成。
3. LLM jobs 数量由业务策略控制，而不是等于股票池全量。
4. 前端能区分 `fresh / degraded / stale-but-usable / missing`。

### Phase 4: Tier SLA 与商业策略路由

目标：把模型调用成本、用户权益和生产 SLA 正式绑定。

建议 SLA：

| Tier | 预测覆盖 | 模型策略 | SLA |
| --- | --- | --- | --- |
| `free` | 自选股少量 + 热门候选 | rule-engine + 低成本解释 | 盘后尽快完成，允许降级 |
| `go` | 用户自选股优先 | DeepSeek 主模型 | 盘后主窗口完成 |
| `plus` | 自选股 + 高价值候选 | DeepSeek 主模型，必要时第二模型复核 | 主窗口完成，失败补跑 |
| `pro/alpha` | 持仓/关键自选股优先 | 高优先模型 + 复核策略 | 最严格，允许单独补跑 |

范围：

1. 建立 `tier -> model_policy -> budget -> priority` 的统一策略层。
2. 聚合 watcher demand：
   - watcher count
   - active user count
   - paid tier demand
   - locale demand
   - holding / position demand
3. 根据 demand 生成 job priority。
4. 定义用户可见降级文案和 API 字段。
5. 建立每日成本预算与 provider 速率预算。

验收：

1. free/go/plus 的模型权益与实际后台生产策略一致。
2. 模型失败时不会出现不可解释的空白状态。
3. 每日可输出成本报表：tokens、调用次数、成功率、tier 分布。
4. 1000 只股票规模下，正式用户核心自选股在 SLA 内完成。

## 5. 迁移顺序

推荐顺序：

1. 先做 Phase 1，验证分片与并发不会破坏现有结果。
2. 再做 Phase 2，把执行状态数据化。
3. 然后做 Phase 3，把上下文预物化并引入规则层全量扫描。
4. 最后做 Phase 4，把商业策略、SLA、预算和可见降级收口。

不推荐：

1. 直接把 GitHub Actions timeout 继续加大。
2. 直接全量 1000 只跑 DeepSeek。
3. 在没有 job 状态表前做复杂补跑和重试策略。
4. 把 context 外部源实时调用留在每个 LLM job 的关键路径上。

## 6. 本地 0 成本 E2E 验证

Phase 1 及后续预测链路改动，先用本地 hermetic E2E 验证，再考虑真实 LLM 或 GitHub Actions 小流量验证。

验证目标：

1. 不调用任何 LLM，token 成本为 0。
2. 不访问 AkShare / 外部 macro / 外部 flow 数据源。
3. 仍然覆盖 `backend/main.py -> JobGuard -> shard -> run_ai_analysis -> PredictionRunner -> rule-engine -> ai_predictions_v2 -> task_logs`。
4. 只写本地 SQLite，不触碰 cloud DB。

推荐命令：

```bash
DB_SOURCE=local \
PREDICTION_E2E_FIXTURE=1 \
ENABLE_SMART_NOTIFICATIONS=false \
PRODUCER_OUTCOME_SHADOW_WRITE=0 \
WECOM_ROBOT_KEY= \
ADMIN_MOBILES= \
.venv/bin/python -u backend/main.py \
  --analyze \
  --market CN \
  --model rule-engine \
  --force \
  --shard-index 0 \
  --shard-total 20 \
  --max-symbol-concurrency 2 \
  --skip-mode-pipeline
```

关键开关：

| 开关 | 作用 |
| --- | --- |
| `DB_SOURCE=local` | 强制使用 `data/stockwise.db` |
| `PREDICTION_E2E_FIXTURE=1` | 跳过外部 context provider，使用中性 fixture |
| `--model rule-engine` | 只跑 0 token 成本模型 |
| `--shard-total 20` | 在当前小池子里只抽少量股票，验证 shard 行为 |
| `--max-symbol-concurrency 2` | 验证 shard 内股票并发 |
| `--skip-mode-pipeline` | 聚焦预测链路，不串联 mode pipeline |

验证 SQL：

```bash
sqlite3 -cmd '.timeout 5000' data/stockwise.db "
SELECT display_name,status,metadata
FROM task_logs
WHERE display_name='AI Analysis (CN)'
ORDER BY id DESC LIMIT 1;
"

sqlite3 -cmd '.timeout 5000' data/stockwise.db "
SELECT symbol,date,model_id,content_locale,signal,confidence,
       token_usage_input,token_usage_output,execution_time_ms
FROM ai_predictions_v2
WHERE model_id='rule-engine'
ORDER BY updated_at DESC LIMIT 5;
"
```

验收口径：

1. `task_logs.status = success`。
2. `metadata.success > 0`，`metadata.failed = 0`。
3. `metadata.shard_index / shard_total / total_jobs / max_symbol_concurrency` 存在。
4. `ai_predictions_v2.token_usage_input = 0` 且 `token_usage_output = 0`。
5. 运行日志中不应出现 `Fetching Macro Data from AkShare` 或 `Fetching Flow Data`。

## 7. 与现有文档的关系

| 文档 | 关系 |
| --- | --- |
| [18_Backend_Workflow_Orchestration_Map.md](./18_Backend_Workflow_Orchestration_Map.md) | 负责全局任务编排时段和 workflow 角色，本 RFC 负责 AI prediction 子系统扩容 |
| [31_Capacity_Planning_And_Scaling_Strategy_20260317.md](./31_Capacity_Planning_And_Scaling_Strategy_20260317.md) | 负责整体容量规划，本 RFC 是预测生产链专项扩容方案 |
| [22_ai_predictions_v2_Data_Dictionary.md](./22_ai_predictions_v2_Data_Dictionary.md) | 继续作为正式预测结果表事实源，本 RFC 不替代它 |
| [Backlog.md](../Backlog.md) | 只保留近期可执行事项，详细架构边界以本 RFC 为准 |
