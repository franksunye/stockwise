# 26. Pragmatic CPU Reduction Plan for Vercel

## 1. 背景与目标

### 1.1 当前问题
StockWise 前端当前在 Vercel 上出现明显的 CPU 压力，最近 30 天 `Fluid Active CPU` 已接近套餐上限。

这不是一个“流量很大”的问题，而更像是一个“请求路径不够克制”的问题：

- 当前用户量很小，但 public 页面仍有较多动态渲染。
- Dashboard 侧存在固定轮询、前台恢复刷新、联网恢复刷新。
- 一些本可复用的共享数据，仍通过动态 API 在每次请求时重复查询。
- 当前根布局存在动态依赖，导致不止首页，多个 public 页面也无法静态化。

### 1.2 本方案目标

本方案不是追求“最先进的 ISR 架构”，而是追求：

- 在不影响现有功能可用性的前提下，优先降低 Vercel CPU 消耗。
- 优先做低风险、高收益、容易回滚的改造。
- 尽量复用现有代码结构，不大规模重写 Dashboard 或权限模型。
- 给出可直接执行的工作项、验收标准、风险边界和回滚策略。

### 1.3 非目标

以下事项不属于本轮优化目标：

- 不重构整个数据模型。
- 不改写现有用户权限体系。
- 不在本轮引入新的公开研究页体系，如 `/market/[symbol]`。
- 不为了“理论上更优雅”而新增大量中间层接口。
- 不牺牲现有 Dashboard、Brief、会员分层、模式切换等功能。

---

## 2. 基于现状的关键判断

本方案基于当前仓库代码现状，而不是抽象假设。

### 2.1 已确认的真实问题

#### A. 首页目前确实是动态渲染
`frontend/src/app/page.tsx` 当前使用了 `headers()` 与 `redirect()`，会使首页保持动态渲染。

#### B. 根布局也是动态依赖
`frontend/src/app/layout.tsx` 当前通过 `headers()` 读取 `x-ziso-locale`。这会影响整个 `app` 路由树的静态化能力，是当前文档中最容易被低估的一点。

#### C. Dashboard 轮询会持续消耗 CPU
`frontend/src/hooks/useDashboardData.ts` 当前具备以下行为：

- 首次进入自动拉取
- Watchlist 变化时强制刷新
- 页面恢复可见时刷新
- `focus/pageshow/online` 时刷新
- 定时轮询刷新

并且对 `/api/stock/batch` 使用了：

- `cache: 'no-store'`
- 非静默刷新追加时间戳参数

这意味着即便只有一两位用户，只要页面长时间开着，也会持续触发服务端计算。

#### D. Dashboard 接口仍有重复查询
`frontend/src/app/api/dashboard/route.ts` 名义上是“只返回 watchlist”，但实际仍会查询并返回 `almanacs`。这部分与 `batch` 接口存在职责重叠。

#### E. 部分内容页其实已经静态化
`learn/[slug]` 与 `support/[slug]` 已经使用 `generateStaticParams()`。因此这部分不是当前 CPU 的优先问题，不需要在本轮大动。

### 2.2 结论

当前 CPU 优化的正确优先级不是“一次性建设完整 Global-First ISR 架构”，而是：

1. 先清理 public 页动态依赖。
2. 先拆出最明确的共享数据。
3. 先减少 Dashboard 重复查询和无意义刷新。
4. 最后才处理更深层的 shared stock API 拆分。

---

## 3. 总体策略

本轮采用 **三阶段、逐步上线** 的务实方案。

| 阶段 | 目标 | 风险 | 预期收益 |
| :--- | :--- | :--- | :--- |
| Phase 1 | 去掉 public 页面最明显的动态渲染来源 | 低 | 立刻降低 public 请求 CPU |
| Phase 2 | 抽离最安全的共享数据并收敛接口职责 | 低 | 降低 Dashboard 重复 DB 查询 |
| Phase 3 | 对 Batch 接口做有限缓存与节流优化 | 中 | 降低长开 Dashboard 的持续 CPU 消耗 |

**原则：**

