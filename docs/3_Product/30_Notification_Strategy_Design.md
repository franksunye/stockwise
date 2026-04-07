---
title: "知守 AI (ZISO AI) 通知系统专项设计"
doc_id: "product-notification-strategy-design-202603"
doc_domain: "product"
doc_status: "active"
owner: "founder"
created_at: "2026-03-04"
updated_at: "2026-04-07"
last_reviewed_at: "2026-04-07"
summary: "定义通知系统的生产基线与研究延续，是通知、节奏与触达类内容的现行事实源。"
---

# 知守 AI (ZISO AI) 通知系统专项设计

> **首次制定**: 2026-03-04  
> **最后更新**: 2026-04-07  
> **状态**: 生效中（Production Baseline）+ 研究亮点保留（Research Continuity）

## 0. 文档使用方式（重要）

本文件分为两层，请不要混用：

1. **生产基线层**：已实现、可上线、可验收的当前事实。
2. **研究亮点层**：已验证有价值但尚未完全落地的方向，用于后续升级延续。

## 1. 目标与边界

通知不是“播报”，而是系统价值交付。

1. 商业目标：每条通知都要体现 知守 AI (ZISO AI) 的核心能力（判断、验证、行动建议），服务 Pro 转化与留存。
2. 工程目标：通知链路必须可审计、可配置、可回放，满足生产级稳定性要求。
3. 体验目标：降低噪音，避免“高频低价值”。

## 2. 当前通知全量清单（用户侧）

| 类型 | 事件键（event_type） | 偏好键（preference key） | 触发来源 | 价值定位 | 默认状态 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 信号反转 | `signal_flip` / `signal_flip_batch` | `signal_flip` | `analysis/runner.py` + `NotificationManager.check_signal_flip` | 关键转向，最强行动价值 | 开启 |
| 开盘早报 | `morning_call` / `morning_call_neutral` | `morning_call` | `scripts/daily_morning_call.py` | 开盘前优先级排序 | 开启 |
| 验证战报 | `validation_glory` | `validation_glory` | `scripts/daily_validation_check.py` | 建立信任、强化留存 | 开启 |
| 预测更新 | `prediction_updated` | `prediction_updated` | `analysis/runner.py` | 服务状态告知 | 开启 |
| 每日复盘 | `daily_brief` / `daily_brief_*` | `daily_brief` | `engine/services/brief_assembler.py` | 复盘内容送达 | 暂停 |
| 实时行情 | `price_update` | `price_update` | `sync/prices.py` | 盘中波动提醒 | 关闭 |
| 投资黄历 | `almanac_preview` / `almanac_ritual` | `market_almanac` | `scripts/broadcast_almanac.py` | 日级节奏与情绪框架 | 暂停 |

## 2.1 研究亮点（保留，不代表已全部实现）

以下亮点来自前期通知专项研究，当前保留为产品升级方向：

1. **从“行情播报”升级为“AI 决策助手”**：通知承载判断与动作，而非仅价格变化。
2. **Signal Flip 作为核心价值通知**：仅在观点跨中轴线时触发，强化“关键时刻触达”。
3. **Validation Glory 作为信任增长飞轮**：持续展示可验证战报，强化留存与续费意愿。
4. **个性化风险预警（Guardian 模式）**：面向用户持仓组合的风险扫描与操作提醒。
5. **分层通知商业化**：Free 以摘要告知，Pro 以“可执行动作”作为差异化价值。

## 3. 文案框架（统一规范）

每条通知遵循三段式：

1. 结论先行：先告诉用户发生了什么（反转/验证/更新/风险）。
2. 价值锚点：说明为什么值得看（置信度、命中、节奏、风控）。
3. 行动入口：明确点击后得到什么（复盘、计划、阈值、细节）。

实现位置：`backend/notification_templates.py`

## 4. 工程实现原则

1. 单一模板中心：所有用户通知标题/正文必须通过 `NotificationTemplates.render()`。
2. 偏好兼容映射：变体事件统一映射到主偏好键（如 `daily_brief_bullish -> daily_brief`）。
3. 聚合可预期：同一用户同批次内聚合为一条，避免风暴式推送。
4. 日志不重复：后端 `NotificationManager` 为主日志写入点；调用内部 API 时带 `skip_log=true`。
5. 链路可审计：每条通知带 `nid` 追踪参数并落库 `notification_logs`。

## 5. 后续升级路线（研究 -> 实现）

以下为明确的延续方向（当前未全部完成）：

1. **用户级频控策略**：通知冷却时间、每日上限、分层优先级抢占。
2. **组合级风险预警**：从单票事件升级为 Watchlist/持仓组合风险暴露提醒。
3. **价值闭环指标体系**：按通知类型监控点击率、留存贡献、转化贡献。
4. **端到端回放与诊断**：支持“某用户某天为何收到/未收到”的可追溯解释。

## 6. 核心通知类型与文案规格 (2026-04 线上镜像)

具体通知话术是系统向用户交付价值和传递专业度的核心触点，这些具体的文本规范内聚于产品设计文档当中并与 `backend/notification_templates.py` 强绑定。

