---
title: "功能规格说明书：仓位预算插件版（Position Budget Plugin P0）(Spec 57)"
doc_id: "spec-position-budget-plugin-p0-20260511"
doc_domain: "product"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-05-12"
summary: "定义仓位预算能力的插件验证版：独立 PC 页面先行，以最小耦合验证 1R 预算使用价值，并在数据契约、持久化与并轨条件上与 Spec 56 保持一致；选股侧与 Dashboard 自选池共用 `useStockSymbolSearch` + `StockSymbolSearchField`，避免重复实现。"
source_docs:
  - "docs/3_Product/Specs/trade_management/56_Risk_Management_R_Multiple_Calculator_Spec_20260509.md"
  - "docs/1_Engineering/50_Plugin_Architecture_And_Extensibility_RFC_20260511.md"
  - "frontend/src/content/seo-position-budget.ts"
  - "frontend/scripts/position-budget-seo-check.mjs"
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

### 5.4 市场上下文增强字段（P0.1）

以下字段用于帮助用户理解“当前价格与常态波动”，不改变 §5.2 的仓位预算计算口径，也不自动替代用户输入的止损或目标位。

| 字段 | 来源 / 口径 | 用途 |
| --- | --- | --- |
| `latest_price` | 后台行情快照，当前约 **15 分钟更新一次**；必须随同返回 `as_of` / `updated_at` 等时间戳 | 展示“最新价格（约 15 分钟更新）”，可作为入场价预填候选 |
| `latest_change_percent` | 同一行情快照中的涨跌幅，缺失时展示为空 | 展示当前涨跌背景，不参与预算计算 |
| `atr_14` | 基于日线 `high / low / close` 计算 14 日 ATR（True Range 取 `max(high-low, abs(high-prevClose), abs(low-prevClose))`） | 衡量常态单日波动，用于辅助用户判断止损距离是否过窄 |
| `volatility_bucket` | 基于近 20 或 30 个交易日收盘收益率的已实现波动率分档，初始枚举为 `LOW` / `MED` / `HIGH` | 展示波动风险标签，阈值可随真实样本校准 |

文案约束：前端不得裸写“实时价格”。建议使用“最新价格（约 15 分钟更新）”或“近实时价格 · 约 15 分钟刷新”，并在 UI 中显示更新时间，避免用户误解为逐笔或秒级行情。

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
2. 中部：**止损方式选择** + 对应参数区（内部仍映射三种 `r_mode`，对用户不暴露技术枚举）
3. 右侧/下方：预算结果卡（1R、仓位、风险提示）
4. 底部：保存按钮 + 免责声明

P0.1 可在顶部股票信息区增加 **Market Context / 市场上下文** 条，展示最新价、ATR 与波动率分档。该区块只解释行情背景；计算器仍以用户确认后的入场价、止损位、目标位与风险比例为准。

### 7.3 文案约束

允许：

- “基于您的参数，建议仓位规模为 …”
- “若触发止损，本次预计亏损为 …（1R）”

禁止：

- “AI 推荐买入 …”
- “最大胜率 …”
- “按此操作即可盈利 …”

### 7.4 止损方式 UX（P0）

产品语义上，用户不是在选择“计算模式”，而是在选择“止损如何定义”。因此 UI 必须用交易语义包装 `r_mode`，但数据契约与计算枚举保持不变：

| 内部枚举 | PC 展示名 | Mobile 短标签 | 说明文案 |
| --- | --- | --- | --- |
| `system_followed` | `Strategy Stop / 策略止损` | `策略` | `基于策略失效位` |
| `fixed_stop` | `Price Stop / 价格止损` | `价格` | `手动输入止损价` |
| `percent_stop` | `Percent Stop / 百分比止损` | `百分比` | `按入场价回撤比例计算` |

交互约束：

