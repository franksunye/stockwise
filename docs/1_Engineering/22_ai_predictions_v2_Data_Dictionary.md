# 22 ai_predictions_v2 Data Dictionary

更新时间：2026-03-13

## 1. 目的

本文档用于说明 `ai_predictions_v2` 的字段含义、来源、写入时机和主要消费方式。

补充定位：

- `docs/1_Engineering/21_Decision_Data_Model_Architecture.md` 定义目标数据模型
- 本文件描述的是 `ai_predictions_v2` 在当前实现中的事实口径
- 因此，本文件不等于目标模型说明，而是过渡期主表的数据字典

它回答四个问题：

1. 每个字段表示什么
2. 字段由哪一层产出
3. 字段更偏“原始事实”还是“兼容展示”
4. 当前前后端应如何理解这些字段

## 2. 当前口径

`ai_predictions_v2` 是当前生产预测主表。

它同时承载三类信息：

1. 预测主结果
2. Layer-1 / 四状态附加信息
3. Prompt / 运行 / 验证元数据

当前真实 schema 需以两部分共同理解：

1. 建表与迁移逻辑：
   - [`backend/database.py`](/Users/yesun/Code/stockwise/backend/database.py)
2. 实际主链写入口径：
   - [`backend/db_repo/queries.py`](/Users/yesun/Code/stockwise/backend/db_repo/queries.py)

说明：

- `backend/database.py` 中的 `CREATE TABLE` 片段体现基础结构
- 部分字段通过后续迁移补入
- 当前本地真实 schema 已包含 `trace_id`

从目标模型视角看，`ai_predictions_v2` 当前是一个混合表：

1. 主体上承载 `producer_outcome`
2. 同时混入部分 `fact_snapshot` 附加信息
3. 以及验证、运行与兼容展示元数据

## 3. 主键与行粒度

主键：

- `(symbol, date, model_id)`

这意味着一行表示：

- 某只股票
- 某个分析基准日
- 某个模型

对应的一条预测快照。

## 4. 字段分组

### 4.1 身份与定位字段

| 字段 | 类型 | 含义 | 来源 | 备注 |
| --- | --- | --- | --- | --- |
| `symbol` | `TEXT` | 股票代码 | 主链输入 | 主键一部分 |
| `date` | `TEXT` | 分析基准日 / 预测生成日 | 主链输入 | 主键一部分 |
| `model_id` | `TEXT` | 生成该预测的模型标识 | 模型注册表 / 主链 | 主键一部分 |
| `target_date` | `TEXT` | 对应行情/验证目标日期 | 主链计算 | 常与 `daily_prices.date` 对齐 |
| `mode_id` | `TEXT` | 该预测记录关联的 mode 视角 | 模式链 / 回填链 | 当前更多用于模式体系兼容 |

### 4.2 预测主结果字段

| 字段 | 类型 | 含义 | 来源 | 备注 |
| --- | --- | --- | --- | --- |
| `signal` | `TEXT` | 当前记录的最终信号 | 主链 canonical 结果 | 当前已进入四状态主语义 |
| `confidence` | `REAL` | 模型给出的置信度 | LLM 输出 / 规则链 | 不是收益概率 |
| `support_price` | `REAL` | 支撑位 | LLM/规则生成 | 历史字段，部分新模板依赖更弱 |
| `pressure_price` | `REAL` | 压力位 | LLM/规则生成 | 历史字段，部分链路仍保留 |
| `ai_reasoning` | `TEXT` | AI 分析结果正文 / JSON 包 | LLM 输出后清洗入库 | 当前最核心内容资产之一 |
| `is_primary` | `BOOLEAN` | 是否为当日主展示预测 | 主链选择器 | 同一 `symbol+date` 可能多模型，通常只有一条主记录 |

### 4.3 Layer-1 / 四状态字段

| 字段 | 类型 | 含义 | 来源 | 备注 |
| --- | --- | --- | --- | --- |
| `layer1_status` | `TEXT` | Layer-1 量化状态 | Layer-1 引擎 | 当前 canonical 四状态：`NoSetup / Watch / TriggeredLong / RiskOff` |
| `layer1_score` | `REAL` | Layer-1 综合分值 | Layer-1 引擎 | 解释性/调试用途更强 |
| `layer1_trigger_hit` | `INTEGER` | 是否命中 trigger 条件 | Layer-1 引擎 | 常作布尔位使用 |
| `layer1_risk_off_hit` | `INTEGER` | 是否命中 risk-off 条件 | Layer-1 引擎 | 常作布尔位使用 |
| `layer1_strategy_version` | `TEXT` | Layer-1 规则版本 | Layer-1 引擎 | 便于回溯策略版本 |
| `layer1_payload` | `TEXT` | Layer-1 原始上下文载荷 | Layer-1 引擎 | 面向审计/调试，不建议前台直接消费 |

### 4.4 Prompt 与运行元数据

| 字段 | 类型 | 含义 | 来源 | 备注 |
| --- | --- | --- | --- | --- |
| `prompt_version` | `TEXT` | 本次生成所用 prompt 版本 | Prompt 主链 | 用于版本比较与回归 |
| `token_usage_input` | `INTEGER` | 输入 token 数 | LLM 客户端 | 成本/性能观测 |
| `token_usage_output` | `INTEGER` | 输出 token 数 | LLM 客户端 | 成本/性能观测 |
| `execution_time_ms` | `INTEGER` | 本次预测耗时 | 主链执行器 | 端到端时延观测 |
| `trace_id` | `TEXT` | 对应 LLM trace 标识 | LLM 追踪器 | 可关联 `llm_traces`，但当前产品主读取不应依赖 join |

