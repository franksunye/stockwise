---
title: "50. Plugin Architecture and Extensibility RFC"
doc_id: "engineering-plugin-architecture-and-extensibility-rfc-20260511"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-05-11"
summary: "定义 StockWise 应用内插件系统的最小可行架构：以核心对象稳定、插件能力受控、数据契约可并轨为原则，支持仓位预算等插件快速扩展。"
source_docs:
  - "docs/3_Product/Specs/trade_management/56_Risk_Management_R_Multiple_Calculator_Spec_20260509.md"
  - "docs/3_Product/Specs/trade_management/57_Position_Budget_Plugin_P0_Spec_20260511.md"
---

# 50. Plugin Architecture and Extensibility RFC

更新时间：2026-05-11

## 1. 背景

随着 `Spec 57` 启动应用内插件验证页，系统进入“会持续新增插件能力”的阶段。  
若缺少统一扩展架构，短期可上线，但中期会出现三类问题：

1. 插件直接耦合核心对象内部细节，升级成本上升。
2. 多插件并存时，权限与数据边界不清晰。
3. 插件从验证态并轨主链路时，需要二次迁移甚至重写。

WordPress 的经验可借鉴：**稳定扩展点 + 声明式能力 + 插件独立数据域**。  
本 RFC 目标是在 StockWise 栈内落地对应原则，但不复制其历史包袱。

## 2. 设计目标

1. 保持核心对象与主链路稳定：`User / Stock / Position / Event / Advice`。
2. 让新插件以“注册 + 声明 + 组合”的方式快速接入，而非改核心分支。
3. 让插件产出事实可追溯、可复盘、可并轨，不污染核心 canonical 表。
4. 为 `Spec 56/57` 的仓位预算插件提供首个参考实现。

## 3. 非目标

1. 不实现第三方开发者生态与外部市场。
2. 不在本阶段做动态远程插件下载或运行沙箱。
3. 不重构现有业务为“插件优先”，仅对新增能力启用该模型。

## 4. 架构原则（Platform Constitution）

1. **Core Stable**：核心对象 schema 只做向后兼容演进，不因单插件频繁改语义。
2. **Extension by Contract**：插件必须通过声明式契约（manifest + capability + hook）接入。
3. **Data Isolation**：插件事实默认独立命名空间/表；核心只保留必要关联与映射。
4. **Controlled Write**：插件不能绕过平台直接写核心 canonical 事实。
5. **Merge-Ready First Day**：插件验证态从第一天就对齐目标态字段语义，避免二次迁移。

## 5. 目标分层

| 层 | 职责 | 典型位置 |
| --- | --- | --- |
| `Core Layer` | 核心对象与主流程（交易管理、状态机、events） | `frontend/src/lib/*core*`, `api/user/trade-management/*` |
| `Plugin Runtime Layer` | 注册、加载、能力校验、hook 调度、开关 | `frontend/src/lib/plugins/runtime.ts`（建议） |
| `Plugin Domain Layer` | 插件业务逻辑、插件表、插件 API | `frontend/src/lib/plugins/<plugin-id>/*` |
| `UI Composition Layer` | 插件卡片/页面挂载与排序策略 | `dashboard/tools/*`, `TacticalBriefDrawer` slots（后续） |

## 6. 插件契约

### 6.1 Manifest（声明式元数据）

每个插件至少声明：

- `id`（全局唯一）
- `version`
- `status`（`experimental` / `active` / `deprecated`）
- `requires_core_schema`（最低核心 schema 版本）
- `capabilities`（见 §6.2）
- `ui_slots`（见 §6.3）
- `owner` / `maintainer`

建议路径：`frontend/src/plugins/<plugin-id>/manifest.ts`。

### 6.2 Capability（能力白名单）

首版能力集合（最小集）：

- `read:stock_context`
- `read:user_profile`
- `read:user_position`
- `write:plugin_snapshot`
- `write:plugin_preference`
- `emit:ui_card`

规则：

1. 插件默认零权限，manifest 明确申请。
2. Runtime 在 API 与 UI 两侧都做 capability 校验。
3. `write:core_event` 等高权限能力仅在并轨后、按插件逐个开放。

### 6.3 UI Slot（挂载槽位）

统一槽位名，避免组件硬编码：

- `dashboard.tools.primary`
- `dashboard.tools.secondary`
- `trade_management.decision.after_summary`
- `trade_management.management.after_action`

插件只声明可挂载槽位，不直接依赖具体页面结构。

## 7. Hook 机制（借鉴 WordPress 的最小实现）

### 7.1 Hook 类型

- `action`：副作用型，不改输入输出
- `filter`：转换型，可链式修改结果（首版谨慎开放）

### 7.2 首批建议 Hook 点

1. `onStockContextReady`
2. `onUserSessionReady`
3. `beforePluginSnapshotSave`
4. `afterPluginSnapshotSaved`
5. `beforePositionEventCreate`
6. `afterPositionEventSaved`
7. `beforeDecisionCardRender`
8. `afterManagementActionResolved`