- 每一阶段都必须能独立上线。
- 每一阶段都必须有明确验收标准。
- 任何阶段出现行为回归，都应允许单独回滚。
- 不允许在一个 PR 中同时做页面静态化、API 架构重写、会员逻辑改造三类事情。

---

## 4. 目标架构（务实版）

### 4.1 数据分层

| 层级 | 类型 | 典型内容 | 本轮策略 |
| :--- | :--- | :--- | :--- |
| L1 | Public Static | 首页、About、Pricing、Terms、Privacy 等 | 尽可能静态化 |
| L2 | Shared Cached | Almanac、HK Short、纯 symbol 级历史数据 | 独立共享 API 或服务端缓存 |
| L3 | Private Dynamic | Watchlist、用户 Tier、用户 Mode、会话态数据 | 继续动态 |
| L4 | Hybrid | Dashboard Batch 中“共享 + 用户叠加”的混合数据 | 先做子查询缓存，不急于彻底拆分 |

### 4.2 本轮不做的“理想化设计”

以下设计可以以后再考虑，但本轮不作为必须项：

- 完整的 `/api/shared/stock/[symbol]` 全量公共股票画像接口
- 完整的 `/market/[symbol]` SEO 研究页体系
- 全站 tag-based revalidation 设计
- 全量 brief 体系重构为 tier-global brief

原因很简单：这些改造都可能碰到权限边界、缓存一致性、历史兼容性问题，不适合作为当前 CPU 救火第一阶段。

---

## 5. 实施计划总览

## 5.1 执行顺序

1. Phase 1: Public 静态化止血
2. Phase 2: Shared Almanac + 接口职责收敛
3. Phase 3: Batch 查询缓存 + Dashboard 刷新节流
4. Phase 4: 复盘与是否继续扩展 shared stock API

## 5.2 建议排期

| Phase | 工作量预估 | 建议安排 |
| :--- | :--- | :--- |
| Phase 1 | 0.5 - 1 天 | 优先立刻做 |
| Phase 2 | 1 天 | 紧随其后 |
| Phase 3 | 1 - 2 天 | 在前两阶段验证稳定后进行 |
| Phase 4 | 0.5 天 | 基于监控决定是否继续 |

---

## 6. Phase 1: Public 静态化止血

### 6.1 目标

让 public 页面先从“明显动态”退回到“可静态化”，这是本轮性价比最高的一步。

### 6.2 工作项

#### Task 1. 去掉首页的动态 host 判断

**文件：**

- `frontend/src/app/page.tsx`

**当前问题：**

- 页面内读取 `headers()`
- 页面内根据 host 判断是否 `redirect('/dashboard')`

**改造要求：**

- 删除页面内 `headers()` 逻辑
- 删除页面内 `redirect()` 逻辑
- 保留 `middleware.ts` 中对 `app.ziso.cc` 的跳转/改写策略
- 首页组件只负责渲染 landing 内容

**完成标准：**

- `npm run build` 后 `/` 不再因为页面内 `headers()` 动态化
- 在 `app.ziso.cc/` 访问时，行为仍由 middleware 正常导向 dashboard

#### Task 2. 去掉根布局的 `headers()` 依赖

**文件：**

- `frontend/src/app/layout.tsx`
- 如有需要，新增 locale 专用的 public 子布局

**当前问题：**

- `RootLayout` 使用 `headers()` 读取 `x-ziso-locale`
- 这会扩大动态范围

**改造要求：**

- 根布局不得再依赖 `headers()`、`cookies()` 或 request-time 信息
- 根布局仅保留全站通用静态壳层能力
- locale 相关逻辑应下沉到真正需要 locale 的 public route segment
- 如必须保留 locale 能力，优先用：
  - segment 级 layout
  - 路由参数
  - 静态可推导的方式

**禁止事项：**

- 不要为了“兼容旧逻辑”把 request header 读取搬到另一个全局公共入口继续动态化

**完成标准：**

- `RootLayout` 代码中不再出现 `headers()` / `cookies()`
- `npm run build` 后 public 路由动态数量明显下降

#### Task 3. 构建产物验证与记录

