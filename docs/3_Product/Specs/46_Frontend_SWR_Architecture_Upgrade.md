---
title: "Frontend Architecture Upgrade: SWR & Unified Caching"
doc_id: "spec-frontend-swr-architecture-upgrade"
doc_domain: "product"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-04-14"
summary: "定义前端 SWR、PWA 壳层 bootstrap、Dashboard bootstrap state、本地快照边界，以及收盘后恢复探测与黄历失效策略的当前事实源。"
---

# Frontend Architecture Upgrade: SWR & Unified Caching

## 1. 当前结论

这份文档不再作为“待实施方案草稿”，而是当前前端架构的事实源。

截至 2026-03-27，结论如下：

1. 当前前端体验基线已经明确：
   - 回访用户优先从本地快照恢复，保持秒开；
   - 后台刷新不能破坏现有结构；
   - watchlist 本地变更优先级高于晚到的远端读；
   - 弱网与失败场景下页面结构不能塌陷。
2. `SWR` 在本项目中的定位是：
   - `运行时请求编排层`
   - 不是唯一缓存层
   - 不是跨刷新持久化层
3. 当前主问题已经不是“要不要上 SWR”，而是：
   - `Dashboard bootstrap state` 的长期收口
   - 与非首帧关键数据面的渐进迁移
4. 第一阶段前端架构基线已经建立，当前工作模式应从“持续扩工程”切换为“收口、冻结、观测”。
5. `Dashboard` 首页主链路目前不作为下一步 SWR 落点。
6. `shared almanac` 已从“长 ISR route cache”切换为“可主动失效的数据级缓存 + 5 分钟兜底”。
7. `Dashboard` 收盘后恢复应用时，允许先做轻量版本检查，但不允许无条件重拉完整预测。
8. `Dashboard` 入口私有握手已新增轻量 `POST /api/user/bootstrap`，但它只负责 gate/profile/watchlist metadata，不替代本地 snapshot 秒开链路。

## 2. 统一术语

- `PWA 壳层 bootstrap`
  - 指 `RootLayout + manifest + splash + service worker + 设备标记` 这一层启动外壳。
- `Dashboard bootstrap state`
  - 指 Dashboard 进入前后的状态判定集合，包含 auth、profile、onboarding、navigation intent、splash 关闭时机等入口规则。
- `本地快照`
  - 指为跨刷新保留并支撑首帧恢复而写入 `localStorage` 的持久化数据，不等同于 SWR 运行时缓存。
- `乐观进入`
  - 指在本地条件已足够时，不等待完整网络闭环，先允许用户进入 Dashboard 内容层。
- `gate`
  - 指具体的页面准入判定逻辑，是 `Dashboard bootstrap state` 的一个实现位置，而不是独立架构层。

若后文只写 `bootstrap`，默认指 `Dashboard bootstrap state`。

## 3. 当前架构边界

### 3.1 已经成立的架构判断

1. 必须保留二层语义：
   - 第一层：本地快照
   - 第二层：SWR 运行时层
2. 不应使用“全局持久化 SWR provider”统一承载所有业务数据。
3. 身份、授权、profile、watchlist、dashboard 数据不能混入一个单一持久化缓存仓库。
4. `Dashboard bootstrap state` 必须被视为独立架构问题，而不是附属在 SWR 迁移里的顺手修补。

### 3.2 SWR 负责什么

SWR 适合承担：

1. 请求去重
2. focus / reconnect revalidation
3. 轮询刷新
4. 条件与依赖式 key
5. optimistic mutation
6. 统一错误与加载语义
7. 收盘后恢复应用的轻量版本探测

### 3.3 SWR 不负责什么

SWR 不应被直接等同为：

1. 跨刷新持久化缓存
2. 项目级秒开恢复
3. 业务级 TTL / LRU
4. watchlist 的 Anti-Zombie 业务保护
5. 身份恢复与 iOS PWA 特殊兼容链路

## 4. 当前实现现状

### 4.1 PWA 壳层 bootstrap

`PWA 壳层 bootstrap` 已经有明确入口，并不处于“尚未开始”的状态。

当前主要入口：

1. [`frontend/src/app/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/layout.tsx)
2. [`frontend/src/components/ServiceWorkerRegistrar.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/ServiceWorkerRegistrar.tsx)
3. [`frontend/public/sw.js`](/Users/yesun/Code/stockwise/frontend/public/sw.js)

