# 17 Investment Mode API Signal Unification Plan

更新时间：2026-03-10  
状态：Draft  
定位：PRO 用户三模式与前端三模型信号统一专项方案

关联文档：
- `docs/1_Engineering/14_Investment_Mode_Backend_Runbook.md`
- `docs/3_Product/Specs/47_Investment_Mode_Product_Layer.md`
- `docs/1_Engineering/archive/19_Investment_Mode_Execution_Alignment_Plan.md`

## 1. 目标

解决当前一个明确的生产问题：

1. PRO 用户已具备多投资模式：
   - `steady_v1`
   - `balanced_v1`
   - `aggressive_v1`
   - `observe_only_v1`
2. 后端 mode 管线已经能为不同模式产出不同决策。
3. 但前端主展示链路仍主要读取 `ai_predictions_v2`，没有把用户当前 `mode_id` 的最终决策完整收口到 Dashboard 与模型视图。

本专项目标不是重做整套前端，而是先让用户可见信号统一收口到 API 层，确保：

1. 同一用户、同一时刻、同一股票，在前端不同入口看到的是同一套 mode-aware 信号。
2. 不同模式的信号必须允许产生真实差异，且差异来自 mode 决策，而不是前端各自做二次判断。

## 2. 当前事实（As-Is）

### 2.1 已经成立的能力

1. 后端 mode 定义已存在：
   - `backend/investment_mode.py`
   - `frontend/src/lib/investment-mode.ts`
2. mode 管线已存在，并能写入：
   - `mode_decision_log`
   - `mode_simulated_trade_ledger`
   - `mode_performance_snapshot`
3. 前端/API 已支持：
   - `/api/user/mode`
   - `/api/modes`
   - `/api/modes/decisions`
   - `/api/modes/performance/*`

### 2.2 当前不一致点

用户主展示链路没有统一读取 mode 决策结果：

1. Dashboard 主卡片：
   - 当前主要通过 `/api/stock/batch`
   - 数据源仍以 `ai_predictions_v2` 为主
2. 详情历史与模型视图：
   - 当前主要通过 `/api/predictions`
   - 数据源仍以 `ai_predictions_v2` 为主
3. 前端展示动作文案主要使用：
   - `layer1_status`
   - 若无则回退 `signal`

因此会出现：

1. mode 管线已经得出差异，但前端主信号仍可能一样。
2. 主卡片、历史卡片、AICouncil 可能各看各的口径。
3. “模式切换只影响后续新预测”的产品边界，与“用户当前实际看见的信号”之间没有被工程化地统一。

## 3. 设计原则

### 3.1 单一解释权

对用户可见的最终动作信号，解释权统一归属于：

- `mode_decision_log`

不是：

- 前端组件本地规则
- 各模型原始 `ai_predictions_v2.signal`
- 不同接口各自拼装的临时判断

### 3.2 保留原始预测底稿

`ai_predictions_v2` 仍保留为：

1. 原始预测底稿
2. 模型身份来源
3. reasoning / tactical content 来源
4. 历史验证与原始模型数据来源

本次不建议直接抛弃 `ai_predictions_v2`，原因是当前前端大量结构仍依赖它。

### 3.3 统一收口位置

本次优先把统一逻辑收口到 API 层，而不是分散到各个 React 组件。

原因：

1. 风险更低。
2. 更容易保持口径一致。
3. 便于做性能观测与回滚。
4. 可以复用现有前端 `AIPrediction` 数据结构，减少页面级改造面。

## 4. 目标口径（To-Be）

### 4.1 最终动作信号来源

用户侧最终动作信号定义为：

`当前用户 mode_id 下，对应 symbol + decision_date 的 mode_decision_log 结果`

### 4.2 原始内容来源

原始内容继续来自 `ai_predictions_v2`：

1. `ai_reasoning`
2. `confidence`
3. `model`
4. `display_name`
5. 技术指标快照
6. 历史验证字段

### 4.3 API 返回策略

API 返回时采用“overlay”模式：

1. 先查原始 prediction 数据。
2. 再按当前用户 `mode_id` 批量查 `mode_decision_log`。
3. 将最终动作字段覆盖回 prediction 对象。

覆盖字段限定为：

1. `signal`
2. `layer1_status`
3. 可选：`ai_reasoning` 前缀或新增 mode 元信息字段

不覆盖字段：

1. `model`
2. `display_name`
3. `validation_status`
4. `actual_change`
5. 技术指标字段
6. 原始 LLM / 规则推理主体

## 5. 四语义映射

统一使用已有四语义：

1. `建议进场`
2. `建议观察`
3. `建议防守`
4. `暂无信号`

映射建议：

| mode_decision_log.decision_semantic | overlay signal | overlay layer1_status |
|---|---|---|
| 建议进场 | `Long` | `TriggeredLong` |
| 建议观察 | `Side` | `Watch` |
| 建议防守 | `Short` | `RiskOff` |
| 暂无信号 | `Side` | `NoSetup` |

说明：

1. 该映射用于兼容当前前端 `getPredictionActionMeta()`。
2. `暂无信号` 当前仍映射为 `signal=Side`，但通过 `layer1_status=NoSetup` 与“建议观察”区分。

## 6. 推荐实现方案

### 6.1 采用批量查询 + 内存 merge

本次不建议做“逐条补查”，也不建议第一步就把查询写成超复杂大 SQL。

推荐流程：

