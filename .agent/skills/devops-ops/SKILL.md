---
name: devops-ops
description: StockWise 系统开发运维 (DevOps) 技能。涵盖线上任务审计、可观测性监控、系统可靠性维护及自动化运维工作流。
---

# 开发运维 (DevOps & System Ops)

本技能定义了 StockWise 生产环境的运维标准与自动化流程。侧重于系统的可观测性 (Observability)、可靠性 (Reliability) 以及长期的运维自动化。

## 1. 线上任务执行审计 (Online Task Audit)

每日对后台任务的执行状态进行对齐审计，确保生产链路（CN/HK/US）符合编排计划。

### 1.1 数据源与工具
- **数据源**: Turso 云端数据库中的 `task_logs` 表。
- **核心工具**: `backend/scripts/audit_task_logs.py`
- **执行环境**: 必须设置 `$env:DB_SOURCE="cloud"` 以连接生产库。

### 1.2 审计标准 (SLA)
参考文档：[18_Backend_Workflow_Orchestration_Map.md](file:///Users/yesun/Code/stockwise/docs/1_Engineering/18_Backend_Workflow_Orchestration_Map.md)

| 市场/类别 | 核心任务 | 期望开始时间 (BJT) | 允许延迟 |
| :--- | :--- | :--- | :--- |
| **CN (A股)** | `Full Market Sync (CN)` | 16:00 | 30 min |
| **CN (A股)** | `AI Analysis (CN)` | 16:10 | 30 min |
| **HK (港股)** | `Full Market Sync (HK)` | 16:30 | 30 min |
| **US (美股)** | `Full Market Sync (US)` | 06:30 | 30 min |
| **运营/内容** | `Daily Morning Call` | 08:30 / 20:30 | 5 min |

### 1.3 审计命令
```powershell
# 运行自动化审计脚本
$env:DB_SOURCE="cloud"; python backend/scripts/audit_task_logs.py
```

## 2. 系统可观测性 (Observability)

### 2.1 任务日志规范
所有后台任务必须通过 `JobGuard` 或 `TaskLogger` 写入日志。
- **状态枚举**: `running`, `success`, `failed`
- **失败处理**: 状态为 `failed` 时必须附带 `message` (异常摘要) 和 `metadata` (堆栈或关键指标)。

### 2.2 健康检查
- **Almanac Health**: 检查 `market_facts_daily` 的生成覆盖率。
- **Broadcast Status**: 检查企微通知和 Push 的触达成功率。

## 3. 常见运维操作 (Runbooks)

### 3.1 任务补跑 (Backfill)
当审计发现任务缺失或失败时：
- **手动触发**: 在 GitHub Actions 中找到对应的 `.yml` 文件执行 `workflow_dispatch`。
- **脚本补跑**: 使用 `backend/scripts/ai_backfill.yml` (需适配参数)。

### 3.2 数据库连接诊断
- 遇到 `ECONNRESET` 或 `stream not found`：这是 Turso 的瞬态错误，脚本应具备重试逻辑。
- 手动验证：使用 `node frontend/scripts/turso-cli.mjs query "SELECT 1"`。

## 4. 报告模板

审计报告应包含以下结构：
- **Summary**: 任务总数、成功数、失败数、延迟数。
- **Discrepancies**: 偏离计划的任务列表、延迟分钟数、失败报错消息。
- **Action Items**: 是否需要手动重补、是否需要调整 Cron 时间、是否有 API 稳定性风险。

---
> [!TIP]
> 这是一个持续演进的技能。后续将补充关于“自动化发布门禁 (Quality Gates)”和“多云环境同步”的内容。
