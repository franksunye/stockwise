---
title: "39 决策模型实施清单（2026-03-25）"
doc_id: "engineering-decision-model-implementation-plan-20260325"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-25"
summary: "将决策栈与统一数据模型落实到代码与表结构的执行清单，覆盖语义治理、DTO/API 收口、目标表补齐、迁移顺序与回滚策略。"
---

# 39 决策模型实施清单（2026-03-25）

## 0. 实施进展（截至 2026-03-25）

当前状态：

1. Step 1 已完成并上线（`completed`）
2. Step 2 已完成并上线（`completed`）
3. Step 3 已完成并上线（`completed`）
4. Step 4-8 待执行（`pending`）

已完成项摘要：

1. Step 1：统一语义常量与历史别名映射
   - 新增 `backend/engine/semantic_registry.py`
   - 新增 `frontend/src/lib/semantic-registry.ts`
   - 前后端语义映射改为统一来源，替换主要硬编码入口
2. Step 2：类型系统收口
   - 前端关键字段升级为 union type（`decision_semantic / layer1_status / signal`）
   - mode 决策读取链路增加显式归一
   - 后端写入链路增加语义归一约束，收敛自由字符串入口
3. Step 3：应用层 DTO 显式化
   - 新增应用层对象：`ProducerOutcomeView / ArbitrationResultView / ModeActionDecisionView`
   - 在 `predictions / history / stock-batch` API 增量返回新对象字段
   - 旧字段保持不变，页面继续兼容原消费方式

上线前验证口径（Step 1/2）：

1. `frontend` lint / `tsc` / build 通过
2. `backend/tests/test_mode_pipeline.py` 通过
3. 本轮未涉及 schema 变更，按兼容方式发布

## 1. 本文档解决什么问题

前两篇母文档已经回答了：

1. 我们的决策栈应该如何分层
2. 我们的数据模型应该长什么样

见：

- `docs/0_Strategy/09_Decision_Stack_and_Producer_Architecture.md`
- `docs/1_Engineering/21_Decision_Data_Model_Architecture.md`

本文件只回答一个问题：

**接下来按什么顺序改，才能最小风险地把现有系统迁到目标模型。**

---

## 2. 本次实施的总原则

### 2.1 不推倒重来

当前生产链路仍以：

- `ai_predictions_v2`
- `mode_decision_log`
- `mode_simulated_trade_ledger`
- `mode_performance_snapshot`

为主。

本轮改造不要求一次性废弃这些表，而是先建立：

- 统一语义契约
- 显式 DTO / API 视图
- 目标表迁移通道

### 2.2 先统一语义，再补物理表

如果在语义未收口前直接拆表，极有可能把混乱复制到更多表里。

因此优先级必须是：

1. 语义治理
2. 应用层显式结构
3. 物理表补齐
4. 历史数据迁移

### 2.3 生产先稳，实验可并行

生产链路目标：

- 保持用户可见结果稳定
- 不中断当前 mode 出数

实验链路目标：

- 为新模型提供 shadow 运行与验证空间

### 2.4 本次实施的收敛原则

本轮改造虽然引入了更完整的对象模型，但必须避免过度工程。

明确约束如下：

1. 保持 `Modular Monolith`
   - 不引入多服务拆分作为本轮前提
2. 先做逻辑分层
   - 不要求所有对象立刻落独立物理表
3. 先做最值钱的一层
   - `producer_outcome_log` 优先级最高
4. 延迟重对象物理化
   - `arbitration_result`
   - `fact_snapshot`
   - `semantic_registry`
5. 前台继续简单
   - 用户最终仍主要看到清晰动作结论，而不是更多中间层术语

---

## 3. 目标范围

本次实施清单覆盖四个工作包：

1. `语义治理`
2. `应用层对象与 API 收口`
3. `目标表与迁移通道`
4. `历史数据清洗与回滚`

不在本轮范围内：

1. 全量替换前端页面消费模型
2. 一次性废弃 `ai_predictions_v2`
3. 一次性废弃 `mode_decision_log`
4. 重新设计所有 AI 提示词模板
5. 把 `fact_snapshot / arbitration_result / semantic_registry` 三者全部同时物理表化
6. 为这次改造引入微服务、消息总线或完整事件溯源体系

