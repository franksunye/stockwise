# Market Almanac Backend Architecture (Technical Proposal)

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
每日固定时点（盘后 15:30 / 盘前 09:00），系统触发任务：
1.  **大盘原始水位**：全市场总成交量能变化（相比5日均线的缩放比）。
2.  **板块洋流 (Sector Currents)**：识别资金聚拢的最强主线（财神方位）与恐慌撤退的板块（煞气所在）。
3.  **市场熵值 (Market Entropy)**：统计全市场赚钱效应（上涨/下跌家数比）及连板高度，转化为 0-100% 的“市场温度”。
4.  **外围环境 (Global Context)**：拉取隔夜美股（纳指）表现作为开盘情绪传染基调。

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

## 3. 技术挑战与对策 (Industrial Reliability)

*   **性能保证**：采用异步预生成机制。用户打开 App 时，数据已在缓存中，实现“秒开”。
*   **数据一致性**：使用统一的 HK Time 日期判定逻辑，确保全球用户看的是同一个“今日气象”。
*   **容错设计**：如果数据源失效（如 API 熔断），展示预设的“市场迷雾 · 观测中”作为安全占位。

---

## 4. 下一步开发计划 (Next Steps)
1.  [ ] 在 Supabase 中完成表结构迁移。
2.  [ ] 编写 `market_context_summarizer` 的 Prompt 逻辑。
3.  [ ] 开发板块资金流向的统计脚本。
4.  [ ] 对接前端 `MarketAlmanacFeed` 组件。

---
**代号**: Project Muse (Market Core)
**日期**: 2026-02-23
