## 1. Purpose

本说明文档聚焦一个非常具体的问题：

- 页面：Dashboard 中的「策略内参 + 投研决议」抽屉（`TacticalBriefDrawer` + `AICouncil`）。
- 现象：用户在同一只股票、同一交易日内，会**高频反复打开投研决议**做推敲；但当前实现每次都感觉在重新拉数据，冷启动 / 返回应用时尤为明显。
- 目标：在不破坏现有架构分层的前提下，让「投研决议」具备与首页 / 投资黄历类似的 **本地秒开 + 后台静默拉新** 体验。

本方案只做「前端本地快照层」设计，不改后端表结构与 API 契约。

相关设计文档：

- `46_Frontend_SWR_Architecture_Upgrade.md`
- `23_PWA_Dashboard_Refresh_Strategy_Regression_20260313.md`
- `25_Onboarding_First_Load_Recovery_Plan_20260314.md`
- `30_Stock_Data_Layers_And_API_Boundaries_20260316.md`

本说明与它们的关系：

- 延续「持久化快照层 + SWR 运行时层」的分层原则；
- 不推动 Dashboard 主链路再次大改，只在 **投研决议这一块局部数据面** 增加快照。
- 与价格刷新职责拆分（`/api/stock/batch` vs `/api/stock/prices`）解耦：本方案只关注 `/api/predictions` 提供的投研决议数据，价格层刷新由独立的轻量 API 负责，详见 `30_Stock_Data_Layers_And_API_Boundaries_20260316.md`。

---

## 2. Current Behavior (Baseline)

### 2.1 数据入口与组件

- 投研决议展示组件：`frontend/src/components/dashboard/AICouncil.tsx`
- 容器抽屉：`frontend/src/components/dashboard/TacticalBriefDrawer.tsx`
- Dashboard 入口：`frontend/src/app/(dashboard)/dashboard/page.tsx`

数据链路（当前）：

1. 抽屉打开或预加载时，调用 `preloadAICouncil(symbol, targetDate)`。
2. `preloadAICouncil` 使用 SWR 的 `preload(key, fetcher)` 启动请求，但不做持久化。
3. `AICouncil` 组件内部通过：
   - `useSWR(['ai-council', symbol, targetDate], fetchCouncilData, { ... })` 获取数据；
   - `fetchCouncilData` 访问 `/api/predictions?symbol=...&limit=10&mode=full&targetDate=...`。
4. 返回结果在内存中经过一层 `CouncilCachePayload` 封装：
   - `councilSnapshotCache: Map<string, { data: AIPrediction[]; fetchedAt: number }>`
   - TTL：`CACHE_TTL = 5min`

重要特性：

- **Service Worker 显式绕过 `/api/`**  
  `frontend/public/sw.js` 对 `/api/` 请求采用「直接放行、不缓存」策略，因此投研决议数据不会进入 SW 层缓存。

- **SWR 层配置偏向「始终新鲜」**
  - `revalidateOnFocus: false`
  - `revalidateIfStale: !isFresh`
  - `revalidateOnMount: !isFresh`

其中 `isFresh` 只看内存 `councilSnapshotCache` 的 TTL。冷启动 / 进程被系统杀死 / 切换 symbol / TTL 过期时，用户体感就是「再次请求」。

### 2.2 与首页 / 黄历 / 策略内参的差异

对比已有的「秒开」链路：

- Dashboard 主列表 / 投资黄历 / 策略内参：
  - 已有本地快照（`localStorage` + 入口 bootstrap 状态）。
  - 冷启动时可以先渲染 **旧数据快照**，再在后台重验证。

- 投研决议（顾问席 / 复核意见）：
  - **仅有内存缓存**（Map + SWR），无跨刷新 / 跨会话快照。
  - 冷启动后重新进入同一股票的投研决议时，仍需要等一次请求。

---

## 3. Product Intent for Investment Mode Decisions

结合「投研决议」在产品中的定位，本页面属于：

- 高价值、**深推敲型** 数据面；
- 同一股票、同一日期的决议内容，在短时间内不会变化（基础数据来自 batch 预测和决策日志）；
- 用户常见行为：
  - 切换回 App 后继续看前一次的投研结论；
  - 在策略内参和投研决议之间多次往返；
  - 当天内多次回来复盘同一条决议。

因此，合理的体验基线应为：

1. **只要最近一次决议已经成功加载过，同一 symbol+date 再次进入时应秒开。**
2. 决议内容允许在后台静默更新，但不需要「每次打开都强制重新拉一遍」。
3. 部分轻微陈旧是可接受的（例如 30 分钟内），但「长时间极旧」应有再验证或提示。