---

## 4. 逐步上线计划

以下步骤必须满足四个条件：

1. 可独立开发与合并
2. 可独立上线
3. 可独立验证
4. 可独立回滚

每一步都明确说明其与最终目标的等价关系。

### Step 1：统一语义常量与历史别名映射

目标：

- 建立统一语义契约，封住新的语义漂移入口

主要改动：

1. 新增后端语义模块
   - 建议：`backend/engine/semantic_registry.py`
2. 新增前端语义模块
   - 建议：`frontend/src/lib/semantic-registry.ts`
3. 明确以下枚举与别名映射：
   - `signal_state`
   - `decision_semantic`
   - `action_decision`
   - `action_semantic`
4. 补旧语义别名：
   - `建议进场 -> 建议看多`
   - `进场 -> 建议看多`
   - `空仓 / 建议空仓 -> 暂无信号`

主要触点：

1. [backend/engine/signal_semantics.py](/Users/yesun/Code/stockwise/backend/engine/signal_semantics.py)
2. [frontend/src/lib/prediction-display.ts](/Users/yesun/Code/stockwise/frontend/src/lib/prediction-display.ts)
3. [frontend/src/lib/investment-mode.ts](/Users/yesun/Code/stockwise/frontend/src/lib/investment-mode.ts)

上线方式：

- 纯兼容上线，不改数据库 schema，不改 API 结构

验证：

1. 新旧映射结果一致
2. SQL/TS 中不再新增新的硬编码旧术语
3. dashboard / history / predictions 展示无回归

回滚：

- 删除新常量引用，恢复原字符串常量

与最终目标关系：

- `contract-equivalent`
- 含义：统一了最终目标所需的语义契约，但尚未引入新对象或新表

### Step 2：类型系统收口

目标：

- 将关键语义字段从“自由字符串”升级为受约束类型

主要改动：

1. 前端为以下字段增加 union type：
   - `decision_semantic`
   - `layer1_status`
   - `signal`
2. 后端增加 Enum 或等价常量约束
3. 新 DTO 禁止裸字符串传播

主要触点：

1. [frontend/src/lib/types.ts](/Users/yesun/Code/stockwise/frontend/src/lib/types.ts)
2. [frontend/src/lib/investment-mode.ts](/Users/yesun/Code/stockwise/frontend/src/lib/investment-mode.ts)
3. 相关后端常量模块

上线方式：

- 代码约束上线，无 schema 变更

验证：

1. 前端编译通过
2. 现有测试通过
3. 没有新增 `string` 偷渡类型

回滚：

- 回退类型收紧改动

与最终目标关系：

- `type-equivalent`
- 含义：关键语义字段已具备最终目标要求的类型边界

### Step 3：应用层 DTO 显式化

目标：

- 在不改数据库的前提下，让代码先显式表达目标模型

主要改动：

1. 引入应用层视图：
   - `ProducerOutcomeView`
   - `ArbitrationResultView`
   - `ModeActionDecisionView`
2. 在 API/service 层构造这些对象
3. 保留现有兼容字段返回

主要触点：

1. [frontend/src/app/api/predictions/route.ts](/Users/yesun/Code/stockwise/frontend/src/app/api/predictions/route.ts)
2. [frontend/src/app/api/stock/batch/route.ts](/Users/yesun/Code/stockwise/frontend/src/app/api/stock/batch/route.ts)
3. [frontend/src/app/api/history/route.ts](/Users/yesun/Code/stockwise/frontend/src/app/api/history/route.ts)
4. [frontend/src/lib/investment-mode.ts](/Users/yesun/Code/stockwise/frontend/src/lib/investment-mode.ts)

上线方式：

- API 增量返回新结构
- 页面暂时继续用旧字段

验证：

1. API 响应中可见新对象
2. 页面仍按旧方式工作
3. 新对象内容与旧字段语义一致

回滚：

- 删除新 DTO 输出，保留原 API 结构

与最终目标关系：

- `read-model-equivalent`
- 含义：读模型已近似最终目标，但底层存储仍未切换

### Step 4：动作层语义收口

目标：

- 把 `mode_decision_log` 的新增解释权明确收口到动作层

主要改动：

