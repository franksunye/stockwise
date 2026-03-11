# GitHub Workflows 说明

这份 README 不再维护具体时间表。

原因：
- 过去这里保留的是早期拆分设计稿，时间与命名已经落后于当前真实编排。
- 当前正式口径已经统一收敛到工程文档，不应该再在 workflows 目录里保留第二份独立时间表。

## 当前正式编排口径

请以这两份文档为准：

1. [18_Backend_Workflow_Orchestration_Map.md](/Users/yesun/Code/stockwise/docs/1_Engineering/18_Backend_Workflow_Orchestration_Map.md)
   - 后台任务全量编排地图
   - 正式时间节奏
   - 触发源、依赖、阻塞级别

2. [14_Investment_Mode_Backend_Runbook.md](/Users/yesun/Code/stockwise/docs/1_Engineering/14_Investment_Mode_Backend_Runbook.md)
   - Investment Mode / sidecar / 研究链边界
   - 生产链与研究链执行顺序

## 当前关键时间节奏

- `daily_morning_call.yml`
  - 由 Cloudflare Worker 精确触发
- `data_sync_realtime.yml`
  - 由 Cloudflare Worker 在盘中窗口调度
- `tradeability_postclose_pipeline.yml`
  - `CN`: 北京时间 `19:05`
  - `HK`: 北京时间 `19:35`
  - 属于研究链，不属于前台生产主链

## 维护规则

- 如果 workflow 时间、依赖或触发源发生变化，优先更新：
  - `docs/1_Engineering/18_Backend_Workflow_Orchestration_Map.md`
  - `docs/1_Engineering/14_Investment_Mode_Backend_Runbook.md`
- 所有 `.github/workflows/**` 变更都会经过 `workflow_quality_gates.yml` 的静态校验后再进入主干。
- 不再在本 README 中维护第二套独立时间表。