### 7.3 执行约束

1. Hook 超时与异常不得阻断核心主链路（默认 fail-open + 错误上报）。
2. 同一 hook 多插件执行顺序可按优先级稳定排序。
3. Runtime 记录 hook 执行日志用于排错与回归。

## 8. 数据模型策略

### 8.1 核心 vs 插件数据边界

- 核心 canonical：`users`, `user_trade_positions`, `user_trade_position_events` 等
- 插件事实：`plugin_*` 或插件专属表（例如 `position_budget_snapshots`）

### 8.2 推荐命名规则

1. 表名：`<plugin_id>_<fact_plural>` 或 `plugin_<plugin_id>_<fact_plural>`
2. 主键前缀：`<plugin_short>_`
3. 必备列：`user_id`, `created_at`, `updated_at`（若可变）

### 8.3 并轨策略

并轨不是“迁移插件表到核心表”，而是“定义映射关系”：

1. 插件事实继续保留为独立审计源。
2. 在核心节点（如 events）写入必要映射字段。
3. 双写窗口结束后，按 RFC 决定是否保留插件事实表。

## 9. 版本与兼容

1. 为 Runtime 定义 `plugin_contract_version`（例如 `v1`）。
2. 核心升级若影响插件契约，需提供 deprecation window 与迁移说明。
3. 插件不能依赖未声明的内部函数或隐式字段。

## 10. 治理与发布

1. 插件默认 `experimental`，通过 feature flag 灰度。
2. 每个插件必须有 owner，离职或转移需完成维护者交接。
3. 任何新增 plugin table 需回答：
   - 该事实为什么不是核心 canonical？
   - 并轨映射点在哪里？
   - 退出策略是什么？

## 11. Plugin Stability Gate（严格门禁）

插件验证不能以牺牲 StockWise 1.0 国际化稳定版为代价。任何插件相关变更，只要触碰全局壳层、public site、Dashboard、共享组件、API、DB schema 或启动链路，必须先通过本门禁。

### 11.1 稳定边界

以下边界默认 **不允许破坏**；若破坏，结论只能是 `fix-before-merge`，不能以“插件实验”为理由放行：

1. **SSG / SEO**：`(site)` 下 public route 不得引入 `headers()`、`cookies()`、`unstable_noStore()` 等 request-time API，除非该 route 已明确移出静态关键路径并更新质量门禁。
2. **i18n 首屏一致性**：不得制造已知 hydration mismatch；应用态 `AppLocale` 与官网 `PublicLocale` 的边界必须清晰。
3. **首屏与启动体验**：不得无条件改写全局 splash / bootstrap / PWA 行为；failsafe 只能兜底异常，不得覆盖既有产品语义。
4. **Dashboard 稳定 UX**：共享组件改造不得降低已稳定的 Dashboard、自选池、详情卡与导航体验。
5. **API 与 DB 写入安全**：插件 API 必须使用服务端会话鉴权、服务端重算关键事实，并以实际 DB client 类型决定 cloud/local 分支。
6. **性能与缓存**：不得扩大关键 API payload、破坏既有 cache key 语义，或引入可避免的重复请求。
7. **质量门禁**：`build` 通过不是充分条件；必须同时尊重 `test:quality`、i18n 结构、Dashboard boundary、batch facts 等既有守护测试。

### 11.2 决策记录格式

插件相关变更至少记录以下字段：

| 字段 | 说明 |
| --- | --- |
| Impact domain | `plugin-only` / `shared-component` / `public-site` / `dashboard` / `api` / `db-schema` / `global-shell` |
| Stability contract | 触碰的 1.0 边界，如 SSG、i18n hydration、splash/boot、PWA、auth/session、API latency、DB writes、Dashboard UX |
| Decision | `accept` / `fix-before-merge` / `isolate` / `defer` / `remove` |
| Guardrail | 证明安全的检查，如 `pnpm run test:quality`、targeted lint、i18n tests、batch facts tests、手工路径 |
| Rollback | 生产异常时最小回滚路径 |

### 11.3 默认处理规则

1. `plugin-only` 且不触碰稳定边界：可 `accept`，但仍需基本 lint/build。
2. 触碰 `global-shell`、`public-site`、`dashboard`：默认 `fix-before-merge` 或 `isolate`。
3. 触碰 `api` / `db-schema`：必须有服务端鉴权、输入校验、可回滚 schema 策略和 cloud/local 双路径验证。
4. 共享组件只允许收敛重复逻辑；不得把单插件特例上升为全局默认行为。
5. 任何质量门禁失败都必须归因：本次引入则修复；已存在则单独列为外部阻塞，不与插件风险混在一起。

## 12. 仓位预算插件的参考实现（Spec 57）

`Spec 57` 作为首个 reference plugin，要求：

