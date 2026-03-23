# 14 Investment Mode Backend & API Unification Runbook

更新时间：2026-03-23  
范围：本地开发环境（SQLite / Turso-compat SQL）与前端 API 收口统一  
文档角色：Investment Mode 的后端现行运行手册与前端 API 信号统一执行方案  

发布状态：
- 基本后端结构已发布到 `main`（commit: `a941edf`）
- API 信号统一方案处于执行验证阶段

## 1. 目标

保证 Investment Mode 在系统内端到端形成闭环：

**第一层：数据与产数闭环（Backend）**
- 数据结构：`user_investment_mode` / `mode_decision_log` / `mode_simulated_trade_ledger` / `mode_performance_snapshot`
- 审计字段：`job_id` / `rule_version` / `triggered_by`
- 产数程序：`prediction -> decision -> ledger -> snapshot`

**第二层：展示与消费闭环（API & Frontend）**
解决当前 PRO 用户具备多模式（steady/balanced/aggressive/observe_only），但前端主链路仍主要读取底层原始预测（`ai_predictions_v2`），导致模式差异无法正确透出的问题。
- 让用户可见的信号**统一收口到 API 层**。
- 同一用户、同一时刻、同一股票，在前端不同入口（主卡片、历史卡片、AICouncil）看到的是同一套 **mode-aware** 信号。

---

## Part I: 后端数据与执行口径

## 2. 口径定义：Investment Mode 不等于 sidecar

Investment Mode 与 `tradeability sidecar` 都使用真实市场数据，但职责不同，不得混称：

术语约定：
- 中文统一使用“生产线 / 实验线”。
- 中文统一使用“生产池 / 研究池”。
- 英文保留 `Production Decision Lane / Research Quant Lane`。

1. **Investment Mode（生产线）**：
   - 属于正式产品数据链路。输入来自线上 `daily_prices` 与 `ai_predictions_v2`。
   - 输出到：`mode_decision_log`，`mode_simulated_trade_ledger`，`mode_performance_snapshot`。
   - 前台接口读取这些表作为正式表现。

2. **tradeability sidecar（实验线）**：
   - 属于量化研究与参数治理链路。
   - 输出到：`quant_tradeability_signals`。
   - 用于 Layer-1 状态观测、版本并行实验、weekly calibration，**不是**当前 Investment Mode 的前台主展示数据源。

3. **两层池子定义**：
   - **研究池**：服务量化实验，用于找结论。
   - **生产池**：服务正式产品，不作为研究池的样本屏障。

## 3. 当前数据血缘

**线上 Investment Mode（生产线）**：
1. 数据同步任务写入 `daily_prices`
2. 预测主流程写入 `ai_predictions_v2`
3. `run_mode_pipeline()` 读取两者，产出 mode 三层结果表。
4. 前台 `/api/modes/*` 消费三层表。

**实验线**：
1. 盘后样本补量扩充 `daily_prices`
2. `run_tradeability_sidecar.py` 计算并输出至 `quant_tradeability_signals`
3. 周末执行周度校准。

## 4. 运行编排纪律

本地与线上实验必须恪守不同纪律：
- **本地**：互动试错、找方向。
- **线上（生产编排）**：全自动无干预。顺序为 `同步/预测 -> 旁路研究补量 -> 生产管线 run_mode_pipeline() -> 周度校准`。
- **线上影子实验**（如 cn_top30_shadow）：走单独 workflow (`tradeability_shadow_universe_experiment.yml`)，输出不写成前台正式口径。

## 5. 项目代码位置与测试验收

- **数据模型与逻辑**：`backend/analysis/mode_pipeline.py`, `backend/db_repo/queries.py`
- **入口程序**：`backend/main.py --mode-pipeline`
- **最小验收方案**：单测 `backend.tests.test_mode_pipeline` 和回归测试 `test_runner_layer1_enforcement`。

---

## Part II: API 层信号统一专项方案

## 6. 当前不一致点问题陈述

当前前端虽有 `/api/user/mode`，但核心的主展示（Dashboard 取 `/api/stock/batch`，详情页取 `/api/predictions`）仍然只读取底层表 `ai_predictions_v2`。
这导致用户即使切换了 Mode（例如从 `balanced_v1` 切到了 `aggressive_v1`），但在股票卡片前台看见的 `layer1_status` 或者买卖点文案可能根本没变化。

