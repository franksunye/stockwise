# A/B 实验记录：止损阈值单参数测试（固定 vcp_ratio=0.9）

**文档状态**: Draft  
**分支**: `exp/quant-ai-tradeability-v1`  
**日期**: 2026-03-05  
**作者**: Codex  
**目标**: 在 `vcp_ratio=0.9` 固定下，仅调整 `stop_loss_pct`，评估回撤与期望的权衡。

---

## 1. 实验设置

固定项：

1. 数据范围：`2024-01-01 ~ 2026-03-05`  
2. 规则：`Watch -> TriggeredLong -> RiskOff`  
3. 基线：`MA20` + `walk_forward_3`  
4. 固定参数：`vcp_ratio=0.9`

变量：

1. A：`stop_loss_pct=0.05`  
2. B：`stop_loss_pct=0.06`  
3. C：`stop_loss_pct=0.07`

结果文件：

1. `tmp/min_tradeability_loop_vcp09_sl05.json`  
2. `tmp/min_tradeability_loop_vcp09.json`  
3. `tmp/min_tradeability_loop_vcp09_sl07.json`

---

## 2. 全样本对比

`SL05`：

1. `trigger_coverage=0.630%`  
2. `T+3 win_rate=40.79%`  
3. `expectancy=+2.53%`  
4. `payoff=3.32`  
5. `MDD=44.70%`

`SL06`：

1. `trigger_coverage=0.631%`  
2. `T+3 win_rate=40.79%`  
3. `expectancy=+2.38%`  
4. `payoff=3.16`  
5. `MDD=51.43%`

`SL07`：

1. `trigger_coverage=0.631%`  
2. `T+3 win_rate=40.79%`  
3. `expectancy=+2.40%`  
4. `payoff=3.18`  
5. `MDD=51.43%`

结论：

1. 三组覆盖率基本一致（说明止损不影响触发端）。  
2. `SL05` 在期望值和回撤上同时优于 `SL06/SL07`。  
3. 当前推荐参数更新为：`vcp_ratio=0.9, stop_loss_pct=0.05`。

---

## 3. Walk-forward（三窗口）对比

`SL05` 窗口期望：`+6.97% / -1.39% / +2.37%`  
`SL06` 窗口期望：`+6.97% / -1.67% / +2.19%`  
`SL07` 窗口期望：`+6.97% / -1.56% / +2.17%`

观察：

1. 三组都在窗口 2 出现负期望。  
2. `SL05` 的窗口 2 亏损最小。  
3. 说明“中段 regime 失效”仍是主要问题，但 `SL05` 更稳。

---

## 4. 当前阶段结论

1. 单参数迭代有效：我们已经找到更优风险收益点。  
2. 仍未触达 `27` 文档的覆盖率与 `T+3` 达标线。  
3. 下一步应继续单参数策略，优先考虑“退出逻辑”而非“入场扩张”。

---

## 5. 下一步建议（继续最小迭代）

固定 `vcp_ratio=0.9 + stop_loss_pct=0.05`，只测一个参数：

1. `max_hold_days`: `10 -> 8`（目标：降低尾部回撤）  
或
2. `risk_off_line`: `close<ma10 -> close<ma5`（目标：更快保护利润）

建议优先 `max_hold_days 10->8`，因为改动最小、可解释性最高。