1. **PC**：可使用三张 explainable option cards，展示标题 + 一行说明 + 选中态；不要使用 `SYSTEM / FIXED / PCT` 这类技术 tab。
2. **Mobile**：使用 compact segmented control，只显示短标签；未选中的模式不展示说明。
3. **渐进解释**：移动端仅在分段控件下方展示当前选中项的一句说明，控制在 12-16 个中文字以内；更长解释进入 `?` tooltip / bottom sheet。
4. **动态输入**：下方只展示当前止损方式需要的输入框；`percent_stop` 需同步展示计算出的最终止损价。
5. **结果收口**：结果区统一展示 `Resolved Stop / 最终止损价` 与 `Risk per Share / 每股风险`，让三种方式最终落到同一计算事实。

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

### 8.5 快照 CRUD 语义（产品约束）

仓位预算快照不是普通可编辑表单记录，而是“某一时刻的计划事实”。因此 CRUD 语义按以下方式收口：

1. **Create**：保存本次预算快照，已在 P0 提供。
2. **Read**：必须补齐为 P0.1 能力。用户保存后应能查看最近预算、按股票查看历史，并可把旧快照“载入为当前参数”继续测算。
3. **Update**：不对历史快照做原地编辑。若用户基于旧快照调整参数，应生成新的快照；用户偏好（账户规模、默认风险比例、默认 R 模式）可以更新。
4. **Delete / Archive**：允许删除误存、测试或无意义快照；若后续进入复盘链路，优先采用 `archived_at` / soft delete，而不是物理删除。

一句话原则：**偏好可以改，快照只追加；旧快照只能载入、复制、删除/归档，不做原地覆盖。**

### 8.6 市场上下文数据读取（P0.1）

三项市场上下文增强优先复用现有股票数据链路，不新增前端依赖，也不把预算隐私字段写入行情请求：

1. **最新价**：优先复用 `GET /api/stock/batch?symbols=...` 或现有最新行情接口返回的 `price.close`、`change_percent` 与更新时间；UI 必须标注“约 15 分钟更新”。
2. **ATR / Volatility**：若现有价格历史接口只返回 `close`，P0.1 可扩展该接口返回 `high`、`low`、`close`、`date`、`updated_at`，由前端或共享纯函数计算展示指标。
3. **隐私边界**：`account_size`、`risk_ratio`、预算结果与快照 ID 不进入行情请求、batch cache key 或预测 SQL；行情上下文与预算持久化保持解耦。

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

### 10.2 P0.1（快照查看与市场上下文增强）

P0 已经提供保存动作，因此 P0.1 的重点不是继续堆复杂计算，而是补足“保存之后如何查看”的闭环，并在不改变预算口径的前提下补充最小市场上下文：

1. 新增 **Recent Budgets / 最近预算** 区块，默认展示最近 5-10 条快照。
2. 每条展示 `symbol`、`entry / stop / target`、`risk_ratio`、`position_size`、`expected_loss`、`r_multiple`、`created_at`。
3. 支持按 `symbol` 查看历史预算快照。
4. 支持 **Load as Current Parameters / 载入为当前参数**，但不修改原快照。
5. 支持删除或归档误存快照；删除能力需保留会话鉴权和 `user_id` 边界。
6. 增加 **最新价格（约 15 分钟更新）** 展示，包含价格、涨跌幅与更新时间；可作为入场价预填候选，但用户必须可覆盖。
7. 增加 **ATR14** 展示，使用日线 `high / low / close` 计算，用于辅助判断止损距离是否符合常态波动。
8. 增加 **Volatility** 分档展示，使用近 20 或 30 个交易日收益率波动率映射为 `LOW` / `MED` / `HIGH`。

P0.1 不做：

1. 不做快照原地编辑。
2. 不做 realized R / 实际盈亏对比。
3. 不做复杂交易日志统计。
4. 不自动根据 ATR 或 Volatility 改写仓位预算结果；若要做动态仓位建议，进入 P1+ 另行定义。

### 10.3 P1（计算器增强 + 轻集成）

