---
title: "42 交易管理研究架构草图（2026-03-27）"
doc_id: "engineering-trade-management-research-architecture-20260327"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-27"
summary: "给出交易管理研究子系统的模块边界、对象模型、表结构草图与第一期实施清单，用于承接未来执行卡与管理策略产品化。"
---

# 42 交易管理研究架构草图（2026-03-27）

## 1. 文档目标

本文件用于回答四个工程问题：

1. 交易管理研究系统应插在现有 StockWise 架构的哪一层
2. 哪些部分应复用成熟量化框架，哪些部分必须自研
3. 第一阶段最小模块和表结构应该长什么样
4. 如何在不推翻现有 `Investment Mode / Decision Model` 的前提下增量长出这条能力线

上游母本：

- [01 产品定位与能力边界](/Users/yesun/Code/stockwise/docs/0_Strategy/01_Product_Positioning_and_Boundaries.md)
- [05 量化信号验证与执行公理](/Users/yesun/Code/stockwise/docs/0_Strategy/05_Quant_Signal_and_Execution_Axioms.md)
- [09 决策栈与 Producer 架构](/Users/yesun/Code/stockwise/docs/0_Strategy/09_Decision_Stack_and_Producer_Architecture.md)
- [30Q 交易管理研究框架](/Users/yesun/Code/stockwise/docs/2_Intelligence/30Q_Trade_Management_Research_Framework.md)

---

## 2. 总体架构

推荐把交易管理研究作为一条独立子系统接入：

```text
Market Data / Prediction Data
  -> Signal State Layer
  -> Position State Layer
  -> Management Policy Layer
  -> Simulation / Research Engine
  -> Evaluation
  -> Product Execution Card
```

这条链路在顶层上应明确理解为一套双层结构：

1. **表层：模式系统**
   - 服务用户选择与产品表达
2. **底层：持仓状态机**
   - 服务系统决策、研究比较与动作映射

工程上不应把这两层做成互相替代关系，而应做成：

- `Investment Mode` 负责定义管理风格
- `Position State + Management Policy` 负责定义当前状态下的真实动作

### 2.1 分层解释

1. `Signal State Layer`
   - 已存在
   - 负责给出市场判断，如 `TriggeredLong / Watch / RiskOff / NoSetup`
2. `Position State Layer`
   - 新增
   - 负责描述已有仓位状态
3. `Management Policy Layer`
   - 新增
   - 负责把状态映射成管理动作
4. `Simulation / Research Engine`
   - 尽量复用成熟框架
5. `Evaluation`
   - 比较不同管理策略优劣
6. `Product Execution Card`
   - 将优选策略翻译成用户执行语言

### 2.2 状态机契约 V1

为避免工程先跑、状态语义后漂移，第一阶段固定采用六状态契约：

1. `EntryTriggered`
2. `BreakoutPending`
3. `TrendHolding`
4. `ProfitProtection`
5. `FailureRisk`
6. `ExitCompleted`

工程约束：

- 状态必须由可观察事实驱动
- 状态名必须稳定，不随单次策略试验随意变更
- 策略可变，但状态契约先收口

产品约束：

- 前台默认不直接暴露完整状态机
- 但执行卡、纪律线、进阶解释必须能回溯到这套状态契约

---

## 3. 哪些不自研，哪些必须自研

### 3.1 不自研

以下能力不应由 StockWise 从零重写：

1. 通用回测主循环
2. 参数扫描
3. 基础绩效指标计算
4. 常规订单路径模拟

### 3.2 必须自研

以下能力是 StockWise 的真正产品资产：

1. `Position State Schema`
2. `Management Policy DSL`
3. `Policy Evaluation Objective`
4. `Execution Card Mapping`

---

## 4. 模块草图

建议新增目录：

```text
backend/
  management/
    domain/
    state/
    policies/
    simulation/
    research/
    storage/

  scripts/
    run_management_research.py
    backfill_position_states.py
    compare_management_policies.py
```

其中：

- `run_management_research.py` 负责单票、单 case 回放
- `compare_management_policies.py` 负责固定 case set 或外部 JSON case file 的批量策略比较

### 4.1 `domain/`

职责：

- 定义统一对象
- 脱离数据库原始字段

建议对象：

- `PositionState`
- `ManagementAction`
- `PolicyResult`

### 4.2 `state/`

职责：

- 从现有数据库生成研究所需状态快照

输入来源：

- `daily_prices`
- `ai_predictions_v2`
- `quant_tradeability_signals`

### 4.3 `policies/`

职责：

- 定义管理策略
- 统一策略输入输出

第一期建议：

- `buy_and_hold_baseline`
- `partial_take_profit_33`
- `partial_take_profit_50`
- `discipline_exit_only`
- `failure_risk_reduce_50`
- `failure_risk_exit_all`

### 4.4 `simulation/`

职责：

- 逐日推进状态
- 应用策略动作
- 生成交易路径结果

### 4.5 `research/`

职责：

- 构造样本
- 批量运行 policy
- 比较指标
- 产出报告

