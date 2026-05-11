---
title: "功能规格说明书：仓位预算（Position Budget / R 纪律）（Spec 56）"
doc_id: "spec-trade-management-position-budget-r-discipline-20260509"
doc_domain: "product"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-05-09"
summary: "在 v2 交易管理 sidecar 之上，引入仓位预算（R 纪律）层：把 Tactic + key_levels + 6 状态机已经产出的系统侧止损与目标位，压缩成单笔可执行的 1R 风险预算与仓位规模，作为 TacticalBriefDrawer 决议/管理 tab 的录入前置与执行前置。"
implementation_p0_spec: "docs/3_Product/Specs/trade_management/57_Position_Budget_Plugin_P0_Spec_20260511.md"
implementation_architecture_rfc: "docs/1_Engineering/50_Plugin_Architecture_And_Extensibility_RFC_20260511.md"
---

# 功能规格说明书：仓位预算（Position Budget / R 纪律）（Spec 56）

## 1. 一句话定义

**仓位预算是 v2 交易管理 sidecar 的录入前置与执行前置层：把"系统已经给出的止损位与目标位"翻译成"这一笔该建多大、亏多少 1R、对应当前状态该怎么做"。**

它不是一个独立的 R 计算器工具。

---

## 2. 正式定位

### 2.1 它是什么

仓位预算的正式定位是：

**在已有持仓状态机之前与之上，回答"这一笔的风险预算应是多少"的执行预算层。**

它服务的是：

1. 单笔 1R 风险的明确化
2. 仓位规模的标准化
3. 与 6 状态机分动作语义对齐
4. 为后续 Paper Portfolio Lab 提供"计划 R"事实

### 2.2 它不是什么

它不是：

1. 独立的风控计算器小工具
2. 第二套止损/目标位生成系统
3. 浮动在 AI 预测页上的 sidebar
4. 本地端的私有交易日志重做
5. 任意 JS 表达式驱动的"自定义公式器"
6. AI 计划 vs 实际执行的对比报告系统

### 2.3 与 v2 现有产品层的边界

当前 v2 已经成立的层：

1. `Tactic + key_levels`：单票战术与关键位（已落，见 `frontend/src/lib/types.ts`）
2. `Investment Mode`：风险偏好层（Spec 47）
3. `Trade Management Phase 0+`：已开放到 `TacticalBriefDrawer` 的 `管理` tab，含 6 状态机、market-aware routing、advice loop、events、admin（Spec 51 / 52 / 53）

仓位预算的边界：

**Tactic 回答"这票现在看哪个位"，状态机回答"这仓现在处于哪个阶段"，仓位预算回答"这笔在这个位、这个阶段下，可以下多大"。**

一句话：

**它是 sidecar 之内、状态机之前的"执行预算薄层"，不是新建独立产品。**

---

## 3. 核心目标

### 3.1 用户价值

1. 建仓前看到"这笔最多亏 X 元 (1R)、可买 N 股、对应账户 Y%"
2. 加减仓前看到"当前状态下，该不该再加、再加多少 R"
3. 收尾后留下"这笔计划 R / 实际 R" 的可追溯事实

### 3.2 产品价值

1. 把 v2 已经存在的`Tactic / key_levels / 6 状态机`从"展示层"推进到"执行预算层"
2. 给 Pro 锚点能力补上"工业级执行力"中的"风险预算"一环
3. 沉淀"计划 R"事实，为 Paper Portfolio Lab 路线提供可对比基础事实

### 3.3 不追求的事

1. 不追求"AI 给出唯一目标价 + 置信度"那类荐股器形态
2. 不追求把研究尺子展示给用户
3. 不追求成为独立的交易计算器产品

---

## 4. 与 AI 预测产品的真实对接（数据契约）

### 4.1 实际可用字段（必须对齐）

仓位预算只消费 v2 已经存在的字段，不假设新字段：

来自 `TacticalData`：