1. 在 `决议` tab 复用插件核心组件（先 `empty` 场景）
2. 建立“决议 -> 预算 -> 录入”串联
3. 增加手续费 / 滑点（fee & slippage）对 `risk_amount` 与 `r_multiple` 的影响
4. 增加 1R / 2R / 3R / 自定义 R 的 target ladder
5. 明确 long / short 支持边界（P1 默认可先 long-only，若支持 short 需同步调整 stop/target 校验）

### 10.4 P1.5（高级计划能力）

1. 多目标位 / 分批止盈（partial take-profit ladder）
2. 分批入场 / 加仓均价（multiple entry weighted average）
3. 多场景比较（不同止损位、风险比例、目标位下的仓位差异）

### 10.5 P2（完整并轨与复盘）

1. 扩展到 `管理` tab 与状态机语义
2. 对齐 `events` 与复盘消费链路
3. 将计划快照与实际交易事件连接，计算 `realized_r`
4. 形成用户级统计：`net_r`、`expectancy`、胜率、回撤、按策略/股票分组

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
- [ ] P0.1 前明确快照语义：历史快照不原地编辑，查看/载入/删除或归档按 §8.5 执行
- [ ] 止损方式 UI 按 §7.4 展示交易语义，PC / mobile 均不暴露 `SYSTEM / FIXED / PCT` 技术标签

### 11.1 验收标准（P0.1）

- [ ] 最近预算区块可展示、按股票过滤，并能把旧快照载入为当前参数但不覆盖原快照
- [ ] 最新价展示包含价格、涨跌幅与更新时间，文案明确“约 15 分钟更新”
- [ ] ATR14 基于日线 `high / low / close` 计算，数据不足时降级为空态而非伪造数值
- [ ] Volatility 分档输出 `LOW` / `MED` / `HIGH`，阈值集中在共享计算函数中，便于后续校准
- [ ] 市场上下文不写入预算快照的计算字段，不进入 `stock/batch` 缓存键，也不改变 §5.2 的预算结果

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
| `frontend/src/app/(site)/tools/position-budget/page.tsx` + `layout.tsx`（`LocaleProvider` 包裹，不经 DashboardShell） | 插件页：选股、预填、止损方式选择、结果卡、保存；**选股区**挂载 §12.3.1 的 `useStockSymbolSearch` + `StockSymbolSearchField`；止损方式按 §7.4 做 PC / mobile 差异化展示 |
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

### 12.9 市场上下文增强（P0.1）

P0.1 的市场上下文应作为插件页的独立展示层实现，避免污染预算计算纯函数：

| 资产 | 职责 |
| --- | --- |
| `frontend/src/lib/position-budget-market-context.ts`（可新建） | 纯函数计算 `atr_14`、收益率波动率与 `volatility_bucket`；不依赖 React 或请求层 |
| `frontend/src/lib/position-budget-client.ts` | 扩展行情读取 DTO，接收 `high`、`low`、`close`、`change_percent`、`updated_at` 等字段 |
| `frontend/src/app/api/stock/prices/history/route.ts`（如需扩展） | 返回计算 ATR 所需的日线字段；保持 `limit` 上限，避免大 payload |
| `frontend/src/app/(site)/tools/position-budget/page.tsx` | 在股票选中区展示最新价、ATR14、Volatility；入场价仍允许用户覆盖 |

计算与降级规则：

1. `latest_price` 使用后台约 15 分钟刷新的行情快照；若无 `updated_at`，至少展示行情 `date`，并使用“更新时间未知”空态。
2. `atr_14` 至少需要 15 条可用日线（含前收盘计算 True Range）；不足时展示 `--`，不回退为估算值。
3. `volatility_bucket` 初始建议使用近 20 或 30 个交易日的收盘收益率标准差映射，阈值集中定义，后续可按 CN/HK/US 样本校准。
4. 市场上下文只读行情数据，不读取或写入 `account_size`；不得参与 `computePositionBudget()` 的核心输出。

