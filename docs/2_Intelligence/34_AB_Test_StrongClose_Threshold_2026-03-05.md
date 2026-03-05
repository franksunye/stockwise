# A/B 实验记录：强收盘阈值单参数测试（0.70 vs 0.65）

**文档状态**: Draft  
**分支**: `exp/quant-ai-tradeability-v1`  
**日期**: 2026-03-05  
**作者**: Codex  
**目标**: 在当前最优参数上，仅放宽 `strong_close_threshold`，观察覆盖率与稳健性变化。

---

## 1. 实验设置

固定参数：

1. `vcp_ratio=0.9`  
2. `stop_loss_pct=0.05`  
3. `max_hold_days=10`  
4. `risk_off_ma=10`  
5. `breakout_volume_mult=1.1`

变量：

1. A：`strong_close_threshold=0.70`  
2. B：`strong_close_threshold=0.65`

---

## 2. 全样本对比

`SC0.70`：

1. `trigger_cov=1.307%`  
2. `T+3=42.48%`  
3. `expectancy=+3.16%`  
4. `payoff=3.69`  
5. `MDD=42.31%`  
6. `trades=154`

`SC0.65`：

1. `trigger_cov=1.407%`  
2. `T+3=43.90%`  
3. `expectancy=+3.19%`  
4. `payoff=3.71`  
5. `MDD=44.16%`  
6. `trades=165`

---

## 3. Walk-forward（三窗口）

`SC0.70` 期望：`+3.44 / +0.95 / +2.88`  
`SC0.65` 期望：`+3.23 / +1.85 / +2.56`

观察：

1. 两组均为 3 窗口全正期望。  
2. `SC0.65` 提升了中段窗口（窗口 2）表现。  
3. `SC0.65` 的全样本回撤略高（约 +1.85pct），属于可接受代价。

---

## 4. 阶段结论

建议将当前实验主参数更新为：

1. `vcp_ratio=0.9`  
2. `stop_loss_pct=0.05`  
3. `max_hold_days=10`  
4. `risk_off_ma=10`  
5. `breakout_volume_mult=1.1`  
6. `strong_close_threshold=0.65`

说明：

1. 覆盖率从最初版本持续提升（约 `0.23% -> 1.41%`）。  
2. 仍未达到 `27` 文档覆盖率目标（`5%-20%`），但路径有效且未破坏正期望。

---

## 5. 下一步建议（仍然单参数）

优先继续：

1. `momentum_gate`: `change_percent > 5` 放宽到 `>4`（或 `macd_hist` 连续修复天数规则）  
2. 固定其余参数，重复同口径验证  
3. 严格执行“若 expectancy 转负则回退”规则