#### 1. 信号反转 (signal_flip)
> 触发逻辑：遵循“单一周期收盘确认 (Once Per Bar Close)”原则。必须在目标级别 K 线收平后确立跨越中轴，才会触发。系统通过冷却期过滤盘中的高频假摔或来回摩擦噪音。
*   **Free (基础告知)**
    *   **Title**: `🚨 {timeframe}信号反转：{stock_names}`
    *   **Body**: `观点从 [{old_signal}] 变为 [{new_signal}]，置信度 {confidence_pct}%。点击查看突破动因。`
*   **Pro (动作导向)**
    *   **Title**: `🎯 Pro {timeframe}反转预警：{stock_names}`
    *   **Body**: `结构已确立切换为 [{new_signal}]。{direction_action} 查看最新计划。`
    *   *(注：当多转空时 `{direction_action}` = "关注防守与破位边界"；当空转多时 `{direction_action}` = "蓄势转强，关注试仓条件")*

#### 2. 开盘早报 (morning_call)
> 触发逻辑：于**开盘前 1 小时**（如 CN/HK 市场为北京时间 08:30）固定触发。不采用宏观大盘情绪，而是直接聚合用户**个人自选股池 (Watchlist)** 当日的 AI 预测核心语义（TriggeredLong / RiskOff）。系统采用基于“绝对触发量”的稀疏适配算法（Sparsity Adjusted）为每个用户输出千人千面的 `{sentiment_tag}` 与 `{stock_names}` 组合：
> - **[局部试多] / [多头进攻]**: 当池内多头（TriggeredLong）数量 > 0 且大于等于空方时。若数量极少（≤2）定调为“局部试多”，反之“多头进攻”。`{stock_names}` 顺势提取做多标的。
> - **[局部承压] / [避险防御]**: 当池内空头（RiskOff）数量 > 0 且胜过多方时。同理细分为“局部承压”与“避险防御”。`{stock_names}` 顺势提取破位风险标的。
> - **[震荡观望]**: 多空均未触发（极度死水）。系统降级调用 `morning_call_neutral` 退化模板（“自选池无明确多头信号，情绪：[震荡观望]。今日耐心等待”）。
*   **Free (基础广度认知)**
    *   **Title**: `☕ 开盘前早报`
    *   **Body**: `自选池情绪：[{sentiment_tag}]。重点观察 {stock_names} 等标的盘口异动。`
*   **Pro (战术深度聚焦)**
    *   **Title**: `☀️ Pro 开盘作战简报`
    *   **Body**: `高优盯盘资产：{stock_names}。自选池情绪：[{sentiment_tag}]。带好战术防线入场。`

#### 3. 验证战报 (validation_glory)
> 触发逻辑：于盘后或休市期触发。不刻意筛选最高点炫耀，而是客观匹配昨夜预测与今日实际走势。核心目的是展现闭环体系，帮助用户克服贪婪与恐惧，强化“按机器纪律执行”。
*   **Free (结果溯源与信任拉平)**
    *   **Title**: `📊 AI 策略执行追踪：{stock_names}`
    *   **Body**: `该标的今日触及预测网格，录得日内最高浮盈 {peak_gain}%。进入详情查看 AI 复盘。`
*   **Pro (动态风控与跟进)**
    *   **Title**: `🎯 Pro 策略复盘与进阶：{stock_names}`
    *   **Body**: `已达成预期推演 (日内最高浮盈 {peak_gain}%)。最新止损边界与持仓计划已更新，请检查。`

#### 4. 预测更新 (prediction_updated / 盘后沙盘)
> 触发逻辑：每日预测批处理完成后触发。采用**“成果分层 (Hierarchical Alert)”**的区别机制（原则上仅作为端内静默发报）：
> - **[L1 异动提权 (`prediction_updated_alert`)]**：当扫描出高置信度结构偏移 (`TriggeredLong/RiskOff` 等 > 0) 时触发，透传强准备金召唤感。
> - **[L2 常规巡检 (`prediction_updated_routine`)]**：全是中性/观察标的，作为保底动作触发，传递安抚感与系统存活感。
*   **Free (基础广度)**
    *   **[L1 异动] Title**: `⚡ {market_name} 最新异动已捕获`
    *   **[L1 异动] Body**: `模型扫描已完成。您的自选池中析出 {action_count} 个核心形态变化，建议立即查看 AI 评级。`
    *   **[L2 巡检] Title**: `🔄 {market_name} 夜间推演完成`
    *   **[L2 巡检] Body**: `全场标的走势模拟已更新。当前无结构性发散，请继续跟踪网格支撑位。`
*   **Pro (战术深度)**
    *   **[L1 异动] Title**: `🚨 Pro 盘后核心沙盘：发现战机`
    *   **[L1 异动] Body**: `{market_name} 模型算力结算完毕。已锁定 {action_count} 处可建仓/防守级拐点，风控参数与进场节点已更新。`
    *   **[L2 巡检] Title**: `🛡️ Pro 盘后例行维护：阵型稳固`
    *   **[L2 巡检] Body**: `{market_name} 核心标的深度评估完毕。当日无系统性风控事件，明日纪律计划已下发。`

