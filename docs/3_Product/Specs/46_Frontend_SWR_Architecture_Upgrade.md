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

## 2. 当前现状梳理

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
4. 再改 Dashboard 的主批量拉取链路。
5. 最后改 Watchlist mutation 流。

理由：

- AICouncil 风险最小，最适合验证范式。
- Dashboard 收益最大，但要先有统一基础设施。
- Watchlist 行为最敏感，应最后处理。

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
  - 分阶段迁移。
  - 先简单场景，后复杂 mutation。

这份文档是后续实施与验收的共同基线。