1. 在代码与文档中把 `mode_decision_log` 视为过渡期 `mode_action_decision`
2. 禁止继续向该表新增 Producer 层语义字段
3. SQL 映射统一通过语义常量处理旧别名

主要触点：

1. [backend/analysis/mode_pipeline.py](/Users/yesun/Code/stockwise/backend/analysis/mode_pipeline.py)
2. [frontend/src/lib/investment-mode.ts](/Users/yesun/Code/stockwise/frontend/src/lib/investment-mode.ts)
3. [frontend/src/lib/prediction-display.ts](/Users/yesun/Code/stockwise/frontend/src/lib/prediction-display.ts)

上线方式：

- 兼容上线，不新增表

验证：

1. `mode_decision_log` 新写入只使用统一动作语义
2. mode overlay 结果与旧逻辑等价
3. 历史兼容别名仍可被正确归一

回滚：

- 回退语义收口改动，恢复旧 SQL 兼容逻辑

与最终目标关系：

- `semantic-equivalent`
- 含义：动作层语义已与目标模型对齐，但存储名仍是旧名

### Step 5：`producer_outcome_log` schema 与 shadow 写入

目标：

- 为 AI / Quant Producer 建立第一个真正的新目标表

主要改动：

1. 设计并创建 `producer_outcome_log`
2. 不切读路径，只做 shadow 写入
3. 选择一条最小主链先写：
   - `ai_predictions_v2` 对应的主预测
   - 或 `quant_tradeability_signals` 中的一条主规则链

建议最小字段：

- `outcome_id`
- `env`
- `symbol`
- `trade_date`
- `producer_id`
- `producer_type`
- `role_type`
- `outcome_kind`
- `signal_state`
- `decision_semantic`
- `confidence`
- `reasoning_payload`
- `run_id`
- `version`
- `created_at`

主要触点：

1. [backend/database.py](/Users/yesun/Code/stockwise/backend/database.py)
2. 预测写入链路
3. 研究 sidecar 写入链路

上线方式：

- 只新增写，不切任何线上读

验证：

1. 新表有稳定写入
2. 同一 `symbol + trade_date + producer_id` 可与旧表结果对账
3. 不影响现有页面与 API

回滚：

- 停止 shadow 写入，新表保留但不使用

与最终目标关系：

- `write-path-equivalent`
- 含义：新写路径已开始积累最终目标数据，但读路径仍在旧表

### Step 6：新旧结果对账与一致性报表

目标：

- 证明新旧链路在业务结果上等价或差异可解释

主要改动：

1. 增加对账脚本
2. 输出按以下维度比对：
   - `symbol`
   - `trade_date`
   - `producer_id`
   - `signal_state`
   - `decision_semantic`
3. 对 mode 结果增加 overlay 前后对账

主要触点：

1. 对账脚本
2. 现有 experiment / audit 脚本

上线方式：

- 内部观测，不改用户链路

验证：

1. 一致率达标
2. 差异项可归因为旧别名、历史脏数据或版本差异

回滚：

- 无需回滚，只是停止比对任务

与最终目标关系：

- `behavior-equivalent`
- 含义：验证行为层面已接近最终目标

### Step 7：读路径灰度切换到新对象

目标：

- 在保留 fallback 的前提下，让部分 API 优先读取新对象

主要改动：

1. API 先改读顺序：
   - 先读 `producer_outcome_log`
   - 失败或缺失时回退旧表
2. 对 mode 动作继续保留 `mode_decision_log`
3. `arbitration_result` 继续停留在 service/view 层

主要触点：

1. [frontend/src/app/api/predictions/route.ts](/Users/yesun/Code/stockwise/frontend/src/app/api/predictions/route.ts)
2. [frontend/src/app/api/stock/batch/route.ts](/Users/yesun/Code/stockwise/frontend/src/app/api/stock/batch/route.ts)
3. [frontend/src/app/api/history/route.ts](/Users/yesun/Code/stockwise/frontend/src/app/api/history/route.ts)

上线方式：

- 灰度切换
- 必须保留旧表 fallback

验证：

1. 新老路径结果一致
2. 性能无明显退化
3. 错误率不升高

回滚：

- 切回旧表优先读取顺序

与最终目标关系：

- `runtime-equivalent`
- 含义：运行时主读路径已接近最终目标

