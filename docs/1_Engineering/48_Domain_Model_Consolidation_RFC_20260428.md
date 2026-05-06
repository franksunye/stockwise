---
title: "48. Domain Model Consolidation RFC"
doc_id: "engineering-domain-model-consolidation-rfc-20260428"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-04-28"
summary: "定义 StockWise V1 稳定后如何从功能驱动加表转向领域对象驱动建模，并在进入 prediction_jobs 队列化前收口 schema 边界。"
---

# 48. Domain Model Consolidation RFC

更新时间：2026-04-28

## 1. 背景

V1 功能已经稳定，产品框架逐渐成型。当前系统从预测、行情、通知、模式、交易管理、增长、运营监控等方向持续演进，本地 schema 已经达到约 46 张表。

表数量本身不是问题；真正的风险是：

1. 新功能继续以“新增表”作为默认实现方式。
2. 多张表同时表达相近业务事实，事实源边界变模糊。
3. shadow / audit / trace / projection 表缺少生命周期。
4. 后续 Phase 2 `prediction_jobs`、Phase 3 context 预物化继续加表后，系统复杂度会被数据模型放大。

因此，在 Prediction Pipeline Phase 2 前，需要先做一次领域模型收口。

目标不是马上删表，而是先建立稳定抽象：以后新增能力必须先落到领域对象，再决定是否需要新表。

## 2. 设计目标

1. 用少量领域对象维护复杂系统，而不是让表数量自然膨胀。
2. 每个 domain 明确 canonical fact source。
3. 区分 fact / projection / job / log / trace / audit / compatibility。
4. 给 shadow 表和实验表定义退出或归档策略。
5. 为 Phase 2 `prediction_jobs` 提供清晰归属：它是 Operation Job，不是新的 Prediction fact source。

## 3. 目标领域对象

| 领域对象 | 职责 | Canonical 原则 | 当前表数 → 推荐密度上限 |
| --- | --- | --- | --- |
| `User` | 用户身份、订阅、语言、推荐关系 | 用户状态只能有一个主事实源 | 5 → 5 |
| `Universe` | 股票池、市场归属、证券元数据 | 股票是否进入生产池由一个统一池决定 | 3 → 3 |
| `MarketData` | 日/周/月行情、市场事实、交易日历 | 原始市场数据和派生市场事实分层 | 8 → 5 |
| `Prediction` | 模型对 symbol/date/model/locale 的预测结果 | 用户可见预测事实源只能有一个 | 6 → 4 |
| `Decision` | 用户模式、动作语义、最终执行建议 | 决策层不能反向改写 Prediction | 6 → 4 |
| `Position` | 用户持仓、交易事件、持仓状态快照 | 真实持仓事件和派生快照分离 | 6 → 4 |
| `Notification` | 推送订阅、通知日志、信号状态 | 发送事实和用户偏好分离 | 3 → 3 |
| `Operation` | 后台任务、队列、审计、trace、健康检查 | run 级、job 级、trace 级分层 | 8 → 6 |

> 上限是 guardrail 不是承诺；超过上限不等于禁止新增，而是必须先回答 §6.5 与 §8 Step 3 的 guardrail 问题。本 RFC 不规定全局表数目标，详见 §6.5。

## 4. 表角色分类

| 角色 | 定义 | 例子 |
| --- | --- | --- |
| `canonical` | 该领域对象的主事实源 | `users`, `ai_predictions_v2` |
| `projection` | 从 canonical 派生，用于查询或展示 | `mode_performance_snapshot` |
| `job` | 后台执行状态，不表达业务事实本身 | future `prediction_jobs` |
| `log` | 事件或发送记录，通常 append-only | `notification_logs`, `task_logs` |
| `trace` | 调试链路和模型调用细节 | `llm_traces`, `chain_execution_traces` |
| `audit` | 发布、促销、人工操作审计 | `promotion_audit_log` |
| `shadow` | 新旧模型迁移期间的并行写入 | `producer_outcome_log` 当前阶段 |
| `compat` | 兼容旧代码或过渡期读取 | `stock_pool` 若仍存在旧路径 |
| `deprecated` | 不再新增写入，等待清理 | 需审计后标记 |

## 5. 当前表映射

### 5.1 User

| 表 | 当前角色 | 建议 |
| --- | --- | --- |
| `users` | canonical | 保留为用户主事实源 |
| `user_watchlist` | canonical relation | 保留；表达 user-symbol 关系 |
| `invitation_codes` | canonical / audit | 保留；后续确认是否拆分 code fact 与 usage audit |
| `referral_transactions` | log | 保留 append-only |
| `growth_daily_snapshots` | projection | 保留；增长看板聚合快照 |

