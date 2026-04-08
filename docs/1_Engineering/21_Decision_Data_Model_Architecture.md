---
title: "21 决策数据模型架构 (Decision Data Model Architecture)"
doc_id: "engineering-decision-data-model-architecture"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-25"
summary: "定义可扩展的量化 + AI 统一数据模型，明确事实层、Producer 结果、裁决层、模式动作层与现有表的迁移映射。"
---

# 21 决策数据模型架构 (Decision Data Model Architecture)

## 1. 文档目标

本文件用于回答四个工程问题：

1. 如何用一套可生长的数据模型同时容纳量化规则与 AI 世界
2. 如何区分共享事实层、原始判断层、综合裁决层、模式动作层
3. 当前 `ai_predictions_v2`、`quant_tradeability_signals`、`mode_decision_log` 等表在新模型中的位置是什么
4. 如何在不推倒重来的前提下，分阶段迁移到目标模型

上游术语母本：

- `docs/0_Strategy/09_Decision_Stack_and_Producer_Architecture.md`

关联文档：

- `docs/1_Engineering/10_Architecture.md`
- `docs/1_Engineering/14_Investment_Mode_Backend_Runbook.md`
- `docs/1_Engineering/22_ai_predictions_v2_Data_Dictionary.md`
- `docs/Backlog.md` 第 5 节“信号语义深层治理（P2）”

---

## 2. 设计原则

### 2.1 一套模型，容纳两大世界

目标模型必须同时容纳：

1. `Quant Producer`
   - `tradeability_v2`
   - `TrendStrategy`
   - 后续更多量化规则
2. `AI Producer`
   - `DeepSeek`
   - `Hunyuan`
   - 后续更多 AI 分析者

并允许同一个 AI 同时承担：

- `Producer`
- `Interpreter`

### 2.2 先分层，再分表

我们先解决“语义分层”，再决定“物理拆表”。

因此：

- 当前表可以先保留
- 但文档和新代码必须按目标分层理解

### 2.3 实验与生产共用对象定义

`Production` 与 `Experiment` 不应使用两套完全不同的数据概念。

它们应共享：

- 相同对象类型
- 相同主键思路
- 相同结果分层

差异主要通过：

- `env`
- `run_id`
- `policy_id`
- `version`

来表达。

### 2.4 语义治理必须内建，不能外挂

`docs/Backlog.md` 中的“信号语义深层治理（P2）”不应被理解为一组零散质量事项。

它实际上是目标数据模型成立的前置条件。

如果没有统一的信号语义治理，以下问题会持续反复出现：

1. 同一个字段在不同层代表不同含义
2. `signal / canonical_signal / decision_semantic / action_semantic` 互相串层
3. 前后端常量漂移
4. 历史数据难以解释
5. AI 文本继续回流旧术语

因此，语义治理必须直接纳入目标模型设计。

### 2.5 目标模型允许“逻辑先进，物理克制”

本模型的目标是让系统边界更清楚，不是为了把一个 2C 决策产品过早改造成重型分布式架构。

因此必须明确：

1. 目标模型首先是一套**逻辑对象模型**
2. 它并不要求所有对象在第一阶段都变成独立物理表
3. 它也不要求当前单体应用立刻演化成多服务体系

对当前阶段更合适的落地方式是：

- `Modular Monolith`
- 逻辑分层优先
- DTO / API 显式对象优先
- 延迟物理化（Delayed Physicalization）

结论：

对 ZISO 这样的 2C 决策产品来说，复杂度应主要服务于“输出稳定的简单结论”，而不是服务于架构形式本身。

---

## 3. 目标对象模型

推荐统一采用六层对象。

在这六层对象之上，再补一层跨域基础设施：

- `semantic_registry`

它不是业务结果表，但它是所有结果层的上游契约。

### 3.1 `fact_snapshot`

共享事实层。

一行表示：

- 某标的
- 某交易日
- 某环境下

的一份结构化市场事实快照。

它只记录“市场事实”，不直接记录立场。

典型字段建议：

| 字段 | 含义 |
| --- | --- |
| `fact_snapshot_id` | 主键 |
| `env` | `production / experiment` |
| `symbol` | 标的 |
| `trade_date` | 交易日 |
| `market` | 市场 |
| `data_version` | 数据版本 |
| `price_payload` | 行情摘要 |
| `quant_fact_payload` | 技术指标、形态、关键位、风险结构 |
| `event_context_ref` | 事件/新闻上下文引用 |
| `created_at` | 生成时间 |

