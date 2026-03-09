# 18 Backend Workflow Orchestration Map

更新时间：2026-03-09

## 1. 目标

为当前 StockWise 后台任务建立统一编排口径，解决以下问题：

1. 生产链路、研究链路、运营链路、验证链路混称
2. 单个 workflow 承担多种职责，出现互相阻塞
3. 时间表只写 cron，不写依赖、阻塞级别和失败策略

本文档作为后续 workflow 拆分与调度治理的统一依据。

## 2. 四类任务语义

当前后台任务不再建议简单区分为“生产 / 非生产”。

更合理的一级语义应为：

1. `Production`
2. `Research`
3. `Ops Governance`
4. `Maintenance`

定义如下。

### 2.1 Production

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

### 2.2 Research

定义：

1. 用于策略实验、版本比较、参数优化、sidecar 并行观察
2. 不直接作为用户正式口径

典型任务：

1. sample sync
2. sidecar daily
3. weekly calibration
4. strategy experiment
5. promotion verdict

### 2.3 Ops Governance

定义：

1. 保证系统调度、质量、稳定性、可观测、可审计
2. 通常不直接形成用户业务价值产物

典型任务：

1. trading day gate
2. daily validation check
3. acceptance weekly
4. layer1 consistency
5. market facts health check

### 2.4 Maintenance

定义：

1. 低频维护、手工修复、后台操作、补跑和管理类任务

典型任务：

1. meta sync
2. user maintenance
3. admin codes
4. backfill
5. 历史 almanac maintenance

## 3. 四条主链路
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

## 4. 任务分类字段

后续所有 workflow 应至少能回答这 7 个字段：

1. `Stage`
2. `Type`
3. `Trigger Source`
4. `Depends On`
5. `Blocking Level`
6. `Primary Output`
7. `SLA`

推荐口径如下。

### 4.1 Stage

1. `Post-Close`
2. `Pre-Market`
3. `Intraday`
4. `Maintenance`
5. `Weekly Governance`
6. `Manual / Backfill`

### 4.2 Type

1. `ingestion`
2. `analysis`
3. `market_content`
4. `validation`
5. `distribution`
6. `research`
7. `promotion_governance`

### 4.3 Blocking Level

1. `hard_blocking`
   失败则下游主流程不应继续
2. `soft_blocking`
   失败会影响局部链路，但不拖住其他链
3. `best_effort`
   失败报警，不阻塞主产线
4. `manual_only`
   仅手工触发

### 4.4 Trigger Source

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

## 5. 当前真实编排地图

### 5.1 Production

Production 内部分为两组：

1. `Production Core`
   - 正式行情、分析、验证、Investment Mode
2. `Production Content`
   - 黄历、brief、morning call、broadcast

#### 5.1.1 Production Core

| Job / Workflow | Stage | Type | Trigger Source | Depends On | Blocking | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `meta_sync.yml` | Maintenance | ingestion | GitHub Schedule / Manual | 无 | best_effort | 元数据维护 |
| `data_sync_cn.yml` | Post-Close | ingestion | Workflow Call / Manual | `trading_day_gate(CN)` | hard_blocking | A 股正式同步 |
| `data_sync_hk.yml` | Post-Close | ingestion | Workflow Call / Manual | `trading_day_gate(HK)` | hard_blocking | 港股正式同步 |
| `data_sync_realtime.yml` | Intraday | ingestion | Cloudflare Worker / Manual | Worker / API 节拍 | soft_blocking | 前端实时行情能力，属于生产链 |
| `data_sync_single.yml` | Manual / Backfill | ingestion | Manual / API Dispatch | 手工触发 | manual_only | 单票补数、运营修复、前台问题排查 |
| `verify_predictions.yml` | Post-Close | production_validation | Workflow Call / Manual | `data_sync_*` | soft_blocking | 用户可见验证结果，属于生产口径 |
| `ai_analyze_cn.yml` | Post-Close | analysis | Workflow Call / Manual | `data_sync_cn` | soft_blocking | 纯分析 workflow；内部仍会触发 `mode_pipeline` |
| `ai_analyze_hk.yml` | Post-Close | analysis | Workflow Call / Manual | `data_sync_hk` | soft_blocking | 纯分析 workflow；与 CN 保持相同边界 |
| `mode_pipeline` | Post-Close | analysis | Internal Program Call | `ai_analyze_*` 内部触发 | soft_blocking | 正式 Investment Mode 产数 |

#### 5.1.2 Production Content

| Job / Workflow | Stage | Type | Trigger Source | Depends On | Blocking | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `almanac_generator.py` | Post-Close / Pre-Market | market_content | Workflow / Program Entry | `data_sync_cn` 或已有事实表 | best_effort | T+1 黄历生产 |
| `daily_morning_call.yml` | Pre-Market | distribution | Cloudflare Worker / Manual | 最新黄历 / overnight 数据 | best_effort | 盘前 ritual |
| `daily_brief_push.yml` | Post-Close | distribution | GitHub Schedule / Manual | brief source 数据 | best_effort | 简报推送 |
| `broadcast_almanac.py` | Post-Close / Pre-Market | distribution | Workflow / Program Entry | 已生成黄历 | best_effort | 只负责广播，不应重算 |

### 5.2 Research

