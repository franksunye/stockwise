---
title: "功能规格说明书：仓位预算插件版（Position Budget Plugin P0）(Spec 57)"
doc_id: "spec-position-budget-plugin-p0-20260511"
doc_domain: "product"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-05-11"
summary: "定义仓位预算能力的插件验证版：独立 PC 页面先行，以最小耦合验证 1R 预算使用价值，并在数据契约、持久化与并轨条件上与 Spec 56 保持一致；选股侧与 Dashboard 自选池共用 `useStockSymbolSearch` + `StockSymbolSearchField`，避免重复实现。"
source_docs:
  - "docs/3_Product/Specs/trade_management/56_Risk_Management_R_Multiple_Calculator_Spec_20260509.md"
  - "docs/1_Engineering/50_Plugin_Architecture_And_Extensibility_RFC_20260511.md"
---

# 功能规格说明书：仓位预算插件版（Position Budget Plugin P0）(Spec 57)

## 1. 一句话定义

**仓位预算插件版是 Spec 56 的验证实现层：先以独立页面快速验证“1R 预算是否高频、可持续被使用”，同时保证计算语义与数据契约可无缝并入主系统。**

---

## 2. 与 Spec 56 的关系

### 2.1 定位关系

- `Spec 56`：目标态产品规格（sidecar 内嵌、状态机语义完整融合）
- `Spec 57`：验证态工程规格（插件先行、最小耦合、可并轨）

### 2.2 不变约束

插件版不是“另做一个交易计算器产品”，以下约束保持不变：

1. 仍采用 `R` 风险预算语义，不改口径
2. 仍使用三种模式（跟随系统位 / 固定止损价 / 百分比止损）
3. 仍禁止伪字段（`confidence_score` 等）
4. 仍要求服务端持久化，不走 LocalStorage
5. 仍保留可见免责声明与参数阻断规则

### 2.3 插件先行的目的

插件版只验证三件事：

1. 用户是否持续使用“预算先行”流程
2. 用户是否能理解并执行“1R 纪律”语言
3. 计划 R 事实是否具备后续复盘价值

---

## 3. 适用范围与边界（P0）

### 3.1 P0 要做

1. 提供 PC 端独立可访问页面（插件入口）
2. 支持匿名用户会话与已登录用户双态
3. 支持股票档案预填（代码、名称、关键位候选）
4. 支持三种 R 模式与实时计算
5. 保存用户偏好与本次计划 R 快照到服务端

### 3.2 P0 不做

1. 不改动 `TacticalBriefDrawer` 现有结构
2. 不接入完整 6 状态机分语义渲染
3. 不做 AI 计划 vs 实际对比报告
4. 不做移动端专门适配（先以 PC 可用为准）
5. 不引入新前端依赖栈

### 3.3 插件版本与国际化范围（0.1）

本插件按 **0.1 / P0 验证版**交付即可，以下范围**刻意保持现状**，不阻塞验证：

1. **国际化**：与 Dashboard 一致，仅使用应用内 `AppLocale`（`cn` / `en`）及 `messages/cn.json`、`messages/en.json` 中的 `positionBudget` 命名空间；**不对齐**官网营销路由的四语模型（`PublicLocale`：`en` / `cn` / `ko` / `es`）。浏览器语言为韩语、西语等时，沿用现有 `resolveLocale` 行为（归入英文应用界面）。
2. **后续**：若并轨主版本或独立产品化，再评估是否扩展 `AppLocale`、增加 `ko`/`es` 词条或与官网四语统一入口。

---

## 4. 目标用户与使用场景

### 4.1 用户类型

1. 访客用户：未登录但希望快速测算风险预算
2. 已登录用户：希望留存参数与预算事实，后续可复盘

### 4.2 典型路径

1. 选择股票（手动输入或从股票档案预填）
2. 确认入场价 / 止损位 / 风险比例
3. 查看 `position_size / expected_loss / r_multiple`
4. 保存预算快照（匿名会话或登录用户）

---

## 5. 数据契约（与主系统对齐）

### 5.1 字段来源优先级

插件版沿用 Spec 56 的字段逻辑：

1. 入场价：用户输入为主，可被预填覆盖
2. 止损位：
   - 优先 `key_levels.stop_loss_reference`
   - 其次 `tactics.empty[].stop_loss_price`
   - 最后用户手动输入