### 4.5 验证与表现字段

| 字段 | 类型 | 含义 | 来源 | 备注 |
| --- | --- | --- | --- | --- |
| `validation_status` | `TEXT` | 预测验证状态 | 验证链 | 典型值如 `Pending / Correct / Incorrect / Neutral / Verifying` |
| `actual_change` | `REAL` | 真实发生的价格变化 | 验证链 | 用于结果评估 |
| `validation_data` | `TEXT` | 多日验证轨迹 JSON | 验证链 | 例如轨迹/窗口信息 |
| `max_perf_in_window` | `REAL` | 验证窗口内峰值/谷值表现 | 验证链 | 用于 acceptance / 回测分析 |

### 4.6 时间字段

| 字段 | 类型 | 含义 | 来源 | 备注 |
| --- | --- | --- | --- | --- |
| `created_at` | `TIMESTAMP` | 记录创建时间 | 数据库默认值 / 写入时补充 | 入库时间，不等于交易日 |
| `updated_at` | `TIMESTAMP` | 记录更新时间 | 写入链 / 更新链 | 便于回填与重算追踪 |

## 5. 关键字段的当前工程解释

### 5.1 `signal`

当前应理解为：

- 该记录的最终信号
- 也是生产链默认对外使用的主信号

注意：

- 在四状态升级后，`signal` 已不应再被默认为旧三态心智
- API 层当前会额外提供 `canonical_signal` 等显式别名，便于前端理解

### 5.2 `layer1_status`

当前应理解为：

- Layer-1 量化纪律结论
- 也是双轨架构里的规则侧主结论

它不是“补充标签”，而是：

- 执行纪律
- 风险语义
- 决策约束

的主要来源。

### 5.3 `ai_reasoning`

当前应理解为：

- AI 侧核心内容资产
- 既是策略内参/战术分析的主要来源
- 也是未来双轨架构中 `A-L` 的主要承载体

当前阶段我们默认：

- 不新增数据库字段来拆原始/最终 reasoning
- 先在 API 层基于 `ai_reasoning` 组织 `llm_reasoning`

### 5.4 `trace_id`

`trace_id` 主要用于：

- 调试
- 审计
- 完整 prompt/response 追踪

当前原则：

- 可以关联 `llm_traces`
- 但产品主读取链路不应依赖它

## 6. 与双轨架构的对应关系

参见：

- [`19_Dual_Track_Decision_Architecture_Proposal.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/19_Dual_Track_Decision_Architecture_Proposal.md)

当前推荐映射为：

| 双轨概念 | 当前字段 |
| --- | --- |
| `B-S` 量化纪律结论 | `layer1_status` |
| `canonical_signal` 最终系统结论 | `signal` |
| `A-L` AI 分析过程/解释 | `ai_reasoning` |

说明：

- `A-S` 当前并没有在 `ai_predictions_v2` 中单独拆列保存
- 当前阶段通过 API 层从 `ai_reasoning` 中提取 `llm_signal`
- 这也是为什么目前我们说 Phase 1 不改 schema，只先做 API 显式分层

## 7. 当前前后端消费建议

### 7.1 后端

- 写入主表时，以 `signal` 作为最终信号
- `layer1_status` 作为规则纪律主轴
- `ai_reasoning` 作为内容主资产
- `trace_id` 只作追踪，不作主链主依赖

### 7.2 API

当前 API 层推荐同时返回：

- `signal`
- `layer1_status`
- `canonical_signal`
- `layer1_signal`
- `llm_signal`
- `llm_reasoning`

其中：

- `signal / layer1_status` 保持兼容口径
- 其余显式字段用于后续双轨展示和内部共识

### 7.3 前端

当前前端不必直接理解所有数据库字段。

推荐依赖 API 提供的显式视图，而不是自己推断：

- 哪个是最终信号
- 哪个是 Layer-1 信号
- 哪个是 AI 视图

## 8. 当前已知注意点

### 8.1 `trace_id` 是真实存在字段

虽然 `backend/database.py` 的 `CREATE TABLE` 基础片段没有显式展示 `trace_id`，但当前真实 schema 已包含它，且写入查询也在使用它。

因此当前事实应以：

- 实际数据库 schema
- 当前写入查询

为准，而不是只看最早的建表片段。

### 8.2 `signal` 与 `layer1_status` 不能混为一谈

即使当前某些场景下二者可能相同，也不能把它们视为同一概念：

- `signal`：最终结果
- `layer1_status`：规则纪律状态

### 8.3 `ai_reasoning` 不是“纯展示文案”

它当前已经承担：

- 战术结构
- 摘要
- 反方观点
- 次日关注点
- AI 侧内容资产

因此不应把它理解成普通备注字段。

## 9. 一句话版本

`ai_predictions_v2` 是当前预测主快照表：`signal` 管最终结果，`layer1_status` 管规则纪律，`ai_reasoning` 管 AI 内容资产，`prompt/token/time/trace` 管可追踪性，验证字段管事后评估。