### 3.2 `producer_registry`

判断来源注册表。

它定义“谁有资格产出结果”。

典型字段建议：

| 字段 | 含义 |
| --- | --- |
| `producer_id` | 主键，如 `tradeability_v2`、`deepseek_v3` |
| `producer_type` | `quant / ai / hybrid` |
| `role_capabilities` | `producer / interpreter` 的能力声明 |
| `owner_team` | 所属团队 |
| `versioning_policy` | 版本治理策略 |
| `status` | `active / shadow / deprecated` |

### 3.3 `producer_outcome`

每个 Producer 的原始产出。

这是目标模型中最关键的一层。

量化与 AI 在这一层彻底平权。

一行表示：

- 某 Producer
- 在某标的某日某环境
- 基于某份事实快照
- 产出的一次原始结果

典型字段建议：

| 字段 | 含义 |
| --- | --- |
| `outcome_id` | 主键 |
| `env` | `production / experiment` |
| `symbol` | 标的 |
| `trade_date` | 交易日 |
| `producer_id` | 来源 |
| `producer_type` | `quant / ai` |
| `role_type` | `producer / interpreter` |
| `outcome_kind` | `signal / opinion / interpretation` |
| `signal_state` | 结构化信号 |
| `decision_semantic` | 人类可读判断语义 |
| `confidence` | 置信度 |
| `reasoning_payload` | 原始解释/推理 |
| `fact_snapshot_id` | 关联事实层 |
| `run_id` | 一次运行实例 |
| `version` | 规则/模型版本 |
| `is_primary_for_producer` | 该 Producer 在当前环境下的主结果标识 |
| `created_at` | 写入时间 |

### 3.4 `arbitration_case`

综合裁决上下文。

一行表示：

- 某标的某日某环境
- 系统准备对若干 `producer_outcome` 做一次综合裁决

典型字段建议：

| 字段 | 含义 |
| --- | --- |
| `case_id` | 主键 |
| `env` | `production / experiment` |
| `symbol` | 标的 |
| `trade_date` | 交易日 |
| `fact_snapshot_id` | 关联事实快照 |
| `case_scope` | 如 `daily_primary`, `backtest_trial` |
| `created_at` | 建立时间 |

### 3.5 `arbitration_result`

系统综合后的统一判断。

它解决的是“系统如何看市场”，不是“用户今天怎么操作”。

典型字段建议：

| 字段 | 含义 |
| --- | --- |
| `arbitration_result_id` | 主键 |
| `case_id` | 所属 case |
| `policy_id` | 裁决策略 |
| `canonical_signal` | 统一结构化结果 |
| `market_view` | 市场倾向总结 |
| `consensus_level` | 共识强度 |
| `primary_outcome_id` | 主支撑结果 |
| `supporting_outcome_ids` | 辅助证据集合 |
| `conflict_summary` | 分歧摘要 |
| `created_at` | 生成时间 |

### 3.6 `mode_action_decision`

投资模式后的最终动作。

它解决的是“今天到底做什么”。

典型字段建议：

| 字段 | 含义 |
| --- | --- |
| `action_decision_id` | 主键 |
| `case_id` | 所属 case |
| `arbitration_result_id` | 所依赖的综合结果 |
| `mode_id` | 投资模式 |
| `position_context` | 当前持仓状态 |
| `action_decision` | `Open / Hold / Add / Reduce / Exit / Ignore` |
| `action_semantic` | 用户可读动作语义 |
| `sizing_hint` | 仓位建议 |
| `risk_instruction` | 风控说明 |
| `decision_reason` | 动作理由 |
| `created_at` | 写入时间 |

### 3.7 下游对象

动作层之后继续接：

1. `position_ledger`
2. `performance_snapshot`
3. `notification_event`

这三层不再负责解释“谁判断的”，而负责：

- 落账
- 统计
- 触达

### 3.8 `semantic_registry`

语义注册表。

它负责统一定义系统内允许出现的语义枚举、映射关系和展示规范。

建议至少覆盖四类语义：

1. `signal_state`
   - 结构化信号状态
   - 例：`TriggeredLong / Watch / NoSetup / RiskOff`
2. `decision_semantic`
   - Producer 或裁决层的人类可读判断语义
   - 例：`建议看多 / 建议观察 / 建议防守 / 暂无信号`