3. 目标位：
   - 优先 `tactics.empty[].target_price`
   - 其次 `key_levels.strong_resistance`
   - 缺失可为空

### 5.2 统一计算口径

1. `risk_amount = account_size * risk_ratio`
2. `position_size = floor(risk_amount / risk_per_share)`
3. `expected_loss = position_size * risk_per_share`
4. `expected_profit = position_size * (target_price - entry_price)`（目标位有效时）
5. `r_multiple = (target_price - entry_price) / risk_per_share`（目标位有效时）

### 5.3 参数边界与阻断

1. `risk_ratio` 默认 `1%`
2. `risk_ratio > 2%` 黄色提示
3. `risk_ratio > 5%` 阻断提交
4. `risk_per_share <= 0` 阻断
5. `position_size * entry_price > account_size` 阻断

---

## 6. 账号体系与持久化

### 6.1 会话策略

1. 匿名态：使用匿名会话标识（`anonymous_user_id` 或等价 session 主键）
2. 登录态：使用正式 `user_id`
3. 升级态：匿名数据支持归并到登录用户（可延后到 P1，但字段需预留）

工程实现上，当前 StockWise 前台以 **签名 Cookie 会话 + `user_*` id** 统一承载匿名与登录（见 §12.2）；产品语义上的「访客」仍成立。

### 6.2 服务端持久化对象（P0 最小集合）

1. 用户偏好（复用用户域，不单建偏好表）：
   - `default_account_size`
   - `default_risk_ratio`
   - `default_r_mode`
2. 预算快照（建议新建轻量表或事件扩展）：
   - `user_id`（会话解析，产品上的访客与登录均映射为 `user_*`）
   - `symbol`
   - `entry_price`
   - `stop_loss_price`
   - `target_price`（可空）
   - `account_size`（快照时用于计算的账户规模）
   - `risk_ratio`
   - `risk_per_share`
   - `risk_amount`
   - `position_size`
   - `expected_loss`
   - `r_mode`
   - `created_at`

列级 DDL 见 §12.4。

### 6.3 隐私边界

1. `account_size` 仅用于预算计算，不进入分析主链路
2. 不写入 `/api/stock/batch`
3. 不出现在 admin 公开看板
4. UI 明确提示“仅用于风险预算辅助”

---

## 7. 插件入口与页面形态

### 7.1 入口建议

插件入口为**独立路由组**（与 Dashboard 布局解耦），例如：

- `/tools/position-budget`（canonical）
- 旧路径 `/dashboard/tools/position-budget` 仅作 302 跳转至 canonical（避免书签失效）

**PC 与官网策略**：主产品壳（`app.ziso.cc`）以竖屏 Dashboard 为主，偏移动端体验；**对外主入口应放在官网（`ziso.cc`）**，避免用户误以为只能从 App 内找工具。实现上在官网页脚「资源」区提供绝对链接，直达 Web App 工具页：

- `https://app.ziso.cc/tools/position-budget`

本地开发为相对路径 `/tools/position-budget`；生产环境对外传播以官网页脚 + 上述绝对 URL 为准。

**与邀请墙（Invite Wall）的关系**：主 Dashboard 布局内嵌邀请制校验；本工具页**不得**挂在 `dashboard/layout` 之下，否则未兑换邀请码的用户无法使用，与「开放工具 / 访客可算」的产品定位冲突。实现上采用与 `paper-portfolio-lab` 相同的「站点根下独立 route」模式，**不经过** `InviteWall`。

**与 PWA 的关系**：PWA 安装的是同一 Web App（`manifest` + `sw.js` 同源）。用户从主屏幕打开后仍可访问 `/tools/position-budget`；该页**不依赖** Dashboard 授权壳，行为与浏览器标签页一致。

**「匿名」的工程含义**：无需注册邮箱，但首次调用受保护 API 前仍会走 `POST /api/user/register` 下发 **隐式 `user_*` + 签名会话 Cookie**，以便落库偏好与快照；这不是「零身份公网裸 API」，而是**低摩擦访客身份**，与主 App 邀请墙无绑定。

### 7.2 页面结构（P0）

1. 顶部：股票信息与预填状态（**代码检索**与 Dashboard 自选池共用 §12.3.1 模块；可选自选快捷入口）
2. 中部：三种 R 模式参数区
3. 右侧/下方：预算结果卡（1R、仓位、风险提示）
4. 底部：保存按钮 + 免责声明

### 7.3 文案约束