| Job / Workflow | Stage | Type | Trigger Source | Depends On | Blocking | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `tradeability_postclose_pipeline.yml` | Post-Close | research | GitHub Schedule / Manual | `trading_day_gate` | soft_blocking | 研究链总编排 |
| `tradeability_sample_sync_daily.yml` | Post-Close | ingestion | Workflow Call / Manual | `tradeability_postclose_pipeline` | soft_blocking | 补量扩样 |
| `tradeability_sidecar_daily.yml` | Post-Close | research | Workflow Call / Manual | `sample_sync` | soft_blocking | sidecar 写 `quant_tradeability_signals` |
| `tradeability_sidecar_weekly_calibration.yml` | Weekly Governance | research | GitHub Schedule / Manual | 历史样本/sidecar | best_effort | 周度参数校准 |
| `tradeability_experiment_weekly.yml` | Weekly Governance | research | GitHub Schedule / Manual | 历史样本/sidecar | best_effort | 周度实验 artifact |
| `tradeability_promotion_gate.yml` | Weekly Governance | promotion_governance | GitHub Schedule / Manual | calibration + experiment | best_effort | 研究结果是否可晋级生产参数 |

### 5.3 Ops Governance

| Job / Workflow | Stage | Type | Trigger Source | Depends On | Blocking | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `trading_day_gate.yml` | Maintenance | ops_validation | Workflow Call | schedule entrypoint | soft_blocking | 调度闸门 |
| `daily_validation_check.yml` | Post-Close | ops_validation | GitHub Schedule / Manual | 生产链结果 | best_effort | 每日生产巡检 |
| `acceptance_weekly.yml` | Weekly Governance | ops_validation | GitHub Schedule / Manual | 生产 / 研究 artifact | best_effort | 周度验收 |
| `layer1_consistency_daily.yml` | Maintenance | ops_validation | GitHub Schedule / Manual | sidecar / ai_predictions | best_effort | Layer-1 一致性 |
| `market_facts_healthcheck.py` | Post-Close / Manual | ops_validation | Workflow / Program Entry | 黄历事实层 | best_effort | 不应拖住分析主链 |

### 5.4 Maintenance

| Job / Workflow | Stage | Type | Trigger Source | Depends On | Blocking | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `meta_sync.yml` | Maintenance | ingestion | GitHub Schedule / Manual | 无 | best_effort | 元数据维护 |
| `user_maintenance.yml` | Maintenance | maintenance | GitHub Schedule / Manual | 无 | best_effort | 用户清理 |
| `admin_codes.yml` | Maintenance | maintenance | Manual / API Dispatch | 无 | manual_only | 邀请码管理 |
| `ai_backfill.yml` | Manual / Backfill | maintenance | Manual / API Dispatch | 手工触发 | manual_only | 历史分析补跑 |
| `almanac_maintenance.yml` | Manual / Backfill | maintenance | Manual / API Dispatch | 手工触发 | manual_only | 历史黄历补跑 |

## 6. 当前边界状态

### 6.1 `ai_analyze_cn.yml` 越界问题已修复

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

### 6.2 `--analyze` 内部再带 `mode_pipeline`

当前 `backend/main.py --analyze` 默认自动触发 `mode_pipeline`。

结论：

1. 这件事不是错误
2. 但需要在文档中明确：它属于生产链内部耦合，不等同于把运营链也带进去

### 6.3 研究链和生产链目前是并行存在的

这是合理的，不应合并：

1. 生产链回答“今天正式给用户什么”
2. 研究链回答“哪个版本更好、是否值得升级”

## 7. 推荐的时间编排口径

### 7.1 每日 Production

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

### 7.2 每日 Research

| 北京时间 | 类别 | 任务 | 说明 |
| --- | --- | --- | --- |
| 18:05 | Research | `tradeability_postclose_pipeline.yml` (CN) | 正式盘后链结束后再跑研究链 |
| 18:35 | Research | `tradeability_postclose_pipeline.yml` (HK) | 港股研究链 |

### 7.3 按需操作

| 触发方式 | 类别 | 任务 | 说明 |
| --- | --- | --- | --- |
| 手工 / API / 运维 | Production Core | `data_sync_single.yml` | 单票补数、排障、手工修复 |
| 手工 / API / 运维 | Maintenance | `ai_backfill.yml` | 历史分析补跑 |
| 手工 / API / 运维 | Maintenance | `almanac_maintenance.yml` | 黄历历史补跑 |

### 7.4 每周 Research / Ops Governance

| 北京时间 | 类别 | 任务 | 说明 |
| --- | --- | --- | --- |
| 周日 10:00 | Research | `tradeability_sidecar_weekly_calibration.yml` | 周校准 |
| 周日 10:30 | Research | `tradeability_experiment_weekly.yml` | 周实验 |
| 周日 10:50 | Research | `tradeability_promotion_gate.yml` | 周 promotion verdict |
| 周日 10:10 | Ops Governance | `acceptance_weekly.yml` | 周验收快照 |

## 8. 第一优先级拆分建议

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

### 8.1 当前执行约束

为兼容 GitHub Actions Free 与 Turso 现状，当前执行约束是：

1. 长任务和内容任务分开，避免单 job 串行拖长关键路径
2. 对高时效任务显式标记 `Cloudflare Worker` 触发源
3. 对内容分发和健康检查优先使用 `best_effort` 或 step 级软失败
4. 对盘后主产线保留有限并行，不主动放大到高并发 fan-out
5. 对可能卡死的 AkShare 调用使用可重置 timeout 隔离

## 9. 后续治理建议

1. 所有 workflow 文档都补上 `Stage / Type / Trigger Source / Depends On / Blocking`
2. 生产链与研究链分别维护独立总表
3. `README.md` 从“文件列表说明”升级为“链路拓扑说明”
4. 对超时敏感的内容链任务，统一标注 `best_effort`
5. 研究链默认不得阻塞生产链
