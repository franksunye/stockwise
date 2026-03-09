# Frontend Architecture Upgrade: SWR & Unified Caching (Draft)

## 1. 背景与目标 (Background & Goals)

**现状 (Status Quo)**
目前 知守 AI (ZISO AI) 的前端架构中，网络请求状态管理和本地缓存存在较强的“碎片化”特征：
- 首页大盘流（`useDashboardData`）：基于 `localStorage` 手写了大量逻辑，包括定时器轮询、焦点回归刷新、手动防抖（Debounce）及过期管理。
- 用户自选池（`useWatchlist`）：实现了乐观更新（Optimistic Updates）与本地远端同步，带有五秒的突变防守期（Anti-Zombie）。
- 局部组件（如 `AICouncil`）：通过 `Map` 构建了带限制容量（防 OOM）的纯内存缓存。

这些手动挡代码虽然目前保证了各模块的秒开（Zero UI Flash）体验，但也带来了：
- 极高的维护成本与代码冗余（数百行样板代码）。
- 存在潜在的 React 异步生命周期竞态问题（需手动写大量 isMounted 守卫）。
- 全局没有一个统一的拉取、缓存、错误重试标准。

**升级目标 (Objective)**
进行一次前端数据流架构的统一“收敛大手术”，全盘引入行业顶尖的状态缓存库 **SWR**（或功能对等的封装层）。
核心目标是：
1. **代码减负**：大幅削减现有数百行的防抖、生命周期拦截代码。
2. **体验对齐**：全站实现完美的 Stale-While-Revalidate（旧缓存秒开预演 + 后台静默热刷）体验。
3. **消除隐患**：彻底消除 SPA 运行时的内存溢出（OOM）隐患和组件卸载后的内存泄漏（Memory Leak）警告。

## 2. 实施方案 (Implementation Plan)

### 2.1 技术选型
引入 Vercel 提供的 `swr` 库作为前端所有 API Fetch 的基础设施。它具备体积小、Next.js 兼容性好、自带 LRU 和 Focus Revalidation 等特性。

### 2.2 核心改造模块

#### 第一阶段：边缘独立组件验证
- **目标组件**：`AICouncil.tsx`
- **改造动作**：
  移除手写的 `councilCache` (`Map`) 和复杂的 `useEffect`。
  使用 `const { data, isLoading } = useSWR(key, fetcher)`，并利用 SWR 的 `fallbackData` 配置或中间件实现原有的最大容量剔除与 TTL 机制。

#### 第二阶段：Watchlist 乐观同步与自选股重构
- **目标 Hook**：`useWatchlist.ts`
- **改造动作**：
  将目前由 `localStorage` 与 `fetch` 混合搭建的读写与防抖逻辑，改造为 SWR 驱动的 `mutate(key, newData, { optimisticData: ... })`。这能更优雅地处理防丧尸（Zombie Data）问题，同时保证多窗口下的一致性。

#### 第三阶段：Dashboard 主线轮询迁移
- **目标 Hook**：`useDashboardData.ts`
- **改造动作**：
  将当前带有可见性监听器、`setInterval` 的百行代码全部精简。
  利用 SWR 配置：`refreshInterval` 根据时段动态调整为 5min/10min、`revalidateOnFocus` 替代 visibilitychange 的手动监听。

## 3. 设计原则 (Design Principles)

1. **绝对无感（Zero UI Flash）**：无论网络状况如何，用户在二次打开面板/切换 Tag 时，永远不准看到骨架屏，必须瞬间呈现上次的缓存。
2. **渐进式实施（Incremental Adoption）**：由于目前生产环境列车正平稳运行，重构采用“切一片、上一片”的方式，新老架构在一段时间内共存，不搞休克疗法。
3. **保持 UI 不变**：重构只碰数据流和状态层，彻底解耦，不改动现存任何样式和交互逻辑。

## 4. 风险与回滚方案
- **缓存冲突**：引入新库可能与已有 `localStorage` 存放的老结构冲突，需要在一开始加上清晰的 `cacheKey` 隔离（或者一键清除旧缓存版本）。
- **重构成效验证**：通过 `npm run lint` 和 E2E / 手动体验交叉验证。若某模块出现加载迟滞，可快速 Rollback 回我们目前已调优至极限的原生写法。