允许：

- “基于您的参数，建议仓位规模为 …”
- “若触发止损，本次预计亏损为 …（1R）”

禁止：

- “AI 推荐买入 …”
- “最大胜率 …”
- “按此操作即可盈利 …”

---

## 8. API 方案（P0 草案）

### 8.1 读取偏好

`GET /api/user/trade-management/preferences`

说明：该接口在领域上归属于用户偏好，存储可直接复用 `users`（或已有用户配置承载），不要求新增独立 preferences 表。

### 8.2 更新偏好

`PUT /api/user/trade-management/preferences`

### 8.3 保存预算快照（新增）

`POST /api/user/trade-management/position-budget/snapshots`

请求体（示意）：

- `symbol`
- `entry_price`
- `stop_loss_price`
- `target_price`
- `risk_ratio`
- `risk_amount`
- `position_size`
- `expected_loss`
- `r_mode`

`user_id` 以服务端会话为准，**不由客户端传 `owner_id` 鉴权**（§12.7）。

### 8.4 查询预算快照（可选）

`GET /api/user/trade-management/position-budget/snapshots?symbol=...`

---

## 9. 与主系统并轨条件（Exit Criteria）

插件版只有满足以下条件，才进入 Spec 56 主链路并轨：

1. 计算字段与命名与 Spec 56 完全一致，无二义口径
2. 匿名与登录两态数据均可稳定保存，失败率在可控范围
3. 用户连续使用数据证明“预算先行”成立（由产品定义阈值）
4. 参数提示与阻断逻辑经过真实场景验证，无明显误导
5. 预算快照可被后续 `events` 或 Paper Lab 路线消费

---

## 10. 路线图（P0 -> P1 -> P2）

### 10.1 P0（插件验证）

1. 独立页面上线（PC）
2. 三模式计算 + 服务端偏好
3. 快照持久化（匿名/登录）

### 10.2 P1（轻集成）

1. 在 `决议` tab 复用插件核心组件（先 `empty` 场景）
2. 建立“决议 -> 预算 -> 录入”串联

### 10.3 P2（完整并轨）

1. 扩展到 `管理` tab 与状态机语义
2. 对齐 `events` 与复盘消费链路

---

## 11. 验收标准（P0）

- [ ] 独立插件页面可稳定访问与计算
- [ ] 三种 R 模式均可切换，结果实时刷新
- [ ] 偏好持久化到服务端，不写 LocalStorage
- [ ] 匿名态可保存预算快照，登录态可读取自身快照
- [ ] 极端参数提示/阻断逻辑生效
- [ ] 免责声明在首屏可见
- [ ] 不引入新栈（Vue / Element / ECharts / localForage 等）
- [ ] 与 Spec 56 字段口径一致，可并轨
- [ ] 股票代码检索走 §12.3.1 共享模块（与自选池同行为：防抖、Enter 立即搜、请求可取消），插件内无重复搜索实现

---

## 12. 技术方案（P0 · 对齐现有工程）

本节与当前 `frontend` 实现对齐，便于直接拆任务；若实现时发现路径微调，以代码为准并回写本文。

### 12.1 技术栈与边界

与 Spec 56 §13 一致，不新增依赖栈：

- `Next.js` App Router、`React`、`TypeScript`、`Tailwind`、`SWR`
- 数据：`@libsql/client` / `better-sqlite3`，`DB_STRATEGY` / `DB_SOURCE` 双策略
- 计算：**纯函数**收口到 `frontend/src/lib/position-budget.ts`（新建），便于插件页与后续 `PositionBudgetCard` 共用

插件扩展机制（manifest / capability / hook / slot）遵循：

- `docs/1_Engineering/50_Plugin_Architecture_And_Extensibility_RFC_20260511.md`

同时，本插件作为首个 reference plugin，必须通过 `RFC 50 §11 Plugin Stability Gate`。默认策略为严格模式：凡触碰 1.0 国际化版本的 SSG、i18n 首屏、Dashboard 既有 UX、全局启动链路、PWA、API/DB 安全或既有质量门禁，均不得以“插件实验”为理由放行。

### 12.2 身份与会话（匿名 / 登录）

仓库现状：**前台 API 普遍要求已解析的 `user_id`**（`requireUserSession` 读签名 Cookie `stockwise_user_session`）。  
“匿名用户”在工程上对应 **`POST /api/user/register` 隐式注册** 后下发的同一套会话，而非无 Cookie 的公网裸调。

