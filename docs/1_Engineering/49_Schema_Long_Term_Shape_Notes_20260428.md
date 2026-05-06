---
title: "49. Schema Long-Term Shape Notes"
doc_id: "engineering-schema-long-term-shape-notes-20260428"
doc_domain: "engineering"
doc_status: "informational"
owner: "founder"
last_reviewed_at: "2026-04-28"
summary: "在 Domain Model Consolidation RFC 之外，记录 V1 schema 长期可压缩边界与潜在融合候选，供路线图参考。本文档不是承诺，不绑定具体迁移时序。"
---

# 49. Schema Long-Term Shape Notes

更新时间：2026-04-28

## 0. 文档定位

- **不是 RFC 主文档**：主依据是 [48. Domain Model Consolidation RFC](./48_Domain_Model_Consolidation_RFC_20260428.md)。
- **不是迁移计划**：本文档不规定何时压缩、由谁压缩、压缩到哪一版。
- **不是承诺**：表数估算只是上界参考，给路线图判断提供边界。
- **作用**：在不污染 RFC 主体的前提下，让"未来 schema 最紧能收到多少"这一问题有可引用的答案。

适用场景：

1. 新功能讨论时被问"我们最终会有多少张表"。
2. 评估某个新表是否值得加，需要参考"长期是否能融合掉"。
3. Phase 2 / Phase 3 路线图回看，判断当前膨胀速度是否健康。

## 1. 三层分析

把当前 ~46 张表按 **能否安全融合** 分成三层。每层只是结构性判断，不代表立刻执行。

### 1.1 Tier A：硬核 canonical（基本不可压）

每个领域对象一张主事实表 + 必要的关系表 / 事件表，动它们就是动产品语义：

| 表 | 所属领域 | 不可压理由 |
| --- | --- | --- |
| `users` | User | 用户主事实源 |
| `user_watchlist` | User | user-symbol 主关系 |
| `invitation_codes` | User | 邀请 code 与使用关系 |
| `global_stock_pool` | Universe | 生产股票池主表 |
| `stock_meta` | Universe | 证券元数据主表 |
| `daily_prices` | MarketData | 日线主事实源 |
| `market_holidays` | MarketData | 交易日历 canonical |
| `ai_predictions_v2` | Prediction | 用户可见预测主事实源 |
| `prediction_models` | Prediction | 模型 registry |
| `user_investment_mode` | Decision | 用户模式主设置 |
| `mode_decision_log` | Decision | Decision canonical |
| `user_trade_positions` | Position | 用户持仓主事实源 |
| `user_trade_position_events` | Position | 持仓 append-only event log |
| `push_subscriptions` | Notification | 推送订阅 canonical |
| `signal_states` | Notification | 信号去重 canonical |
| `task_logs` | Operation | run 级后台任务主事实源 |

合计约 **16 张**。

### 1.2 Tier B：可融合的同形候选

形态相同、语义相近，可通过加 `type / kind / granularity` 列融合：

| 当前 | 融合后假设 | 节省 | 风险 |
| --- | --- | --- | --- |
| `weekly_prices` + `monthly_prices` | 加 `granularity` 进入 `prices_rollup` 或 view | -2 | 低；本身就是日线 rollup |
| `hk_short_eligible_list` + `hk_short_interest_weekly` + `hk_short_selling_daily` | 一张 `hk_short_facts` + `dataset_type` | -2 | 中；外部数据集更新节奏不一致，可能稀疏 |
| `stock_briefs` + `daily_briefs` + `market_almanacs` | `briefs` + `brief_type` | -2 | 中；产出方与读取方需先解耦 |
| `llm_traces` + `chain_execution_traces` | 统一 `execution_traces` + `trace_kind` | -1 | 低；都是 trace 用途 |
| `ops_broadcast_health` + `ops_broadcast_fallback_events` | 统一 `ops_broadcast_events` | -1 | 低；同一子系统可观测性 |
| `mode_simulated_trade_ledger` + `mode_performance_snapshot` | ledger 保留为事件源，snapshot 改为 view | -1 | 中；查询性能需重测 |
| `management_policy_runs` + `management_policy_results` | 移入研究子域并融合 | -2 | 低；研究域用法可控 |