### 5.2 Universe

| 表 | 当前角色 | 建议 |
| --- | --- | --- |
| `global_stock_pool` | canonical | 保留为生产股票池主表 |
| `stock_meta` | canonical | 保留为证券元数据主表 |
| `stock_pool` | compat / candidate deprecated | 审计读写路径；若无活跃路径，标记 deprecated |

### 5.3 MarketData

| 表 | 当前角色 | 建议 |
| --- | --- | --- |
| `daily_prices` | canonical | 保留 |
| `weekly_prices` | canonical derived series | 保留，但标明由日线或同步源派生 |
| `monthly_prices` | canonical derived series | 保留，但标明由日线或同步源派生 |
| `market_holidays` | canonical calendar | 保留 |
| `market_facts_daily` | projection | 保留，作为日级市场事实聚合 |
| `hk_short_eligible_list` | canonical external dataset | 保留，属于 HK 市场事实子域 |
| `hk_short_interest_weekly` | canonical external dataset | 保留，属于 HK 市场事实子域 |
| `hk_short_selling_daily` | canonical external dataset | 保留，属于 HK 市场事实子域 |

### 5.4 Prediction

| 表 | 当前角色 | 建议 |
| --- | --- | --- |
| `ai_predictions_v2` | canonical | 用户可见预测事实源，必须保持唯一主事实源 |
| `prediction_models` | canonical config | 保留，模型 registry / policy |
| `producer_outcome_log` | shadow / future unified outcome | 当前不要提升为 Prediction 主事实源；继续通过 reconciliation 验证 |
| `stock_briefs` | projection | 需确认是否与 daily_briefs / market_almanacs 重叠 |
| `daily_briefs` | projection | 保留为日级 brief 输出 |
| `market_almanacs` | projection | 保留为市场 almanac 输出 |

### 5.5 Decision

| 表 | 当前角色 | 建议 |
| --- | --- | --- |
| `user_investment_mode` | canonical user setting | 保留 |
| `mode_decision_log` | canonical decision log | 保留为 Decision 层，不与 Prediction 争事实源 |
| `mode_simulated_trade_ledger` | projection / simulation ledger | 保留，明确不是用户真实成交 |
| `mode_performance_snapshot` | projection | 保留，用于 mode 效果评估 |
| `layer1_daily_reports` | projection / report | 保留；后续确认是否可并入 Operation report 或 MarketData projection |
| `quant_tradeability_signals` | projection / research output | 审计生产读取路径；若仅研究使用，定义归档策略 |

### 5.6 Position

| 表 | 当前角色 | 建议 |
| --- | --- | --- |
| `user_trade_positions` | canonical | 用户持仓主事实源 |
| `user_trade_position_events` | event log | append-only，保留 |
| `position_state_snapshots` | projection | 保留，派生快照 |
| `trade_management_advice_log` | log / advice output | 保留，定义 retention |
| `management_policy_runs` | job / experiment run | 归入 Operation 或 Research 子域 |
| `management_policy_results` | projection / experiment result | 归入 Research 子域，定义归档策略 |

### 5.7 Notification

| 表 | 当前角色 | 建议 |
| --- | --- | --- |
| `push_subscriptions` | canonical | 推送订阅主事实源 |
| `notification_logs` | log | append-only，保留 |
| `signal_states` | canonical state | 保留，用于去重和信号翻转 |

### 5.8 Operation

| 表 | 当前角色 | 建议 |
| --- | --- | --- |
| `task_logs` | canonical run log | run 级后台任务事实源 |
| future `prediction_jobs` | job | symbol/model/locale 级预测执行状态；不表达预测结果 |
| `ops_broadcast_health` | health log | 保留，定义 retention |
| `ops_pool_reconcile_runs` | audit / job log | 保留，定义 retention |
| `ops_broadcast_fallback_events` | log | 保留，定义 retention |
| `llm_traces` | trace | 保留短周期或按需归档 |
| `chain_execution_traces` | trace | 保留短周期或按需归档 |
| `promotion_audit_log` | audit | 保留 append-only |
| `_local_sync_state` | local operation state | 本地状态表，不应进入产品语义 |

## 6. 关键收口原则

### 6.1 Prediction 与 Decision 分层

`Prediction` 回答：

```text
某个模型在某个交易日对某只股票给出了什么预测？
```

`Decision` 回答：

```text
在某个用户模式或持仓上下文下，应该如何行动？
```

因此：

1. `ai_predictions_v2` 是 Prediction canonical。
2. `mode_decision_log` 是 Decision canonical。
3. `producer_outcome_log` 在完成迁移前只能是 shadow / reconciliation layer。
4. 前端可以组合 Prediction 和 Decision，但不能让两者互相覆盖语义。

