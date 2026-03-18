# 32. Frontend Network Optimization: Zero-Redundancy Protocol

**Date**: 2026-03-18
**Status**: Active implementation

## 1. Purpose

本文档是 [31_Capacity_Planning_And_Scaling_Strategy_20260317.md](./31_Capacity_Planning_And_Scaling_Strategy_20260317.md) 中关于 **Page-Load Request Fan-out** 优化的落地细则。

在应用热启动（活体切回前台）和冷启动（系统清除内存后重新加载 HTML）时，前端触发了大量多余的网络请求。由于 Vercel Serverless 按请求执行时间计费，且高频非必要请求严重挤兑全局数据库连接池，我们必须在**不改变任何前端产品功能与时效性**的前提下，彻底清理冗余请求。

**核心方针 (The Zero-Redundancy Principle)**:
一旦数据被本地缓存（无论是 LocalStorage 还是 React 内存态），且未超出合理生命周期或缺乏触发更新的事件条件，**应用打开的一瞬间必须视本地缓存为真理 (Source of Truth)**，禁止任何无条件的“挂载级 (Mount-level)”强制同步请求。数据的吐故纳新应全权交由后台的定时心跳（机制）控制。

---

## 2. Redundancy Flow Analysis (冗余路径剖析)

在优化前，发生应用重启及自选池与首页之间高频切换时，系统会产生以下冗余瀑布流：

| 触发场景 | 冗余行为表现 | 根本原因 (Root Cause) |
|----------|--------------|----------------------|
| **Cold Start**<br>(内存清除, 重新进站) | 发出 `GET /api/stock-pool` | `useWatchlist.ts` 的 `useEffect` 中写死了应用一挂载（且脱离 SSR 后）必定在 500ms 后发起向服务器同步自选池的动作，**无视上次同步距离现在的间隔**。 |
| **Cold Start**<br>(内存清除, 重新进站) | 发出 `POST /api/user/profile` | 验证用户身份与权限的请求绑定于底层 Provider挂载及 `layout` 端校验加载阶段。二者未能有效共享长期过期时间（现存仅为 `useUserProfile.ts` 的 30 秒防抖），**导致任何系统级进程恢复都会重新扣响该接口**。 |
| **Cold Start**<br>(内存清除, 重新进站) | 发出 `GET /api/stock/batch` & `almanac` | `useDashboardData.ts` 从缓存中读取出了 N 条数据将 `watchlist` 长度从 0 推演至 N 时，其内部侦听器 (Effect 5) **误以为是用户全新手加了股票**，触发 `ignoreDebounce=true` 的强制请求机制，把防抖网兜捅破。 |
| **Hot Nav**<br>(自选池 ↔ 首页高频切换) | 发出 `GET /api/stock/batch` | 返回首页时，请求规格 `historyLimit` 从 1 升至 5，底层侦听器 (Effect 6) 出于对历史不足的恐惧，**直接重置了 `lastFetchTime` 为 0**，强杀防抖发起兜底请求。 |

---

## 3. Optimization Architecture (优化实施方案)

### 3.1 Profile Verification TTL (权限校验跨组件存活期)
**目标文件**: `layout.tsx` & `hooks/useUserProfile.ts`
- **逻辑**: 对于用户身份信息 (`profile`) 的静默后台验证，引入 30 分钟的统一 TTL (`PROFILE_LAST_SYNC_TS_V1`)。
- **决策点**:
  - 在 `layout.tsx` 中，若有乐观缓存且距上次核检不足 30 分钟，并无新邀请码注入，则不触发 `profile` 预热验证，直接以 authorized 身份进入。
  - 在 `useUserProfile.ts` 的 `refreshProfile` 中，同步把 `now - lastSync < 30000` (30秒) 的机制改为响应这个 30 分钟的 `PROFILE_LAST_SYNC_TS_V1`。
- **协同防撞**: 必须同时修改两者，否则若 `layout.tsx` 拦截了请求而不发出 `PROFILE_SYNC_IN_FLIGHT_KEY`，子组件 `UserProfileProvider` 挂载时一旦超过 30 秒仍会自发请求，导致拦截失效。30 分钟生命周期机制可同时约束两者。

