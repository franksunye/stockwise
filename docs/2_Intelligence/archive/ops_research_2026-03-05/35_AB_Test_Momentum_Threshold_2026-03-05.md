# A/B 实验记录：动量阈值单参数测试（5 vs 4）

**文档状态**: Draft  
**分支**: `exp/quant-ai-tradeability-v1`  
**日期**: 2026-03-05  
**作者**: Codex  
**目标**: 在当前组合上，只放宽 `momentum_change_threshold`，提升触发覆盖率并保持稳健性。

---

## 1. 实验设置

固定参数：

1. `vcp_ratio=0.9`  
2. `stop_loss_pct=0.05`  
3. `max_hold_days=10`  
4. `risk_off_ma=10`  
5. `breakout_volume_mult=1.1`  
6. `strong_close_threshold=0.65`

变量：

1. A：`momentum_change_threshold=5`  
2. B：`momentum_change_threshold=4`

---

## 2. 全样本对比

`MOMO5`：

1. `trigger_cov=1.407%`  
2. `T+3=43.90%`  
3. `expectancy=+3.19%`  
4. `payoff=3.71`  
5. `MDD=44.16%`  
6. `trades=165`

`MOMO4`：

1. `trigger_cov=1.502%`  
2. `T+3=46.55%`  
3. `expectancy=+3.34%`  
4. `payoff=3.79`  
5. `MDD=44.16%`  
6. `trades=175`

---

## 3. Walk-forward（三窗口）

`MOMO5` 期望：`+3.23 / +1.85 / +2.56`  
`MOMO4` 期望：`+3.16 / +1.96 / +3.13`

观察：

1. 两组均保持 3 窗口全正期望。  
2. `MOMO4` 在窗口 2 与窗口 3 表现更好。  
3. 回撤未显著恶化。

---

## 4. 阶段结论

当前主实验参数更新为：

1. `vcp_ratio=0.9`  
2. `stop_loss_pct=0.05`  
3. `max_hold_days=10`  
4. `risk_off_ma=10`  
5. `breakout_volume_mult=1.1`  
6. `strong_close_threshold=0.65`  
7. `momentum_change_threshold=4`

备注：

1. 该版本较初始版本已显著提升覆盖率和样本数，同时维持正期望。  
2. 仍未达到 `TriggeredLong coverage 5%-20%` 的 Level 1 目标，后续继续迭代。

---

## 5. 下一步建议（继续单参数）

建议仅测试：

1. `vcp_ratio`: `0.9 -> 1.0`（进一步放宽收缩条件）  
2. 若覆盖率上升且 `expectancy` 保持正值，则进入下一轮；否则回退。