### 4.6 `storage/`

职责：

- 落研究 run
- 落每笔策略结果
- 支撑复盘与比较

---

## 5. 关键对象草图

### 5.1 `PositionState`

最小字段建议：

- `symbol`
- `date`
- `entry_date`
- `entry_price`
- `position_size`
- `holding_days`
- `close`
- `high`
- `low`
- `unrealized_pnl_pct`
- `mfe_pct`
- `mae_pct`
- `signal_state`
- `confidence`
- `support_price`
- `resistance_price`
- `breakout_confirmed`
- `failed_breakout_risk`
- `volume_followthrough`

### 5.2 `ManagementAction`

最小字段建议：

- `action`
- `size_ratio`
- `trigger_reason`
- `stop_price`
- `target_price`

动作枚举建议：

- `HOLD`
- `SELL_PART`
- `EXIT_ALL`
- `ADD`
- `MOVE_STOP`

### 5.3 `PolicyResult`

最小字段建议：

- `policy_id`
- `symbol`
- `entry_date`
- `exit_date`
- `realized_pnl_pct`
- `max_drawdown_pct`
- `profit_giveback_pct`
- `holding_days`
- `action_count`

---

## 6. 表结构草图

### 6.1 `position_state_snapshots`

用途：

- 固化研究输入状态

建议字段：

- `symbol`
- `date`
- `entry_date`
- `entry_price`
- `position_size`
- `holding_days`
- `close`
- `high`
- `low`
- `unrealized_pnl_pct`
- `mfe_pct`
- `mae_pct`
- `signal_state`
- `confidence`
- `support_price`
- `resistance_price`
- `breakout_confirmed`
- `near_resistance`
- `failed_breakout_risk`
- `feature_payload`

### 6.2 `management_policy_runs`

用途：

- 记录一次研究任务

建议字段：

- `run_id`
- `policy_id`
- `universe`
- `date_from`
- `date_to`
- `params_json`
- `created_at`

### 6.3 `management_policy_results`

用途：

- 记录每个 policy 在每笔样本上的结果

建议字段：

- `run_id`
- `policy_id`
- `symbol`
- `entry_date`
- `exit_date`
- `holding_days`
- `realized_pnl_pct`
- `max_drawdown_pct`
- `profit_giveback_pct`
- `win_flag`
- `result_payload`

### 6.4 第一阶段 SQL 草案

以下 SQL 草案遵循当前仓库已有表的风格：

- 主键尽量使用显式 `TEXT` 主键
- 保留 `created_at / updated_at`
- 使用 `TEXT` 存 JSON payload
- 以“逻辑先成立、物理适度克制”为原则

#### A. `position_state_snapshots`

```sql
CREATE TABLE IF NOT EXISTS position_state_snapshots (
    id TEXT PRIMARY KEY,
    symbol TEXT NOT NULL,
    trade_date TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    entry_price REAL NOT NULL,
    position_size REAL NOT NULL,
    holding_days INTEGER NOT NULL,

    close REAL NOT NULL,
    high REAL,
    low REAL,

    unrealized_pnl_pct REAL,
    mfe_pct REAL,
    mae_pct REAL,

    signal_state TEXT,
    confidence REAL,
    support_price REAL,
    resistance_price REAL,

    breakout_confirmed INTEGER DEFAULT 0,
    near_resistance INTEGER DEFAULT 0,
    failed_breakout_risk INTEGER DEFAULT 0,
    partial_exit_done INTEGER DEFAULT 0,

    feature_payload TEXT,
    source_ref TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_position_state_unique
ON position_state_snapshots(symbol, trade_date, entry_date);

CREATE INDEX IF NOT EXISTS idx_position_state_lookup
ON position_state_snapshots(symbol, entry_date, trade_date);

CREATE INDEX IF NOT EXISTS idx_position_state_signal
ON position_state_snapshots(signal_state, trade_date);
```

设计说明：

- `trade_date` 不用裸 `date`，避免和 SQL 关键字语义混淆。
- `entry_date + trade_date` 组合允许同一标的不同持仓样本共存。
- `source_ref` 预留给未来关联 `mode_decision_log.id`、`producer_outcome_log.outcome_id` 或研究样本来源。

#### B. `management_policy_runs`

```sql
CREATE TABLE IF NOT EXISTS management_policy_runs (
    run_id TEXT PRIMARY KEY,
    policy_id TEXT NOT NULL,
    universe TEXT NOT NULL,
    date_from TEXT NOT NULL,
    date_to TEXT NOT NULL,
    benchmark_policy_id TEXT,
    objective_id TEXT,
    params_json TEXT,
    sample_size INTEGER,
    triggered_by TEXT,
    note TEXT,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_management_policy_runs_lookup
ON management_policy_runs(policy_id, date_from, date_to);
```

设计说明：

- `benchmark_policy_id` 允许同一次研究明确相对基准，如 `buy_and_hold_baseline`。
- `objective_id` 明确本次优化目标，避免未来研究报告出现“最优但不知道按什么最优”的歧义。

