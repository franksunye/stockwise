## 1. Purpose

本说明文档定义 StockWise 当前前后端数据层的**两类更新频率**与对应 API 边界，为后续拆分 `batch` 接口（方案 A）与优化价格刷新策略提供统一的工程语言与约束。

目标：

- 统一团队对「日更决策视图」与「盘中价量快照」的认知；
- 明确哪些接口负责哪一层数据；
- 明确哪些接口**不得**用于高频轮询，避免 `ai_reasoning` 这类日级重 payload 被误用在 10–15 分钟刷新场景。

---

## 2. Data Layers Overview

从时间维度看，当前系统的关键数据可以分成两层：

- **Layer A — 日更决策层 (Daily Decisions / Facts)**  
  - Almanac（投资黄历）  
  - Dashboard 批量预测结果（含 `ai_reasoning` 与 `TacticalData`）  
  - 投研决议（顾问席 / 决议摘要）  
  - Investment Mode 表现与决策日志（`mode_performance_snapshot` / `mode_decision_log`）  
  - 用户模式选择与配置（`user_investment_mode`）  
  - 其它典型“收盘后才变化”的投研结论  
  - **更新节奏**：按交易日滚动，盘中不回溯历史结论。

- **Layer B — 盘中价量快照层 (Intraday Price Snapshot)**  
  - `daily_prices` 中的当日价格（open/high/low/close/涨跌）  
  - `getCachedLatestPrices` 汇总的最新价快照  
  - `ShortMetrics` 中的港股沽空、仓位等短期指标  
  - **更新节奏**：交易时段内大约每 10–15 分钟刷新一次（但仍属于快照，而非逐笔行情）。

未来所有 API 设计与调用策略应首先确定：  
**要解决的问题属于 A 还是 B？**  
然后选择对应 API 家族与刷新机制。

---

## 3. API Families and Responsibilities

### 3.1 决策视图 API 家族（服务 Layer A）

主要接口：

- `GET /api/stock/batch`
  - 作用：Dashboard 主链路批量拉取每只股票的「最新预测 + 上一条预测 + 历史预测队列」，用于：
    - 首屏卡片信息  
    - 策略内参（Tactical Brief）的数据源  
  - 关键字段：
    - `prediction.ai_reasoning` / `llm_reasoning`：用于生成战术视图 / 投研解释  
    - `signal / canonical_signal / llm_signal / layer1_status / decision_semantic`：多层信号语义  
    - `history`：过去若干日的预测轨迹  
    - `shortMetrics`：港股沽空、仓位快照（按日）
  - 更新节奏：按交易日（或显式刷新）使用，不作为 10–15 分钟轮询接口。

- `GET /api/predictions`
  - 作用：按 symbol + targetDate 拉取「全量顾问席/模型视角」预测列表，驱动投研决议（`AICouncil`）。
  - 特点：包含比 `/api/stock/batch` 更完整的 reasoning、模型维度与冲突信息。

- `GET /api/modes/*`
  - `GET /api/modes` / `GET /api/user/mode/summary`：投资模式目录与当前模式摘要。
  - `GET /api/modes/performance*`：模式表现快照。
  - `GET /api/modes/decisions`：模式决策日志（基于 `mode_decision_log`）。

- 其他 `api/user/*` 与 Almanac 相关接口  
  - 如 `/api/shared/almanac` 等，均属于「日更决策」范畴。

**职责总结**：

- 提供**日级稳定的投研视图**（预测、战术、模式、决议）。  
- 适合：
  - 首屏加载；
  - 用户手动“刷新决策/刷新列表”；
  - 新交易日切换。
- **不适合**：
  - 盘中 10–15 分钟轮询行情。  
  - 单纯为了价格变化而高频调用。

### 3.2 价格视图 API 家族（服务 Layer B）

当前状态：

- 价格底层已经被隔离到：
  - `lib/stock-cache.ts` 中的 `getCachedLatestPrices`；
  - `daily_prices` 表；
  - 批量接口中通过：
    - `latestPrices = getCachedLatestPrices(...)`  
    - `LEFT JOIN daily_prices dp ...`  
    来为每只股票补上价格。

规划中的 API 角色（尚未拆出独立接口，但应按此方向收敛）：

- 未来的 `GET /api/stock/prices?symbols=...`（示例命名）
  - 作用：只返回价格与必要涨跌字段，例如：
    - `close / change_percent / lastUpdatedTag` 等；
  - 特点：
    - 负载极轻；
    - 可安全用于 10–15 分钟刷新；
    - 不携带 `ai_reasoning`、战术数据、投研决议等重字段。

**职责总结**：

- 提供盘中「快照行情」，与投研结论分层。
- 是唯一允许被设计为「高频轮询」的家族。  
- 即使未来有更细颗粒度的行情，也应挂在这一家族，而不是复用 batch。

---

## 4. Current Misalignment and Risk Points

### 4.1 `/api/stock/batch` 的混合负载风险