**执行命令：**

```bash
cd frontend
npm run build
```

**需要记录的结果：**

- `/`
- `/about`
- `/pricing`
- `/privacy`
- `/terms`
- `/support`

这些路由在 build 输出中的静态/动态状态。

**验收目标：**

- 至少首页和若干 public 页面不再是 `ƒ`
- 如果仍有动态页面，必须在 PR 描述中逐一注明原因

### 6.3 风险与回滚

**风险：**

- locale 行为可能受影响
- `app.ziso.cc` 与主域名行为可能出现跳转偏差

**回滚策略：**

- 仅回滚 `page.tsx` 和 `layout.tsx` 相关改动
- 不影响后续 Phase 2、Phase 3 的代码

---

## 7. Phase 2: Shared Almanac 与接口职责收敛

### 7.1 目标

先抽离一块最确定、最共享、最不涉及权限差异的数据：`market_almanacs`。

这一步的目的不是追求“所有共享数据都拆完”，而是先把最容易重复查询的公共数据剥离出来。

### 7.2 工作项

#### Task 4. 新增共享 Almanac API

**新增文件：**

- `frontend/src/app/api/shared/almanac/route.ts`

**接口要求：**

- 只返回共享 Almanac 数据
- 不读取用户 session
- 不读取 cookies
- 不依赖 `userId`
- 使用 `export const revalidate = 3600`

**返回结构建议：**

```json
{
  "almanacs": [],
  "almanac": null,
  "lastUpdated": "ISO_TIMESTAMP"
}
```

**实现要求：**

- 查询 `market_almanacs ORDER BY target_date DESC LIMIT 5`
- 保持与现有前端字段兼容
- 保留必要的 JSON parse 与 `degraded` 推导逻辑
- 响应中不要混入任何用户态字段

**安全要求：**

- 不允许从请求中读取用户身份
- 不允许透传 debug 级内部信息

#### Task 5. Dashboard 私有接口去掉 Almanac 查询

**文件：**

- `frontend/src/app/api/dashboard/route.ts`

**改造要求：**

- `/api/dashboard` 只返回 watchlist 与必要的私有上下文
- 删除 `market_almanacs` 查询
- 删除响应中的 `almanacs` / `almanac`
- 保持调用方在类型和错误处理上可平滑升级

**完成标准：**

- `dashboard` 接口职责与注释一致
- 不再发生 watchlist 接口重复查询 Almanac

#### Task 6. 前端优先从 shared API 获取 Almanac

**文件：**

- `frontend/src/hooks/useDashboardData.ts`
- 如有需要，相关 context / types

**改造要求：**

- Almanac 数据优先来自 `/api/shared/almanac`
- `/api/stock/batch` 不再作为 Almanac 主来源
- 保留对旧字段的容错，避免一次上线就因为缓存结构差异导致白屏

**推荐实现顺序：**

1. 先请求 shared almanac
2. 再请求私有 watchlist / batch 数据
3. 若 shared almanac 失败，不阻塞 stocks 展示

**注意：**

- Almanac 是增强信息，不应成为 Dashboard 主列表的阻塞项

### 7.3 验收标准

- Dashboard 正常展示 watchlist
- Almanac 卡片正常展示
- `/api/dashboard` 返回体变轻
- `/api/dashboard` 与 `/api/stock/batch` 不再重复查询 Almanac

### 7.4 风险与回滚

**风险：**

- 前端初始化阶段可能出现 Almanac 比股票晚到达
- 本地缓存中旧结构可能与新结构不一致

**缓解：**

- Almanac UI 必须允许独立 loading
- 本地缓存读取时继续兼容旧键

**回滚策略：**

- 仅恢复 `useDashboardData` 从旧接口取 Almanac 的逻辑
- shared almanac API 可以保留，不影响系统

---

## 8. Phase 3: Batch 接口的有限缓存与 Dashboard 刷新节流

### 8.1 目标

不改掉当前 Dashboard 的用户态模型，但减少每次刷新都重新做同样的 symbol 查询。

### 8.2 核心原则