### 12.10 P0 架构决策记录（按 RFC 50 §11）

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
- [ ] 将三种 `r_mode` 包装为“止损方式”：PC 使用 option cards，mobile 使用 compact segmented control + 当前项一句话说明
- [ ] 结果区统一展示 `Resolved Stop / 最终止损价` 与 `Risk per Share / 每股风险`
- [ ] 增加“参数异常阻断 + 黄色风险提示 + 免责声明固定可见”
- [ ] 增加“保存预算快照”动作与成功/失败反馈

### 13.3 测试与验收

- [ ] 覆盖三种 R 模式计算单测（含边界值：`risk_ratio` 2%/5%）
- [ ] 覆盖服务端快照写入校验测试（会话、字段、重算一致性）
- [ ] 验证匿名态（隐式注册）与已登录态均可保存并查询快照
- [ ] 验证 `account_size` 不进入 batch 请求或预测查询链路
- [ ] 走一轮手工验收，逐条勾选本文 §11

### 13.4 P0.1 市场上下文增强

- [ ] 扩展或复用行情读取接口，确保最新价返回价格、涨跌幅与更新时间，并在 UI 标注约 15 分钟更新
- [ ] 扩展价格历史 DTO，补齐 `high`、`low`、`close`、`date` 字段以支持 ATR14
- [ ] 新增市场上下文纯函数：`computeAtr14()`、`computeRealizedVolatility()`、`bucketVolatility()`
- [ ] 在股票选中区展示最新价、ATR14、Volatility 三项；数据不足时展示空态，不伪造指标
- [ ] 增加单测覆盖 ATR、波动率分档与数据不足降级
- [ ] 手工验证入场价预填可使用最新价，但用户修改后不会被后台刷新覆盖

### 13.5 并轨准备（P1 前置）

- [ ] 形成字段映射文档：`position_budget_snapshots -> events(plan_r_*)`
- [ ] 保持 `compute` 与 `validation` 纯函数可复用到 `Spec 56` sidecar 组件
- [ ] 按 `RFC 50` 接入 manifest/capability/hook/slot 的最小 runtime 注册

---

## 14. SEO / GEO 运营目标与 PDCA 闭环

本小节定义 **插件页 canonical 路径：`/tools/position-budget`** 的搜寻与生成式检索侧运营准则。技术实现已与全站 `buildPageMetadata`、`rootMetadata`、`sitemap` 对齐，本节负责 **目标—监测—复盘—改版** 的闭环，避免与该页相关的 SEO/GEO 工作与主站框架脱节。

### 14.1 在全站 SEO / GEO 框架中的位置（不变量）

| 层级 | 责任 | 本页对应 |
| --- | --- | --- |
| 框架 | canonical、sitemap、`metadataBase`、`root` 级 OG/Twitter 默认 | `(site)` 继承 `frontend/src/app/root-layout-config.ts` |
| 协议 | `buildPageMetadata`、`localizePublicPath` 约束 | **`alternateLocales`** 仅用真实存在的路由；该页仅为 locale-neutral **`/tools/position-budget`**，不捏造 `/cn/tools/…` |
| 页面 | title / description / keywords / JSON-LD | `frontend/src/content/seo-position-budget.ts` + `frontend/src/app/(site)/tools/position-budget/layout.tsx` |
| 发现 | 收录 URL 列表 | `frontend/src/app/sitemap.ts` 中 `tools/position-budget` 条目 |

**口径**：本条所称 **GEO** = 跨境/双语意图与生成式检索中的**可被正确复述、少幻觉、可追溯 canonical**（与「地缘政治」无关）；不改变产品合规表述与免责声明边界。

### 14.2 页面级运营目标（建议 12 个月内滚动修订）

以下为 **定性 + 定量** 组合示例，可按实际流量在每季 OKR 里改数字，但 **守门线** 建议常年保留。

**A. 守门线（必须持续满足）**

