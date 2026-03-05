# Tradeability Sidecar 上线运行手册

**文档状态**: Draft  
**日期**: 2026-03-05  
**分支**: `exp/quant-ai-tradeability-v1`  
**目标**: 在不影响现有主预测链路的前提下，上线旁路策略信号。

---

## 1. 上线范围（零侵入）

本次仅新增，不替换现有功能：

1. 新表：`quant_tradeability_signals`  
2. 新脚本：`backend/scripts/run_tradeability_sidecar.py`  
3. 新工作流：`.github/workflows/tradeability_sidecar_daily.yml`

不修改：

1. `ai_predictions_v2` 主预测生成逻辑  
2. 现有 `daily_pipeline_cn/hk` 执行路径  
3. 现有通知和用户端主信号

---

## 2. 调度策略

1. CN sidecar：`50 8 * * 1-5`（UTC）  
2. HK sidecar：`20 9 * * 1-5`（UTC）  
3. 交易日闸门：分别调用 `trading_day_gate.yml`（CN/HK 独立）

---

## 3. 手动触发（建议先灰度）

Workflow: `Tradeability Sidecar Daily`

输入参数：

1. `market`: `CN/HK/BOTH`  
2. `date`: 可选  
3. `strategy_version`: 默认 `tradeability_v1`  
4. `dry_run`: 默认 `false`

建议步骤：

1. 先 `dry_run=true` 验证当日信号分布  
2. 再 `dry_run=false` 正式写入

---

## 4. 验证 SQL

```sql
SELECT market, date, strategy_version, setup_state, COUNT(*) AS n
FROM quant_tradeability_signals
WHERE date = '2026-03-05'
GROUP BY market, date, strategy_version, setup_state
ORDER BY market, setup_state;
```

---

## 5. 回滚策略

如果 sidecar 异常：

1. 暂停 workflow `tradeability_sidecar_daily.yml`  
2. 不需要回滚主链路（主链路完全独立）  
3. 必要时按 `strategy_version` 删除 sidecar 数据：

```sql
DELETE FROM quant_tradeability_signals
WHERE strategy_version = 'tradeability_v1';
```
