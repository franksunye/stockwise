---
title: "Frontend Architecture Upgrade: SWR & Unified Caching"
doc_id: "spec-frontend-swr-architecture-upgrade"
doc_domain: "product"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-26"
summary: "定义前端 SWR 与统一缓存架构的现行边界，是秒开、快照、PWA bootstrap 与零闪烁相关内容的产品事实源。"
---

# Frontend Architecture Upgrade: SWR & Unified Caching

## 1. 背景

当前前端数据流已经实现了我们真正想要的体验基线：

- 回访用户进入 Dashboard 时，优先从本地缓存恢复，保持“零闪烁秒开”。
- 若存在旧数据，优先展示旧数据，再在后台静默刷新。
- 用户对自选池的增删必须即时生效，不能被晚到的远端读请求打回。
- 弱网、接口失败、切回页面、切换模式等场景下，页面结构不能抖动或退回工程态。

这些效果不是“顺手做出来的”，而是当前产品体验的一部分，不能因为引入 SWR 而漂移。

本次升级的目标不是“为了库而换库”，而是：

1. 保留现有体验基线。
2. 用 SWR 收口重复的请求状态管理和重验证逻辑。
3. 减少手写 `useEffect + fetch + debounce + mounted guard` 的维护负担。
4. 为后续 Dashboard / 投研决议 / 自选池形成统一的数据层语义。

## 1.1 当前执行状态（2026-03-10 更新）

截至 2026-03-10，当前执行结论如下：

- `AICouncil` 的 SWR 试点已经落地，并通过了体感验证。
- `Dashboard` 主链路的 SWR 迁移已经尝试，但未通过真实设备体验验收，已回滚。
- 结论不是“放弃 SWR”，而是“暂停 SWR 进入首页首帧关键链路”。

对应提交节点：

- `1bb0d2f`：`AICouncil` 迁移到 SWR。
- `20d83a1`：曾尝试将 Dashboard 主批量请求迁移到 SWR。
- `d405fc2`：回滚上述 Dashboard SWR 迁移。

因此，当前文档需要从“继续推进 Dashboard”修正为“保留 AICouncil 成果，重新定义下一步范围”。

补充验证结果：

- `stock-pool -> dashboard` 的进入体验，在入口 bootstrap 修正后已基本无感。
- 冷启动 / 重新打开应用时，仍可能有极短的快速闪烁，但已不再暴露 Dashboard 骨架屏。
- 这说明当前主矛盾已从“数据层退化”收敛为“入口 bootstrap / hydration 切换细节”。

## 1.2 当前实现状态补记（2026-03-26）

这份文档不是从零开始重写。

截至 2026-03-26，仓库中的实际状态更准确地说是：

- `PWA 壳层 bootstrap` 已经有了明确入口，并不处于“尚未开始”的状态。
- `Dashboard bootstrap state` 已经经过多轮战术修复，回访秒开、splash 收敛、profile 桥接、watchlist 本地恢复都已有落地。
- 但 `Dashboard bootstrap state` 仍未形成单独工具层，当前仍是“部分统一”，不是“完全收口”。

具体来说：