3. `action_decision`
   - 动作层内部枚举
   - 例：`Open / Hold / Add / Reduce / Exit / Ignore`
4. `action_semantic`
   - 面向用户的动作表达
   - 例：`开仓 / 持有 / 加仓 / 减仓 / 离场 / 忽略`

建议字段：

| 字段 | 含义 |
| --- | --- |
| `semantic_domain` | 语义域，如 `signal_state` |
| `semantic_key` | 稳定主键 |
| `canonical_label_zh` | 中文标准文案 |
| `canonical_label_en` | 英文标准文案 |
| `legacy_aliases` | 历史兼容别名 |
| `layer` | 该语义所属层级 |
| `is_user_facing` | 是否允许直接面向用户 |
| `status` | `active / deprecated` |
| `effective_from` | 生效时间 |
| `notes` | 备注 |

工程上不一定一开始就需要数据库实体表，但至少要有：

1. 后端 Python 常量源
2. 前端 TypeScript 常量源
3. 自动一致性校验

补充约束：

- `semantic_registry` 在第一阶段优先作为代码契约存在
- 不建议为了“完整性”立即引入独立数据库表
- 只有当语义治理需要被后台配置化、审计化或多环境动态发布时，再考虑物理化

---

## 4. 统一主链路

目标主链路如下：

```text
market_data
  -> fact_snapshot
  -> producer_outcome
  -> arbitration_case
  -> arbitration_result
  -> mode_action_decision
  -> position_ledger / performance_snapshot / notification_event
```

解释能力可横切存在于：

- `producer_outcome`
- `arbitration_result`
- `mode_action_decision`

同时，所有层都必须回指同一个 `semantic_registry` 契约，而不是各自发明文案。

---

## 5. 当前表到目标对象的映射

### 5.1 `ai_predictions_v2`

当前角色：

- 生产预测主表
- 同时承载 AI 原始内容、Layer-1 附加信息、验证元数据

在目标模型中的归属：

1. `producer_outcome`
   - `model_id`
   - `signal`
   - `confidence`
   - `ai_reasoning`
2. 部分字段属于共享事实或附加调试资产
   - `layer1_status`
   - `layer1_payload`
3. 部分字段属于验证/运行元数据
   - `trace_id`
   - `validation_status`
   - `actual_change`

结论：

`ai_predictions_v2` 不应被长期视为“万能主表”，而应逐步被拆解理解为：

- 以 `producer_outcome` 为主
- 混入了事实层、验证层、运行元数据

### 5.2 `quant_tradeability_signals`

当前角色：

- 研究线量化 sidecar 主表

在目标模型中的归属：

- 主要对应 `producer_outcome`
- 部分字段也会回指 `fact_snapshot`

结论：

它应被理解为研究环境下某个 `Quant Producer` 的结果表，而不是“量化世界的全部”。

### 5.3 `mode_decision_log`

当前角色：

- 生产模式结果表
- 同时带有 `strategy_version`、`layer1_status` 等来源痕迹

在目标模型中的归属：

- 应逐步收口为 `mode_action_decision`

结论：

该表后续应减少“来源层”的语义负担，聚焦：

- 模式
- 持仓上下文
- 最终动作

### 5.4 `mode_simulated_trade_ledger`

当前角色：

- 生产模式模拟交易台账

在目标模型中的归属：

- `position_ledger`

### 5.5 `mode_performance_snapshot`

当前角色：

- 生产模式绩效汇总

在目标模型中的归属：

- `performance_snapshot`

### 5.6 当前最值得物理化的对象

从扩展价值与复杂度平衡看，当前不建议六层对象全部同时物理化。

优先级建议：

1. 优先物理化：`producer_outcome`
   - 最能解决 AI / Quant 平权与实验 / 生产并存问题
2. 延后物理化：`arbitration_result`
   - 可先用 service / DTO 视图承载
3. 延后物理化：`fact_snapshot`
   - 可先从现有 payload 与指标快照构造逻辑视图
4. 代码契约优先：`semantic_registry`
   - 不急于立独立表

---

## 6. 当前字段的归类建议

为了帮助后续改代码时不再串层，推荐先按下面的心智分类。

### 6.1 事实层字段

例如：

- 技术指标
- 关键位
- VCP 条件命中
- 趋势状态
- 风险状态

这些字段后续应优先归到：

- `fact_snapshot`

### 6.2 Producer 原始结果字段

例如：

- `signal`
- `decision_semantic`
- `confidence`
- `ai_reasoning`
- `raw_action`