1. `tactics.holding_profit[].target_price / stop_advance_price`
2. `tactics.holding_loss[].stop_loss_price`
3. `tactics.empty[].buy_zone_price / target_price / stop_loss_price`

来自 `TacticalData.key_levels`：

1. `stop_loss_reference`（首选系统侧止损参考位）
2. `strong_support / strong_resistance`
3. `breakout_confirmation_level`
4. 兼容字段：`support / resistance / stop_loss`

来自交易管理 sidecar：

1. `position`（剩余仓位 / 原始仓位 / 成本价）
2. `advice.state_id`（6 状态之一）
3. `advice.recommended_policy`
4. `recent_events`

### 4.2 不引入的伪字段

明确不引入也不期待：

1. `confidence_score`：StockWise 战略明确反对单一置信度分数（见 `02_Monetization_Pricing_Strategy.md` 与 Danelfin 对照）
2. `suggested_stop_loss`（独立于 Tactic 的全局字段）：止损语义已经按场景拆在 `Tactic.*_price` 与 `key_levels.stop_loss_reference` 中
3. `target_price`（独立于 Tactic 的全局字段）：同上

### 4.3 字段填充优先级

仓位预算在不同场景下的字段优先级：

`empty / 建仓场景`：

1. 入场价：`buy_zone_price` -> 用户手动覆盖
2. 止损位：`stop_loss_reference` -> `tactics.empty[].stop_loss_price` -> 用户手动
3. 目标位：`tactics.empty[].target_price` -> `key_levels.strong_resistance` -> 不强求

`holding_profit / 已盈利加减仓场景`：

1. 入场价：当前价（实时）
2. 止损位：`tactics.holding_profit[].stop_advance_price` -> `key_levels.stop_loss_reference`
3. 目标位：`tactics.holding_profit[].target_price`

`holding_loss / 已亏损减仓场景`：

1. 不再展示 1R 建仓预算
2. 只展示"按当前 1R 反向校准的减仓建议"
3. 止损位：`tactics.holding_loss[].stop_loss_price` -> `key_levels.stop_loss_reference`

### 4.4 字段缺失降级

1. 任一关键位缺失：UI 显式标注"系统暂无此位，请手动输入"
2. 全部位缺失：默认 `Side / 观望`，禁止用伪值兜底
3. 不静默失败，符合开发原则第 3 条

---

## 5. 与 6 状态机的融合（执行预算薄层）

仓位预算的输出必须按 `state_id` 切换语义，不能是单一公式：

| state_id | 仓位预算的语义 |
| --- | --- |
| `EntryTriggered` | 建仓 R 预算：1R 应是多少元、可买多少股、占比 |
| `BreakoutPending` | 观望 R 预算：若突破确认则下多少 R |
| `TrendHolding` | 加码 R 预算 + 总仓位 R 上限提示 |
| `ProfitProtection` | 已锁 R 提示 + 保护性减仓的"保留 R" |
| `FailureRisk` | 不展示新增 R 预算，只校准应减仓多少以回到原 1R 之内 |
| `ExitCompleted` | 仅复盘：计划 R / 实际 R 落账 |

正式判断：

**仓位预算不是一个永远显示的"建仓计算器"，而是按状态机切换形态的"执行预算薄层"。**

---

## 6. 入口与挂载（不新增 sidebar）

### 6.1 不允许的入口形态

1. AI 预测结果页的浮动 sidebar（StockWise 没有这个独立页）
2. 全局浮动按钮 / 独立工具页
3. 与 `TacticalBriefDrawer` 并列的新 drawer

理由：会直接破坏 Spec 51 已经定型的 sidecar 原则与 Spec 52 已经收口的"三 tab 一致性"判断。

### 6.2 正式挂载位置

挂载在 `TacticalBriefDrawer` 的现有 tab 之内：

1. `决议` tab
   - 建仓预算：在"今天可不可以下"之后回答"如果下，下多大"
   - 仅当当前用户在 `empty` 场景，或最近一次决议为可建仓