1. [`frontend/src/app/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/layout.tsx) 已统一承担：
   - `manifest` 注入，
   - `app-splash` 首屏壳层，
   - 移动端设备标记，
   - 基于本地 auth/profile/onboarding 缓存的 `dashboard-boot-ready` 预判，
   - splash 的首屏保留与抑制逻辑。
2. [`frontend/src/components/ServiceWorkerRegistrar.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/ServiceWorkerRegistrar.tsx) 与 [`frontend/public/sw.js`](/Users/yesun/Code/stockwise/frontend/public/sw.js) 已形成独立的 PWA 注册与缓存策略层。
3. [`frontend/src/app/(dashboard)/dashboard/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/layout.tsx) 仍承担：
   - auth/profile/onboarding gate，
   - invite wall 判定，
   - profile 预热与桥接缓存，
   - onboarding 准入，
   - splash 关闭时机，
   - transition skip 判定。
4. [`frontend/src/hooks/useUserProfile.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useUserProfile.ts)、[`frontend/src/hooks/useWatchlist.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useWatchlist.ts)、[`frontend/src/hooks/useDashboardData.ts`](/Users/yesun/Code/stockwise/frontend/src/hooks/useDashboardData.ts) 仍分别维护自己的本地恢复、静默刷新、防抖与兜底策略。

因此，当前更准确的架构判断应更新为：

- 我们已经完成了 `PWA 壳层 bootstrap` 级别的一次收口。
- 我们还没有完成 `Dashboard bootstrap state` 级别的统一建模。
- 下一步不是另起炉灶，而是在现有实现上继续把分散判断收口为统一的 `dashboard bootstrap state`。

## 2. 当前现状梳理

### 2.0 统一术语

为避免后续文档把不同层次的问题混写，本文统一使用以下术语：

- `PWA 壳层 bootstrap`
  - 指 `RootLayout + manifest + splash + service worker + 设备标记` 这一层启动外壳。
- `Dashboard bootstrap state`
  - 指 Dashboard 进入前后的状态判定集合，包含 auth、profile、onboarding、navigation intent、splash 关闭时机等入口规则。
- `本地快照`
  - 指为了跨刷新保留并支撑首帧恢复而写入 `localStorage` 的持久化数据，不等同于 SWR 运行时缓存。
- `乐观进入`
  - 指在本地条件已足够时，不等待完整网络闭环，先允许用户进入 Dashboard 内容层。
- `gate`
  - 指具体的页面准入判定逻辑，是 `Dashboard bootstrap state` 的一个实现位置，而不是独立架构层。

后文若只写 `bootstrap`，默认指 `Dashboard bootstrap state`，不是泛指全部前端启动过程。

### 2.1 已经被验证有效的行为

#### Dashboard 主线

`useDashboardData.ts` 当前同时承担：

- `localStorage` 快照恢复，保证首帧秒开。
- `focus` / `visibilitychange` 后静默刷新。
- 按交易时段动态轮询。
- watchlist 变化后的本地映射修复。
- 弱网或失败时保留已有结构，不让页面塌陷。
- history 的增量加载。

这说明 Dashboard 不是一个简单的“拉一个列表” Hook，而是一条完整的数据链路。

#### Watchlist

`useWatchlist.ts` 当前同时承担：

- 本地列表秒恢复。
- 远端真源同步。
- optimistic add / remove。
- 5 秒 Anti-Zombie 保护，避免“写后被旧读覆盖”。

这不是单纯的 fetch 状态管理，而是带业务一致性要求的 mutation 流程。

#### AICouncil

`AICouncil.tsx` 当前是局部组件场景：

- 内存 `Map` 缓存。
- 5 分钟 TTL。
- 有旧数据先展示，后台热刷。
- 组件卸载守卫，防止异步请求污染状态。

这块最接近 SWR 的标准使用场景，适合先做试点。

### 2.2 架构层现实约束

当前仓库并不只在 Dashboard 使用本地缓存：

- 用户身份恢复依赖 `localStorage + cookie + URL bridge`，兼容 iOS PWA 隔离存储。
- 用户 profile 已经在使用“先读本地，再静默刷新”的模式。
- Investment Mode Card 也在使用本地 TTL 快照。

因此，本项目需要的不是“单一缓存技术”，而是“分层缓存语义”。

## 3. 本次升级必须冻结的目标

以下行为属于不可退让的验收标准：

1. 只要本地存在可用旧数据，首帧不允许退回骨架屏。
2. 后台重验证不能破坏用户当前看到的结构与滚动上下文。
3. watchlist 的本地变更优先级高于晚到的远端读。
4. 弱网或接口失败时，页面保留上次可用结构，不出现明显跳变。
5. 焦点回归、页面重新可见、定时刷新都应保持静默刷新语义。
6. iOS PWA 的身份与本地数据恢复逻辑不能被 SWR 改造破坏。

一句话：优化实现可以变，产品体感不能退。

## 4. 研究结论

### 4.1 SWR 适合解决的问题

基于官方文档，SWR 适合承担以下职责：

- 请求去重。
- focus / reconnect revalidation。
- 轮询刷新。
- 条件与依赖式 key。
- optimistic mutation。
- 统一错误与加载语义。
- 通过自定义 cache provider 承载运行时缓存。

### 4.2 SWR 不应被误解为默认具备的能力

同样基于官方文档，本项目不能把以下能力直接等同于 SWR 默认能力：

- 跨刷新持久化缓存。
- 项目级 localStorage 秒开恢复。
- 业务语义级 TTL / LRU 策略。
- watchlist 场景下的 Anti-Zombie 业务保护。
- 按产品域隔离的缓存寿命和安全边界。

因此，SWR 在本项目里的定位应该是：

`SWR = 运行时请求编排层，不是唯一缓存层。`

## 5. 最终推荐方案

### 5.1 采用二层缓存架构

#### 第一层：持久化快照层

职责：

- 为回访和刷新后的首帧提供旧数据。
- 保证“零闪烁秒开”。
- 仅存储明确需要跨刷新保留的产品数据。

实现建议：

- 保留 `localStorage`。
- 统一收口为项目级 `readSnapshot / writeSnapshot / isSnapshotFresh` 工具。
- 按功能域分 key，不做一个全局大缓存。

#### 第二层：SWR 运行时层

职责：

- 请求去重。
- 后台重验证。
- 轮询。
- focus / reconnect 刷新。
- optimistic mutation。
- 统一 key 与 fetcher。

实现建议：

- 增加项目级 `SWRConfig`。
- 提供统一 `fetcher`、统一 key factory、统一错误处理。
- 将 SWR 视为会话内数据编排器，而不是持久化仓库。

### 5.2 为什么不能使用“全局持久化 SWR provider”

不建议把所有业务数据统一塞进一个持久化 SWR provider，原因如下：

- 不同数据的寿命不同：AICouncil、Dashboard、Profile、Mode Card 并不相同。
- 不同数据的安全边界不同：身份与授权信息不应与普通展示数据混在一起。
- 当前项目存在 iOS PWA 的特殊身份恢复链路，不能让通用缓存策略误伤这部分逻辑。
- 一旦全局 provider 失控，排查缓存污染会非常困难。

结论：

- 持久化应该按领域做，而不是按库做。

### 5.3 Dashboard Bootstrap 需要独立收口

这次线上验证进一步说明，Dashboard 首页体验并不只由数据请求层决定，还强依赖入口 bootstrap 链路：

- auth cache
- profile cache
- onboarding marker
- 导航意图（如 `stock-pool -> dashboard?symbol=...`）
- hydration 前后的骨架显示策略

短期内，这些条件可以以战术方式修正，目标是先确保用户无感进入。

但从长期架构看，不应让这些入口条件持续散落在：

- `RootLayout` 的 bootstrap script
- `dashboard/layout.tsx` 的 gate 逻辑
- `stock-pool` 页的导航意图写入
- `dashboard/page` 的清理逻辑

因此，后续应收敛出统一的 `dashboard bootstrap state` 工具层，职责至少包括：

1. 统一读取 auth/profile/onboarding/navigation intent。
2. 统一判断“是否允许乐观进入 Dashboard”。
3. 统一管理 bootstrap 生命周期与过期策略。
4. 将显示层、数据层、导航层的入口判断从页面组件中剥离。

补充状态说明（2026-03-26）：

- 这项工作目前仍是 `未完成但已具备现实基础`，不是概念阶段。
- 已有实现已经覆盖了大部分“读取条件”和“乐观进入”能力，只是这些能力还散落在多个入口与 hook 中。
- 后续的主要工作应是把现有判断搬运并收口，而不是重新发明另一套 bootstrap 机制。

这一步不属于当前 SWR 迁移的直接实施项，但它是 Dashboard 首页长期稳定性的必要前置条件。

文档关系说明：

1. 本文负责给出架构判断与边界约束。
2. 若需要处理 2026-03 新用户 invite -> onboarding -> dashboard 首次进入卡在黄历的问题，执行层请参考 [`25_Onboarding_First_Load_Recovery_Plan_20260314.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/25_Onboarding_First_Load_Recovery_Plan_20260314.md)。
3. 该执行文档是对本节判断的战术落地，不代表恢复 Dashboard 主链路的 SWR 迁移。

