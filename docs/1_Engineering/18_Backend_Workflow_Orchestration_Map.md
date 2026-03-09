# 18 Backend Workflow Orchestration Map

更新时间：2026-03-09

## 1. 目标

为当前 知守 AI (ZISO AI) 后台任务建立统一编排口径，解决以下问题：

1. 生产链路、研究链路、运营链路、验证链路混称
   - 当前统一术语应为：生产线、实验线、运营链路、验证链路
2. 单个 workflow 承担多种职责，出现互相阻塞
3. 时间表只写 cron，不写依赖、阻塞级别和失败策略
4. 通知责任未并入编排设计，导致有的任务会通知用户、有的任务只应通知 ADMIN、有的任务失败后仍可能静默

本文档作为后续 workflow 拆分与调度治理的统一依据。

## 2. 24 小时运行纲

在进入具体 workflow 之前，先定义一天 24 小时内后台的宏观时间规划。

这部分不是精确 cron 表，而是“这个时间段系统应该以什么目标为主”的总纲。

### 2.0 总控摘要表

| 时间段 | 主目标 | 主类别 | 允许的任务类别 |
| --- | --- | --- | --- |
| `06:00-09:00` | 盘前准备 | 内容刷新与晨间触达 | `Production Content` / 轻量 `Ops Governance` / 必要 `Maintenance` |
| `09:00-16:30` | 盘中服务 | 前端实时能力优先 | `Production Core` / 严格受控 `Production Content` / 最小化 `Ops Governance` |
| `16:00-19:00` | 盘后产数 | 正式生产批处理 | `Production Core` / `Production Content` / `production_validation` / 轻量 `Ops Governance` |
| `19:00-06:00` | 夜间治理 | 研究、治理、补跑 | `Research` / `Ops Governance` / `Maintenance` |

### 2.1 总原则

1. 同一时间段应尽量只服务一个主目标，避免生产、研究、运营、维护互相抢关键路径
2. 高时效任务优先由外部精确定时触发，避免依赖 GitHub cron 漂移
3. 面向用户的正式产数优先，研究、治理、维护应让路给生产关键路径
4. 长任务与内容任务分离，避免单 job 里串行堆叠
5. 时间规划先定义“做什么”，workflow 只是实现方式

### 2.2 一天四个主时段

#### A. 盘前准备段：06:00-09:00

目标：

1. 完成盘前需要给用户消费的内容刷新
2. 准备晨间通知和 ritual
3. 不做大规模重计算

允许的任务类型：

1. `Production Content`
2. 轻量 `Ops Governance`
3. 必要的 `Maintenance`

典型任务：

1. `daily_morning_call.yml`
2. 盘前黄历刷新
3. 轻量健康检查

不建议：

1. 大批量 AI 分析
2. 大规模 backfill
3. 研究链重计算

#### B. 盘中服务段：09:00-16:30

目标：

1. 稳定服务前端实时能力
2. 优先保证数据新鲜度和触达时效
3. 控制后台负载，避免影响实时同步

允许的任务类型：

1. `Production Core`
2. 严格受控的 `Production Content`
3. 最小化 `Ops Governance`

典型任务：

1. `data_sync_realtime.yml`
2. 单票补数与线上排障

不建议：

1. 与实时同步争抢资源的重型批处理
2. 大批量研究实验
3. 会放大外部 API 压力的内容重算

#### C. 盘后产数段：16:00-19:00

目标：

1. 先完成正式生产链产数
2. 再并行完成内容链与验证链
3. 这是一天中最重要的正式批处理窗口

允许的任务类型：

1. `Production Core`
2. `Production Content`
3. `production_validation`
4. 轻量 `Ops Governance`

典型任务：

1. `data_sync_cn.yml` / `data_sync_hk.yml`
2. `verify_predictions.yml`
3. `ai_analyze_cn.yml` / `ai_analyze_hk.yml`
4. `daily_almanac_cn.yml`
5. `daily_brief_push.yml`

规则：

1. 先同步，再验证/分析/内容分叉
2. 面向用户的正式产数优先于研究链
3. 内容任务不应阻塞分析主链

#### D. 夜间治理段：19:00-06:00

