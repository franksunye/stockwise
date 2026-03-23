# 20 Investment Mode Signal Unification Experiments

更新时间：2026-03-23
状态：Draft  
定位：在正式改 API 前，验证 mode 信号统一方案在数据覆盖面、模型分化能力和数据库查询性能层面是否皆可行。本文合并了第一阶段（内存 Merge）与第二阶段（单 SQL Join）的实验设计与结论。

关联文档：
- `docs/1_Engineering/17_Investment_Mode_API_Signal_Unification_Plan.md`
- `docs/1_Engineering/14_Investment_Mode_Backend_Runbook.md`

## 1. 实验目标与背景

由于 API 收口会影响全局数据获取与性能，我们在本地及线上环境分别进行**只读**技术实验，以回答以下核心问题：

**功能层面（Phase 1）：**
1. 当前 `mode_decision_log` 对主展示链路（如 Watchlist）的覆盖率是否足够。
2. 三个核心模式是否真的能对同一批股票产生差异化策略建议（还是其实都在趋同）。
3. 哪些边界情况会导致方案不完整（如 decision 缺失、日期对不上、或是与原始 signal 严重冲突）。

**性能层面（Phase 2）：**
4. 性能代价：将 API 收口到 mode overlay，主干查询延迟会增加多少？
5. 工程实现：能否通过单 SQL (Join/CTE) 替代“两次查询 + 应用层 Merge”的形式，从而显著降低云端往返（Round Trip）的额外开销？

## 2. 实验原则

1. **只读访问**：实验不产生数据写入。
2. **不侵入现有 API**：在旁路脚本中模拟 API 后续可能采用的数据行为。
3. **分环境验证**：
   - 本地：主要用于快速跑通查询逻辑与应用层 Merge / SQL Join 调优。
   - 线上：验证真实环境网络延迟（Turso 云库）与生产数据集覆盖率。

## 3. 实验方案对比（基于 Overlay 思路）

### 3.1 方案 A：两次查询 + 应用层 Merge (Phase 1 基线)

- **步骤**：先把基表（`ai_predictions_v2`）查询一轮；再拿 Symbols 和 Dates 批量查一次 `mode_decision_log`；最后在 Python API 中于内存进行 Overlay（重叠覆盖）。
- **用途**：可以很快写出快速样板，跑通逻辑和验证数据覆盖率。

### 3.2 方案 B：单 SQL Join/CTE (Phase 2)

- **步骤**：在同一条 SQL 里利用 CTE 筛选 Prediction 基表窗口，直接 `LEFT JOIN mode_decision_log`；覆盖判断和重命名全部在一条 SQL 中完成。
- **用途**：为了避免多次云端库发起请求导致的长时间开销，这对于批量查询 `/api/stock/batch` 和 `/api/predictions` 非常关键。本方案优先在较聚焦的 `/api/predictions` 场景上（指定 symbols、history_limit、mode_id）做单一验证。

## 4. 样本设计

优先从真实 PRO 用户的 Watchlist 抽样，以最贴近真实主展示链路。

- **触发入口**：针对具体用户 `--user-id` 或具体一组股票 `--symbols`
- **规模梯度**：例如分别跑 [10 只，30 只，50 只] 股票 × 历史长度 [7，15，30] 交易日。

### 测试用例示例：
```bash
# 本地库测试 (DB_SOURCE=local)
DB_SOURCE=local python backend/scripts/experiment_mode_signal_unification.py --user-id <USER_ID> --history-limit 15 --iterations 5

# 云端生产库测试 (DB_SOURCE=cloud) 指定个股与对比两种实现
DB_SOURCE=cloud python backend/scripts/experiment_mode_signal_unification.py --symbols 00700,02171,600519 --history-limit 15 --iterations 5
```

## 5. 指标与判定标准

### 5.1 正确性指标（一致性判定）
若以单 SQL 作为最优解，则下列字段返回必须与方案 A 逐行一致，方可认为 SQL 层实现成立：
- 基本坐标：`symbol`, `date`, `target_date`
- Overlay 结果：`signal` 和 `layer1_status` （单 SQL 和 两次查询必须得出相同结果）
- 语义映射：新 `decision_semantic` 是否符合预期

同时需关注宏观情况：
1. **`mode_coverage_rate`**：无 Overlay 不行。
2. **`divergence_rate`**：同一股票同一天，三模式如果没有任何不一样，这功能就形同虚设。
3. **`missing_mode_rows`**：监控哪些场景没生成 Mode 而丢失。

### 5.2 性能指标
通过多次 Iteration 平均看：
1. `baseline_query_ms`：纯量化预测基表无关联耗时。
2. `two_step_total_ms`：方案 A 两次查询加合并耗时。
3. `single_sql_total_ms`：方案 B 单条 SQL 关联查询的整体耗时。
4. `delta_ms` & `delta_pct`：主要对比方案 B 对于 Baseline 增加了多大延迟，是否在生产可接受（例如 < 50ms 级别增加）。

## 6. 实验结论预判及后续 Action 链条

本实验的结果将直接左右我们是否、以及如何改版正式 API。

**分支一：若功能满足（有覆盖、有分化）且 单 SQL(Join) 实现在云端明显较快**
- 行动：正式在 API 收口，`/api/predictions` 优先重构为带 Join 的单 SQL。接着可将探索扩展至 `/api/stock/batch` 多表聚合场景中测试可行性。

**分支二：若单 SQL Join 并没有显著比 两次查询更快**
- 问题定性：网络往返 Round Trip 未必是唯一瓶颈，可能是云端表规模缺乏合理复合索引导致全表扫描延迟飙升。
- 行动：暂停向应用层推进改版。转回数据库侧：检查并增加针对 (`symbol`, `decision_date`, `mode_id`) 或者特定联合主键的查询覆盖索引。

**分支三：若方案产生大范围缺失覆盖、甚至各模式根本无信号分化差值**
- 行动：终止工程 API 下沉讨论，这就回退成了数据底座完整性的问题。须拉起算法或定时任务重新补充生成。