## 6. 分模块落地方案

### 6.1 Phase 1: AICouncil 先行

目标：

- 验证 SWR 是否能在不破坏体感的前提下替换手写局部缓存。

方案：

- 将 `Map + TTL + useEffect` 改为 `useSWR`。
- 保留“有旧数据先展示，没有才 loading”的语义。
- 在切换 `symbol` / `targetDate` 的过程中，优先评估 `keepPreviousData`，避免 Key 切换瞬间出现可感知闪烁。
- 暂不要求跨刷新持久化，只需保持当前组件级体验。
- 若需要 TTL，使用带元数据的自定义缓存值或在 key 层增加时间判断。

验收：

- 切换股票时不闪。
- 重复打开同一股票不重复打接口。
- 页面切换与组件卸载时不再需要手写 mounted guard。

状态：

- `已完成`
- 当前判断：这一层级的局部数据面适合继续采用 SWR。

### 6.2 Phase 2: Dashboard 只迁请求编排层

目标：

- 让 Dashboard 摆脱手写重验证逻辑，但保留现有秒开与失败兜底。

方案：

- 保留 Dashboard 本地快照。
- 用 SWR 接管 `/api/stock/batch` 的请求、轮询和重验证。
- `fallbackData` 来自本地快照，而不是空数组。
- 若存在 Key 变化时的体感抖动，优先尝试 `keepPreviousData` 与本地 snapshot 衔接，不默认采用“手工搬运旧 Key 缓存到新 Key”的方案。
- `refreshInterval` 继续按交易时段动态控制。
- 使用 `revalidateOnFocus` / `revalidateOnReconnect` 替换显式监听器。
- watchlist 到 `StockData[]` 的映射逻辑保留在 hook 内，不强行下沉到 fetcher。
- `loadMoreHistory` 保持单独流程，不硬塞进主 key。

