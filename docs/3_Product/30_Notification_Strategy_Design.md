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
> 逻辑：仅在观点跨中轴线时触发，强调关键时刻的转向动作。
*   **Free (基础告知)**
    *   **Title**: `🚨 信号反转：{symbol}`
    *   **Body**: `观点从 [{old_signal}] 变为 [{new_signal}]，置信度 {confidence_pct}%。点开看原因。`
*   **Pro (动作导向)**
    *   **Title**: `🎯 Pro 反转提醒：{symbol}`
    *   **Body**: `核心方向已切换到 [{new_signal}]。已生成仓位动作与风险阈值。`

#### 2. 开盘早报 (morning_call)
> 逻辑：开盘前的注意力引导与情绪定调。
*   **Free (基础告知)**
    *   **Title**: `☕ 开盘前早报`
    *   **Body**: `重点观察 {stock_names} 等标的。{sentiment_snippet}`
*   **Pro (动作导向)**
    *   **Title**: `☀️ Pro 开盘作战简报`
    *   **Body**: `高优先级标的：{stock_names}。{sentiment_snippet}`

#### 3. 验证战报 (validation_glory)
> 逻辑：展现 AI 实力的关键闭环，形成持续复用的信任飞轮。
*   **Free (基础告知)**
    *   **Title**: `🏅 昨日判断已被验证`
    *   **Body**: `{stock_names} 与昨日判断一致，最大波动 {max_gain}%。继续按纪律执行。`
*   **Pro (动作导向)**
    *   **Title**: `🏆 Pro 策略验证成功`
    *   **Body**: `{stock_names} 命中关键节奏，最大波动 {max_gain}%。下一步计划已更新。`

#### 4. 预测更新 (prediction_updated)
> 逻辑：系统底层完成扫描刷新。
*   **Free (基础告知)**
    *   **Title**: `🤖 预测数据已更新`
    *   **Body**: `{market_name} 监控池已完成刷新，可查看最新趋势。`
*   **Pro (动作导向)**
    *   **Title**: `⭐ Pro 深度预测已就绪`
    *   **Body**: `{market_name} 深度分析已生成，含情绪建模与策略解释。`

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
> 逻辑：应对盘中极端波动（目前按战略为“降噪”，此通知不发）。
*   **All (通用)**
    *   **Title**: `{stock_name} ({symbol}) {emoji} {change_pct}%`
    *   **Body**: `最新: {price} | 成交: {volume_formatted}`


## 7. 非权威文档说明

`docs/archive/` 下通知相关历史文档（例如旧版 Drawer 升级方案）仅用于追溯，不作为当前实现依据。  
当前权威以本文件 + 代码为准。