目标：

1. 消化研究、治理、补跑、低频维护
2. 不影响盘前和盘中关键时段
3. 为第二天提供治理结论和修复空间

允许的任务类型：

1. `Research`
2. `Ops Governance`
3. `Maintenance`

典型任务：

1. `tradeability_postclose_pipeline.yml`
2. weekly calibration / experiment / promotion
3. `acceptance_weekly.yml`
4. `almanac_maintenance.yml`
5. `ai_backfill.yml`

不建议：

1. 把夜间研究任务挂到生产关键路径上
2. 让补跑任务与次日盘前内容链抢资源

### 2.3 时间优先级

如果不同类型任务发生冲突，统一按这个优先级让路：

1. `Production Core`
2. `Production Content`
3. `production_validation`
4. `Ops Governance`
5. `Research`
6. `Maintenance`

解释：

1. 先保证前端可用和正式产数
2. 再保证用户消费内容
3. 再做验证、治理、研究和补跑

### 2.4 这份总纲的用途

后面每一个 workflow 在设计时，都应先回答：

1. 它属于一天中的哪个主时段
2. 它是否抢占了不该抢占的关键窗口
3. 它是否应该让位于更高优先级任务
4. 它失败后是否应该阻塞该时段的主目标

只有先回答这些问题，才进入具体的 cron、依赖和 timeout 设计。

## 3. 四类任务语义

当前后台任务不再建议简单区分为“生产 / 非生产”。

更合理的一级语义应为：

1. `Production`
2. `Research`
3. `Ops Governance`
4. `Maintenance`

定义如下。

### 3.1 Production

定义：

1. 直接产出用户会消费、依赖、看到、收到的数据或动作

判定标准：

1. 是否形成正式产品口径数据
2. 是否直接驱动前端功能
3. 是否直接触发用户通知、广播或内容分发

典型任务：

1. 行情同步
2. 实时价格同步
3. AI 分析
4. 预测验证状态回写
5. Investment Mode 产数
6. 黄历 / brief / morning call 生产与分发

### 3.2 Research

定义：

1. 用于策略实验、版本比较、参数优化、sidecar 并行观察
2. 不直接作为用户正式口径

典型任务：

1. sample sync
2. sidecar daily
3. weekly calibration
4. strategy experiment
5. promotion verdict

### 3.3 Ops Governance

定义：

1. 保证系统调度、质量、稳定性、可观测、可审计
2. 通常不直接形成用户业务价值产物

典型任务：

1. trading day gate
2. daily validation check
3. acceptance weekly
4. layer1 consistency
5. market facts health check

### 3.4 Maintenance

定义：

1. 低频维护、手工修复、后台操作、补跑和管理类任务

典型任务：

1. meta sync
2. user maintenance
3. admin codes
4. backfill
5. 历史 almanac maintenance

## 4. 四条主链路
虽然一级语义改为四类，但在运行编排上，仍然可以抽象为四条主链路：

1. 生产决策链
2. 研究量化链
3. 市场内容运营链
4. 验证与治理链

其中：

1. 生产决策链 + 市场内容运营链 都属于 `Production`
2. 研究量化链属于 `Research`
3. 验证与治理链大部分属于 `Ops Governance`

### 3.1 生产决策链

目标：

1. 生成正式产品可读的行情、预测与 Investment Mode 数据

输入：

1. `daily_prices`
2. `ai_predictions_v2`

输出：

1. 前端实时/按需可用的行情数据
1. `ai_predictions_v2`
2. `mode_decision_log`
3. `mode_simulated_trade_ledger`
4. `mode_performance_snapshot`

核心 workflow / 程序：

1. `data_sync_cn.yml`
2. `data_sync_hk.yml`
3. `data_sync_realtime.yml`
4. `data_sync_single.yml`
5. `daily_pipeline_cn.yml`
6. `daily_pipeline_hk.yml`
7. `ai_analyze_cn.yml`
8. `ai_analyze_hk.yml`
9. `backend/main.py --analyze`
10. `run_mode_pipeline()`

说明：