验收：

- 刷新页面后，若有本地快照，仍然秒开。
- 切回页面后静默刷新，不出现明显结构跳变。
- API 重复请求数下降。
- 失败时仍能保留上次结果。

状态：

- `已尝试，已回滚`
- 当前判断：这条链路属于首页首帧关键路径，现阶段不能继续以当前方式推进。
- 回滚原因：
  - 真实设备上出现了更明显的“框架页 / 骨架页闪现”。
  - 从 `stock-pool -> dashboard` 与直接打开 `dashboard` 两条路径看，体感退化已超过可接受范围。
  - 该回归直接触碰了本方案的冻结目标：首帧不闪、结构不跳、体验不退。

结论：

- Dashboard 主链路暂不作为下一个 SWR 落点。
- 后续若重启此项，必须先设计“本地快照优先于 SWR 运行时状态”的更严格混合方案，并在真实设备上做封闭验证。
- 在真正重启 Dashboard SWR 主链路之前，应先完成 `dashboard bootstrap state` 的统一收口评估。

### 6.3 Phase 3: Watchlist 最后迁

目标：

- 在不损失即时反馈的前提下，让 watchlist 读写逻辑标准化。

方案：

- 本地快照继续保留，用于首帧恢复。
- SWR 持有远端 `stock-pool` 真源。
- `add/remove` 使用 `mutate` 驱动 optimistic update。
- 保留业务级 `lastMutationAt` 守卫，不把 Anti-Zombie 全部交给 SWR 默认行为。
- Conditional Fetching 可作为辅助机制使用，但不能替代业务级撞针；因为它只能阻止新请求发出，不能天然解决“旧请求晚到覆盖新状态”问题。
- mutation 成功后更新快照；失败时回滚本地状态与快照。
- 默认避免 mutation 之后立刻被自动 revalidate 覆盖本地最新操作。

验收：

- 添加和删除股票仍然是即时反馈。
- 5 秒内晚到读不会覆盖本地最新结果。
- 刷新页面后本地列表仍可立即恢复。

状态：

- `未开始`
- 当前判断：在 Dashboard 主链路尚未重新证明安全之前，Watchlist 不应继续推进。

### 6.4 修正后的下一步

基于当前执行结果，下一步不建议继续推进首页首帧关键链路，而应转向“非首帧关键数据面”。

优先级建议如下：

1. `StockProfile` 的完整历史加载。
2. `Brief` 页 / `BriefDrawer` 的数据获取。
3. 个人中心二级页内部的非首屏关键模块。
4. 其他仅在打开 Drawer / Modal 后才会触发的数据面。

这些位置的共同特征是：

- 不决定 Dashboard 首帧。
- 允许轻微等待，但不允许结构性退化。
- 更接近 `AICouncil` 已验证成功的局部数据模式。

补充判断：