当前 `/api/stock/batch` 同时携带：

- A 类：日更决策 payload：
  - `prediction.ai_reasoning` + `llm_reasoning` + `TacticalData` 解析基础；
  - 模型/模式相关决策字段。
- B 类：价量快照：
  - `price`（来自 `getCachedLatestPrices`）；
  - `close_price`（来自 `daily_prices`）。

如果前端把 `/api/stock/batch` 当成「价格刷新接口」每 10–15 分钟调用一次，将导致：

- **网络浪费**：反复传输不变的 `ai_reasoning` / 历史预测等大字段；
- **服务端资源浪费**：即便 DB 命中缓存，仍有序列化、网络传输、函数执行成本；
- **心智负担**：调用方难以区分「刷新价格」与「刷新决策」，未来要升级任一侧都增加成本。

### 4.2 投研视图的本地快照与刷新节奏

当前我们已经为多个决策视图实现了本地快照：

- Dashboard 列表 / 投资黄历 / 策略内参：`localStorage` + 入口 bootstrap。  
- 投研决议（AICouncil）：`sessionStorage` + SWR fallback。

这说明「日更决策」在客户端已经有清晰的快照语义，不需要依赖高频接口刷新。问题集中在 **batch 同时承载两种节奏**，而调用方一旦误用，就会放大浪费。

---

## 5. Guardrails and Guidelines

### 5.1 接口职责约束

1. **禁止使用 `/api/stock/batch` 作为价格轮询接口。**
   - 任何「每 10–15 分钟刷新一次价格」的需求，都必须走专门的价格视图 API（未来的 `/api/stock/prices` 系列）。

2. **决策视图 API 只用于：**
   - 首屏加载；
   - 用户显式「刷新决策/刷新列表」操作；
   - 新交易日切换；
   - 调试/内部工具需要一次性审视决策状态。

3. **价格视图 API 只返回：**
   - 必需的价格/涨跌/更新时间字段；
   - 不返回 `ai_reasoning`、战术数据、模式表现等决策 payload。

### 5.2 前端调用侧约束

1. 任何定时器/轮询逻辑在落地前，必须回答：
   - 这是为了「价格/短期指标刷新」还是「决策/结论重拉」？
2. 若答案是「价格/短期指标」：
   - 使用价格视图 API；
   - 不允许调用 `/api/stock/batch` / `/api/predictions` / `/api/modes/*`。
3. 若答案是「决策/结论重拉」：
   - 调用前优先检查本地快照是否足够新；
   - 只在跨交易日或用户显式刷新时重拉；
   - 不得用固定时间间隔轮询来代替「跨日判断」。

---

## 6. Path to Plan A (API Split) — Design Only

本节只定义拆分方向，不要求立即编码实现。

### 6.1 拆分目标

1. 定义并实现独立的价格视图 API（例如 `GET /api/stock/prices?symbols=...`）。  
2. 逐步将所有「高频刷新价格」的前端调用迁移到价格视图 API。  
3. 审查 `/api/stock/batch` 调用点，确保其只在「首屏/跨日/显式刷新」等场景出现。  
4. 若必要，可以为 `/api/stock/batch` 增加一个明确的 `include_reasoning` 开关，默认关闭，用于进一步优化带宽。

### 6.2 Implementation Order (Recommended)

1. **文档阶段**（本文件 + 相关 specs）  
   - 明确 A / B 层含义与各自 API 家族；
   - 记录禁止用 batch 轮询的约束。

2. **价格 API 原型**  
   - 简单实现 `/api/stock/prices?symbols=...`，只返回价格 + 涨跌 + 更新时间；
   - 内部/灰度使用，验证前端对它的适配成本。

3. **前端调用迁移**  
   - 从最明显的候选场景开始（如 Dashboard 底部“最近价/涨跌”刷新），替换为价格 API；
   - 确认不再有定时器针对 `/api/stock/batch`。

4. **batch 优化（可选）**  
   - 只有在确认前端不再对 batch 做高频调用后，才考虑：
     - 增加 `include_reasoning` 等开关；
     - 或将 `ai_reasoning` 按需拆到更专门的决策 API。

---

## 7. Summary

- 当前系统自然分为两层：
  - **日更决策层 (Layer A)**：黄历、预测、`ai_reasoning`、模式表现与决议，按交易日更新；  
  - **盘中价量快照层 (Layer B)**：价格、短期指标，每 10–15 分钟更新一次。
- `/api/stock/batch` 目前混合了承载 A + B 两类数据，若被当作价格轮询接口，会导致 `ai_reasoning` 等重 payload 被频繁拉取，浪费带宽与算力。
- 本文件定义的工程共识是：
  - **决策视图 API**（batch / modes / predictions）只服务日级决策视图；
  - **价格视图 API** 专门服务盘中价量刷新；
  - 任何高频刷新场景必须走价格视图家族，而不是复用 batch。

