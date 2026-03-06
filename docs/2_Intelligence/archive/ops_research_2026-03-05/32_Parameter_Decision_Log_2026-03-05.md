# 参数决策日志（持续最小迭代）

**文档状态**: Draft  
**分支**: `exp/quant-ai-tradeability-v1`  
**日期**: 2026-03-05  
**作者**: Codex  
**目的**: 记录连续单参数实验后的取舍结论，形成可追溯参数版本。

---

## 1. 当前候选基线

来自前序实验（文档 31）：

1. `vcp_ratio=0.9`  
2. `stop_loss_pct=0.05`  
3. `max_hold_days=10`  
4. `risk_off_ma=10`

---

## 2. 本轮实验 A：max_hold_days（10 -> 8）

对比：

1. H10：`expectancy=+2.53%`, `payoff=3.32`, `MDD=44.70%`  
2. H8：`expectancy=+0.63%`, `payoff=1.98`, `MDD=47.66%`

结论：

1. `H8` 未降低回撤，且显著削弱期望值。  
2. **拒绝 H8**，保留 `max_hold_days=10`。

---

## 3. 本轮实验 B：risk_off_ma（ma10 -> ma5）

对比（固定 `vcp=0.9, sl=0.05, hold=10`）：

1. MA10：`trigger_cov=0.630%`, `t3=40.79%`, `expectancy=+2.53%`, `MDD=44.70%`  
2. MA5：`trigger_cov=0.639%`, `t3=40.26%`, `expectancy=+1.85%`, `MDD=45.09%`

walk-forward：

1. MA10 期望：`+6.97 / -1.39 / +2.37`  
2. MA5 期望：`+6.56 / -1.36 / +1.56`

结论：

1. MA5 没有带来全样本回撤改善。  
2. MA5 压低了期望与 payoff。  
3. **保留 MA10** 作为当前最优。

---

## 4. 当前最优参数（截至 2026-03-05）

1. `vcp_ratio=0.9`  
2. `stop_loss_pct=0.05`  
3. `max_hold_days=10`  
4. `risk_off_ma=10`

---

## 5. 下一步最小迭代建议

继续单参数，优先测试：

1. `breakout_volume_mult`: `1.5 -> 1.3`（目标：提升触发覆盖率）  
2. 其余参数固定不动，观察 `trigger_cov` 与 `expectancy` 同时变化

决策门槛：

1. 若 `trigger_cov` 提升且 `expectancy` 仍为正，进入下一轮 walk-forward。  
2. 若 `expectancy` 转负，立即回退该参数。