- 当前 Dashboard 首页体验的主要残留问题，已经不是 SWR 本身，而是 bootstrap 状态收口还不统一。
- 因此，在重新触碰 Dashboard 主链路之前，应优先评估是否先抽出统一的 `dashboard bootstrap state`。
- 这项评估应以“复用现有 RootLayout / dashboard layout / profile / watchlist / data hook 中的既有逻辑”为前提，而不是重写一套新机制。

### 6.5 Next Step: Dashboard Bootstrap State Consolidation

目标：

- 以最小风险向前推进一小步，先统一 `Dashboard bootstrap state` 的读取与判定来源，而不改动当前产品体感与主请求链路。

为什么先做这一步：

1. 当前最分散、最容易继续漂移的不是 SWR 本身，而是 Dashboard 入口判定。
2. 这些规则已经在真实代码中存在并被证明有效，不需要从零重新设计。
3. 先收口读取层，不触碰 `useDashboardData`、`useWatchlist` mutation、轮询与 Service Worker，回归面最小。
4. 这一步完成后，后续无论继续修 splash、skeleton、invite/onboarding 进入体验，还是未来重新评估 Dashboard SWR，都会更稳。

实施范围：

#### Phase A: 抽只读 `dashboard bootstrap state` 工具层

建议新增一个统一模块，例如：

- [`frontend/src/lib/dashboard-bootstrap.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/dashboard-bootstrap.ts)

职责：

1. 统一读取：
   - `ZISO_AUTH_CACHE_V1`
   - `stockwise_user_profile_v1`
   - `STOCKWISE_HAS_ONBOARDED`
   - `stockwise_dashboard_nav_intent`
   - `stockwise_splash_ts`
2. 统一给出：
   - `getOptimisticDashboardBootstrap()`
   - `getDashboardEntryHint()`
   - `shouldSkipDashboardSkeleton()`
   - `shouldSuppressDashboardSplash()`

边界：

- 只搬运当前已存在的判断。
- 不修改 key。
- 不修改 TTL。
- 不新增网络请求。
- 不改变现有缓存策略。

#### Phase B: 替换两个核心消费点

优先替换：

1. [`frontend/src/app/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/layout.tsx)
2. [`frontend/src/app/(dashboard)/dashboard/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/layout.tsx)

目标：

- 让 `RootLayout` 与 Dashboard layout 基于同一套 bootstrap 语义工作。
- 删除双边重复解析逻辑，减少“改一边忘另一边”的风险。

边界：

- 保留现有渲染结构。
- 保留现有 `InviteWall`、`UserProfileProvider`、`StockProvider` 组织方式。
- 不把本阶段扩展成 UI 重构。

#### Phase C: 补轻量验证

建议验证方式：

1. 为纯函数判定补最小单测，覆盖典型缓存组合。
2. 手工验证以下三条关键路径：
   - 回访用户直接打开 `/dashboard`
   - `stock-pool -> dashboard`
   - onboarding 后首次进入 dashboard

验收标准：

1. 行为与当前版本一致。
2. 不新增 skeleton 闪现。
3. 不新增 splash 残留。
4. 不新增 onboarding / auth / profile 误判。

本阶段明确不做：

1. 不触碰 `useDashboardData` 请求编排。
2. 不触碰 `useWatchlist` mutation 语义。
3. 不重启 Dashboard SWR 主链路迁移。
4. 不改 Service Worker 策略。
5. 不引入新的全局持久化缓存层。

当前判断：

- 这是当前“收益最高、风险最小”的前进一步。
- 它属于架构收口，不属于重新打开 Dashboard 主链路改造。
- 若要为后续 Dashboard 主链路继续演进打基础，应优先完成这一小步。

状态（2026-03-26）：

- `Phase A` 已完成：
  - 已新增 [`frontend/src/lib/dashboard-bootstrap.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/dashboard-bootstrap.ts)
  - 已补充 [`frontend/tests/dashboard-bootstrap.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/dashboard-bootstrap.test.mjs)
- `Phase B` 已完成：
  - [`frontend/src/app/(dashboard)/dashboard/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/layout.tsx) 已切换为消费统一 helper
  - [`frontend/src/app/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/layout.tsx) 已改为消费由 helper 生成的 inline bootstrap script
- `Phase C` 已按当前目标完成：
  - [`frontend/tests/dashboard-bootstrap.test.mjs`](/Users/yesun/Code/stockwise/frontend/tests/dashboard-bootstrap.test.mjs) 通过
  - `npx tsc -p tsconfig.json --noEmit` 通过
  - targeted lint 已通过；当前仅保留 [`frontend/src/app/layout.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/layout.tsx) 既有的 `img` 优化 warning