这些字段后续应优先归到：

- `producer_outcome`

### 6.3 综合裁决字段

例如：

- `canonical_signal`
- `consensus_level`
- `primary_source`
- `conflict_summary`

这些字段后续应优先归到：

- `arbitration_result`

### 6.4 模式动作字段

例如：

- `mode_id`
- `action_decision`
- `action_semantic`
- `holding_instruction`

这些字段后续应优先归到：

- `mode_action_decision`

### 6.5 语义契约字段

例如：

- `signal_state`
- `decision_semantic`
- `canonical_signal`
- `action_decision`
- `action_semantic`

这些字段虽然分布在不同层，但其允许值、展示标签、兼容别名、弃用策略都必须统一受 `semantic_registry` 管理。

---

## 7. 推荐主键与唯一性原则

### 7.1 `fact_snapshot`

建议唯一键：

- `(env, symbol, trade_date, data_version)`

### 7.2 `producer_outcome`

建议唯一键：

- `(env, symbol, trade_date, producer_id, version, run_id)`

如果同一 run 下每个 Producer 只有一条主结果，可再增加：

- `is_primary_for_producer`

### 7.3 `arbitration_case`

建议唯一键：

- `(env, symbol, trade_date, case_scope, fact_snapshot_id)`

### 7.4 `mode_action_decision`

建议唯一键：

- `(case_id, mode_id, position_context)`

这样可以天然支持：

- 同一 case 多模式并行
- 同一模式在不同持仓上下文下的动作差异

---

## 8. 分阶段实施建议

### Phase 1：文档与语义收口

目标：

- 先统一术语与对象
- 不强制立刻改物理表

动作：

1. 新代码与新文档都按六层对象解释
2. `mode_decision_log` 对内按 `mode_action_decision` 理解
3. `ai_predictions_v2` 与 `quant_tradeability_signals` 对内按 `producer_outcome` 理解
4. 建立语义注册表草案，明确：
   - `signal_state`
   - `decision_semantic`
   - `action_decision`
   - `action_semantic`

### Phase 2：应用层显式映射

目标：

- 在 API / service / pipeline 层先把目标模型显式表达出来

动作：

1. 引入应用层 DTO：
   - `FactSnapshotView`
   - `ProducerOutcomeView`
   - `ArbitrationResultView`
   - `ModeActionDecisionView`
2. 让 API 优先返回显式结构，而不是让前端猜字段语义
3. 引入前后端共享语义常量，消除硬编码字符串
4. 将 `decision_semantic` 升级为 TS Union / 后端 Enum 或等价约束

### Phase 3：物理表补齐

目标：

- 在不打断生产的前提下增加新表或中间表

优先顺序建议：

1. `producer_outcome_log`
2. `arbitration_result_log`
3. `mode_action_decision_log`
4. 如有必要，再补 `semantic_registry` 物理表或生成产物

补充收敛原则：

- 如果 `arbitration_result` 仍只在单一主链策略中被轻量消费，可继续停留在逻辑视图层
- 如果 `fact_snapshot` 还没有出现明显的跨 Producer 复用与追溯压力，可继续不落表
- 只有当对象已经成为多模块稳定依赖点时，才值得物理化

### Phase 4：旧表退役或降级

目标：

- 把历史兼容表降级为过渡层或只读历史表

动作：

1. `ai_predictions_v2` 从“万能主表”降级为兼容主表
2. `mode_decision_log` 从混合语义表收口为动作层表
3. 研究线与生产线在物理层继续隔离，但在对象模型上对齐
4. 对历史旧语义做幂等数据清洗，如“建议看多”统一收口为“建议看多”

### Phase 5：持续语义审计

目标：

- 防止未来再次语义漂移

动作：

1. CI 校验 Python / TS 语义常量一致性
2. 扫描代码与提示词中的旧术语硬编码
3. 对 AI 文本做抽检，防止回流旧版“进攻/进场”等表达
4. 语义升级时强制附迁移说明与历史兼容策略

---

## 9. 当前最重要的结论

如果只记一句话，应记住：

**量化与 AI 的统一，不是把它们塞进同一张“万能结果表”，而是让它们共享事实层、平权进入 Producer 结果层，并在统一语义契约约束下，经裁决层与模式层生成最终动作。**

进一步收口：

**这套模型应首先作为单体系统内的清晰边界存在，而不应被误读为“必须一次性把每一层都做成独立物理基础设施”。**