已承担的职责包括：

1. `manifest` 注入
2. `app-splash` 首屏壳层
3. 移动端设备标记
4. `dashboard-boot-ready` 预判
5. splash 的首屏保留与抑制逻辑
6. Service Worker 注册与缓存策略

### 4.2 Dashboard bootstrap state

`Dashboard bootstrap state` 已经过多轮修复，当前不再是“从零开始”的状态。

当前相关代码主要分布在：

1. [`frontend/src/app/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/layout.tsx)
2. [`frontend/src/app/(dashboard)/dashboard/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/layout.tsx)
3. [`frontend/src/lib/dashboard-bootstrap.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/dashboard-bootstrap.ts)
4. [`frontend/src/hooks/useDashboardAuthorization.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardAuthorization.ts)
5. [`frontend/src/components/dashboard/DashboardEntryGate.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/DashboardEntryGate.tsx)
6. [`frontend/src/components/dashboard/DashboardShell.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/DashboardShell.tsx)
7. [`frontend/src/hooks/useUserProfile.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useUserProfile.ts)
8. [`frontend/src/hooks/useWatchlist.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useWatchlist.ts)
9. [`frontend/src/hooks/useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts)

当前判断：

1. `PWA 壳层 bootstrap` 已部分统一。
2. `Dashboard bootstrap state` 已完成第一轮读取侧、写入侧与入口编排收口。
3. `dashboard/layout.tsx` 已被压薄为三态渲染层，授权编排、entry gate 与 provider 壳层已独立成模块。
4. 但 profile、watchlist、data hook 的刷新与数据主链路仍然分散，不应误判为“整体已彻底统一”。
5. 2026-04-14 起，`useDashboardAuthorization` 入口优先消费轻量 `bootstrap`；`refreshProfile()` 仍保留 `/api/user/profile`，避免把 mutation 后同步和入口握手混成一个重接口。

### 4.3 本地快照仍是必要层

当前仓库中，本地快照仍然是必须保留的产品层能力。

原因：

1. Dashboard 秒开依赖本地快照恢复
2. profile 已采用“先读本地，再静默刷新”
3. Investment Mode Card 也使用本地 TTL 快照
4. iOS PWA 的身份与存储隔离问题决定了不能把所有能力都压到单一运行时缓存中
5. Dashboard 入口的轻量 `bootstrap` 只允许写入 auth/profile/watchlist metadata，不允许吞掉 `stockwise_dashboard_cache_v1` 这类主数据快照

### 4.4 共享黄历与个股预测的刷新边界

截至 2026-03-27，首页顶部的共享黄历与个股预测不再共享同一种“新鲜度判定”。

当前边界如下：

1. `shared almanac`
   - 属于公共数据面
   - 使用数据级缓存 + tag
   - 黄历生成成功后主动失效
   - 并保留 5 分钟兜底 revalidate
2. `stock batch / dashboard predictions`
   - 仍以本地 snapshot 秒开为主
   - 收盘后只有当所有股票都进入当日批次，才允许停止 batch 新鲜度检查
   - 若只是“同日重跑、date 未变化”，则交由轻量版本探测补位
3. 两条链路共同遵守：
   - 不为追求一致性而放弃本地秒开
   - 不为追求省请求而允许长期 stale

## 5. 已完成与未完成

### 5.1 已完成

1. `AICouncil` 的 SWR 试点已落地，当前判断仍然有效：
   - 局部组件数据面适合继续采用 SWR
2. `Dashboard bootstrap state consolidation` 这一轮三步已完成：
   - 已新增 [`frontend/src/lib/dashboard-bootstrap.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/dashboard-bootstrap.ts)
   - [`frontend/src/app/(dashboard)/dashboard/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/layout.tsx) 已接入 helper
   - [`frontend/src/app/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/layout.tsx) 已改为消费 helper 生成的 inline bootstrap script
   - [`frontend/tests/dashboard-bootstrap.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/dashboard-bootstrap.test.mjs) 已补齐基础纯逻辑验证
3. `Dashboard` 入口编排已进一步模块化：
   - [`frontend/src/hooks/useDashboardAuthorization.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardAuthorization.ts) 负责授权与首轮 profile/bootstrap 编排
   - [`frontend/src/components/dashboard/DashboardEntryGate.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/DashboardEntryGate.tsx) 负责 profile/onboarding/skeleton gate
   - [`frontend/src/components/dashboard/DashboardShell.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/DashboardShell.tsx) 负责 provider 组合