2. `管理` tab
   - 加减仓预算：在"当前状态 + 今日动作"之后回答"如果执行，按多少 R"
   - 仅当存在真实持仓且 `state_id` ∈ {`TrendHolding`, `ProfitProtection`, `FailureRisk`}
3. 录入持仓抽屉（`TradeManagementEntryDrawer`）
   - 在"建仓日 / 建仓均价 / 持仓数量"之外，作为可选的"按 1R 反推持仓数量"模式

### 6.3 不挂载的位置

1. `内参` tab（属于纯择时阅读，不应被预算入侵）
2. dashboard 主列表（不污染主链路，与 Spec 51 一致）
3. 自选池（一阶段不引入）

---

## 7. R 模式（首版收敛为三模式）

### 7.1 默认模式：跟随系统位（推荐）

`risk_per_share = entry_price - key_levels.stop_loss_reference`

或在 `tactics.*` 已给出 `stop_loss_price / stop_advance_price` 时优先使用 Tactic 字段。

UI 标注："基于系统给出的止损参考位计算"。

### 7.2 模式二：固定止损价

用户手动输入止损价：

`risk_per_share = entry_price - user_stop_loss_price`

### 7.3 模式三：百分比止损

`risk_per_share = entry_price * stop_percent`

默认 `stop_percent = 5%`，范围 `1%~10%`。

### 7.4 砍掉的模式

正式砍掉：

1. `自定义 JS 公式` 模式
   - 与开发原则第 3 条"零容忍幻觉"冲突
   - 与品牌战略"反黑盒分数 / 透明推理链"冲突
   - 砍除，无 Pro 解锁

2. `ATR 动态止损` 模式
   - Phase A 不进入
   - 后续若启用，应作为 `key_levels` 派生字段在系统侧统一供给，而不是前台再算一次

### 7.5 公共计算公式

仍然采用标准 R 公式：

1. `risk_amount = account_size * risk_ratio`
2. `position_size = floor(risk_amount / risk_per_share)`
3. `expected_loss = position_size * risk_per_share`
4. `expected_profit = position_size * (target_price - entry_price)`（仅当 `target_price` 可信）
5. `r_multiple = (target_price - entry_price) / risk_per_share`（仅当 `target_price` 可信）

### 7.6 参数边界

1. `risk_ratio ∈ [0.1%, 5%]`
2. 越界给出风险提示，不静默通过
3. `risk_per_share <= 0` 直接阻断提交

---

## 8. 持久化（不走 LocalStorage）

### 8.1 用户偏好

存储位置：服务端用户私有表，沿用 trade-management 风格。

建议新增：

```
GET  /api/user/trade-management/preferences
PUT  /api/user/trade-management/preferences
```

字段建议：

1. `default_account_size`（可空；用户主动输入；不参与任何分析主链路）
2. `default_risk_ratio`（默认 `0.01`）
3. `default_r_mode`（默认 `system_followed`）

### 8.2 计划事实

仓位预算的"计划 R 结果"作为可选事实落库：

候选方案 A（推荐）：

- 在 `events` 写入时附带 `plan_r_amount / plan_position_size / plan_r_mode`
- 不新建表，沿用现有事件链

候选方案 B：

- 新建 `position_budgets` 子表，外键 `position_id`
- 适合后续 Paper Portfolio Lab 直接消费

具体方案在工程拆解阶段再决，本 Spec 仅明确：

**计划 R 事实必须落库，不能仅活在前端。**

### 8.3 不走 LocalStorage 的原因

1. v2 交易管理已经是服务端表 + SWR + sessionStorage 软缓存，不应再发明本地端口
2. LocalStorage 方案与 Spec 51 的"私有 sidecar 数据面"判断不一致
3. 跨设备一致性（移动 + 桌面）必须由服务端兜底

### 8.4 隐私与边界