- 当前结论：
  - 现阶段已完成这轮 `Dashboard bootstrap state consolidation` 的既定三步，可以作为后续继续收口的基线。

## 7. 不建议做的事

以下做法不建议采用：

1. 直接把现有 `localStorage` 秒开逻辑全部删掉，完全依赖 SWR 默认缓存。
2. 一次性同时重写 Dashboard、Watchlist、AICouncil。
3. 将身份、授权、profile、watchlist、dashboard 全部混入一个持久化 SWR cache。
4. 用“代码行数减少”作为主目标，弱化“体感不退化”。
5. 把 Watchlist 当成普通读请求重构，忽略它的业务一致性要求。

## 8. 实施顺序

推荐迁移顺序如下：

1. 引入 `swr` 依赖与项目级 `SWRConfig`，但暂不替换业务逻辑。
2. 抽出统一 `fetcher` 与 `snapshot` 工具。
3. 先改 `AICouncil`。
4. 再改非首帧关键数据面（如 `StockProfile` / `Brief` / 二级页模块）。
5. 最后才重新评估 Dashboard 主链路。
6. 在 Dashboard 未重新证明可行前，不推进 Watchlist mutation 流。

理由：

- AICouncil 风险最小，最适合验证范式。
- 非首帧关键数据面可以继续积累 SWR 经验，而不直接伤害首页首帧。
- Dashboard 收益最大，但事实证明它的失败成本也最高。
- Watchlist 行为最敏感，应在 Dashboard 问题关闭后再处理。

## 9. 验收指标

### 9.1 用户体感指标

- 回访首帧仍然秒开。
- 焦点切回后刷新无明显闪烁。
- 添加/删除自选时有即时反馈。
- 弱网和接口失败下页面结构稳定。

### 9.2 工程指标

- 重复请求数下降。
- 手写事件监听与 mounted guard 数量下降。
- Hook 中重复的 fetch / debounce / refresh 控制逻辑下降。
- 不新增缓存污染与 key 冲突问题。

### 9.3 补充验证项

- 多 Tab 场景下，一个 Tab 修改 Watchlist 后，另一个 Tab 在切回焦点时应能静默对齐。
- Dashboard 主批量接口在一次刷新流程中的重复请求应明显下降。
- `fallbackData` 的展示优先级必须高于身份同步与后台重验证，不得因为 `getCurrentUser()` 等前置动作而阻塞首帧恢复。

## 10. 参考依据

以下为本方案采用的主要外部依据：

- SWR Cache Provider
  - https://swr.vercel.app/docs/advanced/cache
- SWR Mutation / Optimistic Update
  - https://swr.vercel.app/docs/mutation
- SWR Revalidation
  - https://swr.vercel.app/docs/revalidation
- SWR Conditional Fetching
  - https://swr.vercel.app/docs/conditional-fetching
- SWR API
  - https://swr.vercel.app/docs/api
- Next.js Client-side Fetching
  - https://nextjs.org/docs/pages/building-your-application/data-fetching/client-side
- React `useEffect`
  - https://react.dev/reference/react/useEffect

## 11. 当前结论

最终结论如下：

- 我们不是要追求“全面 SWR 化”。
- 我们要追求的是“在不丢失现有效果的前提下，用 SWR 统一运行时数据流”。
- 对本项目最稳的路线是：
  - 保留本地快照秒开。
  - 引入 SWR 统一运行时请求层。
  - 将 Dashboard 首页的 bootstrap 判断视为独立架构问题，而不是附属在 SWR 迁移里的顺手修补。
  - 承认 `PWA 壳层 bootstrap` 已部分统一，后续重点转向 `Dashboard bootstrap state` 的收口，而不是从零重新定义前端启动架构。
  - 分阶段迁移。
  - 先局部组件，再外围数据面，最后才回到首页主链路。
  - 一旦首帧体感退化，优先回滚，不硬推。

这份文档是后续实施与验收的共同基线。