1. Metadata、JSON-LD、可见 UI Disclaimer 与真实能力一致，**不承诺收益、不弱化风险**。
2. Canonical **唯一**：`https://ziso.cc/tools/position-budget`（与 `NEXT_PUBLIC_SITE_URL` / 品牌域名策略一致）。
3. 若全站另行约定 **`app.ziso.cc` vs `ziso.cc` 主次关系**，本页只做 **跳转/别名治理的跟随项**，不在本规格内单列一套规则。

**B. 定量目标（SEO，示例占位）**

| 指标（GSC/Bing Webmaster） | 说明 | 季度检查 |
| --- | --- | --- |
| 索引状态 | 该 URL 「已编入索引」、无外因长期排除 | 是/否 |
| 展示 / 点击 | 针对预先维护的 query 表的合计或 Top N | 环比增长或区间目标由增长负责人填 |
| 点击率 | title/description A/B 后对比 | 与历史周期比 |

**C. GEO / 复述质量目标（抽样，示例）**

- 固定 **中英文问法清单**（与 §14.3 同源），每季度至少完成 **一轮**结构化记录：**引擎 / 是否有引用 canonical / 摘要事实错误项 / 合规风险项**。
- **目标**：对工具能力描述 **不出现与 Disclaimer 相悖的承诺**；出现明显幻觉时 **Act 阶段必须进入文案或 FAQ 修订**（见 §14.4）。

### 14.3 指标体系与数据源

**1）关键词与问法矩阵（负责人维护，建议外置表格）**

列建议：`语言` | `意图（信息/工具）` | `核心词或问法` | `当前备注` | `关联代码/文案位置`。

- 须与 `seo-position-budget.ts` 的 `keywords` **定期对账**（季度一次），避免页面 meta 与矩阵严重漂移。
- 中英 + 市场修饰（港/美/A）仅用于**真实支持范围**的表述，与 §3 边界一致。

**2）监测数据源（与全站一致）**

| 数据源 | 用途 | 频率 |
| --- | --- | --- |
| 自动化（仓库） | **`npm run check:position-budget-seo`**（`frontend/scripts/position-budget-seo-check.mjs`）：抓取线上 HTML / sitemap，校验 title/description/JSON-LD/收录路径 | **发版后或每月**（与 §14.4 Check 对齐）；`SEO_CHECK_BASE_URL` 可改预发 |
| Google Search Console | 展示、点击、查询词、索引、体验 | 月度 |
| Bing Webmaster | 补充搜索引擎可见度 | 月度 |
| 站点 `sitemap.xml` | 确认 URL 仍被收录集合引用 | 发版后 / 季度 |
| 站点分析（若已部署 GA4 等） | 进入该 path 后的行为 proxy | 月度（可选） |
| GEO 抽样表 | 生成式答案是否引用、事实一致性 | 月度 |

### 14.4 PDCA 闭环工作方法

**总则**：单次改版 **只引入一个主导假设**，观测窗口建议 **不少于 14 天（自然检索）**，重大算法波动期允许延长；记录沉淀在 **`docs/` 可追溯位置或团队知识库**，至少保留 **最近一次 Act 的输出链接**在本规格附录或周报。

#### Plan（计划）

1. **选焦点**：从上期 Check 或未达标项中选 1～2 条（如新 query、CTR 偏低、GEO 复述错误）。
2. **立下假设**：例 —「补强 description 中『快照/三市场』信息后，特定 query 点击率提升」。
3. **定义动作边界**：仅能改 **`seo-position-budget.ts`** 文案、`layout` metadata、或页面内 **与检索一致的可见说明段落**（须保持克制与设计规范）；牵涉 **主域与子域 canonical** 的须走全站 SEO 工单，不归本页单独闭环。
4. **输出**：记入周期表：**负责人、截止日期、假设、成功判据（可量化或定性枚举）**。

#### Do（执行）

1. 按仓库规范提交 PR：**代码路径 + Spec 本节或附录「迭代记录」中一句话说明假设**。
2. 发布后 **记录发布日期/commit**（便于对照 GSC 曲线）。