1. `account_size` 仅写入用户私有偏好表
2. 不进入 `/api/stock/batch`
3. 不进入任何分析主链路
4. 不出现在 admin 报表
5. UI 明确说明："仅用于本地预算计算，不参与系统分析"

---

## 9. UX 与文案约束

### 9.1 复用 Spec 52 已收口的视觉系统

1. 卡片密度、节标题、首屏结论优先与 `管理` tab 一致
2. 强弱按钮关系与录入抽屉、个人中心一致
3. 不引入新的色系或新的图表库
4. 不使用 ECharts / Recharts 等新增依赖；首版若需可视化，仅用 Tailwind + 简单 SVG

### 9.2 文案规范

允许：

1. "基于您的参数，建议买入 …"
2. "本次预计亏损 X 元（1R）"
3. "若止损被触发，亏损在风险预算内"

禁止：

1. "你应该买入 …"
2. "最大亏损 …"
3. "AI 推荐仓位为 …"
4. "胜率 X% / NPS / 周留存 …" 等任何对外承诺类话术

### 9.3 状态/动作/纪律语言一致性

仓位预算的输出必须能塞回 Spec 47 的三类语言：

1. `状态`：当前 6 状态机之一
2. `动作`：建仓 / 加码 / 保护性减仓 / 退出（按状态映射）
3. `纪律`：1R 上限、总仓位 R 上限、保留 R 提示

---

## 10. 合规与风险约束

### 10.1 免责声明（必须可见）

> 本工具为风险预算辅助工具，所有计算结果基于您输入的数据与系统参数。
> 不构成投资建议，不保证盈利。市场有风险，投资需谨慎。

### 10.2 反过度承诺

1. 禁止任何"将提升收益 / 提高胜率"类表达
2. 禁止"专家级 / 机构级"类形容词
3. 禁止用绿色/上涨色暗示"按此操作即可获利"

### 10.3 极端参数

1. `risk_ratio > 2%` 给出黄色提示
2. `risk_ratio > 5%` 阻断
3. `position_size * entry_price > account_size` 阻断（杠杆隐含）
4. `entry_price <= stop_loss_price`（多头）阻断

---

## 11. 会员分级（与 v1 实际定价一致）

对齐 `02_Monetization_Pricing_Strategy.md` 的 5 段定价（Free / Go / Plus / Pro / Alpha），不引入"$9.9 高级版"二段定价。

| 能力 | Free | Go | Plus | Pro | Alpha |
| --- | --- | --- | --- | --- | --- |
| 基础 R 计算（三种模式）| ✅ | ✅ | ✅ | ✅ | ✅ |
| 跟随系统 `key_levels.stop_loss_reference` | ✅ | ✅ | ✅ | ✅ | ✅ |
| 保存为持仓预算（落 events）| ❌ | ✅ | ✅ | ✅ | ✅ |
| 与 `管理` tab 状态机联动语义 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 加码 / 总仓位 R 上限提示 | ❌ | ❌ | ✅ | ✅ | ✅ |
| 按状态分桶的 R 复盘统计 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 多策略预算并存（多笔在管） | ❌ | ❌ | ❌ | ✅ | ✅ |

正式判断：

**仓位预算的免费版必须保留"算清 1R"这条最小执行底线，付费层级围绕"沉淀 / 联动 / 复盘"延伸，而不是把 1R 算法藏在付费墙后面。**

---

## 12. 与 Paper Portfolio Lab 的边界（剥离 AI 对比报告）

### 12.1 边界

1. 仓位预算只负责"产生计划 R 事实"
2. "AI 计划 R vs 实际 R / 按场景分组绩效 / 行为优化建议"全部归 Paper Portfolio Lab（参见 `docs/4_Growth_Ops/51_Paper_Portfolio_Lab_Experiment_Plan_20260509.md`）
3. 本 Spec 不在 R-M 层做"AI 对比报告"

### 12.2 协作约定