4. bootstrap 边界验证已加固：
   - [`frontend/tests/dashboard-bootstrap.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/dashboard-bootstrap.test.mjs) 已覆盖 auth cache、profile cache、nav intent、splash suppress 与读写 round-trip
5. `Dashboard` 入口页面级 smoke 验证已落地：
   - [`frontend/scripts/dashboard-entry-smoke.mjs`](/Users/yesun/Code/stockwise/frontend/scripts/dashboard-entry-smoke.mjs) 已覆盖 returning user、nav intent、onboarding、invite wall 四类入口状态
   - [`frontend/scripts/verify-dashboard-entry.mjs`](/Users/yesun/Code/stockwise/frontend/scripts/verify-dashboard-entry.mjs) 已提供可重复执行的本地发布前检查
   - [`frontend/package.json`](/Users/yesun/Code/stockwise/frontend/package.json) 已提供 `check:dashboard-entry`、`verify:dashboard-entry` 与 `verify:release`
   - `verify:release` 现已将 `dashboard entry gate` 纳入正式 release 验证链路，并以 `next start` 运行生产构建
6. `RootLayout` 的 bootstrap hydration mismatch 已修正，当前 smoke 验证同时要求 `console:error` 与 `pageerror` 为零。
7. `Brief` 非首帧数据面已开始第一轮低风险收口：
   - [`frontend/src/lib/brief-client.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/brief-client.ts) 已统一 `BriefDrawer` 与 `Brief` 页的当日 / 上个交易日 fallback 获取逻辑
   - [`frontend/src/lib/brief-dates.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/brief-dates.ts) 已下沉 fallback 日期候选计算
   - [`frontend/tests/brief-client.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/brief-client.test.mjs) 已锁住 brief fallback 语义
   - [`frontend/src/components/dashboard/BriefMarkdown.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/BriefMarkdown.tsx) 已收口 `BriefDrawer` 与 `Brief` 页的 markdown 展示层
8. `StockProfile` 非首帧数据面已完成第一轮数据逻辑收口：
   - [`frontend/src/hooks/useStockProfileHistory.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useStockProfileHistory.ts) 已统一历史数据读取、延迟请求与组件内状态
   - [`frontend/src/lib/stock-profile-history.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/stock-profile-history.ts) 已下沉 30 秒缓存、响应归一化与历史回退语义
   - [`frontend/src/lib/stock-profile-metrics.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/stock-profile-metrics.ts) 已下沉胜率与日期标签等派生规则
   - [`frontend/tests/stock-profile-history.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/stock-profile-history.test.mjs) 与 [`frontend/tests/stock-profile-metrics.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/stock-profile-metrics.test.mjs) 已锁住缓存和派生逻辑
9. `UserCenterDrawer` 已完成第一轮数据准备收口：
   - [`frontend/src/hooks/useUserCenterData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useUserCenterData.ts) 已统一 Drawer 打开时的 profile refresh、investment mode summary 读取、push 状态同步与 notification settings 读写
   - [`frontend/src/lib/user-center-data.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/user-center-data.ts) 已下沉默认通知设置、设置归一化与 investment mode cache 读取逻辑
   - [`frontend/tests/user-center-data.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/user-center-data.test.mjs) 已锁住默认设置和缓存读取语义
   - [`frontend/scripts/user-center-smoke.mjs`](/Users/yesun/Code/stockwise/frontend/scripts/user-center-smoke.mjs) 与 [`frontend/package.json`](/Users/yesun/Code/stockwise/frontend/package.json) 中的 `check:user-center` 已支持本地验证 Drawer 打开后的 profile refresh 与 mode summary 加载
10. `TacticalBriefDrawer` 已完成第一轮派生数据层收口：
   - [`frontend/src/lib/tactical-brief-surface.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/tactical-brief-surface.ts) 已统一策略场景归一化、价格节点构建、港股空头压力分级与旧术语兼容逻辑
   - [`frontend/src/components/dashboard/TacticalBriefDrawer.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/TacticalBriefDrawer.tsx) 现在只消费 surface helper，不再内联维护这批派生规则
   - [`frontend/tests/tactical-brief-surface.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/tactical-brief-surface.test.mjs) 已锁住 tactic 去重补位、价格节点去重排序、short pressure 分级与旧术语归一化语义
