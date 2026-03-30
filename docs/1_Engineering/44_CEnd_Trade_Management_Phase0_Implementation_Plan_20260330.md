---
title: "44 C 端交易管理 Phase 0 工程实施清单（2026-03-30）"
doc_id: "engineering-cend-trade-management-phase0-implementation-plan-20260330"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-30"
summary: "将 C 端交易管理 Phase 0 落实到 Dashboard/TacticalBriefDrawer 的前端工程实施清单，覆盖信息架构、缓存策略、接口边界、文件拆分、验证与 no-regression 守则。"
---

# 44 C 端交易管理 Phase 0 工程实施清单（2026-03-30）

## 1. 本文档解决什么问题

产品 Spec 已经明确三件事：

1. 交易管理要以 sidecar 方式进入 C 端
2. Phase 0 采用 `内参 / 决议 / 管理` 三 tab 过渡结构
3. Phase 0 的最小闭环是：
   - 无持仓态轻入口
   - 最小持仓录入
   - 持仓管理卡展示

本文件只回答一个问题：

**在不破坏当前前端稳定性的前提下，如何把这条能力最小风险地接到现有 Dashboard / TacticalBriefDrawer 里。**

---

## 2. 工程总原则

### 2.1 不破坏当前 Dashboard 主链路

必须保持以下事实不变：

1. Dashboard 首页继续秒开
2. 现有 watchlist / stock batch / bootstrap 主链路不重构
3. 不把交易管理数据并入 `/api/stock/batch`

### 2.2 不重写 Tactical 主内容层

Phase 0 只新增：

- 第三个 tab：`管理`

但不应重写：

- `内参`
- `决议`
- Tactical 当前主内容结构

### 2.3 局部缓存，避免全局缓存扩散

交易管理数据面应采用：

1. 局部 hook
2. 局部 SWR
3. 局部 session snapshot

不应采用：

1. 全局持久化 SWR provider
2. 进入 Dashboard 即预取所有管理数据
3. 把管理对象写进首页主快照

### 2.4 最小 UI，最小状态，最小请求

Phase 0 的原则是：

1. 只做能形成闭环的最小 UI
2. 只引入必要状态
3. 只在用户进入 `管理` tab 后按需拉取

---

## 3. Phase 0 的正式范围

### 3.1 必做

1. TacticalBriefDrawer 增加第三个 tab：`管理`
2. `管理` tab 展示最小功能集合：
   - 仓位摘要条
   - 今日管理建议卡
   - 持仓状态标签
   - 建议更新时间
   - 轻量操作区
   - 无持仓态轻入口
3. 最小持仓录入入口
4. 管理数据独立 API
5. 管理 tab 局部缓存

### 3.2 不做

1. 不做组合级管理视图
2. 不做自选池聚合管理
3. 不做完整执行历史页
4. 不做券商级同步
5. 不做 batch payload 扩容
6. 不做 Tactical/Council 内容层重构

---

## 4. 当前前端路径与改动点

### 4.1 当前真实路径

当前 Dashboard 单票详情相关路径如下：

1. 首页主卡点击
2. 打开 `TacticalBriefDrawer`
3. Drawer 当前包含：
   - `策略内参`
   - `投研决议`

当前入口相关文件：

- [`frontend/src/app/(dashboard)/dashboard/page.tsx`](/Users/yesun/Code/stockwise/frontend/src/app/(dashboard)/dashboard/page.tsx)
- [`frontend/src/components/dashboard/StockDashboardCard.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/StockDashboardCard.tsx)
- [`frontend/src/components/dashboard/StockVerticalFeed.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/StockVerticalFeed.tsx)
- [`frontend/src/components/dashboard/TacticalBriefDrawer.tsx`](/Users/yesun/Code/stockwise/frontend/src/components/dashboard/TacticalBriefDrawer.tsx)

### 4.2 Phase 0 的最小前端改动面

建议只触达以下区域：

1. `TacticalBriefDrawer.tsx`
   - 新增 `管理` tab
   - 按 tab 分流内容
2. 新增 `trade-management` 局部组件
3. 新增 `trade-management` 局部 hook
4. 新增 `trade-management` 局部 surface/helper
5. 新增用户私有 API route

不应触达：

1. `useDashboardData`
2. `StockContext`
3. `/api/stock/batch`
4. Dashboard bootstrap / refresh contract

---

## 5. 推荐目录拆分

### 5.1 前端组件

建议新增：

```text
frontend/src/components/dashboard/
  TradeManagementTab.tsx
  TradeManagementSummaryBar.tsx
  TradeManagementAdviceCard.tsx
  TradeManagementEmptyState.tsx
  TradeManagementEntryDrawer.tsx
```

