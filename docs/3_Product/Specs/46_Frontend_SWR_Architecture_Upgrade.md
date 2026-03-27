---
title: "Frontend Architecture Upgrade: SWR & Unified Caching"
doc_id: "spec-frontend-swr-architecture-upgrade"
doc_domain: "product"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-27"
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
4. `Dashboard` 首页主链路目前不作为下一步 SWR 落点。
5. `shared almanac` 已从“长 ISR route cache”切换为“可主动失效的数据级缓存 + 5 分钟兜底”。
6. `Dashboard` 收盘后恢复应用时，允许先做轻量版本检查，但不允许无条件重拉完整预测。

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

### 4.3 本地快照仍是必要层

当前仓库中，本地快照仍然是必须保留的产品层能力。

原因：

1. Dashboard 秒开依赖本地快照恢复
2. profile 已采用“先读本地，再静默刷新”
3. Investment Mode Card 也使用本地 TTL 快照
4. iOS PWA 的身份与存储隔离问题决定了不能把所有能力都压到单一运行时缓存中

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
   - [`frontend/package.json`](/Users/yesun/Code/stockwise/frontend/package.json) 已提供 `check:dashboard-entry` 与 `verify:dashboard-entry`
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
9. 新用户首次进入 Dashboard 的修复链路已经落地。
   - 详见 [`25_Onboarding_First_Load_Recovery_Plan_20260314.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/25_Onboarding_First_Load_Recovery_Plan_20260314.md)
10. `shared almanac` 已完成主动失效改造：
   - [`frontend/src/app/api/shared/almanac/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/shared/almanac/route.ts)
   - [`frontend/src/app/api/internal/cache/revalidate/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/internal/cache/revalidate/route.ts)
   - [`backend/engine/almanac_generator.py`](/Users/yesun/Code/stockwise/backend/engine/almanac_generator.py)
11. 收盘后恢复应用的轻量版本探测已落地：
   - [`frontend/src/app/api/stock/prediction-versions/route.ts`](/Users/yesun/Code/stockwise/frontend/src/app/api/stock/prediction-versions/route.ts)
   - [`frontend/src/hooks/useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts)
   - 当前最小探测间隔为 10 分钟，仅在 `post_market` 执行
12. `Dashboard` 收盘后轮询停止条件已收紧：
   - 不再是“任一股票进入今日批次即可停止”
   - 而是“所有股票都进入今日批次后才停止”

### 5.2 已证伪或已停止推进

1. `Dashboard` 主链路直接迁到 SWR 的方案已尝试并回滚。
2. 当前不继续推进 Watchlist 的 SWR 化。
3. 当前不引入全局持久化 SWR provider。

### 5.3 仍未完成

1. 非首帧关键数据面的 SWR 迁移尚未系统推进，但 `Brief` 与 `StockProfile` 两个面已完成第一轮低风险收口。
2. `useUserProfile`、`useWatchlist`、`useDashboardData` 之间的数据刷新边界仍未统一建模。
3. 页面级 smoke 目前仍是本地发布前检查，尚未并入更高层 CI / release pipeline。
4. 轻量版本探测目前仅覆盖 `Dashboard` 主列表，不覆盖更深层详情面或 Drawer 内局部数据面。

## 6. 当前最合理的下一步

下一步仍不建议继续触碰 Dashboard 首页主请求链路。

更合理的方向只有两类：

### 6.1 固化页面级轻量验证

建议：

1. 将 `npm run verify:dashboard-entry` 视为 `dashboard` 入口回归的标准本地检查
2. 保持当前纯逻辑测试作为协议护栏，不把页面级验证替换成重型 E2E
3. 在需要扩大发布护栏时，优先考虑把这条命令并入更高层验证，而不是重写成大而重的全链路自动化

这是当前收益最高、风险最低的下一步。

### 6.2 只推进非首帧关键数据面

若继续推进 SWR，只建议从非首帧关键数据面开始，例如：

1. `StockProfile` 的完整历史加载
   - 当前已完成缓存、延迟请求、派生指标的第一轮收口；后续若继续推进，应优先考虑局部请求层或按需缓存，而不是接入 Dashboard 主数据链路
2. `Brief` 页 / `BriefDrawer`
   - 当前已完成 fetch fallback 与 markdown renderer 的第一轮收口，后续若继续推进，应优先考虑数据请求层与局部缓存层，而不是重写页面壳
3. 个人中心二级页中的非首屏关键模块
4. 仅在 Drawer / Modal 打开后才触发的数据面

这些位置更接近 `AICouncil` 已验证成功的模式。

## 7. 不建议做的事

当前不建议：

1. 删除现有本地快照秒开逻辑，完全依赖 SWR 默认缓存
2. 一次性同时重写 Dashboard、Watchlist、AICouncil
3. 将身份、授权、profile、watchlist、dashboard 全部混入一个持久化 SWR cache
4. 把 Watchlist 当成普通读请求重构，忽略业务一致性约束
5. 为了“代码更统一”而牺牲首页首帧体感

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

更细的 bug 修复执行过程，请参考：

1. [`25_Onboarding_First_Load_Recovery_Plan_20260314.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/25_Onboarding_First_Load_Recovery_Plan_20260314.md)
