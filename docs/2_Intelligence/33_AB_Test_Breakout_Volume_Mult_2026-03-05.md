# A/B 实验记录：放量阈值单参数测试（1.5 / 1.3 / 1.1）

**文档状态**: Draft  
**分支**: `exp/quant-ai-tradeability-v1`  
**日期**: 2026-03-05  
**作者**: Codex  
**目标**: 在当前最优组合上，仅调整 `breakout_volume_mult`，提升触发覆盖率并验证稳健性。

---

## 1. 实验设置

固定参数：

1. `vcp_ratio=0.9`  
2. `stop_loss_pct=0.05`  
3. `max_hold_days=10`  
4. `risk_off_ma=10`

变量：

1. A：`breakout_volume_mult=1.5`（旧参考）  
2. B：`breakout_volume_mult=1.3`  
3. C：`breakout_volume_mult=1.1`

---

## 2. 全样本对比

`VOL1.5`：

1. `trigger_cov=0.630%`  
2. `T+3=40.79%`  
3. `expectancy=+2.53%`  
4. `payoff=3.32`  
5. `MDD=44.70%`  
6. `trades=77`

`VOL1.3`：

1. `trigger_cov=0.938%`  
2. `T+3=44.55%`  
3. `expectancy=+1.84%`  
4. `payoff=3.21`  
5. `MDD=56.97%`  
6. `trades=113`

`VOL1.1`：

1. `trigger_cov=1.307%`  
2. `T+3=42.48%`  
3. `expectancy=+3.16%`  
4. `payoff=3.69`  
5. `MDD=42.31%`  
6. `trades=154`

---

## 3. Walk-forward（三窗口）对比

`VOL1.5` 期望：`+6.97 / -1.39 / +2.37`  
`VOL1.3` 期望：`+4.36 / +0.83 / +0.71`  
`VOL1.1` 期望：`+3.44 / +0.95 / +2.88`

关键发现：

1. `VOL1.1` 在 3 个窗口全部为正期望。  
2. `VOL1.1` 相对 `VOL1.5` 同时提高了覆盖率与样本量，并改善总回撤。  
3. `VOL1.3` 虽提高覆盖率，但回撤明显放大，不是更优点。

---

## 4. 阶段结论

当前最优参数更新为：

1. `vcp_ratio=0.9`  
2. `stop_loss_pct=0.05`  
3. `max_hold_days=10`  
4. `risk_off_ma=10`  
5. `breakout_volume_mult=1.1`

说明：

1. 该组合尚未达到 `TriggeredLong coverage 5%-20%` 目标（当前约 `1.31%`）。  
2. 但它是目前“覆盖率提升 + 正期望 + 三窗口稳健性”最平衡的版本。

---

## 5. 下一步建议（继续单参数）

建议只改一个参数继续推进覆盖率：

1. `strong_close_threshold`: `0.7 -> 0.65`  
2. 其他参数固定，重跑同口径指标  
3. 验收门槛：`expectancy` 不转负，`MDD` 不显著恶化