1. 这条链是正式产品口径
2. `mode_pipeline` 属于生产链，不属于研究 sidecar
3. `data_sync_realtime.yml` 与 `data_sync_single.yml` 虽然不在盘后批处理主路径上，但属于前台生产能力，不应遗漏

### 3.2 研究量化链

目标：

1. 做 Layer-1 / tradeability 版本并行观测、参数校准、实验和 promotion 判定

输入：

1. `daily_prices`

输出：

1. `quant_tradeability_signals`
2. calibration artifacts
3. experiment artifacts
4. promotion verdict artifacts

核心 workflow / 程序：

1. `tradeability_postclose_pipeline.yml`
2. `tradeability_sample_sync_daily.yml`
3. `tradeability_sidecar_daily.yml`
4. `tradeability_sidecar_weekly_calibration.yml`
5. `tradeability_experiment_weekly.yml`
6. `tradeability_promotion_gate.yml`

说明：

1. 这条链是研究和治理口径，不直接作为前台正式数据源
2. 可以并行保留 `tradeability_v1` / `tradeability_v2` / future versions

### 3.3 市场内容运营链

目标：

1. 生成并分发黄历、morning call、brief 等内容型产物

输入：

1. `daily_prices`
2. `market_facts_daily`
3. 必要时使用隔夜全球市场上下文

输出：

1. `market_almanac` 类产物
2. brief 数据
3. push / broadcast 行为

核心 workflow / 程序：

1. `backend/engine/almanac_generator.py`
2. `almanac_maintenance.yml`
3. `daily_morning_call.yml`
4. `daily_brief_push.yml`
5. `backend/scripts/broadcast_almanac.py`

说明：

1. 这条链不应挂在个股 AI 分析主链后面
2. 内容链可依赖同步结果，但不应依赖整批 AI 分析全部结束

### 3.4 验证与治理链

目标：

1. 校验生产数据质量、模型结果与运营健康度

输入：

1. 生产链和研究链输出

输出：

1. validation 状态
2. health check 结果
3. acceptance / observability / promotion gate 结论

核心 workflow / 程序：

1. `verify_predictions.yml`
2. `daily_validation_check.yml`
3. `acceptance_weekly.yml`
4. `layer1_consistency_daily.yml`
5. `backend/scripts/market_facts_healthcheck.py`

说明：

1. 这条链通常应为非阻塞或弱阻塞
2. 除非发现严重生产风险，否则不应拖住核心产数

## 5. 任务分类字段

后续所有 workflow 应至少能回答这 10 个字段：

1. `Stage`
2. `Type`
3. `Trigger Source`
4. `Depends On`
5. `Blocking Level`
6. `Primary Output`
7. `SLA`
8. `Notification Audience`
9. `Notification Channel`
10. `Notify on Fail`

推荐口径如下。

### 5.1 Stage

1. `Post-Close`
2. `Pre-Market`
3. `Intraday`
4. `Maintenance`
5. `Weekly Governance`
6. `Manual / Backfill`

### 5.2 Type

1. `ingestion`
2. `analysis`
3. `market_content`
4. `validation`
5. `distribution`
6. `research`
7. `promotion_governance`

### 5.3 Blocking Level

1. `hard_blocking`
   失败则下游主流程不应继续
2. `soft_blocking`
   失败会影响局部链路，但不拖住其他链
3. `best_effort`
   失败报警，不阻塞主产线
4. `manual_only`
   仅手工触发

### 5.4 Trigger Source

1. `GitHub Schedule`
   由 GitHub cron 直接触发
2. `Cloudflare Worker`
   由外部 Worker 按严格时间节奏调用 GitHub Actions
3. `Workflow Call`
   由其他 workflow 作为子流程调用
4. `Manual / API Dispatch`
   由人工或外部 API 通过 `workflow_dispatch` 触发

说明：

1. 对时效要求严格的任务，应显式标记 trigger source
2. 当前已明确由 Cloudflare Worker 驱动的生产任务有：
   - `data_sync_realtime.yml`
   - `daily_morning_call.yml`

### 5.5 Notification Audience

1. `User`
   - 面向终端用户的正式价值交付，例如 push / broadcast
2. `ADMIN`
   - 面向运维/管理侧的内部告警、巡检摘要、研究结论同步