说明：

1. `TradeManagementTab.tsx`
   - `管理` tab 的内容编排层
2. `TradeManagementSummaryBar.tsx`
   - 仓位摘要条
3. `TradeManagementAdviceCard.tsx`
   - 今日管理建议卡
4. `TradeManagementEmptyState.tsx`
   - 无持仓态轻入口
5. `TradeManagementEntryDrawer.tsx`
   - 最小持仓录入抽屉

### 5.2 前端逻辑层

建议新增：

```text
frontend/src/hooks/
  useTradeManagementSurface.ts

frontend/src/lib/
  trade-management-client.ts
  trade-management-surface.ts
  trade-management-cache.ts
```

职责建议：

1. `trade-management-client.ts`
   - fetch API
   - 请求参数与响应归一
2. `trade-management-surface.ts`
   - 轻量展示字段派生
   - 状态标签文案
   - 建议卡显示逻辑
3. `trade-management-cache.ts`
   - session snapshot 读写
   - TTL 与 key 管理
4. `useTradeManagementSurface.ts`
   - SWR orchestration
   - loading / empty / hasPosition / canCreate 状态统一

---

## 6. 前端信息架构

### 6.1 TacticalBriefDrawer Phase 0 结构

顶部 segmented control 改为：

1. `内参`
2. `决议`
3. `管理`

其中：

1. `内参`
   - 保持现状
2. `决议`
   - 保持现状
3. `管理`
   - 新增

### 6.2 `管理` tab 的内容结构

从上到下建议为：

1. `TradeManagementSummaryBar`
2. `TradeManagementAdviceCard`
3. `轻量操作区`
4. `次级入口`
   - 查看管理详情
   - 已执行 / 稍后处理

如果无持仓：

1. 不显示 SummaryBar
2. 显示 `TradeManagementEmptyState`
3. CTA 打开 `TradeManagementEntryDrawer`

### 6.3 交互优先级

必须保证：

1. 默认打开 Drawer 仍停留用户上次使用的分析 tab 或当前默认逻辑
2. 只有用户主动进入 `管理` tab 时，才拉管理数据
3. 不因为新增第三个 tab 让当前 Tactical 初始渲染变慢

---

## 7. 状态与数据流

### 7.1 TacticalBriefDrawer 内部状态建议

当前 `activeTab` 是：

- `brief`
- `council`

Phase 0 建议升级为：

- `brief`
- `council`
- `management`

但管理 tab 的数据状态不应混入 Tactical 现有内容状态。

### 7.2 `useTradeManagementSurface` 返回值建议

建议统一返回：

```ts
type TradeManagementSurfaceState = {
  loading: boolean;
  error: string | null;
  hasPosition: boolean;
  canCreatePosition: boolean;
  position: TradePositionCard | null;
  advice: TradeManagementAdviceCard | null;
  updatedAtLabel: string | null;
  actions: {
    canMarkExecuted: boolean;
    canOpenDetail: boolean;
  };
};
```

### 7.3 为什么要单独建 surface hook

因为当前 Tactical / Council 已各自有内容层与缓存层。

管理层也应保持同样风格：

1. 组件只消费 surface
2. fetch / cache / empty state 由 hook 封装
3. 不在 `TacticalBriefDrawer.tsx` 内散落业务判断

---

## 8. API 与服务端拆分

### 8.1 Phase 0 最小 API

建议新增：

1. `GET /api/user/trade-management/stock?symbol=...`
   - 返回：
     - 当前 symbol 的 position
     - 最新 advice
     - 是否允许创建 position
2. `POST /api/user/trade-management/positions`
   - 创建最小持仓
3. `POST /api/user/trade-management/positions/:positionId/ack`
   - 可选
   - 用于 `已执行` 的极简核销

### 8.2 为什么不直接复用 admin 接口

当前 admin 接口是：

- detail-oriented
- admin-auth
- 偏后台管理语义

Phase 0 前台需要的是：

- 单票最小读取接口
- 用户会话权限
- 更轻的 DTO

因此建议：

1. 前台 route 独立
2. 共享 query/helper 可复用
3. auth 和 DTO 单独收口

### 8.3 服务端复用建议

可复用：

- [`frontend/src/lib/admin-trade-positions.ts`](/Users/yesun/Code/stockwise/frontend/src/lib/admin-trade-positions.ts)

但应新增前台向的 helper，而不是直接让前台 route 使用 admin 命名。

建议新增：

```text
frontend/src/lib/user-trade-management.ts
```

职责：