1. 仓位预算事实必须落库，字段与 Paper Lab 后续消费契约对齐
2. Paper Lab 路线启用时，可读取现有 `events / position_budgets` 表，不要求 R-M 再回吐数据
3. R-M 自身不引入"对比报告"前台模块

---

## 13. 技术方案（对齐实际栈）

### 13.1 技术栈

完全沿用前端现有依赖，不引入新栈：

1. `Next.js 15` / `React 19` / `TypeScript`
2. `Tailwind CSS v4`
3. `framer-motion` / `lucide-react`
4. `SWR` 数据层
5. `@libsql/client` / `better-sqlite3` 服务端
6. 不引入：`Vue / Element Plus / ECharts / localForage / crypto-js`

### 13.2 模块边界

新增前端模块（建议）：

1. `frontend/src/lib/position-budget.ts`：纯函数计算 + R 模式适配
2. `frontend/src/components/dashboard/PositionBudgetCard.tsx`：嵌入 `决议` tab 的预算卡
3. `frontend/src/components/dashboard/PositionBudgetInline.tsx`：嵌入 `管理` tab 与录入抽屉的轻形态
4. `frontend/src/hooks/useUserPreferences.ts`：用户偏好（含 `account_size / risk_ratio / r_mode`）

新增 / 复用 API：

1. 新增：`/api/user/trade-management/preferences`
2. 复用：`/api/user/trade-management/positions/[positionId]/events`（写入时携带 `plan_r_*` 字段）或独立 `/api/user/trade-management/positions/[positionId]/budgets`

### 13.3 与 SWR 的关系

1. 偏好走 `SWR` 单 key 缓存
2. 不进入 `useTradeManagementSurface`，避免污染 sidecar 主面
3. 偏好变更后仅 `mutate` 自身 key，不触发 surface 重拉

### 13.4 实现策略：插件先行（与 Spec 57 对齐）

目标态仍以本文为准：`TacticalBriefDrawer` 内嵌、与 6 状态机语义融合、不新建与 sidecar 并列的浮动入口。

工程落地允许**先走验证态**：在同一技术栈内提供**应用内独立路由页面**（仓位预算插件 P0），用于低耦合验证「1R 预算是否被持续使用」、偏好与计划 R 快照的服务端持久化、股票档案预填与匿名/登录两态。该验证态的边界、API 草案、并轨退出标准见：

- `docs/3_Product/Specs/trade_management/57_Position_Budget_Plugin_P0_Spec_20260511.md`
- `docs/1_Engineering/50_Plugin_Architecture_And_Extensibility_RFC_20260511.md`

约束：

1. 计算口径、字段优先级、三种 R 模式、阻断与免责声明仍以本文第 4–7、10 节为准，插件不得发明第二套语义。
2. 插件产出的数据模型须可按 Spec 57「并轨条件」迁入 Phase A/B（`events` 或等价事实表），避免二次迁移。
3. 「插件」指**主应用内的功能模块 / 路由**，不是脱离 StockWise 主栈的站外产品；与第 14 节「明确不做」中的独立工具站相区别（见该节说明）。

---

## 14. 路线图与分期范围

### 14.0 实施顺序（可选）

若团队选择降低主链路耦合风险，可先完成 **Spec 57 P0**（独立路由 + 持久化 + 预填），再进入 **14.1 Phase A** 的 `决议` tab 嵌入；验收仍以本文第 15 节各阶段为准，Spec 57 不替代 Phase A/B/C 的 sidecar 验收项。

### 14.1 Phase A（最小闭环 · 1 个月）

1. `决议` tab 内嵌入"基础 R 预算卡"（默认模式 + 固定止损 + 百分比）
2. 录入持仓抽屉新增"按 1R 反推持仓数量"可选模式
3. 服务端用户偏好接口落地
4. 计划 R 事实落库（events 扩展字段方案 A）

### 14.2 Phase B（状态机融合 · 2 个月）