3. `User + ADMIN`
   - 既有用户触达，也要求内部可观测与失败告警
4. `None`
   - 当前不应主动发通知，但必须在文档中明确这是“有意为之”而不是遗漏

### 5.6 Notification Channel

1. `Push`
   - Web Push / 内部通知 API，直接触达用户
2. `WeCom`
   - 企业微信机器人，触达 ADMIN
3. `Artifact / Task Log`
   - 仅产出 artifact、任务日志、落库记录，不算主动通知
4. `Mixed`
   - 同时存在 `Push` 与 `WeCom`

### 5.7 Notify on Fail

1. `required`
   - 失败必须触发 ADMIN 告警，不能静默
2. `best_effort`
   - 失败应告警，但允许由父 workflow 或外围守卫承接
3. `none`
   - 当前不发失败通知；仅适用于明确的手工/实验任务

## 6. 当前真实编排地图

### 6.1 Production

Production 内部分为两组：

1. `Production Core`
   - 正式行情、分析、验证、Investment Mode
2. `Production Content`
   - 黄历、brief、morning call、broadcast

#### 6.1.1 Production Core

| Job / Workflow | Stage | Type | Trigger Source | Depends On | Blocking | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `meta_sync.yml` | Maintenance | ingestion | GitHub Schedule / Manual | 无 | best_effort | 元数据维护 |
| `data_sync_cn.yml` | Post-Close | ingestion | Workflow Call / Manual | `trading_day_gate(CN)` | hard_blocking | A 股正式同步 |
| `data_sync_hk.yml` | Post-Close | ingestion | Workflow Call / Manual | `trading_day_gate(HK)` | hard_blocking | 港股正式同步 |
| `data_sync_realtime.yml` | Intraday | ingestion | Cloudflare Worker / Manual | Worker / API 节拍 | soft_blocking | 前端实时行情能力，属于生产链 |
| `data_sync_single.yml` | Manual / Backfill | ingestion | Manual / API Dispatch | 手工触发 | manual_only | 默认只做前端最小可展示补数；周期补数为可选扩展 |
| `verify_predictions.yml` | Post-Close | production_validation | Workflow Call / Manual | `data_sync_*` | soft_blocking | 用户可见验证结果，属于生产口径 |
| `ai_analyze_cn.yml` | Post-Close | analysis | Workflow Call / Manual | `data_sync_cn` | soft_blocking | 纯分析 workflow；内部仍会触发 `mode_pipeline` |
| `ai_analyze_hk.yml` | Post-Close | analysis | Workflow Call / Manual | `data_sync_hk` | soft_blocking | 纯分析 workflow；与 CN 保持相同边界 |
| `mode_pipeline` | Post-Close | analysis | Internal Program Call | `ai_analyze_*` 内部触发 | soft_blocking | 正式 Investment Mode 产数 |

#### 6.1.2 Production Content

| Job / Workflow | Stage | Type | Trigger Source | Depends On | Blocking | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `almanac_generator.py` | Post-Close / Pre-Market | market_content | Workflow / Program Entry | `data_sync_cn` 或已有事实表 | best_effort | T+1 黄历生产 |
| `daily_morning_call.yml` | Pre-Market | distribution | Cloudflare Worker / Manual | 最新黄历 / overnight 数据 | best_effort | 盘前 ritual |
| `daily_brief_push.yml` | Post-Close | distribution | GitHub Schedule / Manual | brief source 数据 | best_effort | 简报推送 |
| `broadcast_almanac.py` | Post-Close / Pre-Market | distribution | Workflow / Program Entry | 已生成黄历 | best_effort | 只负责广播，不应重算 |

### 6.2 Research