#### C. `management_policy_results`

```sql
CREATE TABLE IF NOT EXISTS management_policy_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    policy_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    exit_date TEXT,
    holding_days INTEGER,

    entry_price REAL NOT NULL,
    exit_price REAL,

    realized_pnl_pct REAL,
    max_drawdown_pct REAL,
    profit_giveback_pct REAL,
    win_flag INTEGER,
    action_count INTEGER DEFAULT 0,

    action_log_json TEXT,
    result_payload TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,

    FOREIGN KEY (run_id) REFERENCES management_policy_runs(run_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_management_policy_results_unique
ON management_policy_results(run_id, policy_id, symbol, entry_date);

CREATE INDEX IF NOT EXISTS idx_management_policy_results_lookup
ON management_policy_results(policy_id, symbol, entry_date);

CREATE INDEX IF NOT EXISTS idx_management_policy_results_run
ON management_policy_results(run_id, policy_id);
```

设计说明：

- `action_log_json` 单独保留，便于未来回放“哪一天做了什么动作”。
- `result_payload` 用来承接补充指标，避免第一期过早把所有二级字段都物理化。

#### D. 可选补充表：`management_policy_daily_marks`

如果后续发现仅靠 `position_state_snapshots + management_policy_results` 不够回放逐日路径，可以加一张轻量级日级痕迹表：

```sql
CREATE TABLE IF NOT EXISTS management_policy_daily_marks (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    policy_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    trade_date TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    action TEXT NOT NULL,
    position_size REAL,
    stop_price REAL,
    target_price REAL,
    state_ref_id TEXT,
    payload TEXT,
    created_at TIMESTAMP NOT NULL,

    FOREIGN KEY (run_id) REFERENCES management_policy_runs(run_id),
    FOREIGN KEY (state_ref_id) REFERENCES position_state_snapshots(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_management_policy_daily_marks_unique
ON management_policy_daily_marks(run_id, policy_id, symbol, trade_date, entry_date);

CREATE INDEX IF NOT EXISTS idx_management_policy_daily_marks_lookup
ON management_policy_daily_marks(symbol, entry_date, trade_date);
```

说明：

- 这张表不是第一期必需。
- 但如果未来执行卡要支持“逐日回放”，它会很有价值。

### 6.5 与现有 `mode_*` 表的关系

为了避免后续实现时再次混淆，这里明确：

1. `mode_decision_log`
   - 当前记录“模式层日决策”
   - 仍服务于 `Investment Mode`
2. `mode_simulated_trade_ledger`
   - 当前记录“模式层模拟交易”
   - 仍服务于模式表现
3. `position_state_snapshots / management_policy_*`
   - 服务于未来“交易管理研究”
   - 不是对 `mode_*` 的简单重命名
   - 不应和模式绩效混用

结论：

第一阶段应把它们理解为**并行的研究对象**，而不是一上来就强行合表。

---

## 7. 第一阶段实施清单

### 7.1 文件清单

第一阶段最小文件集合：

1. `backend/management/domain/position_state.py`
2. `backend/management/state/snapshot_builder.py`
3. `backend/management/policies/base.py`
4. `backend/management/policies/hold_to_exit.py`
5. `backend/management/policies/partial_take_profit.py`
6. `backend/management/policies/fixed_discipline_exit.py`
7. `backend/management/policies/policy_registry.py`
8. `backend/management/simulation/engine.py`
9. `backend/management/research/evaluator.py`
10. `backend/management/storage/repo.py`
11. `backend/scripts/run_management_research.py`

### 7.2 先做什么

推荐顺序：

1. 建表
2. 定义 `PositionState`
3. 写 `snapshot_builder`
4. 写最小模拟器
5. 写 4 个基础策略
6. 写 evaluator
7. 跑单票案例
8. 扩展样本集

---

## 8. 与现有系统的关系

### 8.1 复用

直接复用现有数据：

- `daily_prices`
- `ai_predictions_v2`
- `quant_tradeability_signals`
- `mode_simulated_trade_ledger`
- `mode_performance_snapshot`

### 8.2 不推翻现有系统

这条新子系统不应推翻：

- `Decision Model`
- `Investment Mode`
- `Validator`

它们各自继续承担原职责。

新增系统的作用是：

**把“已有仓位怎么管”从经验性建议升级为可研究、可回测、可比较的正式对象。**

---

## 9. 第一阶段验收口径

第一阶段不要求完整产品化。

只要求回答一个关键问题：

**在类似 `02171 科济药业-B` 这类已有浮盈、刚突破的场景中，`全持有`、`先卖 1/3`、`先卖 1/2`、`只守纪律位` 这几类管理方式，哪一种在目标函数上更优。**

最小交付：

1. 一张策略对比表
2. 一份研究结论
3. 一个可重复运行的脚本

---

## 10. 一句话总定义

**交易管理研究架构的目标，不是把 StockWise 变成重型量化平台，而是在现有信号系统之上，长出一条足够严谨、足够克制、最终能回流用户执行卡的管理策略研究链路。**
