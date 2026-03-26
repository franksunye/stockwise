---
title: "Frontend Architecture Upgrade: SWR & Unified Caching"
doc_id: "spec-frontend-swr-architecture-upgrade"
doc_domain: "product"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-26"
summary: "定义前端 SWR、PWA 壳层 bootstrap、Dashboard bootstrap state 与本地快照边界的当前事实源。"
---

# Frontend Architecture Upgrade: SWR & Unified Caching

## 1. 当前结论

这份文档不再作为“待实施方案草稿”，而是当前前端架构的事实源。

截至 2026-03-26，结论如下：

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
4. [`frontend/src/hooks/useUserProfile.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useUserProfile.ts)
5. [`frontend/src/hooks/useWatchlist.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useWatchlist.ts)
6. [`frontend/src/hooks/useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts)

当前判断：

1. `PWA 壳层 bootstrap` 已部分统一。
2. `Dashboard bootstrap state` 已完成第一轮收口。
3. 但 profile、watchlist、data hook 的写入与刷新侧仍然分散，不应误判为“整体已彻底统一”。

### 4.3 本地快照仍是必要层

当前仓库中，本地快照仍然是必须保留的产品层能力。

原因：

1. Dashboard 秒开依赖本地快照恢复
2. profile 已采用“先读本地，再静默刷新”
3. Investment Mode Card 也使用本地 TTL 快照
4. iOS PWA 的身份与存储隔离问题决定了不能把所有能力都压到单一运行时缓存中

## 5. 已完成与未完成

### 5.1 已完成

1. `AICouncil` 的 SWR 试点已落地，当前判断仍然有效：
   - 局部组件数据面适合继续采用 SWR
2. `Dashboard bootstrap state consolidation` 这一轮三步已完成：
   - 已新增 [`frontend/src/lib/dashboard-bootstrap.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/dashboard-bootstrap.ts)
   - [`frontend/src/app/(dashboard)/dashboard/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/layout.tsx) 已接入 helper
   - [`frontend/src/app/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/layout.tsx) 已改为消费 helper 生成的 inline bootstrap script
   - [`frontend/tests/dashboard-bootstrap.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/dashboard-bootstrap.test.mjs) 已补齐基础纯逻辑验证
3. 新用户首次进入 Dashboard 的修复链路已经落地。
   - 详见 [`25_Onboarding_First_Load_Recovery_Plan_20260314.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/25_Onboarding_First_Load_Recovery_Plan_20260314.md)

### 5.2 已证伪或已停止推进

1. `Dashboard` 主链路直接迁到 SWR 的方案已尝试并回滚。
2. 当前不继续推进 Watchlist 的 SWR 化。
3. 当前不引入全局持久化 SWR provider。

### 5.3 仍未完成

1. `Dashboard bootstrap state` 的写入侧仍未统一收口。
2. 非首帧关键数据面的 SWR 迁移尚未系统推进。
3. 缺少更系统的 bootstrap 边界验证与自动化护栏。

## 6. 当前最合理的下一步

下一步不建议继续触碰 Dashboard 首页主请求链路。

更合理的方向只有两类：

### 6.1 加固当前 bootstrap 收口成果

建议：

1. 继续补 [`frontend/tests/dashboard-bootstrap.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/dashboard-bootstrap.test.mjs) 的边界覆盖
2. 增加对 host/path/splash suppress/auth cache 过期组合的验证
3. 将这轮收口成果变成稳定护栏，而不是依赖人工记忆

这是当前收益最高、风险最低的下一步。

### 6.2 只推进非首帧关键数据面

若继续推进 SWR，只建议从非首帧关键数据面开始，例如：

1. `StockProfile` 的完整历史加载
2. `Brief` 页 / `BriefDrawer`
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

## 9. 历史注记

保留以下历史判断，供后续追踪：

1. `AICouncil` 的 SWR 迁移已成功
2. `Dashboard` 主链路 SWR 迁移曾尝试，但已回滚
3. `Dashboard bootstrap state` 的第一轮读取侧收口已完成

更细的 bug 修复执行过程，请参考：

1. [`25_Onboarding_First_Load_Recovery_Plan_20260314.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/25_Onboarding_First_Load_Recovery_Plan_20260314.md)