| Job / Workflow | Stage | Type | Trigger Source | Depends On | Blocking | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `tradeability_postclose_pipeline.yml` | Post-Close | research | GitHub Schedule / Manual | `trading_day_gate` | soft_blocking | 研究链总编排 |
| `tradeability_sample_sync_daily.yml` | Post-Close | ingestion | Workflow Call / Manual | `tradeability_postclose_pipeline` | soft_blocking | 补量扩样 |
| `tradeability_sidecar_daily.yml` | Post-Close | research | Workflow Call / Manual | `sample_sync` | soft_blocking | sidecar 写 `quant_tradeability_signals` |
| `tradeability_sidecar_weekly_calibration.yml` | Weekly Governance | research | GitHub Schedule / Manual | 历史样本/sidecar | best_effort | 周度参数校准 |
| `tradeability_experiment_weekly.yml` | Weekly Governance | research | GitHub Schedule / Manual | 历史样本/sidecar | best_effort | 周度实验 artifact |
| `tradeability_promotion_gate.yml` | Weekly Governance | promotion_governance | GitHub Schedule / Manual | calibration + experiment | best_effort | 研究结果是否可晋级生产参数 |

### 6.3 Ops Governance

| Job / Workflow | Stage | Type | Trigger Source | Depends On | Blocking | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `trading_day_gate.yml` | Maintenance | ops_validation | Workflow Call | schedule entrypoint | soft_blocking | 调度闸门 |
| `daily_validation_check.yml` | Post-Close | ops_validation | GitHub Schedule / Manual | 生产链结果 | best_effort | 每日生产巡检 |
| `acceptance_weekly.yml` | Weekly Governance | ops_validation | GitHub Schedule / Manual | 生产 / 研究 artifact | best_effort | 周度验收 |
| `layer1_consistency_daily.yml` | Maintenance | ops_validation | GitHub Schedule / Manual | sidecar / ai_predictions | best_effort | Layer-1 一致性 |
| `market_facts_healthcheck.py` | Post-Close / Manual | ops_validation | Workflow / Program Entry | 黄历事实层 | best_effort | 不应拖住分析主链 |

### 6.4 Maintenance

| Job / Workflow | Stage | Type | Trigger Source | Depends On | Blocking | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `meta_sync.yml` | Maintenance | ingestion | GitHub Schedule / Manual | 无 | best_effort | 元数据维护 |
| `user_maintenance.yml` | Maintenance | maintenance | GitHub Schedule / Manual | 无 | best_effort | 用户清理 |
| `admin_codes.yml` | Maintenance | maintenance | Manual / API Dispatch | 无 | manual_only | 邀请码管理 |
| `ai_backfill.yml` | Manual / Backfill | maintenance | Manual / API Dispatch | 手工触发 | manual_only | 历史分析补跑 |
| `almanac_maintenance.yml` | Manual / Backfill | maintenance | Manual / API Dispatch | 手工触发 | manual_only | 历史黄历补跑 |

### 6.5 当前任务通知矩阵（逐项核对版）

下表基于当前 `.github/workflows/` 与实际脚本实现核对，目标不是描述“理想状态”，而是记录 2026-03-09 这一天仓库里的真实通知行为。

