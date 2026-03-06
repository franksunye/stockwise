# 最小迭代闭环（二）- 3 窗口 + 基线对照

**文档状态**: Draft  
**分支**: `exp/quant-ai-tradeability-v1`  
**日期**: 2026-03-05  
**作者**: Codex  
**目标**: 在最小闭环基础上，补齐 `MA20` 基线与 `3` 窗口 walk-forward 评估。

---

## 1. 执行命令

```powershell
python backend/scripts/run_min_tradeability_loop.py `
  --db-path data/stockwise.db `
  --start-date 2024-01-01 `
  --with-baseline `
  --walk-forward-3 `
  --output-json tmp/min_tradeability_loop_result_v2.json
```

结果文件：

- `tmp/min_tradeability_loop_result_v2.json`

---

## 2. 全样本对照（主策略 vs MA20 基线）

主策略（Watch/TriggeredLong）：

1. `trade_count=29`  
2. `expectancy=+5.36%`  
3. `payoff=4.36`  
4. `max_drawdown=35.25%`

MA20 基线：

1. `trade_count=666`  
2. `expectancy=+2.18%`  
3. `payoff=4.18`  
4. `max_drawdown=81.42%`

观察：

1. 主策略期望收益更高，但样本显著更少。  
2. 主策略回撤显著低于基线。  
3. 当前最大短板仍是覆盖率不足（触发太少）。

---

## 3. Walk-forward（三窗口）结果

窗口 1（2024-01-02 ~ 2024-09-19）：

1. 主策略 `expectancy=+14.60%`，`MDD=17.88%`，`trade_count=8`  
2. 基线 `expectancy=+0.45%`，`MDD=62.73%`，`trade_count=177`

窗口 2（2024-09-20 ~ 2025-06-13）：

1. 主策略 `expectancy=-2.99%`，`MDD=22.72%`，`trade_count=7`  
2. 基线 `expectancy=+2.09%`，`MDD=60.64%`，`trade_count=175`

窗口 3（2025-06-16 ~ 2026-03-05）：

1. 主策略 `expectancy=+3.68%`，`MDD=36.14%`，`trade_count=12`  
2. 基线 `expectancy=+2.38%`，`MDD=62.28%`，`trade_count=309`

核心结论：

1. 主策略在 3 窗口中 `2/3` 为正期望，且回撤均明显低于基线。  
2. 但窗口 2 失效，说明当前规则对市场状态切换敏感。  
3. 样本量偏小，统计稳定性仍不足。

---

## 4. 对照 27 验收标准的当前状态

1. `Watch->TriggeredLong 15%-40%`：**达标**（31.18%）  
2. `Expectancy > 0`（全样本）：**达标**  
3. `Payoff >= 1.3`：**达标**  
4. `MDD 与基线对照`：**阶段达标**（显著优于基线）  
5. `3 窗口 walk-forward`：**已完成**  
6. `TriggeredLong 覆盖率 5%-20%`：**未达标**（0.232%）  
7. `T+3 胜率 >= 52%`：**未达标**（28.57%）

结论：**轨道有效，但还未达到 Level 1 全量达标。**

---

## 5. 下一步最小迭代建议

只改一个参数做 A/B，避免过拟合：

1. 放宽 `VCP-like` 收缩阈值（例如 `amp5 < amp20*0.8 -> 0.9`）  
2. 其余规则不变，重跑同一命令  
3. 目标优先级：
   - 先把 `TriggeredLong` 覆盖率推高到 `>= 3%`  
   - 同时保持 `Expectancy > 0` 与 `MDD` 不劣化
