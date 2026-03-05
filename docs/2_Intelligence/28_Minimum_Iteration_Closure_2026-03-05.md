# 最小迭代闭环（本地数据可验证）- 2026-03-05

**文档状态**: Draft  
**分支**: `exp/quant-ai-tradeability-v1`  
**作者**: Codex  
**目标**: 用本地 `daily_prices` 跑通 `Watch -> TriggeredLong -> RiskOff` 的最小闭环，并对照 `27_Acceptance_Criteria_v1.md` 做达标判断。

---

## 1. 实验脚本与命令

脚本：

- `backend/scripts/run_min_tradeability_loop.py`

执行命令：

```powershell
python backend/scripts/run_min_tradeability_loop.py `
  --db-path data/stockwise.db `
  --start-date 2024-01-01 `
  --output-json tmp/min_tradeability_loop_result.json
```

---

## 2. 数据范围

1. 股票数：`75`  
2. 评估天数（eligible_days）：`12,499`  
3. 时间范围：`2024-01-01` 至 `2026-03-05`

---

## 3. 闭环定义（最小版）

1. `Watch`：`VCP-like 收缩` + `放量突破`  
2. `TriggeredLong`：`Watch` + `强势收盘` + `动量修复`  
3. 入场：触发次日开盘  
4. 退出：`STOP_LOSS(6%)` 或 `close < ma10` 或 `max_hold_days=10` 超时退出

---

## 4. 结果指标（本次实测）

状态指标：

1. `watch_days=93`，`triggered_days=29`  
2. `watch_coverage=0.744%`  
3. `trigger_coverage=0.232%`  
4. `watch_to_trigger_ratio=31.18%`

前瞻命中：

1. `T+1 win_rate=41.38%`（样本 29）  
2. `T+3 win_rate=28.57%`（样本 28）

交易结果：

1. `trade_count=29`  
2. `expectancy=+5.36%`  
3. `payoff=4.36`  
4. `max_drawdown=35.25%`

退出分布：

1. `RISK_OFF_MA10=15`  
2. `STOP_LOSS=7`  
3. `TIMEOUT=7`

结果文件：

- `tmp/min_tradeability_loop_result.json`

---

## 5. 对照 27 文档的达标判断（Level 1）

1. `TriggeredLong 覆盖率 5%-20%`：**未达标**（当前 `0.232%`）  
2. `Watch->TriggeredLong 15%-40%`：**达标**（当前 `31.18%`）  
3. `Expectancy > 0`：**达标**（当前 `+5.36%`）  
4. `Payoff >= 1.3`：**达标**（当前 `4.36`）  
5. `T+3 胜率 >= 52%`：**未达标**（当前 `28.57%`）  
6. `MDD 与基线对比`：**本轮未完成**（缺旧版基线并行回测）  
7. `多窗口 walk-forward >=3`：**本轮未完成**（仅单窗口）

结论：**本轮不达标，但闭环已打通，可进入参数与基线并行迭代阶段。**

---

## 6. 本轮价值与问题

价值：

1. 已完成从信号到交易到指标的端到端可复现实验。  
2. 已能产出可验收字段（coverage/hit rate/payoff/expectancy/MDD）。  
3. 已具备“每次迭代可量化比较”的实验轨道。

问题：

1. 覆盖率过低，说明触发条件过严。  
2. `T+3` 胜率偏低，短线延续性不足。  
3. 样本量仅 `29` 笔，统计稳定性不足。  
4. 未做基线对照与多窗口验证，暂不能判定策略有效性。

---

## 7. 下一步（最小增量）

1. 增加基线对照：`ma20` 简单趋势策略并行跑。  
2. 做 3 个 walk-forward 窗口，固定参数，不做全样本调参。  
3. 放宽一档触发阈值（先改一个参数），目标先把 `TriggeredLong` 覆盖率推到 `>= 3%`，再观察 `expectancy` 是否保持为正。