1. 查询当前用户某 symbol 的 position
2. 查询最新 advice
3. 创建最小持仓
4. 返回前台 DTO

---

## 9. 缓存与秒开策略

### 9.1 必须遵守的前端缓存原则

遵循现有前端原则：

1. Dashboard 主链路秒开优先
2. 局部数据面局部缓存
3. SWR 是运行时请求编排层，不是全局持久化仓库

### 9.2 管理 tab 的缓存策略

建议采用：

1. 内存缓存
2. `sessionStorage` snapshot
3. 局部 SWR `fallbackData`

不建议采用：

1. `localStorage` 长期持久化
2. 写入 Dashboard 主快照
3. 全局 provider

### 9.3 为什么用 `sessionStorage`

因为管理 tab 属于：

- 用户主动进入的次级数据面
- 会话内会反复打开
- 但不值得写入首页主快照

所以 `sessionStorage` 最合适。

### 9.4 建议缓存 key

```text
stockwise:trade-mgmt:v1:${userId}:${symbol}
```

### 9.5 建议 TTL

建议：

- `5min - 15min`

理由：

1. 管理建议不会像价格一样高频跳变
2. 但又不能像长期内容一样放太久

---

## 10. 性能与 no-regression 守则

### 10.1 严禁触碰的层

Phase 0 不应修改：

1. `Dashboard bootstrap`
2. `useDashboardData`
3. `useDashboardRefreshContract`
4. `/api/stock/batch`
5. Tactical / Council 现有请求语义

### 10.2 动态导入建议

以下组件应保持按需加载或新增按需加载：

1. `TacticalBriefDrawer`
2. `TradeManagementEntryDrawer`
3. 管理详情子层

### 10.3 请求触发建议

只在以下条件下请求管理数据：

1. Drawer 已打开
2. `activeTab === 'management'`
3. 当前 symbol 有效

### 10.4 禁止事项

禁止：

1. 打开 Tactical 时同时并发拉 Council + Management + 其他新增请求
2. 在首页卡片层预取所有 symbol 的管理对象
3. 通过轮询刷新管理数据

---

## 11. 实施步骤

### Step 1：数据契约与前台 helper

新增：

1. `user-trade-management.ts`
2. `trade-management-client.ts`
3. `trade-management-surface.ts`

完成目标：

- 后台 DTO 收口
- 前台 DTO 收口
- 单票最小读取接口定义完成

### Step 2：只读 `管理` tab

新增：

1. `TradeManagementTab.tsx`
2. `TradeManagementSummaryBar.tsx`
3. `TradeManagementAdviceCard.tsx`

接入：

- `TacticalBriefDrawer.tsx`

完成目标：

- `内参 / 决议 / 管理` 三 tab
- 已持仓态可读
- 无持仓态轻入口可见

### Step 3：最小持仓录入

新增：

1. `TradeManagementEntryDrawer.tsx`
2. `POST /api/user/trade-management/positions`

完成目标：

- 用户能从无持仓态进入最小录入闭环

### Step 4：轻量核销

可选接入：

1. `已执行`
2. 极简 ack route

若时间不够，可延后。

---

## 12. 验证清单

### 12.1 静态验证

1. TacticalDrawer 三 tab 布局不挤压
2. `内参 / 决议` 内容无回归
3. `管理` tab 为空时不出现空白页

### 12.2 交互验证

1. 打开 Tactical 默认仍正常
2. 切到 `管理` 时才触发管理请求
3. 关闭再打开 Drawer，session snapshot 可复用
4. 无持仓用户能进入最小录入流程
5. 已持仓用户可看到建议卡

### 12.3 no-regression 验证

至少检查：

1. Dashboard 冷开
2. Dashboard 硬刷新
3. 单票切换
4. Tactical 打开关闭
5. `内参 / 决议` 切换

如有代码改动，执行：

- Tactical 相关目标 lint
- Dashboard 页面目标 lint

---

## 13. 当前推荐结论

1. Phase 0 不应碰 Dashboard 主链路
2. Phase 0 以 `内参 / 决议 / 管理` 三 tab 进入前台
3. 管理数据必须独立 route、独立 hook、独立局部缓存
4. 必须遵守现有前端原则：
   - 秒开
   - 局部 SWR
   - 局部 session snapshot
   - no-regression
5. 最小闭环必须包含：
   - 无持仓态轻入口
   - 最小持仓录入
   - 管理建议展示

一句话收口：

**Phase 0 的工程目标不是把交易管理做完整，而是在不破坏当前择时体验的前提下，把它以最轻、最稳、最可演进的方式挂上去。**