## 7. 架构与设计原则

1. **单一解释权位于 Mode 日志**：对用户可见的最终动作信号，解释权统一归属于 `mode_decision_log`。前端不能自己写二次推断，不同接口也不能各自为战。
2. **保留原始预测底稿**：`ai_predictions_v2` **不能**被丢弃，它依旧是：
   - 模型身份（model、display_name）、原始置信度（confidence）、技术指标和验证情况的主要寄放处。
   - 以及底层推理原因（`ai_reasoning`）的来源。
3. **在 API 层（Node.js 端）做合并 Overlay**：不改下层库表，不在前端 React 组件碎化拼装，而是在 API Handler 里将 Mode 数据覆盖上来。

## 8. 对位与语义映射口径 (To-Be)

统一使用已有四语义：
1. `建议进场` -> Overlay `signal`: `Long`, `layer1_status`: `TriggeredLong`
2. `建议观察` -> Overlay `signal`: `Side`, `layer1_status`: `Watch`
3. `建议防守` -> Overlay `signal`: `Short`, `layer1_status`: `RiskOff`
4. `暂无信号` -> Overlay `signal`: `Side`, `layer1_status`: `NoSetup`

*兼容当前前端 `getPredictionActionMeta()` 的推导设计。无信号与保留观察通过 `layer1_status` 区分。*

**API 返回字段策略：**
- **必须覆盖掉的**：`signal`, `layer1_status`
- **原则不覆盖的**：`model`, `display_name`, `validation_status`, `actual_change`, 及各类技术指标状态。

## 9. 推荐工程实现：批量查询 + 内存 Merge

**步骤：**
1. `/api/stock/batch` 或 `/api/predictions` 按现逻辑查出原始 Prediction 主体数据。
2. 从结果中提取聚合 Key 集合：`mode_id` (读取当前用户环境), `symbol`, `decision_date`。
3. 把这些 Key 打平，发起一次针对 `mode_decision_log` 的批量查询。
4. 在 Node API 的内存中，进行 Map 合并 (Overlay)，并将结果塞回复合物流响应。

**为什么不做单 SQL 大 Join？**
1. 减少系统震荡。先观察批量 Overlay 命中率与延迟，`/api/stock/batch` 本身已有太多聚合。若后续监控到网络耗时瓶颈，再下沉至单 SQL。(详见配套技术实验 `20_Investment_Mode_Signal_Unification_Experiments.md`)
2. 规避 N+1 查询：严禁在循环里向 DB 查 Mode。

**必需索引保障：**
表 `mode_decision_log` 必须具备支撑业务的高效覆盖索引：`idx_mode_decision_lookup (mode_id, symbol, decision_date)`

## 10. 改造的 API 节点与页面影响面

**首要改造 API 路径：**
- `frontend/src/app/api/stock/batch/route.ts` （影响 Dashboard 主卡片）
- `frontend/src/app/api/predictions/route.ts` （影响历史页与 AICouncil 视图）

**被收口的展示位（只统一口径，本次不改前端视觉或文案）：**
- Dashboard 主卡片
- HistoricalCard 历史卡片
- TacticalBriefDrawer 内的 AICouncil
- 基于 `/api/predictions` 的模型拆解列表

## 11. 分阶段实施策略

**Phase 1：API 层全量收口**
- 收口上述两个 route.ts，前端入参结构和返回结构定义完全不变。
- **验收：** 同一股票在卡片侧和 Council 侧看到的买卖意见绝对一致；改变主模式设置，卡片动作跟着变。

**Phase 2：可观测落地**
- 增加监控日志。
- 观测项：`mode_overlay_hit_rate`, `stock_batch_query_ms`, `predictions_query_ms`。

**Phase 3：结构与性能优化**
- 视乎 Phase 2 的耗时观察，再决定是否退回给 DB 做底层单 SQL Join、或引入内存缓存层。
- 禁止预先优化设计。

**红线纪律（不建议做的事）：**
1. 不要让前端组件去独自拿 `/api/user/mode` 并本地处理覆盖。
2. 不要让底层的三个模型去各自生成 Mode-aware 信号。
3. 不要在第一步试图把历史、模型、所有前端老债全部彻底做数据结构换血（风险极大）。