- 不在本阶段强行把 `/api/stock/batch` 改成公开共享接口
- 只缓存其中明确“与用户无关”的子查询
- 用户 Tier、Mode、Session Overlay 保持动态判断

### 8.3 工作项

#### Task 7. 识别并缓存纯 symbol 级子查询

**文件：**

- `frontend/src/app/api/stock/batch/route.ts`
- 必要时新增 `frontend/src/lib/server-cache/*`

**可缓存内容：**

- 最新 `daily_prices`
- 纯 symbol 级历史价格/指标
- HK short daily / weekly / eligible 数据

**暂不缓存内容：**

- 依赖 `userTier` 的模型过滤结果
- 依赖 `mode_id` 的 overlay 结果
- 任何带用户上下文的拼接字段

**实现建议：**

- 将纯 symbol 查询抽成独立函数
- 使用 `unstable_cache`
- key 设计包含：
  - symbol 列表
  - historyLimit
  - 数据版本前缀

**注意：**

- `symbols` 需要排序后再参与 cache key，避免同义请求打出不同缓存

#### Task 8. 保守收缩 Batch 返回内容

**目标：**

把 `batch` 保留为“Dashboard 私有聚合接口”，但不继续承载明显共享的数据。

**改造要求：**

- 删除 Almanac 返回字段，前提是 Phase 2 已完成
- 检查是否还有其他明显共享字段被重复夹带
- 不改字段含义，只减掉已迁出的部分

#### Task 9. 收敛 Dashboard 刷新策略

**文件：**

- `frontend/src/hooks/useDashboardData.ts`

**当前问题：**

- 首次、watchlist 变化、focus、pageshow、online、interval 都可能触发刷新

**改造要求：**

- 保留首次加载
- 保留 watchlist 变化时刷新
- 保留页面恢复后的刷新，但增加更严格的去抖或冷却
- 保留定时刷新，但建议把节奏调整为更保守

**建议参数：**

- 交易时段：从 5 分钟提高到 10 分钟
- 非交易时段：从 10 分钟提高到 20-30 分钟
- 恢复前台刷新：至少要求距离上次成功拉取超过 2-5 分钟

**禁止事项：**

- 不要移除手动刷新能力
- 不要让用户误以为数据完全实时

#### Task 10. 去掉不必要的 cache-buster

**文件：**

- `frontend/src/hooks/useDashboardData.ts`

**改造要求：**

- 非必要情况下，不再给 batch 请求附加 `t=Date.now()`
- 如果确有手动刷新需要绕缓存，只允许手动刷新路径使用强制绕过参数
- 静默轮询与恢复刷新应尽量复用缓存

### 8.4 验收标准

- Dashboard 功能无回归
- Batch 平均响应时间下降或持平
- Batch 对 DB 的重复查询明显减少
- 长时间打开 Dashboard 时，Vercel CPU 使用趋势下降

### 8.5 风险与回滚

**风险：**

- 数据更新不如现在频繁
- 某些 symbol 排序导致缓存命中异常
- 历史查询缓存与 mode/tier 数据混在一起时可能出错

**缓解：**

- 缓存边界只覆盖纯 symbol 查询
- 所有用户态数据继续动态
- 增加日志，明确缓存命中/未命中

**回滚策略：**

- 关闭 cached 子查询，恢复为直接查询
- 不影响 Phase 1、2 成果

---

## 9. Phase 4: 复盘与是否继续扩展

### 9.1 目标

在完成前 3 个阶段后，先看效果，再决定是否继续投入更重的 shared stock API 改造。

### 9.2 复盘内容

- Vercel CPU 是否显著下降
- public 页面是否已大面积静态化
- Dashboard 长开场景 CPU 是否下降
- 是否仍有某个单独 API 成为热点

### 9.3 只有满足以下条件才继续下一轮

- 前 3 阶段已稳定上线至少 2-3 天
- 没有发现明显功能回归
- CPU 仍然偏高，且热点已经定位到 symbol 级重复查询

若满足以上条件，下一轮才考虑：

- `/api/shared/stock/[symbol]`
- `/market/[symbol]`
- 更细的 revalidation/tag 设计