#### 5. 每日复盘 (daily_brief) ⚠️ 待重新启用
> 逻辑：收盘后的例行市场总结。目前功能处于暂停打磨期，保留当前文案结构。
*   **Free (基础告知)**
    *   **Title**: `📊 今日复盘已就绪` （变种包括：🚀机会集中 / 🛡️风险升温 / 偏中性）
    *   **Body**: `{push_hook}` 
*   **Pro (动作导向)**
    *   **Title**: `⭐ Pro 深度复盘已就绪` （变种包括：🟢机会窗口 / 🔴避险触发 / ⚪震荡更新）
    *   **Body**: `{push_hook} | 含明日执行计划` （或附减仓防守方案/观望试仓边界）

#### 6. 投资黄历 (almanac_preview) ⚠️ 待重新启用
> 逻辑：日级别的市场情绪边界与行事指引。目前功能处于暂停打磨期。
*   **All (通用)**
    *   **Title**: `📜 明日投资黄历已出炉`
    *   **Body**: `意境：{mood_tag} | 宜：{strategy}。抢先看明日市场势能推演。`

#### 7. 实时行情 (price_update)
> 逻辑：应对盘中极端波动（目前按战略定调为“低优降噪”，此通知不发）。
*   **All (通用)**
    *   **Title**: `{stock_names} {emoji} {change_pct}%`
    *   **Body**: `最新: {price} | 成交: {volume_formatted}`

#### 8. 盘中结构雷达 (ai_radar_alert)
> 触发逻辑：盘中实时触发。核心在于比较“实时走势”与“晨间 AI 预判”的逻辑一致性。仅在发生**明确背离**（如破位）或**超预期共振**（如放量突破压力位）时发信，作为高价值战术提醒。
*   **Free (风险感应)**
    *   **Title**: `📡 [AI雷达] 捕捉到结构性偏移`
    *   **Body**: `{stock_names} 实际走势与晨间预判出现逻辑背离。重点观察其在 {current_price} 附近的表现。`
*   **Pro (战术确认)**
    *   **Title**: `🕵️ Pro 结构雷达：逻辑共振确认`
    *   **Body**: `{stock_names} 盘中逻辑共振。放量突破 AI 强压力位 {resistance}。请根据 Pro 盘中实时计划调整策略。`



## 7. 全球化调度时间表 (Global Scheduling Timetable)

为了确保双版本（国内/海外）用户的投资节奏与对应市场的开盘、交易、收盘窗口精准对齐，系统采用基于**北京时间 (BJ Time)** 统一编排、分市场独立触发的全球化调度方案。

### 7.1 双版本节奏对账表

| 时段 (BJ Time) | 市场 | 任务类型 | 核心事件 / 用户通知 | 触发基准 | 核心价值交付 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **06:30** | 🇺🇸 US | 后台同步 | **美股结算与 AI 评级更新** | `daily_pipeline_us.yml` | 隔夜美股数据回填，产出今日新预测 |
| **08:30** | 🇺🇸 US | **用户通知** | **美股验证战报 (US Validation Glory)** | `daily_validation_check_us.yml` | **(NEW)** 美股收盘后及时复盘，确立信任 |
| **08:30** | 🇨🇳 CN/HK | **用户通知** | **晨间作战简报 (Morning Call)** | `daily_morning_call.yml` | A 股/港股开盘前策略同步与 Watchlist 扫描 |
| **09:30-15:00**| 🇨🇳 CN/HK | **实时通知** | **盘中雷达 / 信号反转提醒** | `intraday_monitor.py` | 实时监控自选股逻辑偏移与机会共振 |
| **16:00** | 🇨🇳 CN | 后台同步 | **A 股收盘同步与复盘分析** | `daily_pipeline_cn_main.yml` | 结算 A 股表现，产出 T+1 预测 |
| **16:30** | 🇭🇰 HK | 后台同步 | **港股收盘同步与复盘分析** | `daily_pipeline_hk.yml` | 结算港股表现，产出 T+1 预测 |
| **17:30** | 🇨🇳 CN/HK | **用户通知** | **验证战报 (CN/HK Validation Glory)** | `daily_validation_check.yml` | 盘后自动验证 A 股/港股命中情况，建立信任 |
| **20:30** | 🇺🇸 US | **用户通知** | **美股晨间简报 (US Morning Call)** | `daily_morning_call_us.yml` | 美股开盘前（冬/夏令时自适应）策略同步 |
| **21:30-04:00**| 🇺🇸 US | **实时通知** | **美股盘中监控 / 雷达推送** | `intraday_monitor.py` | 监控美股实时异动（L1 级雷达提醒） |

> [!TIP]
> - **夏令时/冬令时自动适配**：美股相关任务（06:30 与 20:30）随美东时间自动平移，确保用户始终在**开盘前 1 小时**收到简报。
> - **数据新鲜度**：所有 Morning Call 均包含“隔夜美股”或“昨日 A 股”的最新分析结果。

## 8. 非权威文档说明

`docs/archive/` 下通知相关历史文档（例如旧版 Drawer 升级方案）仅用于追溯，不作为当前实现依据。  
当前权威以本文件 + 代码为准。
