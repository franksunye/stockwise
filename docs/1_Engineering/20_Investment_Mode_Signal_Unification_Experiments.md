# 20 Investment Mode Signal Unification Experiments

更新时间：2026-03-23
状态：Draft
定位：在正式改 API 前，通过分阶段实验验证 mode 信号统一方案在数据覆盖面、模型分化能力和数据库查询性能层面是否皆可行。

关联文档：
- `docs/1_Engineering/17_Investment_Mode_API_Signal_Unification_Plan.md`
- `docs/1_Engineering/14_Investment_Mode_Backend_Runbook.md`

---

## 阶段一：信号统一验证实验 (Signal Unification Experiment)
*本部分原为 docs/1_Engineering/20_Investment_Mode_Signal_Unification_Experiment.md*

### 1. 实验目标

在本地环境与线上环境分别做只读技术实验，回答 4 个问题：

1. 当前 `mode_decision_log` 对主展示链路的覆盖率够不够。
2. 三个核心模式是否真的能对同一批股票产生差异。
3. 若 API 收口到 mode overlay，查询延迟会增加多少。
4. 哪些边界情况会导致方案不完整：
   - mode 决策缺失
   - 日期对不上
   - 原始信号与 mode 信号冲突

### 2. 实验原则

1. 本实验只读，不写数据库。
2. 不改现有生产 API。
3. 本地和线上都要跑：
   - 本地用于快速调试查询与 merge 逻辑
   - 线上用于验证真实覆盖率与真实延迟
4. 优先验证事实，不先凭感觉拍板。

### 3. 样本设计

#### 3.1 第一优先级样本
优先从真实 PRO 用户 watchlist 抽样，因为这是最接近真实展示链路的数据。

#### 3.2 样本入口
实验脚本支持两种入口：
1. 直接指定用户：`--user-id <USER_ID>`
2. 直接指定股票列表：`--symbols 00700,02171,600519`
若未传 `--symbols`，则优先按 `--user-id` 对应的 watchlist 抽样。

#### 3.3 建议样本规模
建议至少跑三组：
1. 10 只股票
2. 30 只股票
3. 50 只股票

并分别测试：
1. `history-limit=7`
2. `history-limit=15`
3. `history-limit=30`

### 4. 指标定义

#### 4.1 正确性指标
1. `prediction_rows`：本次样本中原始 primary prediction 总数
2. `mode_coverage_rate`：每个 mode 下，能在 `mode_decision_log` 命中的比例
3. `divergence_rate`：同一 `symbol + decision_date` 下，三核心模式是否给出不同语义
4. `balanced_raw_conflict_rate`：`balanced_v1` 对原始 `ai_predictions_v2.signal` 的冲突比例
5. `missing_mode_rows`：哪些 `symbol + decision_date` 缺少 mode 决策

#### 4.2 性能指标
1. `baseline_query_ms`：当前仅查 prediction 主链路的耗时
2. `overlay_lookup_ms`：新增 mode 批量查询耗时
3. `merge_ms`：API 层内存 merge 耗时
4. `overlay_total_ms`：baseline + overlay lookup + merge 的总耗时
5. `overlay_overhead_ms`：与 baseline 相比增加的绝对耗时
6. `overlay_overhead_pct`：与 baseline 相比增加的百分比

### 5. 实验方法

#### 5.1 Baseline
模拟当前主链路的关键部分：
1. 读取样本 symbols
2. 读取 `ai_predictions_v2` 中 primary predictions
3. 取最近 N 个交易日记录

#### 5.2 Overlay 候选实现
在 Baseline 结果上：
1. 提取 `symbol + decision_date`
2. 批量查询 `mode_decision_log`
3. 在内存中做 mode overlay
本实验不改接口，只模拟 API 收口后的数据层行为。

### 6. 判定标准

#### 6.1 方案可推进的最低条件
至少满足：
1. `mode_coverage_rate` 足够高
2. 三核心模式在真实样本上存在可见分化
3. `overlay_overhead_ms` 在可接受范围内
4. 缺口集中在可解释的少数边界，不是系统性缺失

#### 6.2 需要回头补设计的情况
若出现以下情况，则不能直接推进 API 收口：
1. `mode_decision_log` 覆盖率明显不足
2. mode 决策日期与 prediction 日期系统性错位
3. 三模式实际几乎不分化
4. overlay 查询在云库上显著拖慢主链路

### 7. 本地与线上执行建议

#### 7.1 本地
示例：
```bash
DB_SOURCE=local python backend/scripts/experiment_mode_signal_unification.py --user-id <USER_ID> --history-limit 15 --iterations 5
```