| Job / Workflow | Audience | Channel | 当前状态 | 检查结论 / 缺口 |
| --- | --- | --- | --- | --- |
| `meta_sync.yml` | `ADMIN` | `WeCom` | 已实现 | `backend/main.py --sync-meta` 走 `JobGuard`，成功/失败都会发内部通知 |
| `data_sync_cn.yml` | `ADMIN` | `WeCom` | 已实现 | 盘后正式同步，失败不应静默 |
| `data_sync_hk.yml` | `ADMIN` | `WeCom` | 已实现 | 含 HK short sync，内部告警链已接入 |
| `data_sync_realtime.yml` | `User + ADMIN` | `Mixed` | 已实现 | 盘中价格波动会走 `price_update` push；作业本身走 `JobGuard` 发 ADMIN 告警 |
| `data_sync_single.yml` | `ADMIN` | `WeCom` | 已实现 | 手工补数不直接通知用户，只向运维侧暴露执行结果 |
| `verify_predictions.yml` | `User + ADMIN` | `Push + WeCom` | 已实现 | 用户侧验证结果/战报与 ADMIN 成功/失败告警都已接入，workflow 已注入 `WECOM_ROBOT_KEY` 与 `ADMIN_MOBILES` |
| `ai_analyze_cn.yml` | `User + ADMIN` | `Mixed` | 已实现 | 用户会收到 `prediction_updated` / `signal_flip`，作业本身会发 ADMIN 通知 |
| `ai_analyze_hk.yml` | `User + ADMIN` | `Mixed` | 已实现 | 与 CN 同口径 |
| `mode_pipeline` | `ADMIN` | `WeCom` | 已实现 | 目前通过 `--analyze` 内部耦合承接；无独立用户通知职责 |
| `daily_almanac_cn.yml` | `User + ADMIN` | `Mixed` | 已实现 | 预览广播触达用户；生成降级与 `market_facts_healthcheck` 触达 ADMIN |
| `daily_morning_call.yml` | `User + ADMIN` | `Mixed` | 已实现 | morning call push + ritual broadcast 面向用户；脚本成功/失败会发 WeCom |
| `daily_brief_push.yml` | `User + ADMIN` | `Mixed` | 已收口 | 正式口径已切到 `brief_generator` 逐用户即时推送；旧版批量广播仅在 `send_legacy_batch_push=true` 时作为人工补发使用 |
| `broadcast_almanac.py` | `User` | `Push` | 已实现 | 作为分发器使用时职责清晰，不应再承担重算或内部告警职责 |
| `tradeability_postclose_pipeline.yml` | `ADMIN` | `WeCom` | 已实现 | 顶层 `notify-summary` job 会汇总 CN/HK 样本同步与 sidecar 结果，成功/失败都向 ADMIN 发中文摘要，失败带重试入口 |
| `tradeability_sample_sync_daily.yml` | `ADMIN` | `WeCom` | 已实现 | 顶层 `notify-summary` job 会汇总 CN/HK 样本同步结果，成功/失败都向 ADMIN 发中文摘要 |
| `tradeability_sidecar_daily.yml` | `ADMIN` | `WeCom` | 已实现 | 顶层 `notify-summary` job 会汇总 CN/HK sidecar 结果，失败时带重试入口 |
| `tradeability_sidecar_weekly_calibration.yml` | `ADMIN` | `WeCom` | 已实现 | 周校准完成后会向 ADMIN 同步 CN/HK 分支状态，不再只依赖 artifact |
| `tradeability_experiment_weekly.yml` | `ADMIN` | `WeCom` | 已实现 | 周实验 job 结束后统一向 ADMIN 发送成功/失败摘要 |
| `tradeability_promotion_gate.yml` | `ADMIN` | `WeCom` | 已实现 | 已有 `notify` 开关，适合作为研究链周度结论出口 |
| `trading_day_gate.yml` | `None` | `Artifact / Task Log` | 合理 | 闸门本身不单独通知；由父 workflow 记录是否跳过即可 |
| `daily_validation_check.yml` | `User + ADMIN` | `Mixed` | 已实现 | 用户战报 + ADMIN 成功/失败通知都已接入 |
| `acceptance_weekly.yml` | `ADMIN` | `WeCom` | 已实现 | 已有 `notify` 参数，周验收应持续保留内部摘要 |
| `layer1_consistency_daily.yml` | `ADMIN` | `WeCom` | 已实现 | 已有 `notify` 参数，适合作为日级治理告警 |
| `market_facts_healthcheck.py` | `ADMIN` | `WeCom` | 已实现 | 已作为内容链质量闸门接入内部告警 |
| `user_maintenance.yml` | `ADMIN` | `WeCom` | 已实现 | 清理结果与失败都会发内部通知 |
| `admin_codes.yml` | `ADMIN` | `WeCom` | 已实现 | 手工邀请码管理结束后会向 ADMIN 发送最小结果摘要，失败时带重试入口 |
| `ai_backfill.yml` | `ADMIN` | `WeCom` | 已实现 | 手工补跑应通知内部，不通知用户 |
| `almanac_maintenance.yml` | `ADMIN` | `WeCom` | 已实现 | 主生成链结束后统一向 ADMIN 发送中文摘要；健康检查与主任务失败都不会再静默 |

### 6.6 通知编排结论

逐项核对后，当前系统的通知职责可以收敛为四条规则：