11. `Tactical content surface` 已完成第一轮邻接层稳定化：
   - [`frontend/src/lib/tactical-brief-content.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/tactical-brief-content.ts) 已统一策略摘要、冲突处理、重点情报、海报 intelligence/tactic 提取与 JSON 解析兜底
   - [`frontend/src/components/dashboard/AICouncil.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/AICouncil.tsx)、[`frontend/src/components/dashboard/SilentPoster.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/SilentPoster.tsx) 与 [`frontend/src/components/dashboard/TacticalBriefDrawer.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/TacticalBriefDrawer.tsx) 已对齐到同一套 content helper 语义
   - [`frontend/tests/tactical-brief-content.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/tactical-brief-content.test.mjs) 已锁住 summary/conflict 提取、news 归一化、poster content fallback 等核心规则
12. `StockDashboardCard` 已完成第一轮展示层收口：
   - [`frontend/src/lib/stock-dashboard-card-surface.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/stock-dashboard-card-surface.ts) 已统一标题判定、摘要提取、首条 tactic 选择与无数据兜底文案
   - [`frontend/src/components/dashboard/StockDashboardCard.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/StockDashboardCard.tsx) 现在只消费展示层 helper，不再内联维护 tactical parse 与展示优先级
   - [`frontend/tests/stock-dashboard-card-surface.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/stock-dashboard-card-surface.test.mjs) 已锁住标题日期语义、position-aware tactic 选择与 pending fallback
13. `HistoricalCard` 已完成第一轮展示层收口：
   - [`frontend/src/lib/historical-card-surface.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/historical-card-surface.ts) 已统一 `layer1_payload` 基准日解析、summary 提取、验证状态标签与日期格式化
   - [`frontend/src/components/dashboard/HistoricalCard.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/HistoricalCard.tsx) 现在只消费展示层 helper，不再内联维护 validation/status parse 细节
   - [`frontend/tests/historical-card-surface.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/historical-card-surface.test.mjs) 已锁住 summary/base snapshot 提取、验证状态映射与日期格式化语义
14. `StockVerticalFeed` 已完成第一轮编排层收口：
   - [`frontend/src/lib/stock-vertical-feed-surface.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/stock-vertical-feed-surface.ts) 已统一 feed 卡片顺序、历史定位解析与 vertical layer state 映射
   - [`frontend/src/components/dashboard/StockVerticalFeed.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/StockVerticalFeed.tsx) 现在只消费编排层 helper，不再内联维护 feed 顺序与 layer 判定
   - [`frontend/tests/stock-vertical-feed-surface.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/stock-vertical-feed-surface.test.mjs) 已锁住 today card 保留、closest history 匹配与 layer state 语义
15. `Dashboard symbol navigation contract` 已完成第一轮收口：
   - [`frontend/src/lib/dashboard-symbol-navigation.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/dashboard-symbol-navigation.ts) 已统一 URL `?symbol`、session `nav intent` 与可用股票列表之间的优先级、匹配与清理语义
   - [`frontend/src/app/(dashboard)/dashboard/stock-pool/page.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/stock-pool/page.tsx)、[`frontend/src/app/(dashboard)/dashboard/page.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/page.tsx) 与 [`frontend/src/hooks/useTikTokScroll.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useTikTokScroll.ts) 已对齐到同一套 symbol 导航 helper
   - [`frontend/tests/dashboard-symbol-navigation.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/dashboard-symbol-navigation.test.mjs) 已锁住 symbol 归一化、exact/suffix 匹配、`URL > nav intent > default` 的优先级语义
16. `Dashboard modal context contract` 已完成第一轮收口：
   - [`frontend/src/lib/dashboard-modal-context.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/dashboard-modal-context.ts) 已统一 modal 上下文股票、brief symbol 绑定、tactical selection 与 active modal 判定语义
   - [`frontend/src/app/(dashboard)/dashboard/page.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/page.tsx) 现在只消费这层 helper，不再内联维护 modal 对当前股票的绑定规则
   - [`frontend/tests/dashboard-modal-context.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/dashboard-modal-context.test.mjs) 已锁住 almanac/stock 上下文边界、modal 优先级和 selected stock 解析