### 3.2 Watchlist Silent Sync TTL (自选池静默同步防抖)
**目标文件**: `useWatchlist.ts`
- **逻辑**: 为向远端拉取最新同步列表的静默行为，增加 12 小时的 TTL 限制 (`WATCHLIST_LAST_SYNC_TS`)。
- **决策点**: `useWatchlist` 挂载时，若缓存最近在 12 小时内才从云端核对过列表全貌，则跳过本次同步。
- **意义**: 大幅减载 `stock-pool` 读取压力。用户在本地增删股票均有独立接口自动写入云数据库并擦写时间戳，此举仅豁免“冷加载查阅”动作时的重复劳动。

### 3.3 Dashboard Cache Inventory Protocol (数据库存校验模型)
**目标文件**: `useDashboardData.ts`
- **协同声明**: 本次优化完美兼容 2026-03-17 部署的 `priceOnlyRefresh` 模式及 `shouldPollBatch` (收盘后智能轮询) 架构。前序优化切断了**轮询和回前台时**的不必要 batch；本次优化则专注于切断 **React Hook 依赖项变动 (Effect 5 & 6) 引发的挂载级强制要求**。
- **逻辑**: 把所有挂载级及依赖变更导致的强杀防抖（`ignoreDebounce=true` 与 `lastFetchTime=0`）转变为**基于业务实质的数据盘点 (Inventory Check)**。
- **决策点 1 (针对 Effect 5：本地缓存与新列表的冲突)**：当 `watchlist` 加载完毕触发 Effect 5 时，循环核查现有从 `CACHE_KEY` 恢复的 `stocks` 数据。**只有当社群手动新增了缺失代码实体时**，才触发 `ignoreDebounce` 放行强制 batch 获取。若全量吻合则立即退回，信任本地 cache。
- **决策点 2 (针对 Effect 6：高频率导航历史长度规格提升)**：当从 `stock-pool` 导航回 `dashboard`，`historyLimit` 发生 1 → 5 切换时，查核所有标的的 `history.length`。若均已达到 5 的限额（意味着这些缓存在上一轮主页时已留存），立刻拦截该次因突破 `prevHistoryLimit` 而强杀的新 Batch。

---

## 4. Expected Outcomes (预期收益)

本轮零冗余协议部署后，配合之前部署的单例模式与 CDN 化，前端网络的呈现将发生质变：

1. **绝对纯净的热启动**：无论是锁屏后重启、进程存活下切后台切回来，**网络请求数为真正的 0**。更新交由周期性 Polling（如价格引擎）统一调度。
2. **极轻快的冷启动**：微信强制杀后台、内存释放后重新打开浏览器标签卡。控制台预期只剩 HTML 与静态资源。`profile`、`stock-pool`、`batch` 会在这类虚假重置中被截获。
3. **消除页面 Fan-out**：大幅响应 [31_Capacity_Planning_...](./31_Capacity_Planning_And_Scaling_Strategy_20260317.md) 提到的 Tier 1+ 容量隐患危机，Vercel 函数账单和 Turso Row Reads 预计进一步下降 20-30%。

---

## 5. Independent Review (独立评审章节 — Code-Level)

本章节为对当前代码基线的独立评审，目的是把本文档的“零冗余协议”从原则落到**具体触发点、真实行为、风险边界与可验证的改法**。评审基于以下现状文件：

- `frontend/src/hooks/useWatchlist.ts`
- `frontend/src/hooks/useUserProfile.ts`
- `frontend/src/app/(dashboard)/dashboard/layout.tsx`
- `frontend/src/hooks/useDashboardData.ts`

### 5.1 总评：文档方向正确，但必须补齐“硬边界 + 验收指标 + 失效事件”

当前代码已经存在多层缓存与多触发器叠加（SW shell + localStorage snapshot + resume event + polling + hook effects）。在这种体系内，“绝对 0 请求”不是单点优化能保证的稳定态，必须明确：

- **硬边界**：哪些事件必定绕过 TTL（例如 `401/403`、session 代际变化、跨端 watchlist 变动线索、tier/权限变化）。
- **硬指标**：冷启动/热切换时允许的 origin hits 目标值（0/1/2）、以及在 iOS PWA 下的最大陈旧上限。
- **可观测性**：每次“为什么不请求/为什么请求”的决策原因需要可追踪，否则出了 stale 或权限错误无法定位。

下面按文件逐项评审。

### 5.2 `useWatchlist.ts`：当前是“挂载级必拉”，与 12h TTL 目标相反

#### 代码级事实

- `localStorage` 恢复完成后，必定在 500ms 后执行 `sync()`，并对 `/api/stock-pool` 发起请求（带 `t=Date.now()`）。
- 防护仅有“近 5 秒内有 mutation 则跳过”，本质是避免读写一致性回滚，并非 TTL。