1. 按现有接口逻辑查出 prediction 主体数据。
2. 从结果中提取本次需要的 key 集合：
   - `mode_id`
   - `symbol`
   - `decision_date`
3. 再批量查询 `mode_decision_log`。
4. 在 API 层内存中按 key 做 merge / overlay。

### 6.2 原因

这样做的优点：

1. 能最大程度复用现有接口与前端结构。
2. 能避免 N+1 查询。
3. SQL 更稳定，便于调试。
4. 若需要回滚，逻辑边界清晰。

### 6.3 为什么不优先做单 SQL 大 join

当前阶段不建议先做大 join，原因是：

1. `/api/stock/batch` 已经承担较多聚合逻辑。
2. 先把 mode overlay 命中率与延迟观测出来更重要。
3. 若未来确认热点瓶颈，再考虑把查询进一步合并到 SQL 层。

## 7. 性能判断

### 7.1 当前担心是合理的

从“一张表读”变成“原始 prediction 表 + mode 决策表聚合”，确实有潜在性能风险。

这个担心是对的，但风险核心不是“多了一张表”，而是“查询形状是否错误”。

### 7.2 真正需要避免的风险

最需要避免的是：

1. 对每只股票逐条补查 `mode_decision_log`
2. 对每条历史 prediction 逐条补查 `mode_decision_log`
3. 没有索引导致全表扫

### 7.3 当前场景下为何可控

当前业务有几个天然边界：

1. watchlist 单次最多 50 个 symbol
2. Dashboard 主展示只看有限历史窗口
3. 每个用户同一时刻只激活一个 `mode_id`
4. `mode_decision_log` 是模式裁决结果表，数据宽度和查询边界都比原始 prediction 更可控

因此，若采用批量查询 + 内存 merge，性能通常可控。

### 7.4 最小性能纪律

本专项实现必须满足：

1. 不允许逐条补查
2. 不允许在 React 组件层重复查 mode 结果
3. mode overlay 查询必须是批量查询
4. 必须给 `mode_decision_log` 提供适配索引

## 8. 推荐索引

当前 `mode_decision_log` 已有唯一索引：

- `(mode_id, symbol, decision_date, strategy_version)`

若 API 主读取路径确认高频使用 `mode_id + symbol + decision_date`，建议确认或补充：

1. `idx_mode_decision_lookup`
   - `(mode_id, symbol, decision_date)`
2. 若存在按日期范围回看历史：
   - `(mode_id, decision_date DESC, symbol)`

是否补第二个索引，应基于线上 query pattern 决定，不应先过度建索引。

## 9. API 改造范围

### 9.1 第一优先级

1. `frontend/src/app/api/stock/batch/route.ts`
   - 影响 Dashboard 主卡片与首屏历史
2. `frontend/src/app/api/predictions/route.ts`
   - 影响详情历史与 AICouncil

### 9.2 改造方式

两个接口都保持原响应结构，避免大面积前端改动。

改造内容仅增加：

1. 读取当前用户 `mode_id`
2. 批量查 `mode_decision_log`
3. 对 `signal/layer1_status` 做 overlay
4. 可选附带 `mode_id`、`decision_semantic` 供调试或后续 UI 使用

## 10. 页面影响面

完成上述 API 收口后，将直接统一以下入口：

1. Dashboard 主卡片
2. HistoricalCard 历史卡片
3. TacticalBriefDrawer 内的 AICouncil
4. 通过 `/api/predictions` 读取历史或模型列表的视图

本次不要求同步重做 UI 文案，只要求先统一数据口径。

## 11. 分阶段落地

### Phase 1：API 收口

目标：

1. `stock/batch`
2. `predictions`

按当前用户 mode 做 overlay，前端结构保持不变。

验收：

1. 同一股票在主卡片、历史卡片、AICouncil 上信号一致。
2. 切换 `steady / balanced / aggressive` 后，前端主信号允许出现真实差异。

### Phase 2：可观测

目标：

1. 记录 API overlay 命中率
2. 记录 overlay 前后延迟变化
3. 观察模式切换后的用户感知是否稳定

建议观测项：

1. `mode_overlay_rows_requested`
2. `mode_overlay_rows_hit`
3. `mode_overlay_hit_rate`
4. `stock_batch_query_ms`
5. `predictions_query_ms`

### Phase 3：结构优化

若 Phase 2 观察到性能压力，再决定是否：

1. 下沉为单 SQL join
2. 增加更精确索引
3. 加接口层短缓存

本阶段不应预先过度设计。

## 12. 不建议做的事

本轮不建议：

1. 在每个前端组件里自行读取 `/api/user/mode` 再本地改信号
2. 让三模型各自独立产出 mode-aware 信号
3. 直接弃用 `ai_predictions_v2`
4. 在第一步就把所有历史、模型、模式完全改成新对象结构

原因：

1. 风险大
2. 回滚困难
3. 容易把“模式决策”与“原始模型预测”彻底混淆

## 13. 最终决策建议

基于当前仓库现状，最合理方案是：

1. 保留 `ai_predictions_v2` 作为原始预测与内容底稿
2. 保留 `mode_decision_log` 作为用户最终动作信号来源
3. 在 API 层做批量查询 + 内存 merge
4. 先统一主展示入口，再根据观测决定是否进一步优化查询形态

这条路径能在最小改动面下，先解决“信号不统一”和“模式差异无法真实透出”的核心问题。
