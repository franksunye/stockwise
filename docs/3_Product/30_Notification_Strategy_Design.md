# 知守 AI (ZISO AI) 通知系统专项设计（2026-03）
> **版本**: 2.0  
> **日期**: 2026-03-04  
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
| 每日复盘 | `daily_brief` / `daily_brief_*` | `daily_brief` | `engine/services/brief_assembler.py` | 复盘内容送达 | 开启 |
| 实时行情 | `price_update` | `price_update` | `sync/prices.py` | 盘中波动提醒 | 关闭 |
| 投资黄历 | `almanac_preview` / `almanac_ritual` | `market_almanac` | `scripts/broadcast_almanac.py` | 日级节奏与情绪框架 | 开启 |

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

## 5. 本次专项修正（2026-03-04）

1. 修复 `daily_brief_*` 入队后未被聚合处理的问题（已支持）。
2. 增加偏好映射表，解决“变体事件无法被用户开关控制”的问题。
3. 修复内部 API 与后端双重写日志导致的重复记录问题。
4. 统一并优化全部用户通知模板文案，强调“结论+价值+动作”。
5. 更新用户帮助文案与产品功能文档，通知类型口径统一为 7 类。

## 6. 后续升级路线（研究 -> 实现）

以下为明确的延续方向（当前未全部完成）：

1. **用户级频控策略**：通知冷却时间、每日上限、分层优先级抢占。
2. **组合级风险预警**：从单票事件升级为 Watchlist/持仓组合风险暴露提醒。
3. **价值闭环指标体系**：按通知类型监控点击率、留存贡献、转化贡献。
4. **端到端回放与诊断**：支持“某用户某天为何收到/未收到”的可追溯解释。

## 7. 非权威文档说明

`docs/archive/` 下通知相关历史文档（例如旧版 Drawer 升级方案）仅用于追溯，不作为当前实现依据。  
当前权威以本文件 + 代码为准。
