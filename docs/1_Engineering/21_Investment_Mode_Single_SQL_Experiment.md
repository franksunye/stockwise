# 21 Investment Mode Single SQL Experiment

更新时间：2026-03-10  
状态：Draft  
定位：第二阶段实验，验证单 SQL 收口是否能保留正确性并降低云端额外开销

关联文档：
- `docs/1_Engineering/17_Investment_Mode_API_Signal_Unification_Plan.md`
- `docs/1_Engineering/20_Investment_Mode_Signal_Unification_Experiment.md`

## 1. 背景

第一阶段实验已经确认两件事：

1. 功能上，mode overlay 是必要的。
2. 性能上，在云端采用“两次独立查询 + merge”会显著增加总耗时。

因此第二阶段不再讨论“要不要做 overlay”，而是验证：

**能否通过单 SQL join/CTE 的方式，把 mode overlay 收口到一次数据库查询中。**

## 2. 实验问题

本轮只回答两个问题：

1. 单 SQL 结果是否与“两次查询 + merge”结果一致。
2. 单 SQL 是否能在云端明显降低额外开销。

## 3. 对比对象

### 3.1 方案 A：两次查询 + merge

步骤：

1. 先查 `ai_predictions_v2` primary predictions
2. 再查 `mode_decision_log`
3. 在应用层 merge / overlay

### 3.2 方案 B：单 SQL join/CTE

步骤：

1. 在 SQL 内先截取 prediction 基表窗口
2. 直接 `LEFT JOIN mode_decision_log`
3. 在 SQL 内完成 overlay 字段映射

## 4. 本轮范围

为减少变量，本轮优先验证接近 `/api/predictions` 的查询形态：

1. 输入：
   - 一组 symbols
   - `history_limit`
   - 单个 `mode_id`
2. 输出：
   - 原始 prediction 字段
   - overlay 后 `signal`
   - overlay 后 `layer1_status`

暂不直接模拟 `stock/batch` 的完整多表查询。

原因：

1. 先把核心 overlay 形态验证清楚。
2. 避免把 `daily_prices`、short metrics、almanac 等变量混进来。
3. 一旦单 SQL 在这里成立，再向 `stock/batch` 扩展。

## 5. 一致性判定

若以下字段逐行一致，则认为 SQL 口径成立：

1. `symbol`
2. `date`
3. `target_date`
4. `signal`
5. `layer1_status`
6. `decision_semantic`

允许保留原始 `confidence` 和 `ai_reasoning`，本轮不做改写。

## 6. 性能判定

重点看：

1. `two_step_total_ms`
2. `single_sql_total_ms`
3. `delta_ms`
4. `delta_pct`

目标不是追求本地最优，而是尽量压低云端 round trip 成本。

## 7. 实验结论使用方式

### 7.1 若单 SQL 成立且更快

则 API 层推进建议变为：

1. `predictions` 先落单 SQL
2. 再决定 `stock/batch` 是：
   - 也做单 SQL
   - 还是继续批量 merge

### 7.2 若单 SQL 成立但不明显更快

说明瓶颈不在查询轮次，而在：

1. Turso 网络层
2. 查询本身扫描成本
3. 索引不足

此时应优先看索引和查询 shape，而不是继续在应用层与 SQL 层之间反复切换。

### 7.3 若单 SQL 不一致

说明 overlay 规则仍需先统一，不应贸然把逻辑下沉到 SQL。

## 8. 当前预期

基于第一阶段结果，当前合理预期是：

1. 单 SQL 应能显著降低云端额外开销。
2. merge 本身不是瓶颈，网络 round trip 才是瓶颈。
3. 若单 SQL 不能降低明显延迟，则说明查询结构或索引仍需继续优化。
