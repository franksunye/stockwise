# Phase 3 影子验证结果（2026-03-12）

## 1. 运行对象

本轮影子验证比较对象：

- `legacy`
- `B2_PROD_SAFE`

运行条件：

- 本地同步后的真实数据
- `symbol = 300502`
- `date = 2026-03-12`
- `provider = gemini_local`
- 顺序执行，中间 `cooldown = 5s`
- 不写数据库

工具：

- [`shadow_compare_b2_prod_safe.py`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/scripts/shadow_compare_b2_prod_safe.py)

结果目录：

- [`results/shadow_runs/20260312_224027/summary.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/shadow_runs/20260312_224027/summary.json)
- [`results/shadow_runs/20260312_224027/comparison.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/shadow_runs/20260312_224027/comparison.json)

## 2. 核心结果

| 版本 | prompt_version | latency_s | total_tokens | raw_signal | normalized_signal |
|---|---|---:|---:|---|---|
| `legacy` | `v3.6` | 39.266 | 14166 | `Side` | `Side` |
| `B2_PROD_SAFE` | `b2.v1` | 28.164 | 9615 | `Side` | `Side` |

## 3. 直接结论

### 3.1 这轮对照里，`B2_PROD_SAFE` 优于 `legacy`

体现为：

- token 明显更低
- latency 明显更低
- raw / normalized signal 未发生异常漂移
- 两边都能通过当前正式解析链

### 3.2 语义风格也更接近当前迁移目标

`B2_PROD_SAFE` 的摘要为：

- “股价放量跌破MA20关键支撑，技术指标全面转弱，触发RiskOff约束，建议持币观望。”

它比 `legacy` 更明确地保留了：

- `RiskOff` 的风险约束语义

同时没有把输出升级成新枚举，仍保持当前主链兼容。

## 4. 当前边界

这轮结果只能说明：

- `B2_PROD_SAFE` 已具备进入下一阶段影子验证/小流量验证的资格

不能直接说明：

- `B2_LAB` 已经生产化完成
- `B2_PROD_SAFE` 在所有 case 上都必然优于 `legacy`

## 5. 当前判断

基于这轮首样本影子对照，`Phase 3` 的方向是正的：

- `B2_PROD_SAFE` 没有出现结构回归
- 已显示出成本与时延优势
- 具备继续做影子验证的价值

## 6. 小样本扩展结果

随后又补跑了两个本地主链路影子样本：

- [`results/shadow_runs/20260312_225726/summary.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/shadow_runs/20260312_225726/summary.json)
- [`results/shadow_runs/20260312_225901/summary.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/shadow_runs/20260312_225901/summary.json)

### 6.1 `00700 / 2026-03-12` (`NoSetup`)

| 版本 | latency_s | total_tokens | raw_signal | normalized_signal | 备注 |
|---|---:|---:|---|---|---|
| `legacy` | 15.685 | 0 | `null` | `null` | 本地 Gemini 容量耗尽，未形成可解析输出 |
| `B2_PROD_SAFE` | 31.290 | 9942 | `Side` | `Side` | 成功返回并完成解析 |

### 6.2 `601869 / 2026-03-12` (`Watch`)

| 版本 | latency_s | total_tokens | raw_signal | normalized_signal | 备注 |
|---|---:|---:|---|---|---|
| `legacy` | 37.049 | 12647 | `Side` | `Side` | 成功返回并完成解析 |
| `B2_PROD_SAFE` | 17.958 | 0 | `null` | `null` | 本地 Gemini 容量耗尽，未形成可解析输出 |

## 7. 对扩展结果的解释

这两条补样本说明了一件重要事实：

- 当前本地主链路影子测试，已经能观察到 `legacy` 与 `B2_PROD_SAFE` 的真实运行差异
- 但在本地 Gemini 容量波动下，单轮结果仍可能被“哪一边先撞上容量墙”所污染

因此：

- 这些结果可以用于发现方向性信号
- 但还不能把单边失败直接解释为模板本身更差

## 8. 当前更稳的结论

在已成功返回并可解析的样本中：

- `300502`：`B2_PROD_SAFE` 明显更轻、更快
- `00700`：只有 `B2_PROD_SAFE` 成功返回，本轮只能说明其具备可运行性
- `601869`：只有 `legacy` 成功返回，本轮只能说明其具备可运行性

当前阶段最合理的判断是：

- `B2_PROD_SAFE` 已经证明自己**可以进入本地主链路并被正式解析链吃下**
- 它在成功返回的样本上已显示出成本优势
- 但若要做更强结论，仍需要在更稳定的容量窗口下补一轮重复测试

## 9. 补跑后收敛结果

随后对前两条受容量干扰的样本又补跑了一轮：

- [`results/shadow_runs/20260312_231959/summary.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/shadow_runs/20260312_231959/summary.json)
- [`results/shadow_runs/20260312_232135/summary.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/shadow_runs/20260312_232135/summary.json)

### 9.1 `00700 / 2026-03-12`（补跑后）

| 版本 | latency_s | total_tokens | raw_signal | normalized_signal |
|---|---:|---:|---|---|
| `legacy` | 40.042 | 13030 | `Side` | `Side` |
| `B2_PROD_SAFE` | 25.365 | 9113 | `Side` | `Side` |

结论：

- 补跑后两边都成功返回
- `B2_PROD_SAFE` 明显更快、更省 token

### 9.2 `601869 / 2026-03-12`（补跑后）

| 版本 | latency_s | total_tokens | raw_signal | normalized_signal |
|---|---:|---:|---|---|
| `legacy` | 29.496 | 11482 | `Side` | `Side` |
| `B2_PROD_SAFE` | 39.624 | 11458 | `Side` | `Side` |

结论：

- 补跑后两边都成功返回
- 这条样本上 token 基本接近
- `B2_PROD_SAFE` 没有成本优势，甚至更慢

## 10. 当前最稳的 Phase 3 结论

在 `RiskOff / NoSetup / Watch` 三种 Layer-1 主语义样本都补齐后，可以得到更稳的判断：

1. `B2_PROD_SAFE` 已经在本地主链路上证明可运行、可解析、可标准化。
2. 它不是只在单一 `RiskOff` 样本上工作。
3. 它在 `300502` 与 `00700` 上显示出明显成本优势。
4. 它在 `601869` 上没有显示成本优势，因此不能把“更轻更快”写成绝对结论。
5. 当前更准确的表述应是：
   - `B2_PROD_SAFE` 已证明具备进入下一阶段的资格
   - 且在部分样本上显示出明显的 token / latency 收益
   - 但收益不是每个样本都稳定成立