---

## 10. 开发执行清单

以下清单可直接作为开发任务分配依据。

### 10.1 Phase 1 清单

- [ ] 从 `frontend/src/app/page.tsx` 删除 `headers()` 与 `redirect()`
- [ ] 确认 `frontend/src/middleware.ts` 已覆盖 app 域名跳转
- [ ] 从 `frontend/src/app/layout.tsx` 删除 `headers()` 依赖
- [ ] 将 locale 处理下沉到更小的 route segment
- [ ] 执行 `cd frontend && npm run build`
- [ ] 记录 public 路由静态化结果

### 10.2 Phase 2 清单

- [ ] 新增 `frontend/src/app/api/shared/almanac/route.ts`
- [ ] 为 shared almanac 补上类型与必要转换逻辑
- [ ] 从 `frontend/src/app/api/dashboard/route.ts` 删除 almanac 查询与返回
- [ ] 更新 `frontend/src/hooks/useDashboardData.ts` 改为优先读取 shared almanac
- [ ] 验证 Dashboard 在 almanac 失败时仍能加载股票

### 10.3 Phase 3 清单

- [ ] 将 batch 中纯 symbol 查询抽成独立函数
- [ ] 给纯 symbol 查询增加 `unstable_cache`
- [ ] 删除 batch 中已迁出的 almanac 字段
- [ ] 调整 Dashboard 轮询频率
- [ ] 缩减恢复前台刷新触发条件
- [ ] 去掉静默刷新中的时间戳 cache-buster
- [ ] 保留手动刷新强制拉新能力

### 10.4 Phase 4 清单

- [ ] 上线后观察 Vercel CPU 趋势
- [ ] 检查是否还有高频热点 API
- [ ] 决定是否进入下一轮 shared stock API 设计

---

## 11. 验收与监控要求

### 11.1 功能验收

每个阶段上线前，至少验证以下路径：

- 主域名首页访问正常
- `app.ziso.cc` 进入 Dashboard 行为正常
- Dashboard watchlist 正常展示
- Almanac 正常展示
- Brief 正常打开
- 用户 Tier / Mode 不受影响
- 手动刷新仍可用

### 11.2 技术验收

每个阶段至少执行：

```bash
cd frontend
npm run build
```

如果有相关测试或 lint，也应至少执行：

```bash
cd frontend
npm run lint
```

### 11.3 监控建议

上线后重点观察：

- Vercel Fluid Active CPU
- `/api/stock/batch` 请求频率
- `/api/dashboard` 请求频率
- public 页面 TTFB 是否下降
- 是否出现 almanac 空白、brief 读取异常、dashboard 首屏变慢

---

## 12. 需要明确的工程边界

为避免开发过程跑偏，本轮必须遵守以下边界：

### 12.1 不要把所有共享数据都急着公开化

共享不等于公开。凡是与用户 tier、mode、session 有耦合的数据，本轮都不应该贸然移入 `/api/shared/*`。

### 12.2 不要一次性重写 Dashboard 数据流

本轮只允许渐进迁移：

- 先迁 Almanac
- 再做 Batch 子查询缓存
- 最后再评估是否拆更多接口

### 12.3 不要牺牲现有交互体验

允许适度延长共享数据缓存时间，但不允许：

- 破坏手动刷新
- 让用户明显感觉数据“卡住不动”
- 让 Dashboard 因共享数据失败而整体不可用

---

## 13. 最终结论

当前最适合 StockWise 的，不是“大而全的 Global-First ISR 重构”，而是一个 **分阶段、低风险、先止血后优化** 的 CPU 降本方案。

本轮应当优先做：

1. 去掉 public 页面动态依赖，尤其是 `RootLayout` 与首页。
2. 抽离 shared almanac，减少重复查询。
3. 对 batch 做有限缓存，对 Dashboard 刷新做节流。

如果这三步做完后 CPU 已经明显下降，就没有必要继续投入更重的架构改造。只有当热点仍然集中在 symbol 级共享查询时，才进入下一轮 shared stock API 设计。