P0 约定：

1. 插件页 `useEffect` 或数据请求前调用 `getCurrentUser()`（与 Dashboard 一致，`@/lib/user`），确保存在会话后再调需登录的接口。
2. 持久化层**只存 `user_id`**，不单独区分 `owner_type`；规格上的「访客 / 登录」在产品文案保留，在 DB 层统一为 `user_*`。
3. 若未来要做「显式登录后合并匿名草稿」，P0 仅预留 `user_id` 稳定即可；合并策略放到 P1（Spec 56 并轨阶段）。

### 12.3 选股交互与股票档案预填

本节拆为两段：**代码检索**（如何把用户输入变成可靠 `symbol`）与 **战术预填**（选定 `symbol` 后如何拉档案填默认价）。

#### 12.3.1 股票代码检索（共享实现，与自选池对齐）

1. 前端调用 **`GET /api/stock/search?q=...`**，与 Dashboard **「自选池 / 监控池」** 加股时的搜索同源。
2. **单源实现**（禁止在插件页再复制一套 debounce / fetch / Abort 逻辑）：
   - `frontend/src/hooks/useStockSymbolSearch.ts`：导出 `StockSearchHit`；默认 **300ms** 防抖；`AbortController` 取消上一次请求；**Enter 立即触发检索**（与自选池一致：不将 Enter 当作「未校验即提交代码」）；进行中状态；`resetSearch()` 用于选中后清空。
   - `frontend/src/components/stock/StockSymbolSearchField.tsx`：搜索图标、建议列表在输入**下方堆叠**展示；市场角标与本地化名称使用与自选池相同的 `getMarketBadge`、`getLocalizedStockName`。
3. **当前消费方**：`frontend/src/app/(site)/(dashboard)/dashboard/stock-pool/page.tsx` 与 `frontend/src/app/(site)/tools/position-budget/page.tsx`。后续新工具 / 插件若需要「按代码找股」，应**优先挂载**上述 hook + 组件，而不是新开并行实现。
4. **与自选池的刻意产品差异**：插件页在 API **零结果**时，可提供 **「按输入代码继续」** 显式动作（将当前输入视为手动 `symbol`，用于别名未收录等边界）；自选池 P0 仅展示无结果文案，不提供该按钮（加股仍以搜索命中或产品另行流程为准）。

#### 12.3.2 战术结构解析与预填数据路径

战术结构来自 `ai_reasoning` JSON，与卡片层一致：`parseTacticalData`（`frontend/src/lib/stock-dashboard-card-surface.ts` 所用路径）。

P0 推荐数据路径：

1. 用户选定 `symbol` 后，前端请求 **`GET /api/stock/batch?symbols=SYMBOL&historyLimit=1&contentLocale=...`**（与 Dashboard 同源；该路由已 `requireUserSession`）。
2. 从返回中取最新一条 prediction 的 `ai_reasoning`，`parseTacticalData` 得到 `key_levels` 与 `tactics.empty` 等，再按本文 §5.1 填默认入场/止损/目标。
3. **不得**把 `account_size` 或预算结果写入 batch 请求或 batch 缓存键；偏好走独立 API（§12.5）。

可选优化（非 P0 阻塞）：新增 `GET /api/stock/tactical-snapshot?symbol=` 只返回战术 JSON，减少 payload；上线顺序以 batch 复用优先。

### 12.4 数据库表（建议）

采用与 `ensureInvestmentModeSchema` 相同风格：`ensurePositionBudgetSchema(db)` 在首读/首写时 `CREATE TABLE IF NOT EXISTS`。

**偏好复用：`users`（或现有用户配置表）扩展字段，不新增独立偏好表**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `default_account_size` | REAL NULL | 可空 |
| `default_risk_ratio` | REAL NOT NULL | 默认 `0.01` |
| `default_r_mode` | TEXT NOT NULL | `system_followed` / `fixed_stop` / `percent_stop`（枚举与代码常量一致） |

说明：若用户域已有统一 profile/settings 表，以该表为准；关键约束是“偏好属于用户属性域”，不再新增 trade-management 专属偏好表。

**新增表：`position_budget_snapshots`**