---

## 4. Design Principles (Aligned with SWR Spec)

参考 `46_Frontend_SWR_Architecture_Upgrade.md` 的分层判断，本方案遵守：

1. **分层缓存语义**：
   - 第一层：**持久化快照层**（跨刷新 / 跨冷启动）。
   - 第二层：**SWR 运行时层**（会话内请求编排、去重、重验证）。

2. **首帧不退化**：
   - 只要存在可用旧数据，即使网络暂不可用，首帧也应优先展示旧快照，而不是 loading 状态。

3. **运行时刷新非阻塞**：
   - 决议静默刷新不应影响当前 UI 结构、不应打断用户阅读。

4. **范围控制**：
   - 本方案仅针对「投研决议 (AICouncil)」数据面；
   - 不扩展到 Dashboard 主链路 / Watchlist / 其他数据面；
   - 不改变 Service Worker 对 `/api/` 的绕过策略。

---

## 5. Proposed Architecture: Local Snapshot for AICouncil

### 5.1 快照载体

- **首选：`sessionStorage`**
  - 理由：
    - 每次浏览器进程完全关闭后自然清空；
    - 适合「会话内频繁查看、跨冷启动但不刻意长久保留」的行为模式；
    - 相比 `localStorage`，容量和寿命更可控，减少长时间陈旧快照的风险。

- 备选：`localStorage`
  - 若后续发现 session 级别不足（用户频繁完全退出应用），可以再做扩展；
  - 需要配合更严格的 TTL 与版本标记。

### 5.2 快照 Key 设计

Key 形如：

```text
ziso:ai-council:v1:${symbol}:${targetDate}
```

说明：

- `v1`：快照结构版本号，未来结构变更时可以整体失效；
- `symbol`：股票代码（例如 `SH600519`）；
- `targetDate`：决策目标交易日（`YYYY-MM-DD`），与当前 `AIPrediction.target_date` 一致。

### 5.3 快照内容结构

与现有内存缓存保持一致，便于互相复用：

```ts
interface CouncilCachePayload {
  data: AIPrediction[];
  fetchedAt: number; // epoch ms
}
```

序列化为 JSON 存入 `sessionStorage`。

### 5.4 TTL 策略

建议默认 TTL：**30 分钟**，独立于内存 `CACHE_TTL = 5min`。

原因：

- 5 分钟对冷启动场景偏短（市价/决议本身不会在几分钟内大量重写）；
- Dashboard 主批量预测已经有自己的刷新与回测节奏，投研决议更偏「解释层」，容忍度更高；
- 30 分钟可以覆盖「盘中多次往返」「收盘后复盘」的大多数场景。

可选控制：

- 若后续实验表明 30 分钟过长，可以改为 10–15 分钟；
- 或为盘后 / 盘中分别定义不同 TTL（需要额外时间维度判断，这一版不做）。

---

## 6. Runtime Behavior with Snapshot Layer

### 6.1 加载流程（单个 symbol + date）

1. **尝试从内存 Map 命中 (`councilSnapshotCache`)**
   - 命中且在 `CACHE_TTL` 内：
     - 当前行为保持不变：SWR `fallbackData` 使用内存 payload；
   - 未命中或过期：继续下一步。

2. **尝试从 sessionStorage 快照命中**
   - 读取 `ziso:ai-council:v1:${symbol}:${targetDate}`；
   - 若 JSON parse 成功且 `Date.now() - fetchedAt <= SNAPSHOT_TTL`：
     - 将该快照作为 `fallbackData` 传给 SWR；
     - 标记为「已拥有快照」，用于后续重验证策略。

3. **SWR 初始化**

```ts
useSWR(
  swrKey,
  fetchCouncilData,
  {
    fallbackData: payloadFromMemoryOrSnapshot,
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateOnMount: shouldRevalidateOnMount, // 见下节
    revalidateIfStale: shouldRevalidateIfStale,
    dedupingInterval: 10_000,
    onSuccess: (nextPayload) => {
      setCouncilSnapshot(snapshotKey, nextPayload);     // 内存 Map
      writeSessionSnapshot(snapshotKey, nextPayload);   // sessionStorage
    },
  }
);
```

4. **请求成功后**
   - 内存 Map 和 sessionStorage 双写；
   - 下一次访问同一 symbol+date 时，无论是同会话还是冷启动后，都会先看到快照。

### 6.2 重验证策略

为了避免「每次打开就立即重拉」仍然造成体感抖动，建议：

