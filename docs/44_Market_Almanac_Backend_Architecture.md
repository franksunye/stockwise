# Market Almanac Backend Architecture (Technical Proposal)

> Status: Technical reference doc for trusted-v1 backend implementation.

## 0. 核心愿景
将枯燥的宏观行情数据通过 **Silent Math (静默数学)** 系统，转化为具备情绪价值和实战指导意义的“投资黄历”。后端作为“翻译官”，需实现从“数字”到“意境”的跨维度映射。

**黄历的“三不”原则**：
1. **不预测具体点位**：摒弃传统的“支撑压力位”算命，只谈大环境风向。
2. **不罗列繁杂数据**：只提取核心的量能（含氧量）和资金流向（洋流）。
3. **提供定性指导**：用具象的“宜/忌”替代含糊的“观望/买入”。

---

## 1. 数据架构 (Database Schema)

在数据库中创建 `market_almanacs` 表，作为每日全局气象的存储中心。

| 字段名            | 类型      | 说明                                  |
| :---------------- | :-------- | :------------------------------------ |
| `target_date`     | Date (PK) | 目标日期（索引）                      |
| `mood_tag`        | String    | 宏观意境词（如：静水深流、百川归海）  |
| `action_strategy` | String    | 今日总纲（宜/忌 文案）                |
| `meteorology`     | String    | 气象类型（如：晨雾、罡风、烈火）      |
| `market_entropy`  | JSONB     | 市场含氧量与热度 (成交额、涨跌家数比) |
| `sector_currents` | JSONB     | 板块洋流 (主向风口 / 逆向退潮)        |
| `ai_insight`      | Text      | 【天机】深度宏观复盘文案              |
| `market_stats`    | JSONB     | 原始数据备份供 AI 推演使用            |

---

## 2. 后端执行流水线 (The Pipeline)

### 第一阶段：数据聚合 (Data Aggregator)
每日固定时点（盘后 15:30 / 盘前 08:30），系统触发任务：
1.  **大盘原始水位**：全市场总成交量能变化（相比5日均线的缩放比）。
2.  **板块洋流 (Sector Currents)**：识别资金聚拢的最强主线（财神方位）与恐慌撤退的板块（煞气所在）。
3.  **市场熵值 (Market Entropy)**：统计全市场赚钱效应（上涨/下跌家数比）及连板高度，转化为 0-100% 的“市场温度”。
4.  **全球情绪锚点 (Nasdaq Correlation)**：拉取隔夜美股（纳指）表现。若涨跌幅超过阈值（如 ±1.2%），将自动触发“情绪对冲”或“共振增强”文案。

### 第二阶段：AI 语义降维 (AI Metaphor Engine)
通过 LLM 将数据“叙事化”：
*   **输入**：聚合后的 JSON 数据。
*   **Prompt 约束**：
    *   参考 `docs/43_Silent_Math_Visual_Gamification.md` 中的语义映射表。
    *   强制输出指定格式：`意境词 | 宜忌 | 气象隐喻 | 深度洞察`。
*   **逻辑校验**：若 AI 输出超出预定义的“意境库”，则自动 Fallback 到基于成交量的确定性规则。

### 第三阶段：持久化与分发
1.  数据存入 `market_almanacs`。
2.  **API 挂载**：在 `GET /dashboard` 接口中，将当天的 Almanac 数据注入 Response。
3.  **零号位分发**：前端获取后，将其挂载到 `stocks` 数组的 `index: 0` 位置。

---

## 4. 特殊策略：双相位生成 (Two-Phase Generation)

为了确保 Nasdaq 数据的时效性，系统采用“初稿-修正”的两步走策略：

1.  **T+1 初稿 (16:00 CST)**：当 A 股收盘且 AI 预测生成后，立即基于**纯 A 股内能**生成初稿黄历。此时 Nasdaq 数据可能是旧的。
2.  **今日修正 (08:30 CST)**：在 A 股开盘前的 Daily Morning Call 阶段，重新触发生成器。此时美股已收盘，系统捕捉**隔夜纳指终值**，对黄历的气象文案（Meteorology）和深度洞察（AI Insight）进行动态修正，最终定稿并推送。

---

## 5. 下一步开发计划 (Next Steps)
1.  [ ] 在 Supabase 中完成表结构迁移。
2.  [ ] 编写 `market_context_summarizer` 的 Prompt 逻辑。
3.  [ ] 开发板块资金流向的统计脚本。
4.  [ ] 对接前端 `MarketAlmanacFeed` 组件。

---
**代号**: Project Muse (Market Core)
**日期**: 2026-02-23

---

## 6. Trusted v1 Finalized Architecture (2026-03-03)
### 6.1 Decision
Under free-source constraints, we adopt a minimal two-layer architecture:
1. Fact Layer
- Responsible for ingest, cleaning, persistence, and quality gate.
- Produces one authoritative daily snapshot.
2. Semantic Layer
- Reads only Fact Layer output.
- Generates `mood_tag/action_strategy/meteorology/ai_insight` with deterministic rules.
- LLM (optional) is only for wording polish, not fact judgment.

Release policy:
- One post-market finalization per day.
- If quality gate fails, publish degraded almanac instead of normal tone.

### 6.2 New Authoritative Table
Add `market_facts_daily` as the only trusted input for almanac generation.

Minimum columns:
- `trade_date` (PK)
- `total_turnover`, `turnover_ma5`, `turnover_ma20`, `turnover_ratio_5d`
- `advancers`, `decliners`, `breadth_ratio`
- `limit_up_count`, `limit_down_count`, `blowup_rate`
- `idx_sse_chg_1d`, `idx_sse_slope_5d`, `idx_sse_slope_20d`
- `idx_szse_chg_1d`, `idx_cyb_chg_1d`
- `northbound_net`, `northbound_dir_3d`
- `sector_inflow_top`, `sector_outflow_top`, `sector_dir_3d`
- `quality_json`, `lineage_json`, `created_at`

### 6.3 Trusted v1 Pipeline
1. `facts_ingest_job` (new)
- Runs post-market; writes `market_facts_daily`.
- Covers the first 6 core metrics only.
2. `facts_quality_gate` (new)
- Enforces completeness/dimension/conflict thresholds.
- Writes structured gate result to `quality_json`.
3. `almanac_generate_job` (refactor existing)
- Reads Fact Layer only.
- If gate fails, outputs degraded almanac.
4. `dashboard_read_path` (existing)
- Continues reading `market_almanacs`.
- Adds user-visible degraded hint.

### 6.4 Minimal Execution Sequence
1. Add `market_facts_daily` table and indexes.
2. Implement `facts_ingest_job` for first 6 core metrics.
3. Implement `facts_quality_gate`.
4. Refactor almanac generator to read Fact Layer only.
5. Add degraded state hint in frontend card.
6. Run 7-day shadow validation before full rollout.