理论可节省 **-11 张**。

### 1.3 Tier C：可移除 / 可降级

债务清理性质，零产品风险：

| 表 | 处理 | 节省 |
| --- | --- | --- |
| `stock_pool` | compat 路径审计完毕后移除 | -1 |
| `producer_outcome_log` | reconciliation 完成后并入 Prediction 影子字段或归档 | -1 |
| `quant_tradeability_signals` | 仅研究使用，移出生产 schema | -1 |
| `layer1_daily_reports` | 并入 `daily_briefs` 或 MarketData projection | -1 |
| `_local_sync_state` | 本地状态，不应在产品 schema 里 | -1 |

理论可节省 **-5 张**。

## 2. 阶段近似形态

| 阶段 | 表数 | 描述 | 风险 |
| --- | --- | --- | --- |
| 当前 | 46 | V1 稳定后实际状态 | 基线 |
| Phase 2 落地 `prediction_jobs` | 47 | 不做压缩，按 RFC 48 §7 规范增加 | 低 |
| 完成 Tier C 清理 | ~42 | 纯债务清理 | 极低 |
| 完成 Tier B 融合 | **~31** | 中期目标，能撑 V2/V3 功能扩张 | 中（迁移工作量） |
| 极限压缩 | ~25 | 多数 projection 降级为 view | 高（性能 / 可观测性） |

**推荐目标：~31 张**。再往下压缩，性价比迅速衰减；查询路径变长、可观测性变弱、外部数据集字段稀疏化都会反噬抽象收益。

## 3. 边界判断备忘

下面这些是真正动手前必须先回答的问题。本文档只列，不做决定。

### 3.1 weekly_prices / monthly_prices 是否合并

- **现状**：分别存储，便于直接查询。
- **风险**：合并后历史回填脚本和报表需要重写；周线、月线对齐口径与日线 rollup 需要明确定义。
- **决策点**：是否值得为节省 2 张表承担一次完整回填迁移。

### 3.2 HK short 三表是否融合

- **现状**：3 个外部数据集，更新节奏（每日 / 每周 / 不定期）和字段都不一致。
- **风险**：融合表会变成稀疏列宽表，外部供应商更新口径变更时需要更小心。
- **决策点**：是否接受为对称性而牺牲列空间和外部数据回填的清晰度。

### 3.3 brief 系列是否合并

- **现状**：`stock_briefs` / `daily_briefs` / `market_almanacs` 形态相似但产出与读取场景不同。
- **风险**：直接合并会让前端读取路径变长（必须按 type 过滤），且产出端三个 producer 是否能复用同一写入路径未验证。
- **决策点**：先解耦读取再合表，还是先合表再解耦读取。

### 3.4 mode_simulated_trade_ledger / mode_performance_snapshot

- **现状**：snapshot 的查询路径已经稳定，被 Mode 评估页直接读取。
- **风险**：改为 view 后 Mode 评估页查询性能未知。
- **决策点**：先做查询性能基线测量，再决定是否降级。

### 3.5 management_policy_*

- **现状**：研究域使用为主，生产读取路径较少。
- **风险**：移出生产 schema 需要研究流程同步迁移、本地脚本路径调整。
- **决策点**：研究域是否准备好接收独立 schema 或独立库。

## 4. 与 RFC 48 的关系

- RFC 48 给出 **领域语言** 和 **每域密度上限**（见 §3、§6.5）。
- 本文档给出 **可压缩边界** 和 **融合候选清单**。
- 任何具体合表 / 删表 / 降级动作必须独立写迁移 plan 或 ADR，不能直接以本文档为依据执行。
- 本文档可在每次 schema 重大变更（新增 / 删除 / 融合）后增量更新，但不应替代 RFC 48 的 guardrail 流程。

## 5. 非目标

1. 立即执行 Tier B / Tier C 任何动作。
2. 给出"V2 必须达到 31 张"的 commitment。
3. 替代 RFC 48 §3 / §6 / §8 的 guardrail 流程。
4. 决定哪个领域 owner 在什么时间窗执行哪一步迁移。