1. `管理` tab 嵌入"加减仓 R 预算 + 总仓位 R 上限"
2. 6 状态机分别给出对应预算语义
3. `FailureRisk` 校准减仓提示

### 14.3 Phase C（Pro 复盘层 · 3 个月）

1. 按状态分桶的 R 复盘统计
2. 多策略预算并存
3. 与 Paper Portfolio Lab 数据契约对齐

明确不做：

1. 浏览器插件版本（Browser Extension）
2. 独立工具站：指**脱离 StockWise 主栈**的站外域名或独立产品站；**不禁止**主应用内独立路由的验证页（Spec 57 P0），该类页面仍须遵守本文数据契约与合规边界，并作为并入 sidecar 前的工程手段。
3. ATR / 自定义 JS 公式
4. R-M 自身的 AI 对比报告

---

## 15. 验收标准

### 15.1 Phase A 验收

- [ ] `决议` tab 在 `empty` 场景下展示"基础 R 预算卡"，可读取 `Tactic + key_levels` 默认值
- [ ] 三种 R 模式在 UI 上可切换，结果实时刷新
- [ ] 用户偏好（`account_size / risk_ratio / r_mode`）持久化到服务端，不写 LocalStorage
- [ ] 录入持仓抽屉支持"按 1R 反推"
- [ ] 计划 R 事实可在 events 中查到
- [ ] 极端参数（>2% 提示、>5% 阻断、入场≤止损阻断）逻辑生效
- [ ] 不引入 Vue / Element / ECharts / localForage 任意一项
- [ ] 不影响 `内参 / 决议 / 管理` 三 tab 现有阅读节奏（Spec 52 一致性）

### 15.2 Phase B 验收

- [ ] 6 状态机分别给出可区分的预算语义文案
- [ ] `管理` tab 内嵌入预算时不破坏首屏"主结论"地位
- [ ] 总仓位 R 上限提示在多次加仓后仍然准确

### 15.3 Phase C 验收

- [ ] Pro 用户可看到按状态分桶的 R 复盘
- [ ] 数据契约对齐 Paper Lab 路线，不重复发明字段

---

## 16. 风险与应对

1. `语义错位`（中概率 / 高影响）
   - 风险：用户把"建议仓位"当成"AI 推荐买入数量"
   - 应对：所有预算输出统一使用"基于您的参数 …"句式，并在卡片底部固定免责
2. `主链路污染`（中概率 / 高影响）
   - 风险：偏好或预算被混进 batch / 主分析链
   - 应对：偏好/预算独立 API，独立 SWR key，不进入 surface
3. `状态机冲突`（中概率 / 中影响）
   - 风险：预算建议与 `管理` tab 当前 `action_summary` 表达冲突
   - 应对：预算文案统一在 `action_summary` 之后展示，且必须按 `state_id` 切换语义
4. `付费切线错位`（中概率 / 中影响）
   - 风险：把基础 R 算法藏在付费墙后会破坏教育底线
   - 应对：基础 1R 必须 Free 可用，付费层从 Go 起，按"沉淀 / 联动 / 复盘"分层

---

## 17. 当前定稿结论

仓位预算的本质，不是再造一个 R 计算器，而是：

**把 v2 已经存在的 `Tactic + key_levels + 6 状态机 + market-aware routing` 推进到执行预算这一层，让用户在已有的 sidecar 之内、状态机之前，看到"这一笔的风险预算应是多少"。**

它必须满足三件事才能成立：

1. 嵌入 `TacticalBriefDrawer` 的 `决议 / 管理` tab，不新建 sidebar
2. 完全消费现有数据契约，不引入伪字段（`confidence_score` 等）
3. 与 6 状态机分动作语义对齐，不退化为单一公式计算器

一句话收口：

**仓位预算是 v2 交易管理 sidecar 的"前一步"——它让"系统知道的位"和"用户能下的手"对齐。**