17. `Dashboard interaction smoke` 已完成第一轮页面级交付闭环：
   - [`frontend/scripts/dashboard-interaction-smoke.mjs`](/Users/yesun/Code/stockwise/frontend/scripts/dashboard-interaction-smoke.mjs) 已覆盖 `?symbol` 恢复、`stock-pool -> dashboard` nav intent、`BriefDrawer` / `StockProfile` / `TacticalBriefDrawer` / `UserCenterDrawer` 的 modal context 语义
   - [`frontend/scripts/verify-dashboard-interaction.mjs`](/Users/yesun/Code/stockwise/frontend/scripts/verify-dashboard-interaction.mjs) 已提供可重复执行的本地与 release 前验证入口
   - [`frontend/package.json`](/Users/yesun/Code/stockwise/frontend/package.json) 与 [`frontend/scripts/verify-release.mjs`](/Users/yesun/Code/stockwise/frontend/scripts/verify-release.mjs) 已将 interaction gate 纳入正式 release 验证链路
   - [`.github/workflows/frontend_quality_gates.yml`](/Users/yesun/Code/stockwise/.github/workflows/frontend_quality_gates.yml) 已补上 Playwright Chromium 安装，以保证 CI 与本地 release gate 一致
18. `Dashboard Data Refresh Contract` 第一轮已完成：
   - [`frontend/src/lib/dashboard-refresh-contract.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/dashboard-refresh-contract.ts) 已将 watchlist 变化、historyLimit 升级、resume、online、post-market poll 统一建模为同一套刷新计划
   - [`frontend/src/hooks/useDashboardRefreshContract.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardRefreshContract.ts) 已作为薄 orchestrator 接入 `StockProvider`
   - [`frontend/src/context/StockContext.tsx`](/Users/yesun/Code/stockwise/frontend/src/context/StockContext.tsx) 现在负责把 `useUserProfile`、`useWatchlist`、`useDashboardData` 绑定到同一套 refresh contract 上
   - [`frontend/src/hooks/useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts) 不再自己散落实现 watchlist/history/resume/post-market 的刷新触发，而是统一消费 contract plan
   - [`frontend/tests/dashboard-refresh-contract.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/dashboard-refresh-contract.test.mjs) 已锁住事件到刷新计划的核心语义
   - [`frontend/scripts/dashboard-refresh-smoke.mjs`](/Users/yesun/Code/stockwise/frontend/scripts/dashboard-refresh-smoke.mjs)、[`frontend/scripts/verify-dashboard-refresh.mjs`](/Users/yesun/Code/stockwise/frontend/scripts/verify-dashboard-refresh.mjs) 与 [`frontend/package.json`](/Users/yesun/Code/stockwise/frontend/package.json) 中的 `check:dashboard-refresh` / `verify:dashboard-refresh` 已支持本地与 release 前验证 refresh contract
     - watchlist reorder 仅 remap，不触发 batch
     - watchlist 新增缺失 symbol 时触发 batch
     - `resume` 在无 drift 时只刷价格与版本探测
     - `resume` 在检测到 drift 时触发 batch 补拉
   - [`frontend/scripts/verify-release.mjs`](/Users/yesun/Code/stockwise/frontend/scripts/verify-release.mjs) 已将 refresh gate 纳入正式 release 验证链路；当前 release profile 先锁住 watchlist mutation 侧的确定性 contract，`resume/drift` 继续保留为本地观测项
19. 新用户首次进入 Dashboard 的修复链路已经落地。
   - 详见 [`25_Onboarding_First_Load_Recovery_Plan_20260314.md`](../../1_Engineering/25_Onboarding_First_Load_Recovery_Plan_20260314.md)
20. `shared almanac` 已完成主动失效改造：
   - [`frontend/src/app/api/shared/almanac/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/shared/almanac/route.ts)
   - [`frontend/src/app/api/internal/cache/revalidate/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/internal/cache/revalidate/route.ts)
   - [`backend/engine/almanac_generator.py`](/Users/yesun/Code/stockwise/backend/engine/almanac_generator.py)
21. 收盘后恢复应用的轻量版本探测已落地：
   - [`frontend/src/app/api/stock/prediction-versions/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/stock/prediction-versions/route.ts)
   - [`frontend/src/hooks/useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts)
   - 当前最小探测间隔为 10 分钟，仅在 `post_market` 执行
