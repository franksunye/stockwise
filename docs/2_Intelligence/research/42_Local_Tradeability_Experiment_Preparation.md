# 42 本地 Tradeability 实验准备

更新时间：2026-03-09  
状态：Historical Reference  
定位：本地定向实验工作单（保留作阶段性研究记录）  
当前主依据：
- `docs/2_Intelligence/39_Tradeability_Dual_Lane_Operations.md`
- `docs/1_Engineering/14_Investment_Mode_Backend_Runbook.md`
- `docs/1_Engineering/archive/17_Tradeability_Promotion_Execution_Plan.md`

说明：

1. 本文记录的是某一阶段的本地实验准备与候选筛选方式。
2. 若与当前双轨主口径、promotion 治理或运行顺序冲突，以主文档为准。
3. 后续若再次开展本地定向实验，优先新建 `research/` 下的轮次记录，而不是把本文继续当作长期主执行文档。

## 1. 目标

当前本地实验的目标，不是直接定版，而是先解决两个最核心的问题：

1. 模式产品层样本量偏少
2. 研究门禁仍卡在一致性、观察转触发、可观测

因此，本地实验应分成两层：

### A. 定向实验

用途：

- 快速判断参数往哪边调
- 比较 `baseline / mid / active`
- 优先提升：
  - 出手率
  - 样本数
  - T+3 胜率
  - 不显著恶化最大回撤

### B. 完整验证

用途：

- 把定向实验筛出的候选参数带回正式研究链
- 重跑：
  - sidecar
  - acceptance
  - promotion verdict

只有完整验证过的结果，才允许进入线上受控实验。

---

## 2. 实验准备清单

开始新一轮实验前，必须先确认：

1. 本地 SQLite 数据已同步完成
2. `quant_tradeability_signals` 已有足够历史
3. `layer1_daily_reports` 已补齐
4. 本地 `promotion_audit_log` 可用
5. 当前基线参数文件为：
   - `backend/strategy_config/tradeability_params_v2.json`

---

## 3. 当前建议的本地实验矩阵

### 3.1 CN

1. `cn_baseline`
2. `cn_mid`
3. `cn_active`

当前建议重点跟踪：

- `cn_mid`

### 3.2 HK

1. `hk_baseline`
2. `hk_mid`
3. `hk_active`

当前建议重点跟踪：

- `hk_mid`

---

## 4. 实验产物位置

本地实验产物默认落到：

- `tmp/experiment_candidates/`
- `tmp/targeted_experiments/`

建议保存：

1. scenario manifest
2. results json
3. results markdown
4. round summary

---

## 5. 推荐工作流

### Step 1：生成实验清单

把本轮要跑的 `CN/HK` 参数候选写进 manifest。

建议文件：

- `tmp/experiment_candidates/tradeability_round2_manifest.json`

### Step 2：跑定向实验

执行：

```bash
./.venv/bin/python backend/scripts/run_tradeability_targeted_experiments.py \
  --manifest tmp/experiment_candidates/tradeability_round2_manifest.json
```

输出：

- `tmp/targeted_experiments/round2_results.json`
- `tmp/targeted_experiments/round2_results.md`

### Step 3：筛出候选

优先标准：

1. 出手率略提升
2. T+3 胜率不下降，最好上升
3. 回撤不显著恶化
4. 样本数更健康

### Step 4：进入完整验证

对筛出的候选参数：

1. 替换本地候选参数文件
2. 重跑 sidecar / acceptance / promotion verdict
3. 看是否改善：
   - consistency
   - watch -> trigger
   - observability
   - product effect

---

## 6. 当前原则

1. 本地定向实验只负责“找方向”
2. 不用短窗口实验直接定最终参数
3. 不要一次性扫太多参数，优先单参数、小步长
4. 优先选“折中改善”，不要盲目追求更激进

---

## 7. 当前结论

截至 2026-03-09：

1. `CN-mid` 比当前 CN 基线更值得继续验证
2. `HK-mid` 比当前 HK 基线更值得继续验证
3. 下一步应把这两个候选带回完整研究链复验，而不是继续只看短窗口 loop