1. 偏好归用户域（`users` 扩展字段）。
2. 插件事实独立（`position_budget_snapshots`）。
3. API 走 `/api/user/trade-management/*`，但能力归属由 plugin runtime 管理。
4. P1/P2 并轨时将计划 R 映射到 `events`，而非覆盖插件事实源。

## 13. 分期建议

### Phase R0（当前）

1. 固化本 RFC
2. 在 `Spec 56/57` 建立引用
3. 先以仓位预算插件验证数据隔离与并轨可行性

### Phase R1

1. 落地 runtime 最小实现（manifest 注册 + capability 校验 + hook 调度）
2. 把仓位预算插件从“文档约定”升级为“runtime 托管”

### Phase R2

1. 第二个插件接入，验证多插件排序、冲突与开关治理
2. 补齐 observability 与插件健康面板

## 14. 验收标准

- [ ] 新插件接入无需改核心分支业务逻辑（仅注册与声明）
- [ ] 插件越权访问会被 runtime 拦截
- [ ] 插件异常不会导致核心链路失败
- [ ] 插件事实与核心事实关系可追溯
- [ ] 至少两个插件验证通过后再提升契约到稳定版

## 15. Runtime 文件结构建议（首版）

以下结构以“先跑通最小 runtime”为目标，不追求一步到位。命名可微调，但职责边界不应变化。

### 15.1 核心 runtime 目录

```text
frontend/src/lib/plugins/
  types.ts
  capabilities.ts
  slots.ts
  hooks.ts
  registry.ts
  runtime.ts
  guards.ts
  errors.ts
  index.ts
```

职责建议：

1. `types.ts`：`PluginManifest`、`PluginContext`、`HookPayload`、`PluginCapability`。
2. `capabilities.ts`：能力枚举、能力映射、能力校验 helper。
3. `slots.ts`：统一 UI slot 常量，避免字符串散落。
4. `hooks.ts`：hook 名称常量、hook handler 类型、执行顺序策略。
5. `registry.ts`：插件注册表（静态注册起步），支持按 feature flag 过滤。
6. `runtime.ts`：运行时入口（load / check / emit hook / collect ui contributions）。
7. `guards.ts`：运行时前置检查（manifest schema、contract version、capability 合法性）。
8. `errors.ts`：插件错误类型与序列化日志结构。
9. `index.ts`：对外暴露稳定 API，避免业务方直接 import 内部文件。

### 15.2 插件目录模板

```text
frontend/src/plugins/position-budget/
  manifest.ts
  server/
    service.ts
    repository.ts
    schema.ts
  client/
    page.tsx
    components/
      PositionBudgetCard.tsx
    hooks/
      usePositionBudget.ts
  shared/
    model.ts
    compute.ts
    validation.ts
```

职责建议：

1. `manifest.ts`：插件 id/version/capabilities/ui_slots/status。
2. `server/service.ts`：插件业务服务（不直接暴露 DB 细节给 route）。
3. `server/repository.ts`：插件事实读写 SQL（cloud/local 双策略）。
4. `server/schema.ts`：`ensure<Plugin>Schema`，集中管理 DDL。
5. `client/page.tsx`：插件独立页面容器（P0 形态）。
6. `shared/compute.ts`：纯计算函数（前后端共用，防止口径漂移）。
7. `shared/validation.ts`：参数边界与阻断逻辑。

### 14.3 API 路由组织建议

```text
frontend/src/app/api/user/plugins/position-budget/
  preferences/route.ts
  snapshots/route.ts
```

说明：

1. `trade-management` 归属的插件可先沿用现有路径（兼容 Spec 57），但建议在 runtime 稳定后迁到 `api/user/plugins/<plugin-id>/...`，减少领域歧义。
2. route 只负责鉴权、DTO、错误码；业务逻辑下沉到 `plugins/<id>/server/service.ts`。

### 14.4 业务接入点（最小清单）

1. Dashboard 工具入口：读取 runtime 注册表，渲染 `dashboard.tools.primary/secondary`。
2. Sidecar 扩展槽位：`trade_management.decision.after_summary` 与 `trade_management.management.after_action`。
3. 服务端 hook：快照保存前后、事件写入前后。

### 14.5 实施顺序建议

1. 第一步：建 `lib/plugins/*` 骨架 + `position-budget/manifest.ts` 静态注册。
2. 第二步：把 `Spec 57` 的计算与校验收口到 `shared/compute.ts` + `shared/validation.ts`。
3. 第三步：将快照 API 改为经 `service.ts`，route 只做薄层。
4. 第四步：在 Dashboard/Sidecar 引入 slot 渲染器，完成首个 UI 插件挂载。

## 15. 结论

StockWise 的插件系统不追求“可运行任意代码”，而是追求：

1. 快速新增能力
2. 核心对象稳定
3. 数据事实可并轨

一句话收口：

**用 WordPress 的扩展思想，但用 StockWise 的领域边界来落地。**