22. `Dashboard` 收盘后轮询停止条件已收紧：
   - 不再是“任一股票进入今日批次即可停止”
   - 而是“所有股票都进入今日批次后才停止”
23. `Dashboard` 入口私有初始化已完成第二轮收口：
   - 已新增 [`frontend/src/app/api/user/bootstrap/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/user/bootstrap/route.ts)
   - [`frontend/src/lib/user-bootstrap-server.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/user-bootstrap-server.ts) 已统一 bootstrap/profile 的 server-side 数据组装
   - [`frontend/src/hooks/useDashboardAuthorization.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardAuthorization.ts) 现优先消费 `bootstrap` 并将 watchlist metadata seed 回本地缓存
   - [`frontend/src/lib/watchlist-cache.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/watchlist-cache.ts) 已成为 watchlist bootstrap / optimistic mutation / sync timestamp 的统一边界
24. `batch` 主链路已完成一轮内部公共化收敛：
   - [`frontend/src/lib/batch-stock-facts.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/batch-stock-facts.ts) 已下沉 `buildStockFacts(...)` 与 `projectFactsForTier(...)`
   - [`frontend/src/app/api/stock/batch/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/stock/batch/route.ts) 已明确当前国际版 v1 的 `batch` 是 `tier-gated public stock facts`
   - 当前不新增 public/private 双路由，后续是否物理拆分视 `mode` / `pro/alpha` 产品化进度再定

### 5.2 已证伪或已停止推进

1. `Dashboard` 主链路直接迁到 SWR 的方案已尝试并回滚。
2. 当前不继续推进 Watchlist 的 SWR 化。
3. 当前不引入全局持久化 SWR provider。

### 5.3 仍未完成

1. 非首帧关键数据面的 SWR 迁移尚未系统推进，但 `Brief`、`StockProfile`、`UserCenterDrawer`、`TacticalBriefDrawer`、其邻接 content surface、`StockDashboardCard`、`HistoricalCard`、`StockVerticalFeed`、`Dashboard symbol navigation contract`、`Dashboard modal context contract` 与 `Dashboard interaction smoke` 十一个面已完成第一轮低风险收口或交付闭环。
2. `Dashboard Data Refresh Contract` 已完成第一轮，且 production refresh gate 已建立；但对实际线上刷新频率、重复请求和 watchlist 变更后的稳定性仍需要持续观测。
3. 页面级 smoke 目前已并入正式 `verify:release`，并已接入 GitHub Actions 的 `frontend_quality_gates`；但尚未扩展到更高层 staging / device CI。
4. 轻量版本探测目前仅覆盖 `Dashboard` 主列表，不覆盖更深层详情面或 Drawer 内局部数据面。
5. 页面级 `verify:dashboard-*` smoke 仍依赖本地可监听 dev server；在受限环境下可能无法复跑，但脚本契约必须与当前 `bootstrap` 路由保持一致。

## 6. 当前阶段结论

截至 2026-03-27，这轮前端架构升级的第一阶段可以视为已完成。

当前更合理的默认策略不是继续扩工程，而是：

1. 固化当前 release gate 与本地 smoke
2. 观测 refresh contract 的真实表现
3. 仅在出现明确业务需求或真实回归时，再继续推进下一轮架构改造

对应的执行基线见：

