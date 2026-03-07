# Layer-1 参数变更模板（A1）

用途：每次 `tradeability_v2` 参数调整时，必须填写并归档，确保可追溯、可回滚、可验收。

## 1) 基本信息

- 变更日期：
- 变更人：
- 环境：`local` / `cloud`
- 策略版本：`tradeability_v2`
- 市场：`CN` / `HK` / `ALL`
- 关联里程碑：

## 2) 变更目标

- 目标问题：
- 预期改善：
- 不允许恶化项：

## 3) 参数 Diff（必填）

- 文件：`backend/strategy_config/tradeability_params_v2.json`
- 变更前：
```json
{
  "vcp_ratio": 0.95,
  "breakout_volume_mult": 1.0,
  "strong_close_threshold": 0.60,
  "momentum_change_threshold": 2.8,
  "risk_off_ma": 10
}
```
- 变更后：
```json
{
  "vcp_ratio": 0.95,
  "breakout_volume_mult": 0.95,
  "strong_close_threshold": 0.58,
  "momentum_change_threshold": 2.5,
  "risk_off_ma": 10
}
```

## 4) 回滚点（必填）

- Git 回滚提交：
- 参数回滚值：
- 触发回滚条件：
  - 一致率 < 99.5%
  - 触发覆盖率连续异常
  - Mode pipeline 成功率跌破阈值

## 5) 验收指标（必填）

- 方向一致率（门槛 >= 99.5%）：
- TriggeredLong 覆盖率（目标区间）：
- Watch->Triggered 转化率（目标区间）：
- 风险相关（drawdown / riskoff coverage）：
- 可观测指标（延迟/置信度/mode pipeline）：

## 6) 证据附件（必填）

- 日报：`tmp/layer1_metrics/layer1_consistency_daily.*`
- 周报：`tmp/acceptance_metrics/acceptance_weekly.*`
- 观测：`/admin/observability` 截图或导出
- 相关 PR/commit：

## 7) 结论

- 是否通过：
- 上线决策：
- 后续动作：