### 6.2 Operation Run 与 Job 分层

`task_logs` 是 run 级：

```text
AI Analysis (CN) 这次运行整体成功了吗？
```

future `prediction_jobs` 是 job 级：

```text
000001 / 2026-04-10 / deepseek-aliyun / cn 这个预测任务处于什么状态？
```

因此 Phase 2 新增 `prediction_jobs` 是合理的，但必须限定为 Operation.Job，不能成为新的预测结果事实源。

### 6.3 Projection 表必须可重建

以下类型原则上应该能从 canonical 表重建：

1. performance snapshot
2. report
3. brief aggregation
4. state snapshot

如果不能重建，必须解释其不可重建原因，并提升为 canonical 或 event log。

### 6.4 Trace / Log 必须有保留策略

建议默认：

| 类型 | 默认保留策略 |
| --- | --- |
| `trace` | 7-30 天，异常样本可抽样长期保留 |
| `health log` | 30-90 天 |
| `task_logs` | 180 天或按月归档 |
| `audit` | 长期保留 |
| `notification_logs` | 90-180 天，视产品和合规需要调整 |

### 6.5 领域密度准则

为避免新增能力默认走"加表"路径，每个领域对象设定 **推荐表数密度上限**（见 §3 表格）。该上限作为 guardrail，与 §8 Step 3 的新增问答配合使用：

1. **不写全局表数目标**。本 RFC 不规定 V1 之后总共保留几张表；全局数字容易引导"为压缩而压缩"，掩盖领域语义债务。
2. **领域级密度比全局总数更可执行**。每条违规对应一个明确的领域 owner，新增前必须先回答"这个领域是不是已经满了"。
3. **超过上限不等于禁止新增**，但必须在 RFC、ADR 或迁移 plan 中说明：为什么必须新增、为什么无法复用现有表、是否同时下线某张同领域旧表。
4. **上限按生产 schema 计算**：canonical / projection / log / trace / job / audit / shadow / compat 总和构成上限。research-only 表通常应移出生产 schema，不计入领域上限。
5. **长期形态参考**：可压缩边界、可融合候选清单、近似最小表数估算放在 [49. Schema Long-Term Shape Notes](./49_Schema_Long_Term_Shape_Notes_20260428.md)，作为 informational 文档，不绑定本 RFC 的实施。

## 7. Phase 2 前置门槛

在新增 `prediction_jobs` 前，需要完成以下确认：

1. 明确 `prediction_jobs` 只属于 `Operation.Job`。
2. 明确 `ai_predictions_v2` 继续是 Prediction canonical。
3. 定义 `prediction_jobs -> ai_predictions_v2` 的状态转移关系。
4. 定义 job 保留策略：成功 job 可压缩或归档，失败 job 保留用于诊断。
5. 在文档中标注 `task_logs` 与 `prediction_jobs` 的粒度差异。

建议 `prediction_jobs` 最小字段：

```text
job_id
pipeline_run_id
market
symbol
trade_date
model_id
content_locale
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
execution_time_ms
token_usage_input
token_usage_output
created_at
updated_at
```

## 8. 近期行动

### Step 1: 表级审计

输出一张表：

```text
table_name
domain_object
role
canonical_owner
write_paths
read_paths
retention
deprecation_status
notes
```

### Step 2: 标记 deprecated / shadow / projection

优先审计：

1. `stock_pool`
2. `producer_outcome_log`
3. `stock_briefs`
4. `layer1_daily_reports`
5. `quant_tradeability_signals`
6. `management_policy_*`
7. `llm_traces`
8. `chain_execution_traces`

### Step 3: 建立 schema guardrail

任何新增表必须回答：

1. 它属于哪个领域对象？
2. 它是 canonical / projection / job / log / trace / audit / shadow / compat 哪一种？
3. 它的 canonical 上游是谁？
4. 谁写入？谁读取？
5. 数据保留多久？
6. 是否有替代方案复用现有表？
7. 加入后该领域是否仍在 §3 推荐密度上限内？若超上限，是否同步下线一张同领域旧表？

### Step 4: 再进入 Prediction Phase 2

完成上述 guardrail 后，再新增 `prediction_jobs`，避免队列化变成新的表膨胀入口。

## 9. 非目标

当前 RFC 不做：

1. 立即删除任何表。
2. 立即迁移生产数据。
3. 改变前端 API。
4. 改变 `ai_predictions_v2` 当前主事实源地位。
5. 把所有表强行合并成少数大表。

本阶段目标是定边界和定语言，先降低后续扩张的结构性风险。