- [`41_Frontend_Architecture_Baseline_20260327.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/41_Frontend_Architecture_Baseline_20260327.md)

### 6.1 观测并稳固 Refresh Contract

在继续扩大 SWR 落点之前，优先观测这轮 `Dashboard Data Refresh Contract` 的真实表现：

1. watchlist 增删后，Dashboard 内容同步是否稳定
2. 焦点切回 / `pageshow` / `online` 是否出现过刷或漏刷
3. 收盘后版本探测与 batch 补拉是否按 contract 工作
4. profile 刷新是否仍保持静默，不引入新的骨架或闪烁

若观测稳定，再继续扩大到下一批非首帧关键数据面。

### 6.2 只在问题驱动下推进下一批非首帧关键数据面

若继续推进 SWR，只建议从非首帧关键数据面开始，例如：

1. `StockProfile` 的完整历史加载
   - 当前已完成缓存、延迟请求、派生指标的第一轮收口；后续若继续推进，应优先考虑局部请求层或按需缓存，而不是接入 Dashboard 主数据链路
2. `Brief` 页 / `BriefDrawer`
   - 当前已完成 fetch fallback 与 markdown renderer 的第一轮收口，后续若继续推进，应优先考虑数据请求层与局部缓存层，而不是重写页面壳
3. `UserCenterDrawer` 的通知设置与 investment mode 详情页下钻
   - 当前已完成 Drawer 打开时数据准备的第一轮收口；后续若继续推进，应优先考虑局部数据页和动作写回，而不是重写整个个人中心
4. `TacticalBriefDrawer` 的局部数据与展示衍生层
   - 当前已完成策略场景、价格点位与 short pressure 的第一轮 surface 收口；后续若继续推进，应优先考虑局部数据读写与分享链路，而不是碰 `AICouncil` 的 fetch 主入口
5. `AICouncil` / `SilentPoster` 邻接内容层
   - 当前已完成 shared content surface 收口；后续若继续推进，应优先考虑局部展示与分享边界，而不是重构其请求入口
6. `StockDashboardCard` 的主展示派生层
   - 当前已完成标题、摘要、首条 tactic 与 pending copy 的第一轮收口；后续若继续推进，应优先考虑验证面与交互细化，而不是碰主请求链路
7. `HistoricalCard` 的验证展示层
   - 当前已完成 summary、base snapshot 与 validation style 的第一轮收口；后续若继续推进，应优先考虑历史回顾交互与展示层复用，而不是碰 history 主数据来源
8. `StockVerticalFeed` 的主展示编排层
   - 当前已完成 feed 卡片顺序、历史定位与 vertical layer state 的第一轮收口；后续若继续推进，应优先考虑页面级观测与交互验证，而不是碰 Dashboard 主数据链路
9. `Dashboard` 的 symbol 导航与恢复语义
   - 当前已完成 URL `?symbol`、stock-pool nav intent、dashboard 恢复优先级的第一轮收口；后续若继续推进，应优先考虑页面级 symbol smoke，而不是重写 dashboard 主数据加载
10. `Dashboard` 的 modal 上下文语义
   - 当前已完成 `TacticalBriefDrawer`、`StockProfile`、`BriefDrawer`、`UserCenterDrawer` 的第一轮上下文收口；后续若继续推进，应优先考虑页面级 modal smoke，而不是做新的全局状态系统
11. `Dashboard` 的 interaction smoke
   - 当前已完成 symbol 与 modal 的页面级 smoke，并已进入正式 release gate；后续若继续推进，应优先考虑观测与局部补强，而不是继续扩测试框架
12. 仅在 Drawer / Modal 打开后才触发的数据面

这些位置更接近 `AICouncil` 已验证成功的模式。

## 7. 当前冻结边界

当前不建议：

1. 删除现有本地快照秒开逻辑，完全依赖 SWR 默认缓存
2. 一次性同时重写 Dashboard、Watchlist、AICouncil
3. 将身份、授权、profile、watchlist、dashboard 全部混入一个持久化 SWR cache
4. 把 Watchlist 当成普通读请求重构，忽略业务一致性约束
5. 为了“代码更统一”而牺牲首页首帧体感
6. 继续扩张 `Dashboard Data Refresh Contract`，把它做成更大的平台层或事件框架
7. 在没有真实回归证据前，贸然重构 `useDashboardData` 主链路

## 8. 验收基线

后续所有前端架构调整，都不应破坏以下基线：

1. 回访首帧仍然秒开
2. 焦点切回后刷新无明显闪烁
3. 添加 / 删除自选仍然即时反馈
4. 弱网和接口失败下页面结构稳定
5. 身份恢复与 iOS PWA 兼容逻辑不退化
6. 收盘后同日重跑的预测，在恢复应用且超过最小间隔后可以被感知

## 9. 历史注记

保留以下历史判断，供后续追踪：

1. `AICouncil` 的 SWR 迁移已成功
2. `Dashboard` 主链路 SWR 迁移曾尝试，但已回滚
3. `Dashboard bootstrap state` 的第一轮读取、写入与入口编排收口已完成
4. `Dashboard Data Refresh Contract` 的第一轮统一建模已完成

更细的 bug 修复执行过程，请参考：

1. [`25_Onboarding_First_Load_Recovery_Plan_20260314.md`](../../1_Engineering/25_Onboarding_First_Load_Recovery_Plan_20260314.md)