| 列 | 类型 | 说明 |
| --- | --- | --- |
| `snapshot_id` | TEXT PK | `pbs_` + uuid 片段 |
| `user_id` | TEXT NOT NULL | 索引 |
| `symbol` | TEXT NOT NULL | 大写 |
| `entry_price` | REAL NOT NULL | |
| `stop_loss_price` | REAL NOT NULL | 记录当时用于计算的止损价 |
| `target_price` | REAL NULL | |
| `account_size` | REAL NOT NULL | 快照时账户规模（审计用，非分析链） |
| `risk_ratio` | REAL NOT NULL | |
| `risk_amount` | REAL NOT NULL | |
| `risk_per_share` | REAL NOT NULL | 便于复盘校验 |
| `position_size` | INTEGER NOT NULL | floor 后股数 |
| `expected_loss` | REAL NOT NULL | |
| `r_mode` | TEXT NOT NULL | |
| `created_at` | TEXT NOT NULL | |

索引建议：`CREATE INDEX IF NOT EXISTS idx_pbs_user_created ON position_budget_snapshots(user_id, created_at DESC)`。

Cloud / local 双策略：读写 SQL 放在 `frontend/src/lib/user-position-budget.ts`（新建），由 route 调用，与 `user-trade-management.ts` 并列。

### 12.5 HTTP API（路由与行为）

基路径：`/api/user/trade-management/`（与现有 `positions`、`stock` 并列）。

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| `GET` | `.../preferences` | `requireUserSession`；返回用户域中的预算偏好或默认值 |
| `PUT` | `.../preferences` | body 校验（`risk_ratio` 范围等）；写回用户域 |
| `POST` | `.../position-budget/snapshots` | 校验 symbol 与价格字段；**服务端可用同一套纯函数重算** `risk_amount/position_size/...`，与 body 允许误差阈值内一致则落库，防止前端篡改 |
| `GET` | `.../position-budget/snapshots?symbol=&limit=` | 列表；仅 `user_id` 维度；默认按 `created_at` 降序 |

错误码：400 参数、401 无会话、500 服务器错误；与现有 user trade-management 路由风格一致。

### 12.6 前端模块与路由

| 资产 | 职责 |
| --- | --- |
| `frontend/src/app/(site)/tools/position-budget/page.tsx` + `layout.tsx`（`LocaleProvider` 包裹，不经 DashboardShell） | PC 插件页：选股、预填、三模式、结果卡、保存；**选股区**挂载 §12.3.1 的 `useStockSymbolSearch` + `StockSymbolSearchField` |
| `frontend/src/hooks/useStockSymbolSearch.ts` + `frontend/src/components/stock/StockSymbolSearchField.tsx` | 与自选池共用的股票代码检索；插件与 `stock-pool/page.tsx` 唯一实现源 |
| `frontend/src/lib/position-budget.ts` | `computePositionBudget(input): output` + 模式分支 + 阻断原因枚举 |
| `frontend/src/hooks/usePositionBudgetPreferences.ts`（可选） | `SWR` key 独立，**不**接入 `useTradeManagementSurface`（Spec 56 §13.3） |

入口：可从 Dashboard 加一条不破坏主链路的文字链/工具区链到该路由（具体位置 P0 可与设计走最小改动）。

### 12.7 安全与合规

1. 所有快照与偏好查询必须带会话，**禁止**按客户端传入的 `owner_id` 信任鉴权（若早期草案曾写 `owner_id` in body，实现时以 Cookie 会话为准）。
2. `account_size` 仅出现在用户偏好字段与快照表，**不**进入 `stock/batch` 与预测 SQL。
3. Admin 报表默认不包含此类字段；若需运维排错，走单独 admin 路由并加鉴权（P0 可不暴露）。

### 12.8 与并轨的接口契约

`position_budget_snapshots` 行应能映射到 Spec 56 计划事实（`plan_r_amount`、`plan_position_size`、`plan_r_mode` 等）而不改列语义；P1 写入 `events` 时做字段映射即可。

### 12.9 P0 架构决策记录（按 RFC 50 §11）