#### 风险/问题

- **冷启动冗余**：本地缓存可用时仍然必拉，直接违背本文档的 Zero-Redundancy Principle。
- **跨端一致性 trade-off 未显式**：如果把它改成 12h TTL，跨设备变更 watchlist 的可见性将延后（文档未写清是可接受还是不可接受）。

#### 建议（最小可控改法）

- **引入 `WATCHLIST_LAST_SYNC_TS_V1`（localStorage）**：仅当 `(now - lastSync) > TTL` 才允许“挂载级静默全量拉取”。
- **增加“强制失效事件”**：当 Dashboard 发现 `watchlist` 与 `stocks` 的符号集合不一致（见 5.4 Inventory Check），应强制允许一次 `/api/stock-pool` 校验，而不是死等 TTL。
- **建议改成两阶段同步（更稳）**：
  - Phase A：轻量探测（版本号/updated_at/etag）——不变则不拉全量
  - Phase B：仅在探测变化时拉全量列表

> 结论：单纯把 TTL 拉到 12h 省请求很有效，但如果你们不接受跨端延迟，就必须配合版本探测或 mismatch 触发。

### 5.3 `useUserProfile.ts` + `dashboard/layout.tsx`：已有“in-flight 协调”，但 TTL 尚未统一

#### 代码级事实

- Provider 侧 `refreshProfile()` 默认 mount 自动执行，防抖依赖 `sessionStorage:last_profile_sync` 的 **30 秒**。
- Dashboard layout 会在 auth gate 期间主动请求 `/api/user/profile` 并写入 `localStorage:stockwise_user_profile_v1`，同时用 `sessionStorage:profile_sync_in_flight_v1` 告诉 Provider “让位避免重复请求”。
- 目前 layout 中的 profile 预热请求未设置 `cache: 'no-store'`（Provider 请求设置了），但服务端 route 已倾向 no-store（参见你们 2026-03-13 的修复记录）。

#### 风险/问题

- **TTL 不统一**：文档目标是 30 分钟统一 TTL，但代码现状是 layout（按页面生命周期触发）+ Provider（30 秒 sessionStorage 防抖）两套节奏，靠 `in-flight` 只解决“同一时刻并发”，无法避免“同一冷启动流程里”间隔触发。
- **权限正确性边界未写**：把 profile 核验 TTL 拉到 30 分钟会引入“权限滞后”的风险（tier 到期/封禁/权限撤销），需要强制失效机制兜底。

#### 建议（按本文档目标落地）

- **统一 `PROFILE_LAST_SYNC_TS_V1`**：
  - layout 与 Provider 都以同一时间戳判断 30 分钟 TTL。
  - 保留 `PROFILE_SYNC_IN_FLIGHT_KEY` 作为并发互斥，但“是否请求”只看 30 分钟 TTL + 强制失效事件。
- **强制失效事件（必须有）**：
  - 任意受保护 API 返回 `401/403`：立即清空 `PROFILE_LAST_SYNC_TS_V1` 并强制 `refreshProfile({ force: true })`。
  - session 代际变化（如你们 `getCurrentUser()` 写入的 user/session 关键字段变化）应视为 TTL 失效。

> 结论：你们已有“桥接缓存 + in-flight 协调”的良好基础，下一步是把“30秒防抖”升级为“30分钟 TTL + 失效事件”。

### 5.4 `useDashboardData.ts`：Effect 触发点与文档描述一致，是冗余的主源头

#### 代码级事实（对应本文档 2.3 / 2.4）

- **Watchlist 变更强拉（Effect 5）**：`watchlist` 与 `prevWatchlistRef` 发生差异时，直接调用 `loadAllData(false, true)`，即 `ignoreDebounce=true`，会突破 30 秒防抖，触发 `/api/stock/batch`。
- **historyLimit 升级强杀防抖（Effect 6）**：当 `historyLimit > prevHistoryLimitRef.current`，直接 `lastFetchTimeRef.current = 0` 并 `loadAllData(true)`。

这两点与本文档的 root cause 描述一致，且是“必然触发”的代码路径。

#### 风险/问题

- **冷启动误判**：当 `useWatchlist` 从本地恢复把 watchlist 从 0 → N 时，会触发“watchlist 变更强拉”，即便 `stocks` 已由 `CACHE_KEY` 恢复且数据仍在合理生命周期内。
- **高频切换误判**：从 stock-pool 返回 dashboard 造成 `historyLimit: 1 → 5` 时，直接重置 `lastFetchTime`，导致无差别补拉。