#### Check（检查）

1. **技术侧（仓库可执行）**：`cd frontend && npm run check:position-budget-seo`（或对预发设置 `SEO_CHECK_BASE_URL`），覆盖 **HTTP、`title`、`description`、JSON-LD、`SoftwareApplication`、sitemap 路径**。
2. **GSC**：该 URL 的查询词分布、CTR、抓取/索引异常。
3. **Bing**：同步快速扫一眼。
4. **GEO 抽样表**：跑固定问法，记录是否引用、错点类型（事实/合规/品牌）。
5. **对照判据**：未达成则进入 Act；达成则沉淀为 **新基线**。

#### Act（处理）

1. **保留**：假设成立 → 更新关键词矩阵与（如需要）`keywords` meta；在迭代记录表记一行「已采纳」。
2. **回滚或迭代**：不成立 → 回滚 PR 或发起 **更小粒度**的下一轮 Plan（避免同周期多变量）。
3. **上升**：若问题来自全站（重复收录、错误 canonical、子域分流），**关闭本页单点循环**，转交全站 SEO 治理项并在此规格 **记录工单编号/结论链接**。

**建议节奏**

| 周期 | 动作 |
| --- | --- |
| 每月 | 完成一轮 **Check** 数据拉取 + GEO 抽样（可轻量） |
| 每季 | 更新 §14.2 数字目标、关键词矩阵与 `seo-position-budget` 对账；必要时开 **Plan** |
| 每次发版涉及该页 | Do 后 **7 日内**做一次快速 Check（索引、异常抓取） |

### 14.5 迭代记录（模板）

在团队知识库或下表维护；亦可将链接写回本文。

| 日期 | 周期 | Plan 摘要 | Do（PR/版本） | Check 结论 | Act |
| --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | 例：2026 Q2 |  |  |  |  |
| 2026-05-12 | Cycle 0 · 基线 | 固化技术侧 Check：可重复的 HTML + sitemap 巡检；GSC/Bing/GEO 留作人工补栏 | Spec 与脚本落地；参见 `frontend/package.json` · `check:position-budget-seo` | 线上 spot-check：**HTTP 200**；`<title>` 含 Position Budget；`description` meta 存在；`application/ld+json` · `SoftwareApplication` 存在；`sitemap.xml` 含 `https://ziso.cc/tools/position-budget` | **基线**：后续周期对比；**待补**：GSC 索引与 query、Bing、GEO 抽样表（负责人填入本行或外链） |

**负责人边界**：可由工程侧稳定执行 **脚本 + Spec 归档**（Do/Check 中技术块）；涉及 **GSC 权限、竞品词策略、法务口径** 的 Act 仍以产品/增长确认为准。

### 14.6 与增长/观测管道对齐（借助「入库 + Admin」闭环）

本节说明：**如何把每日入库能力接到 PDCA 的 Check**，以及当前仓库内的**真实情况**。

#### 14.6.1 现状（StockWise monorepo 内已存在的能力）

| 管道 | 实现位置（代码） | 落库 | Admin |
| --- | --- | --- | --- |
| **GA4（网站行为）** + **Microsoft Clarity** + **库内激活** | `backend/scripts/daily_growth_digest.py` → `collect_growth_payload()` | `growth_daily_snapshots.payload_json`（含 `ga4`、`clarity`、`internal`） | `/admin/growth` → `/api/admin/growth` |
| **GSC / Bing（搜索表现｜Organic）** · 入库 + Admin（与 GA4 **分列**，避免 `payload_json` 膨胀） | `frontend/src/lib/seo-search-performance.ts`：`ensureSeoSearchPerformanceSchema` / upsert | **表** `seo_search_performance`（见 **14.6.4**） | **`GET` / `POST`** `/api/admin/seo-search`（与 growth **同级** Admin 鉴权）；增长看板 **`/admin/growth`** 底部提供只读预览（调用 `GET`） |