| 事项 | Impact domain | Stability contract | Decision | Guardrail | Rollback |
| --- | --- | --- | --- | --- | --- |
| 插件页 locale 初始化不得在 `(site)` route 中调用 `headers()` / `cookies()` | `public-site` | SSG / SEO、i18n 首屏 | `fix-before-merge`：保持静态 route 壳，首屏使用稳定默认 locale，客户端挂载后再按本地偏好 reconcile | `pnpm run test:quality` 的 SSG Safety Check | 回退插件 route layout 到静态 `LocaleProvider` 包裹 |
| 预算偏好与快照 API 的 cloud/local 分支 | `api` / `db-schema` | DB writes、auth/session | `fix-before-merge`：以 `getDbClient()` 返回的实际 client 类型为准，不再用 env 字符串推断 | build + API route 类型检查；本地/云端连接 smoke（上线前） | 回退 API 暴露或暂时关闭保存动作，只保留本地计算 |
| `SplashDismiss` 全局兜底 | `global-shell` | 首屏与启动体验、PWA | `fix-before-merge`：只能作为超时 failsafe，不能在 React mount 后无条件覆盖 `root-bootstrap` 的 splash 决策 | Dashboard mobile cold open / refresh 手工验收；`pnpm run build` | 移除 `SplashDismiss`，恢复纯 inline bootstrap |
| 股票代码搜索共享化 | `shared-component` / `dashboard` | Dashboard UX、API latency | `fix-before-merge`：共享 hook / UI 必须保持自选池既有语义；Enter 立即搜时取消 pending debounce，避免重复请求 | 自选池加股路径手工验收；targeted lint/build | 自选池回退本地搜索块，插件继续使用共享组件 |
| 快照保存的 symbol 范围 | `api` / `plugin-only` | 数据契约一致性 | `fix-before-merge`：P0 不限制为 5-6 位数字；允许与 `stock_meta` / 搜索结果一致的常见 CN/HK/US symbol 形态，并保留大写规范化 | API 参数测试或手工保存 CN/HK/US 样例 | 收窄插件搜索范围到 CN/HK 后再恢复严格数字校验 |

---

## 13. 实施清单（可直接排期）

### 13.1 数据与后端

- [ ] 在用户域扩展预算偏好字段：`default_account_size`、`default_risk_ratio`、`default_r_mode`
- [ ] 新增 `position_budget_snapshots` 表（含 `idx_pbs_user_created` 索引）
- [ ] 新建 `frontend/src/lib/user-position-budget.ts`：读写 repository + cloud/local 双策略
- [ ] 新建 API：`GET/PUT /api/user/trade-management/preferences`
- [ ] 新建 API：`POST/GET /api/user/trade-management/position-budget/snapshots`
- [ ] 在 `POST snapshots` 内服务端重算预算结果并比对请求体，防止篡改
- [ ] 统一错误码与返回结构（400/401/500）并加最小日志埋点

### 13.2 前端与交互

- [ ] 新建插件页：`/tools/position-budget`（PC，独立于 `dashboard/layout`，不经邀请墙）
- [ ] 新建纯函数：`frontend/src/lib/position-budget.ts`（三模式 + 阻断原因）
- [ ] 接入 `getCurrentUser()` 保障会话后再请求插件接口
- [ ] 复用 §12.3.1：`useStockSymbolSearch` + `StockSymbolSearchField`（与 `stock-pool` 同源 UX）
- [ ] 复用 `GET /api/stock/batch` + `parseTacticalData` 做入场/止损/目标预填（§12.3.2）
- [ ] 增加“参数异常阻断 + 黄色风险提示 + 免责声明固定可见”
- [ ] 增加“保存预算快照”动作与成功/失败反馈

### 13.3 测试与验收

- [ ] 覆盖三种 R 模式计算单测（含边界值：`risk_ratio` 2%/5%）
- [ ] 覆盖服务端快照写入校验测试（会话、字段、重算一致性）
- [ ] 验证匿名态（隐式注册）与已登录态均可保存并查询快照
- [ ] 验证 `account_size` 不进入 batch 请求或预测查询链路
- [ ] 走一轮手工验收，逐条勾选本文 §11

### 13.4 并轨准备（P1 前置）

- [ ] 形成字段映射文档：`position_budget_snapshots -> events(plan_r_*)`
- [ ] 保持 `compute` 与 `validation` 纯函数可复用到 `Spec 56` sidecar 组件
- [ ] 按 `RFC 50` 接入 manifest/capability/hook/slot 的最小 runtime 注册

---

## 14. 当前定稿结论

**先做插件，不是偏离主系统，而是为主系统降低风险。**

插件版的唯一正确做法是：

1. 入口独立
2. 语义一致
3. 数据可并轨

一句话收口：

**P0 先验证“是否被使用”，P1/P2 再验证“如何深度整合”；但从第一天开始，字段与纪律口径就按目标态执行。**