### Step 8：历史清洗与旧表降级

目标：

- 让新模型成为主语义，旧表退居兼容层

主要改动：

1. 历史 `decision_semantic` 幂等清洗
2. `ai_predictions_v2` 从“万能主表”降级为兼容主表
3. `mode_decision_log` 从混合语义表降级为兼容动作层表

上线方式：

- 分批执行
- 必须先完成 Step 6 和 Step 7

验证：

1. 旧术语不再新增
2. 新老查询结果等价
3. 页面不再依赖混合语义字段作为唯一事实源

回滚：

- 保留迁移前快照
- 依赖幂等清洗脚本与旧读路径 fallback

与最终目标关系：

- `storage-equivalent`
- 含义：存储层已基本收口到最终目标心智

---

## 5. 工作包与步骤映射

### 5.1 语义治理

- Step 1
- Step 2
- Step 8

### 5.2 应用层对象与 API 收口

- Step 3
- Step 4
- Step 7

### 5.3 目标表与迁移通道

- Step 5
- Step 6

### 5.4 灰度与回滚

- Step 6
- Step 7
- Step 8

---

## 6. 代码触点建议

为了让工程师能直接开工，首轮建议优先查看以下文件：

1. [backend/engine/signal_semantics.py](/Users/yesun/Code/stockwise/backend/engine/signal_semantics.py)
2. [backend/analysis/mode_pipeline.py](/Users/yesun/Code/stockwise/backend/analysis/mode_pipeline.py)
3. [backend/database.py](/Users/yesun/Code/stockwise/backend/database.py)
4. [frontend/src/lib/prediction-display.ts](/Users/yesun/Code/stockwise/frontend/src/lib/prediction-display.ts)
5. [frontend/src/lib/investment-mode.ts](/Users/yesun/Code/stockwise/frontend/src/lib/investment-mode.ts)
6. [frontend/src/app/api/predictions/route.ts](/Users/yesun/Code/stockwise/frontend/src/app/api/predictions/route.ts)
7. [frontend/src/app/api/stock/batch/route.ts](/Users/yesun/Code/stockwise/frontend/src/app/api/stock/batch/route.ts)
8. [frontend/src/app/api/history/route.ts](/Users/yesun/Code/stockwise/frontend/src/app/api/history/route.ts)
9. [frontend/src/components/dashboard/AICouncil.tsx](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/AICouncil.tsx)

---

## 7. 风险与回滚

### 风险 1：语义收口过慢，导致新旧并存更混乱

缓解：

- 先封住新写入口
- 新代码必须走语义常量

### 风险 2：前端一次性切太多，导致展示回归

缓解：

- 先改 API 聚合层
- 页面保留兼容字段回退

### 风险 3：新表上线后与旧表结果不一致

缓解：

- 先 shadow 写入
- 对比同一 `symbol + trade_date + mode_id`

### 风险 4：AI 文本继续使用旧术语

缓解：

- 模板约束
- LLM-as-a-judge 抽检
- 内容发布前扫描

### 回滚原则

1. 任一阶段都不应要求立即删除旧表
2. 新读路径必须保留旧字段 fallback
3. 新写路径先 shadow，再切主

---

## 8. 本轮最小执行集

如果只做最有价值的一小步，建议先完成以下 6 项：

1. 定 `signal_state / decision_semantic / action_decision / action_semantic` 的统一枚举
2. 建 `backend` 与 `frontend` 的共享语义常量源
3. 给 TS 加 union type 约束
4. 在 API 层引入 `ProducerOutcomeView` 与 `ModeActionDecisionView`
5. 把 `mode_decision_log` 的新增逻辑口径收口到动作层
6. 设计 `producer_outcome_log` schema，并先做 shadow 写入

本轮明确不做：

1. 不强制物理落地 `fact_snapshot`
2. 不强制物理落地 `arbitration_result`
3. 不单独为 `semantic_registry` 先建数据库表
4. 不在首轮就把所有页面切到新对象

---

## 9. 一句话收口

这次实施不追求“一步到位重写系统”，而追求：

**先把语义和对象模型钉死，再用最小风险方式把现有生产链路逐步迁到可扩展、可治理、可审计的量化 + AI 统一数据模型。**