**不含（仍然成立）**：`daily_growth_digest` **不写** `seo_search_performance`。**IndexNow**（`scripts/indexnow_sync.py`）仍是索引提交，**不是** impressions/CTR/position 报表。**外部定时任务**（Python/cron/systemd）从 GSC/Bing API 拉数后须 **UPSERT** 到上表或通过 **`POST`** 回填（任选其一）。

若「每日 GSC/Bing」已在 **私有服务** 入库，请将 **写入侧**对齐 **14.6.4** 主键与 **CTR ∈ [0,1]** 小数约定，读写即与站内 Admin / Agent **同源**。

#### 14.6.2 两条集成路线（由准到松）

**路线 B · 准则（推荐给 PDCA）：Search 表现专用表**

- **写入**：定时任务（对齐现有 `daily_growth_digest --persist` 节奏或独立 Cron）调用  
  - GSC：**Search Analytics**（dimensions：`date` + `page`；可选第二层 `query` 存明细表或小样本）  
  - Bing：**Query / Page / Inbound Links** 等报表中与本站 URL 粒度一致的一组指标（以 Bing Webmaster API 当前能力为准）。
- **读取**：单独的窄表优于塞进 `growth_daily_snapshots`，避免单行 `payload_json` 无限膨胀且难以按 URL 索引。

**本仓库已实现**的更细粒度见 **§14.6.4**（同一 `page_path` 下允许多个 `site_scope`，例如多国 Webmaster API 返回值）。

对 **仓位预算页的 PDCA**：Check 仍以 **`page_path == '/tools/position-budget'`**（canonical，无尾斜杠）为主线，对齐 `frontend/src/content/seo-position-budget.ts`。

**路线 A · 近似（仅作过渡）**：在现有 GA4 pull 里增加 **`pagePath × sessionMedium`（或 filters）**，单独拆出 `organic / organic search` 的 sessions，用于观趋势；**不可替代** GSC 的 impressions/position/query，不得写入 Spec 守门线作为主判据。

#### 14.6.3 Agent（Cursor）如何「为你所用」

满足 **路线 B（14.6.2）** 后，**只读契约**可与 **§14.6.4** 并存：

1. **HTTP Admin GET**：例如 `GET /api/admin/seo-search?path=/tools/position-budget&days=56&sources=gsc,bing&query_limit=120`（与 **`/api/admin/growth`** 同级鉴权：`requireAdminAuth`）。Agent **无法在生产外带 Cookie 直连** Admin 时，由人在本地/CI **导出 JSON**，或离线作业写 **快照文件** —— 注意不要提交密钥与可识别用户数据。
2. **Turso/SQLite 直连（只读）**：对有权限的运维库跑 `seo_search_performance` WHERE `page_path`；本地快照沙箱可把结果写入 §14.5 迭代表。

#### 14.6.4 本仓库：`seo_search_performance` · API · 写入契约

**物理表**：`seo_search_performance`（由 `ensureSeoSearchPerformanceSchema` 确保存在）

| 字段 | 说明 |
| --- | --- |
| `report_date` | `TEXT`，`YYYY-MM-DD`（对齐 Search Analytics **`date`** 维度语义） |
| `source` | `gsc` \| `bing` |
| `granularity` | `page`：URL 聚合行（**无**单独 query）；`query`：query × page 明细行，`search_query` **非空**（经 **lower + trim**，空串禁止） |
| `site_scope` | GSC/Bing **站点上下文**的稳定标识（示例：域名级 property、或 API 返回站点 URL）；**空**则入库管线记为字面 `unset` |
| `page_path` | **pathname only**，`/tools/position-budget` 形式（与 **`normalizeCanonicalPath`** & `seo-position-budget.ts` 一致）；含完整 URL 的 payload 会先被规范化为 pathname |
| `search_query` | `page` 行必须为 `''`；`query` 行 **非空** |
| `impressions`、`clicks` | 非负整数 |
| **`ctr`** | **`REAL`**，**[0, 1]** 区间内的小数，与 Google Search Analytics **fraction** 一致；Bing 若为百分比请先除以再入库 |
| `position` | 平均排名的数值表示；加权平均或由上游汇总；可为 `NULL` |
| `ingest_run_id` \| `raw_json` | 可选：`ingest_run_id` 关联一次离线批，`raw_json` 存单行原始 JSON |