1. `Production Core` 里凡是直接改动用户可见数据的任务，都至少要有 `ADMIN` 失败告警；如果还会触发用户体验变化，则再叠加 `User` 通知
2. `Production Content` 天然属于 `User + ADMIN` 双通知任务，因为它既是内容交付，也需要内部确认是否送达
3. `Research` 与 `Ops Governance` 默认不通知用户，但不代表可以静默；应至少把周报、promotion、失败告警发给 `ADMIN`
4. `Manual / Backfill` 不默认通知用户，但必须把是否执行成功明确告诉触发者或 `ADMIN`

### 6.7 当前优先补齐项

基于现状，通知治理优先级建议如下：

1. `P2`：如果后续需要更高可观测性，可把 `tradeability_*` 的单个脚本运行指标（如处理 symbol 数、artifact 名称）继续下沉到作业级摘要
2. `P2`：继续把同样的 workflow 级中文摘要模式推广到其他手工治理链，保持运维口径一致

## 7. 当前边界状态

### 7.1 `ai_analyze_cn.yml` 越界问题已修复

当前状态：

1. `ai_analyze_cn.yml` 已恢复为纯分析 workflow
2. `daily_almanac_cn.yml` 已独立承载：
   - 黄历生成
   - market facts health check
   - preview broadcast
3. `daily_pipeline_cn.yml` 已改为：
   - `sync -> verify`
   - `sync -> analyze`
   - `sync -> almanac`

这意味着：

1. 分析不会再阻塞黄历
2. 黄历失败不会再污染分析任务成功率
3. workflow 名称与实际职责重新一致

### 7.2 `--analyze` 内部再带 `mode_pipeline`

当前 `backend/main.py --analyze` 默认自动触发 `mode_pipeline`。

结论：

1. 这件事不是错误
2. 但需要在文档中明确：它属于生产链内部耦合，不等同于把运营链也带进去

### 7.3 研究链和生产链目前是并行存在的

这是合理的，不应合并：

1. 生产链回答“今天正式给用户什么”
2. 研究链回答“哪个版本更好、是否值得升级”

## 8. 推荐的时间编排口径

### 8.1 每日 Production

| 北京时间 | 类别 | 任务 | 说明 |
| --- | --- | --- | --- |
| 06:00 | Maintenance | `meta_sync.yml` | 元数据维护 |
| 09:30-15:00 | Production Core | `data_sync_realtime.yml` (CN) | 由 Cloudflare Worker 精确触发，直接服务前端 |
| 09:30-16:00 | Production Core | `data_sync_realtime.yml` (HK) | 由 Cloudflare Worker 精确触发，直接服务前端 |
| 16:00 | Production Core | `data_sync_cn.yml` | A 股盘后正式同步 |
| 16:10 | Production Core | `verify_predictions.yml` | 历史验证，更新用户可见验证结果 |
| 16:10 | Production Core | `ai_analyze_cn.yml` | 只做分析与 mode pipeline |
| 16:12 | Production Content | `daily_almanac_cn` | 只做 T+1 黄历，依赖同步，不依赖整批分析 |
| 16:30 | Production Core | `data_sync_hk.yml` / `ai_analyze_hk.yml` | 港股盘后正式链 |
| 17:30 | Ops Governance / Production Content | `daily_validation_check.yml` / `daily_brief_push.yml` | 巡检与摘要 |
| 08:30 | Production Content | `daily_morning_call.yml` | 由 Cloudflare Worker 精确触发，盘前基于隔夜信息刷新并广播 |

### 8.2 每日 Research

| 北京时间 | 类别 | 任务 | 说明 |
| --- | --- | --- | --- |
| 19:05 | Research | `tradeability_postclose_pipeline.yml` (CN) | 进入夜间治理段后再跑研究链，避免与盘后正式产数重叠 |
| 19:35 | Research | `tradeability_postclose_pipeline.yml` (HK) | 港股研究链，保持在 19:00 后运行 |

### 8.3 按需操作

| 触发方式 | 类别 | 任务 | 说明 |
| --- | --- | --- | --- |
| 手工 / API / 运维 | Production Core | `data_sync_single.yml` | 新增股票后快速补齐前端可展示数据；必要时补周期数据 |
| 手工 / API / 运维 | Maintenance | `ai_backfill.yml` | 历史分析补跑 |
| 手工 / API / 运维 | Maintenance | `almanac_maintenance.yml` | 黄历历史补跑 |