#### 建议（Inventory Check 的代码级落点）

- **替换 Effect 5 的 ignoreDebounce 触发条件**：
  - 在触发前，对比 `watchlistSymbols` 与 `stocksRef.current` 的符号集合：
    - 若 `stocks` 缺失了某些 watchlist symbol（真正新增标的导致本地 cache 不包含），才允许 `ignoreDebounce=true`。
    - 若全量覆盖，则禁止网络请求，仅做本地 remap（你们在 `loadAllData` 防抖分支里已有 remap 思路，但 Effect 5 当前直接越过它）。
- **替换 Effect 6 的 lastFetchTime 强杀**：
  - 当 `historyLimit` 升级时先盘点：所有 `stocksRef.current` 的 `history.length` 是否已达到新阈值。
  - 只有在“确实历史不足”时才允许 `loadAllData(true)`；否则不请求、不改 `lastFetchTimeRef`。

#### 建议（必须加的“硬上限”）

考虑 iOS PWA resume 事件不稳定的历史经验，建议增加一个“最大陈旧上限（hard stale cap）”：

- 当本地 snapshot 时间超过上限（交易时段更短、非交易时段更长）时，无论 Inventory Check 如何，都至少触发一次静默刷新，以避免长期不更新的隐性故障模式。

### 5.5 验收建议（必须写进落地计划）

建议用可量化指标验收“零冗余协议”是否真实生效：

- **Cold Start**：本地 cache 命中时，Dashboard **首屏完成前**的 API origin hits（建议写成双档，避免口径漂移）：
  - **P0（严格）**：**0 个 API origin hits**（包含 `shared/almanac`）。任何“挂载级”同步请求都必须被 TTL / Inventory Check 拦截。
  - **P1（折中）**：允许 **最多 1 个轻量公共端点**请求（仅 `shared/almanac`），且必须满足：
    - **非阻塞首屏**：请求失败/超时不得影响首屏渲染与交互完成
    - **不可级联**：不得触发 `batch` / `stock-pool` / `profile` 等重端点的连锁请求
    - **边缘命中预期**：应命中 ISR/CDN（例如 `revalidate: 3600`），不得走重 DB 路径
- **Hot Start / Resume（活体回前台）**：当应用进程未被系统杀死（切后台 → 30s/2min/10min 后回前台），**回到可交互**前的 API origin hits 目标值：
  - **P0（严格）**：**0 个 origin hits**（包括 `shared/almanac`）。仅允许本地渲染 + 价格层/预测层由既定 polling 策略在“阈值到期后”触发。
  - **P1（可接受）**：允许 **仅价格层**在阈值到期后发起 1 次刷新（如 `/api/stock/prices`），但不得触发 `batch` / `stock-pool` / `profile`。
  - **iOS PWA 回归保护**：在 iPhone PWA standalone 模式下，至少覆盖 `pageshow` / `online` / `visibilitychange` 三类恢复事件，确保不会因事件缺失导致“长期不更新”。（若引入 hard stale cap，则以 hard stale cap 作为最终兜底触发器。）
- **Hot Nav**：`stock-pool ↔ dashboard` 往返 10 次，`/api/stock/batch` 与 `/api/stock-pool` 请求次数应接近 0（除非触发 hard stale cap 或确有增删标的）。
- **Correctness**：在 `401/403` 场景下，profile TTL 必须被强制失效并在一次交互内纠正授权状态。
- **Cross-Device Consistency（跨端一致性）**：在设备 A 增删 watchlist 后，设备 B 在可接受窗口内（需明确：例如 1-5 分钟 / 或“下次回前台”）能看到一致的 watchlist；若选择 12h TTL，则必须在此处明确这是一个产品 trade-off，并提供 mismatch 触发的强制校验路径。
- **Cost / Capacity Outcome（成本与容量）**：上线后一周对比（至少）：
  - Vercel function 调用次数与平均执行时间（重点：`/api/stock/batch`、`/api/stock-pool`、`/api/user/profile`）下降幅度
  - Turso Row Reads 与连接峰值（或错误率）下降幅度
  - 关键端点 p95 延迟不劣化（避免“省请求但单次更慢”的反效果）
- **Observability（可观测性）**：对每次“请求/不请求”的关键决策写入可定位字段（例如 skip reason：TTL 未过期 / inventory match / history sufficient / hard stale cap / 401 强制失效），确保出现 stale/权限问题时能在日志中快速归因。
