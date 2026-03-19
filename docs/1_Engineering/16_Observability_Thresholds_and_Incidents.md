---
title: "16 Observability 阈值与异常定义（R2）"
doc_id: "engineering-observability-thresholds-and-incidents-r2"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-19"
summary: "定义 observability 指标阈值与异常规则，是风险、黑天鹅、波动类内容的工程事实源。"
---

# 16 Observability 阈值与异常定义（R2）

更新时间：2026-03-07  
范围：`/admin/observability`、`/api/admin/observability`、`acceptance_weekly`

## 1. 核心指标与阈值

1. `api_latency_p95_ms`
- `warn >= 5000`
- `critical >= 8000`
- 样本下限：`min_samples_24h = 20`（不足时状态至少为 `warn`）

2. `confidence_low_ratio_7d`（`confidence < 0.6` 占比）
- `warn >= 0.35`
- `critical >= 0.50`
- 样本下限：`min_samples_7d = 50`（不足时状态至少为 `warn`）

3. `mode_pipeline_success_rate_14d`
- `warn <= 0.95`
- `critical <= 0.90`
- 样本下限：`min_runs_14d = 3`（不足时状态至少为 `warn`）

## 2. 异常定义

1. API 延迟异常
- 定义：P95 超阈值，说明接口性能退化，影响运营与后台决策时效。

2. 置信度漂移异常
- 定义：低置信度输出占比异常升高，说明模型输出质量波动。

3. Mode Pipeline 稳定性异常
- 定义：`prediction -> decision -> ledger -> snapshot` 成功率下降，存在生产数据链路风险。

## 3. 状态规则

- `ok`：全部指标在正常区间。
- `warn`：至少一个指标到达 `warn`，且无 `critical`。
- `critical`：至少一个指标到达 `critical`。

## 4. 周复盘接入

- `acceptance_weekly` 必须输出 observability section。
- 每周里程碑复盘至少包含：
  - 本周 `overall_state`
  - 三个核心指标值
  - 异常项与处置动作

## 5. 变更纪律

- 调整阈值时需同步更新：
  - `frontend/src/app/api/admin/observability/route.ts`
  - `backend/scripts/metrics_acceptance_weekly.py`
  - 本文档
