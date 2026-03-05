# StockWise 索引风险检查报告

> Date: 2026-03-05
> Scope: `frontend` + `docs/4_Growth_Ops/content`

## 1) 已修复/已具备

- `robots` 路由已存在：`/robots.txt`
- `sitemap` 路由已存在：`/sitemap.xml`
- `support` 动态页已具备服务端可索引结构。
- `learn` / `support` 动态页已接入结构化数据（Article JSON-LD）。

## 2) 风险发现

### P0
- 无重复 slug（检查结果：`none`）。

### P1
- 内容源中存在缺 frontmatter 文件（2 个）：
  - `March_Content_Matrix_Execution_2026.md`
  - `STOCKWISE_101_SYLLABUS.md`
  - 说明：当前在 `learn-content.ts` 中 `STOCKWISE_101_SYLLABUS.md` 已被过滤，但建议在内容规范层标注“非发布文档”。

### P1
- 薄内容候选（<80 词）14 篇，优先扩写与补证据：
  - `101-09_why_smart_people_fail`
  - `101-10_sitting_on_hands`
  - `101-11_hindsight_bias`
  - `101-28_left_right_trading`
  - `101-30_divergence`
  - `101-31_sector_rotation`
  - `101-56_correlation_risk`
  - `101-61_llm_vs_quant`
  - `101-62_hallucination_control`
  - `101-64_eod_vs_intraday`
  - `101-81_case_reversal`
  - `101-82_false_breakout`
  - `101-83_falling_knife`
  - `2026-03-02_quant_thinking`

## 3) 建议动作（Week 2）

1. 给上述薄内容补：
  - `Key Facts`（至少 2 条）
  - `Source Block`（至少 2 条）
  - `Boundary Notice`
2. 明确非发布文档标识：
  - 采用 frontmatter 字段 `publish: false`，并在读取器中过滤。
3. 加入内容发布校验脚本：
  - 缺少 title/date/category/source block 时阻断发布。