**主键**：`PRIMARY KEY(report_date, source, granularity, site_scope, page_path, search_query)` — **`ON CONFLICT` UPSERT** 刷新指标与附属列。

---

**HTTP · `GET`**（只读，`/api/admin/seo-search`）

| Query | 说明 |
| --- | --- |
| `path` | **必选**，原始 path 或整 URL |
| `days` | 默认 `56`，范围 `1..400` · 回看 **UTC 窗口**的起算日与 `growth` 快照 **不对齐也没关系** |
| `sources` | 可选，逗号 **gsc**，**bing**；缺省 = 两类全选 |
| `query_limit` | 可选，返回 `granularity='query'` 行数上限，`1..2000`，默认 **120**（防爆表） |

**响应 JSON**：`normalized_path`、`scopes_for_path`（该 path 上出现过的 scopes）、**`page_daily`**（多维聚合后的序列）、**`query_rows`**（按 impressions 降序截断）。

---

**HTTP · `POST`**（写，`/api/admin/seo-search`）

请求体：**`{ rows: Row[] }`**，单次最多 **8000** 条；与 **upsert** 同一形状：

```json
{
  "rows": [
    {
      "report_date": "2026-05-01",
      "source": "gsc",
      "granularity": "page",
      "site_scope": "sc-domain:ziso.cc",
      "page_path": "/tools/position-budget",
      "search_query": "",
      "impressions": 1200,
      "clicks": 40,
      "ctr": 0.03333333333333333,
      "position": 3.8,
      "ingest_run_id": "cron-20260512",
      "raw_json": null
    },
    {
      "report_date": "2026-05-01",
      "source": "gsc",
      "granularity": "query",
      "site_scope": "sc-domain:ziso.cc",
      "page_path": "/tools/position-budget",
      "search_query": "position budget china",
      "impressions": 80,
      "clicks": 4,
      "ctr": 0.05,
      "position": 2.5
    }
  ]
}
```

**定时作业（已实现）**：`backend/scripts/daily_seo_search_ingest.py` — 与 **`daily_growth_digest.py --persist`** 同范式：`get_connection()`、`CREATE TABLE IF NOT EXISTS`、`--persist`。在 GitHub Actions 上见 **`.github/workflows/daily_seo_search_snapshot.yml`**（需在仓库 Secrets 增加 **`GSC_SITE_SCOPE`**，且同一服务账号须在 GSC「用户」中具备读权限）；默认复用 **`GA4_SERVICE_ACCOUNT_JSON` → `backend/keys/…json`**（JWT Scope 换成 **Search Console**，与 GA4 不同）。命令示例：`PYTHONPATH=. python backend/scripts/daily_seo_search_ingest.py --persist`（可先不加 `--persist` 看抓取行数）。

---

**闭环动作映射**：

- **Check**：`npm run check:position-budget-seo`（技术/HTML） **+** 从 B 表中取近 28/56 天 **impressions/clicks/CTR/position（及 Top queries）**。
- **Act**：若数据证明 CTR 极低或 queries 漂移，再在 `frontend/src/content/seo-position-budget.ts` / 页面可见文案做小步 Do（§14.4 仍适用「单假设」）。

---

## 15. 当前定稿结论

**先做插件，不是偏离主系统，而是为主系统降低风险。**

插件版的唯一正确做法是：

1. 入口独立
2. 语义一致
3. 数据可并轨

一句话收口：

**P0 先验证“是否被使用”，P1/P2 再验证“如何深度整合”；但从第一天开始，字段与纪律口径就按目标态执行。**
