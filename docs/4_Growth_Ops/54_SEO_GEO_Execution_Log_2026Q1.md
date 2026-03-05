# StockWise 中文 SEO/GEO 执行日志（2026 Q1）

> Owner: Codex + Frank
> Sprint: 4 周冲刺（启动日 2026-03-05）
> Status: In Progress

## 2026-03-05（Day 1）

### 已完成
- 建立品牌内容中心：`frontend/src/content/brand-core.zh-CN.ts`
  - 统一定位、价值主张、核心功能、边界声明、默认来源。
- 建立 SEO 模块：`frontend/src/lib/seo.ts`
  - 统一 canonical URL 与页面 metadata 生成函数。
- 建立 GEO 模块：`frontend/src/lib/geo.ts`
  - 提供 Article/FAQ JSON-LD 生成函数。
- 建立 GEO 组件：`frontend/src/components/seo/GeoBlocks.tsx`
  - `TL;DR/来源块/边界声明/更新时间` 可复用渲染块。
- 首页全局 metadata 接入品牌中心：`frontend/src/app/layout.tsx`
- 公开页面 metadata 模块化接入：
  - `about/pricing/privacy/terms/refund/status/support` 路由 `layout.tsx`
- 补齐抓取入口：
  - `frontend/src/app/robots.ts`
  - `frontend/src/app/sitemap.ts`
    - 包含静态路由 + `learn` 动态页 + `support` 动态页
- `support` 详情页改为服务端可索引：
  - `frontend/src/app/support/[slug]/page.tsx`
  - 加入 JSON-LD、来源块、更新时间、边界声明。
- `learn` 详情页补 GEO 结构块：
  - `frontend/src/app/learn/[slug]/page.tsx`
  - 加入 JSON-LD、来源块、更新时间、边界声明。
- 支持中心内容索引能力补齐：
  - `frontend/src/lib/support-content.ts` 新增 `getAllSupportArticles()`
- 本地验证通过：
  - `npm run lint`（0 error，历史 warning 保留）
  - `npm run build`（通过，`/robots.txt` 与 `/sitemap.xml` 路由已生成）
- Week 1 文档交付：
  - `docs/4_Growth_Ops/SEO_GEO_Keyword_Map_zh.md`（首批 20 页样板）
  - `docs/4_Growth_Ops/SEO_GEO_Source_Block_Standard.md`（来源块标准）
  - `docs/4_Growth_Ops/SEO_GEO_Index_Risk_Report_2026-03-05.md`（索引风险检查）
  - `docs/4_Growth_Ops/SEO_GEO_20_Page_Retrofit_Plan.md`（Week 2 逐页排期）
- 风险项落地修复：
  - `frontend/src/lib/learn-content.ts` 增加发布门槛过滤（缺 title/date/category 或 `publish:false` 不进入公开索引）
- 二次验证通过：
  - `npm run build`（通过，静态页数量从 136 调整为 135，符合非发布内容过滤预期）
- Day 1 页面改造已开始：
  - `frontend/src/app/page.tsx` 接入 `GeoSummary + SourceBlock + BoundaryNotice`
  - `frontend/src/app/pricing/page.tsx` 接入 `GeoSummary + SourceBlock + BoundaryNotice`
- 三次验证通过：
  - `npm run build`（通过，新增 GEO 块后无类型回归）
- Day 2 页面改造推进：
  - `frontend/src/app/support/[slug]/page.tsx` 增加核心机制页 `TL;DR`（5 个高优先 slug）
  - 增加 support 详情页“相关推荐”内链块（同类目 3 篇）
  - `SourceBlock` 支持 `claimScope` 字段，来源口径可读性增强
  - `frontend/src/components/seo/GeoBlocks.tsx` 更新来源块渲染逻辑
- 四次验证通过：
  - `npm run build`（通过，新增 TL;DR 与相关推荐后无类型回归）
- Day 3 页面改造推进：
  - `frontend/src/app/learn/[slug]/page.tsx` 增加核心样板页 `TL;DR`（5 个高优先 slug）
  - learn 与 support 的 GEO 结构对齐（摘要 + 来源 + 时间 + 边界）
- 五次验证通过：
  - `npm run build`（通过，learn 页面扩展后无类型回归）
- Day 4 页面改造推进：
  - `frontend/src/app/support/[slug]/page.tsx` 补齐剩余样板页 `TL;DR`（含 key-levels/context/signal-flip/realtime/on-demand/tiers）
  - 新增跨栏目内链块“相关学习页”（support -> learn）
  - 形成同类推荐 + 跨类推荐双内链结构
- 六次验证通过：
  - `npm run build`（通过，新增跨栏目内链后无类型回归）
- 薄内容补强（批次 1，6 篇）：
  - `docs/4_Growth_Ops/content/101-61_llm_vs_quant.md`
  - `docs/4_Growth_Ops/content/101-62_hallucination_control.md`
  - `docs/4_Growth_Ops/content/101-64_eod_vs_intraday.md`
  - `docs/4_Growth_Ops/content/101-81_case_reversal.md`
  - `docs/4_Growth_Ops/content/101-82_false_breakout.md`
  - `docs/4_Growth_Ops/content/101-83_falling_knife.md`
  - 每篇新增 `Key Facts（带日期）` + `证据口径` 区块。
- 七次验证通过：
  - `npm run build`（通过，内容补强后静态生成正常）
- 薄内容补强（批次 2，5 篇）：
  - `docs/4_Growth_Ops/content/101-09_why_smart_people_fail.md`
  - `docs/4_Growth_Ops/content/101-10_sitting_on_hands.md`
  - `docs/4_Growth_Ops/content/101-11_hindsight_bias.md`
  - `docs/4_Growth_Ops/content/101-28_left_right_trading.md`
  - `docs/4_Growth_Ops/content/101-30_divergence.md`
  - 每篇新增 `Key Facts（带日期）` + `证据口径` 区块。
- 八次验证通过：
  - `npm run build`（通过，第二批补强后静态生成正常）
- 薄内容补强进度：
  - 已完成 `11/14`
  - 剩余 `3` 篇：`101-31_sector_rotation`、`101-56_correlation_risk`、`2026-03-02_quant_thinking`
- 薄内容补强（批次 3，3 篇）：
  - `docs/4_Growth_Ops/content/101-31_sector_rotation.md`
  - `docs/4_Growth_Ops/content/101-56_correlation_risk.md`
  - `docs/4_Growth_Ops/content/2026-03-02_quant_thinking.md`
  - 每篇新增 `Key Facts（带日期）` + `证据口径` 区块。
- 九次验证通过：
  - `npm run build`（通过，第三批补强后静态生成正常）
- 薄内容补强进度更新：
  - 已完成 `14/14`（本轮清零）
- Week 3 监控文档就绪：
  - `docs/4_Growth_Ops/SEO_GEO_Weekly_Report_Week3.md`
  - `docs/4_Growth_Ops/SEO_GEO_Page_Fix_List_Week3.md`
  - `docs/4_Growth_Ops/SEO_GEO_AI_Citation_Sampling_Week3.md`

### 待完成（Week 1 剩余）
- 将 14 篇薄内容纳入 Week 2 扩写池并逐篇补证据锚点。
- 增加 `publish: false` 规范与读取过滤，避免策略文档误入发布流。

### 变更原则记录
- 采用“模块化 + 页面配置”策略，避免逐页硬编码。
- 品牌与产品叙事走中心化内容源，后续调教只改一处。
- 维持“降低攻击性”语气策略，保留专业判断，不做收益承诺。