这为后续实施方案 A（拆出独立价格 API、收紧 batch 角色）提供了统一的设计基线。我们应在新功能与重构中逐步对齐到本约束。 

---

## 8. Implementation Status (2026-03-16)

截至 2026-03-16，本文件描述的拆分方案已部分落地：

- **价格视图 API 已实现**：
  - `GET /api/stock/prices?symbols=...`
    - 返回：`symbol / date / close / change_percent / lastUpdated` 等轻量字段；
    - 用途：供 Dashboard / 自选池等前端以 10 分钟级频率刷新价格快照。

- **Dashboard 已完成首轮前端迁移**：
  - 决策层（预测 / 战术 / 决议）：继续通过 `GET /api/stock/batch` 拉取，刷新频率降低为按需（首屏、回前台、显式刷新、低频定时）。
  - 价格层：通过 `GET /api/stock/prices` 按 watchlist 的 symbol 列表每 10 分钟刷新一次，仅更新 `price.close / price.change_percent / lastUpdated`。

- **后续迁移范围**：
  - 其他需要盘中价格刷新的前端页面（如二级详情页）应逐步改用 `/api/stock/prices`，避免新增依赖 `/api/stock/batch` 做高频轮询。

---

## 9. Per-Symbol Tier/Mode 报告的 ISR 方案（Future Option）

本节只作为未来可选方案记录当前共识，**不要求立即实现**。

### 9.1 Page Key 抽象：有限的视图矩阵

从「单只股票视图」的角度，我们可以将页面空间抽象为一个有限矩阵：

- 维度 1：用户层级（Tier）
  - Free
  - PRO
- 维度 2：投资模式（Mode）
  - Free：固定 1 种「默认模式」/ 无模式
  - PRO：若干种模式（例如 3 种）
- 维度 3：页面类型（Page Kind）
  - 基础档案 / 总览页（symbol 维度）
  - 每个模式下的模式视角页（symbol + mode 维度）

综合起来，对于某一只股票 `symbol`：

- Free 用户：通常只有 1 个视图（默认模式）；
- PRO 用户：可能有「基础总览 + N 个模式视角」，例如 4 个页面。

因此可以定义统一的 Page Key：

```text
PageKey = (symbol, tier, mode?)
```

在给定交易日内，对于相同的 `(symbol, tier, mode)`：

- 投研结论 / 黄历摘要 / 模式视角在逻辑上应保持一致；
- 差异主要体现在：
  - 用户是否有权限访问该 PageKey；
  - 用户当前是否已解锁该模式。

这类 PageKey 更接近「公共事实视图」，适合用作 ISR / Origin Cache 的自然边界。

### 9.2 ISR 策略：Per-PageKey 报告，而非 Batch

基于上述 PageKey 抽象，推荐的未来 ISR 策略是：

- **对每个 PageKey 使用 ISR**：
  - 例如：
    - `/pro/stocks/[symbol]/overview` → `(symbol, PRO, default)`；
    - `/pro/stocks/[symbol]/modes/[modeId]` → `(symbol, PRO, modeId)`；
    - `/free/stocks/[symbol]` → `(symbol, FREE, default)`。
  - 为每个 `(symbol, tier, mode)` 组合预生成一份「报告页面」或「报告数据」：
    - 使用 `revalidate`（如 1 天 / 1 交易日）；
    - 内部可继续使用 `unstable_cache` / DB 视图来拼装事实层。

- **Batch/Dashboard 不做 ISR，只做聚合**：
  - `/api/stock/batch` 保持为：
    - 「按用户 watchlist + 当前 mode 聚合多个 PageKey 的摘要」；
    - 只负责组合、排序、过滤，不做全包级别的 ISR。
  - Batch 内部应优先消费：
    - 已经通过 ISR / `unstable_cache` 预备好的 per-symbol / per-mode 事实；
    - 避免在 Batch 层面引入新的「跨用户共享缓存」语义。

### 9.3 边界与注意事项

- **共享 vs. 权限**
  - PageKey 视图可以在 Origin 上跨用户共享缓存（同 tier / mode），
    但访问控制仍由：
    - 路由保护（仅 PRO 可访问 PRO PageKey）；
    - 页面加载时的用户态校验（当前用户是否解锁该模式）来保证。

- **Batch 仍保持用户态聚合职责**
  - 即便 PageKey 报告被 ISR 化，Dashboard：
    - 仍然是 per-user 的 watchlist 聚合；
    - 仍然需要根据当前 mode/tier 做 overlay；
    - 不应被误用为整个系统的 ISR 粒度。

- **实现时机**
  - 只有当「股票详情页 / 模式视角页」进入实质性开发阶段时，才需要将本节转化为具体 API & 路由设计；
  - 在那之前，本节仅作为团队在「是否给 Batch 上 ISR」问题上的工程共识参考：
    - **优先给 per-symbol × tier × mode 的报告页做 ISR**；
    - **不要给当前形态的 `/api/stock/batch` 整包做 ISR**。