- 当「有快照」时：
  - `revalidateOnMount = false`（或延迟一段时间再手动触发）；
  - `revalidateIfStale = false`；
  - 可选：在 app 回到前台时（`visibilitychange` / `focus`）挂一条全局轻量逻辑，对当前 symbol+date 做一次非阻塞重验证（不一定首版就做）。

- 当「无快照」时：
  - 保持现有配置：`revalidateOnMount = true`，`revalidateIfStale = true`；
  - 首次请求仍然是「从网络来」。

这样用户体感为：

- 已经看过的投研决议 → 秒开旧内容；
- 后台偶尔重刷 → 只会更新内容，不打断阅读；
- 刚换 symbol / 首次看某只股票 → 仍需一次请求。

---

## 7. Failure Modes & Guardrails

### 7.1 存储异常 / 空间不足

所有写 snapshot 操作必须是「最佳努力」：

- 写失败（`QuotaExceededError` / JSON 序列化异常）时：
  - 不影响 UI；
  - 不影响 SWR 运行；
  - 只是不再享有「跨冷启动秒开」能力。

### 7.2 结构变更 / 版本升级

通过快照 key 中的版本位 `v1` 控制：

- 若未来 `CouncilCachePayload` 结构或 `AIPrediction` 需要兼容升级：
  - 将 key 改为 `v2`；
  - 旧快照自动「冷落」（sessionStorage 项仍可存在，但不会再被读取）。

### 7.3 极端陈旧快照

因为采用 sessionStorage + 短 TTL，单次浏览器进程生命周期内不会出现「跨多日陈旧」。

若后续引入 `localStorage` 持久快照，则需要额外：

- 按日期或 `as_of_date` 添加「交易日跨度」约束；
- 超过一定自然日后，视为不可用。

---

## 8. Implementation Plan (Small, Revertible Steps)

### Step 1: 增加快照工具函数（AICouncil 内部自用）

文件：`frontend/src/components/dashboard/AICouncil.tsx`

- 新增：
  - `readSessionSnapshot(snapshotKey): CouncilCachePayload | null`
  - `writeSessionSnapshot(snapshotKey, payload): void`
  - `buildSnapshotKey(symbol, targetDate): string`

行为要求：

- SSR 下不访问 `window` / `sessionStorage`；
- 捕获 JSON parse / stringify 异常；
- 不抛错到调用方。

### Step 2: 整合到现有 SWR 初始化逻辑

在现有：

- `fallbackPayload = getCouncilSnapshot(snapshotKey);`

之后插入：

1. 若 `fallbackPayload` 为空，则尝试 `readSessionSnapshot`；
2. 根据是否存在快照调整 `isFresh`、`revalidateOnMount` 与 `revalidateIfStale`；
3. 在 `onSuccess` 写入内存与会话快照。

### Step 3: 真实设备验证

验证路径：

1. iPhone PWA + 浏览器，港股与 A 股各至少一只标的；
2. 步骤：
   - 打开 Dashboard，进入某只股票；
   - 打开策略内参 → 切到投研决议；
   - 关闭抽屉，多次反复打开；
   - 切出 App / 切回，同样多次反复打开；
   - 在 30 分钟窗口内尽量模拟用户真实行为。

通过标准：

1. **已查看过的 symbol+date 再进入时，不出现可感知 loading 动画**；
2. 再进 App（进程仍在）时「投研决议」仍然秒开；
3. 会话被系统完全杀掉后重新打开，第一次进入时允许出现加载；
4. 未观察到「完全错误的数据重用」（例如换标的仍显示旧 symbol 的决议）。

### Step 4: 如有必要，再评估与首页批量链路的更深复用

本轮实现先刻意不触碰：

- `/api/stock/batch` 响应结构；
- Dashboard 主批量预测逻辑；
- Watchlist 与 AICouncil 之间的 key 合并。

待本地快照稳定后，再评估：

- 是否将「当日主模型决议」在 batch 响应中附带精简信息；
- 是否在客户端首次拿到 batch 响应时就预先写入决议快照（避免额外首请求）。

---

## 9. Summary

本方案的核心判断：

1. 「投研决议」属于高价值、反复查看的解释层数据面，非常适合具备 **本地秒开 + 静默拉新** 的体验；
2. 在现有架构下，不需要大改即可通过 **sessionStorage 快照层 + 30 分钟 TTL** 达成这一目标；
3. 该快照层与 Dashboard 已有的「本地快照 + SWR 运行时层」理念保持一致，且仅作用于 `AICouncil`，风险可控、易于回滚。

执行顺序严格遵循「先文档、后代码，小步、可验证、可回滚」的标准。