#### 7.2 线上
示例：
```bash
DB_SOURCE=cloud python backend/scripts/experiment_mode_signal_unification.py --user-id <USER_ID> --history-limit 15 --iterations 5
```

#### 7.3 手工指定股票
```bash
DB_SOURCE=cloud python backend/scripts/experiment_mode_signal_unification.py --symbols 00700,02171,600519 --history-limit 15 --iterations 5
```

### 8. 预期输出
脚本输出应包含：
1. 当前环境：`DB_SOURCE`、样本 symbols 数
2. 正确性摘要：各 mode 覆盖率、分化率、与原始信号冲突率
3. 性能摘要：baseline、overlay lookup、merge、total
4. Top 样例：模式分化样例、缺失样例、冲突样例

### 9. 实验后的决策
实验完成后再决定三件事：
1. 是否按 `17_Investment_Mode_API_Signal_Unification_Plan` 直接推进 API 收口
2. 是否需要先补索引或修 mode 产数完整性
3. 是否需要分阶段 rollout：先 `stock/batch`，再 `predictions`

### 10. 阶段一结论
当前不直接改 API 的原因不是方案逻辑不成立，而是先用真实数据验证以下关键假设：
1. `mode_decision_log` 的覆盖率足够支撑前端主展示
2. 三模式在真实样本上确实有差异
3. API 层新增一次批量 mode lookup 的性能代价可接受

---

## 阶段二：单 SQL 收口实验 (Single SQL Experiment)
*本部分原为 docs/1_Engineering/21_Investment_Mode_Single_SQL_Experiment.md*

### 1. 背景
第一阶段实验已经确认两件事：
1. 功能上，mode overlay 是必要的。
2. 性能上，在云端采用“两次独立查询 + merge”会显著增加总耗时。

因此第二阶段不再讨论“要不要做 overlay”，而是验证：
**能否通过单 SQL join/CTE 的方式，把 mode overlay 收口到一次数据库查询中。**

### 2. 实验问题
本轮只回答两个问题：
1. 单 SQL 结果是否与“两次查询 + merge”结果一致。
2. 单 SQL 是否能在云端明显降低额外开销。

### 3. 对比对象

#### 3.1 方案 A：两次查询 + merge
步骤：
1. 先查 `ai_predictions_v2` primary predictions
2. 再查 `mode_decision_log`
3. 在应用层 merge / overlay

#### 3.2 方案 B：单 SQL join/CTE
步骤：
1. 在 SQL 内先截取 prediction 基表窗口
2. 直接 `LEFT JOIN mode_decision_log`
3. 在 SQL 内完成 overlay 字段映射

### 4. 本轮范围
为减少变量，本轮优先验证接近 `/api/predictions` 的查询形态：
1. 输入：一组 symbols、`history_limit`、单个 `mode_id`
2. 输出：原始 prediction 字段、overlay 后 `signal`、overlay 后 `layer1_status`

暂不直接模拟 `stock/batch` 的完整多表查询。
原因：
1. 先把核心 overlay 形态验证清楚。
2. 避免把 `daily_prices`、short metrics、almanac 等变量混进来。
3. 一旦单 SQL 在这里成立，再向 `stock/batch` 扩展。

### 5. 一致性判定
若以下字段逐行一致，则认为 SQL 口径成立：
1. `symbol`
2. `date`
3. `target_date`
4. `signal`
5. `layer1_status`
6. `decision_semantic`
允许保留原始 `confidence` 和 `ai_reasoning`，本轮不做改写。

### 6. 性能判定
重点看：
1. `two_step_total_ms`
2. `single_sql_total_ms`
3. `delta_ms`
4. `delta_pct`
目标不是追求本地最优，而是尽量压低云端 round trip 成本。

### 7. 实验结论使用方式

#### 7.1 若单 SQL 成立且更快
则 API 层推进建议变为：
1. `predictions` 先落单 SQL
2. 再决定 `stock/batch` 是也做单 SQL，还是继续批量 merge

#### 7.2 若单 SQL 成立但不明显更快
说明瓶颈不在查询轮次，而在：
1. Turso 网络层
2. 查询本身扫描成本
3. 索引不足
此时应优先看索引和查询 shape，而不是继续在应用层与 SQL 层之间反复切换。

#### 7.3 若单 SQL 不一致
说明 overlay 规则仍需先统一，不应贸然把逻辑下沉到 SQL。

### 8. 阶段二预期结论
基于第一阶段结果，当前合理预期是：
1. 单 SQL 应能显著降低云端额外开销。
2. merge 本身不是瓶颈，网络 round trip 才是瓶颈。
3. 若单 SQL 不能降低明显延迟，则说明查询结构或索引仍需继续优化。