### 8.3.1 `data_sync_single.yml` 方案口径

`data_sync_single.yml` 的定位应明确为：

1. 面向前端体验的单票即时补数，不是完整盘后生产链的缩小版
2. 触发场景主要是用户新增一只系统尚未覆盖的股票后，页面需要尽快有可展示数据
3. 成功标准应优先围绕“前端可用”而不是“所有周期都齐全”

推荐口径：

1. 默认模式只补 `core`
   - 目标：尽快补齐前端最小可展示数据
   - 范围：`daily` + 可选 `realtime`
2. `weekly` / `monthly` 不应阻塞默认链路
   - 作为可选扩展补数
   - 或由盘后正式链继续补齐
3. 盘后正式链负责持续接管
   - 前提是该股票已进入 `global_stock_pool` 且 `watchers_count > 0`
   - 后续由正式同步、分析、预测链继续补齐
4. `data_sync_single.yml` 与盘后正式链分工不同
   - 前者解决“刚新增后立刻可看”
   - 后者解决“日终完整产数与持续覆盖”
5. 周/月数据策略应以稳定性优先
   - 推荐以 `daily` 为主源
   - `weekly` / `monthly` 优先由本地聚合生成
   - 远端原生周/月接口仅作为可选优化，不作为默认成功依赖

当前生产口径补充：

1. `daily_prices` 是周期链的 canonical source
2. `weekly_prices` / `monthly_prices` 以 `daily_prices` 聚合为主路径
3. 原生周/月接口可保留为对账或观察工具，但不再作为生产主依赖

### 8.4 每周 Research / Ops Governance

| 北京时间 | 类别 | 任务 | 说明 |
| --- | --- | --- | --- |
| 周日 10:00 | Research | `tradeability_sidecar_weekly_calibration.yml` | 周校准 |
| 周日 10:30 | Research | `tradeability_experiment_weekly.yml` | 周实验 |
| 周日 10:50 | Research | `tradeability_promotion_gate.yml` | 周 promotion verdict |
| 周日 10:10 | Ops Governance | `acceptance_weekly.yml` | 周验收快照 |

## 9. 第一优先级拆分建议

第一阶段边界清理已经完成：

1. `ai_analyze_cn.yml` 已恢复为纯分析 workflow
2. 已新增独立的 `daily_almanac_cn.yml`
3. `daily_pipeline_cn.yml` 已改为：
   - `sync -> verify`
   - `sync -> analyze`
   - `sync -> almanac`
4. `market_facts_healthcheck` 已放入 `daily_almanac_cn.yml`
5. `broadcast_almanac preview` 已放入 `daily_almanac_cn.yml`

本阶段收益已经兑现：

1. 分析不会再拖住黄历
2. 黄历失败不会污染分析任务成功率
3. workflow 名称和职责重新一致

### 9.1 当前执行约束

为兼容 GitHub Actions Free 与 Turso 现状，当前执行约束是：

1. 长任务和内容任务分开，避免单 job 串行拖长关键路径
2. 对高时效任务显式标记 `Cloudflare Worker` 触发源
3. 对内容分发和健康检查优先使用 `best_effort` 或 step 级软失败
4. 对盘后主产线保留有限并行，不主动放大到高并发 fan-out
5. 对可能卡死的 AkShare 调用使用可重置 timeout 隔离

## 10. 后续治理建议

1. 所有 workflow 文档都补上 `Stage / Type / Trigger Source / Depends On / Blocking / Notification`
2. 生产链与研究链分别维护独立总表
3. `README.md` 从“文件列表说明”升级为“链路拓扑说明”
4. 对超时敏感的内容链任务，统一标注 `best_effort`
5. 研究链默认不得阻塞生产链
6. 所有面向生产的 workflow 都必须明确回答：
   - 是否通知 `User`
   - 是否通知 `ADMIN`
   - 失败时谁来兜底通知
7. 不允许同一业务事件长期并存两条正式通知链，避免重复推送与口径分叉
