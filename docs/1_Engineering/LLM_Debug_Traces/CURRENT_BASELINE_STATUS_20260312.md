# 当前单案例基线状态（2026-03-12）

## 1. 结论先行

截至本次修复后复跑，当前 `docs/7_Debug_Traces/` 的单案例评估链已经达到一个可用基线：

- 线上真实 baseline 已核实为 DeepSeek，且存在稳定生产记录
- 本地 Gemini 重放实验的 10 个 case 已全部跑通
- `B3` 与 `B4_NEW` 的历史 parse 失败，已通过定向 prompt 收紧修复

本文件对应的最新全量复跑结果目录为：

- [`results/eval_runs/20260312_214935/summary.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/eval_runs/20260312_214935/summary.json)
- [`results/eval_runs/20260312_214935/eval_results.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/eval_runs/20260312_214935/eval_results.json)

## 2. 生产真相锚点

线上 `300502 / 2026-03-12` 的主预测已核实为：

- `model_id = deepseek-v3`
- `signal = Side`
- `confidence = 0.45`
- `is_primary = 1`

详见：

- [`PRODUCTION_GROUND_TRUTH_CHECK_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/PRODUCTION_GROUND_TRUTH_CHECK_20260312.md)
- [`results/Raw_Production_Response.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/Raw_Production_Response.json)

因此后续实验的真相边界应始终保持为：

- 线上稳定性，参考 DeepSeek 真实生产记录
- 本地 Gemini 复跑，只用于 prompt 研究与横向比较

## 3. 最新全量复跑结果

本次全量复跑配置：

- Provider: `gemini_local`
- Model: `gemini-3-flash`
- Cooldown: `5s`
- Retries: `1`

核心汇总指标：

- `total_cases = 10`
- `parse_success_rate = 1.0`
- `assertion_pass_rate = 1.0`
- `normalized_tactics_compliance_rate = 1.0`
- `normalized_key_levels_compliance_rate = 1.0`
- `avg_latency_s = 26.689`
- `avg_total_tokens = 7377.0`

按组汇总：

| 组别 | cases | assertion_pass | avg_latency_s | avg_total_tokens |
|---|---:|---:|---:|---:|
| `four_way_benchmark` | 4 | 4 | 27.391 | 7844.5 |
| `layer1_constraint` | 2 | 2 | 23.919 | 6685.0 |
| `four_state_semantics` | 2 | 2 | 25.325 | 6870.0 |
| `fair_3_vs_4_states` | 2 | 2 | 29.421 | 7641.0 |

## 4. 当前 10 个 Case 状态

| Case | 当前状态 | 备注 |
|---|---|---|
| `baseline_old` | 通过 | 生产旧 prompt 文本在本地 Gemini 重放下已跑通 |
| `b1_minimal_features` | 通过 | 极简输入路线可稳定过结构检查 |
| `b2_rich_tables` | 通过 | 当前 rich context 主样本可稳定过结构检查 |
| `b3_logic_distilled` | 通过 | 先前 JSON/字段缺失问题已修复 |
| `b2_with_l1` | 通过 | L1 安全阀版本稳定 |
| `b2_without_l1` | 通过 | 会出现更激进 raw signal，符合该 case 的验证目的 |
| `b2_legacy_3_states` | 通过 | 三态基线可稳定复跑 |
| `b4_new_4_states` | 通过 | 先前 `tactics` 字符串化问题已修复 |
| `b2_optimized_3_states` | 通过 | 公平对比三态版本稳定 |
| `b4_strict_4_states` | 通过 | 公平对比四态版本稳定 |

## 5. 对先前问题的最新判断

### 5.1 `B3` 的问题

旧问题：

- 非法 JSON
- 缺失关键字段
- `tactics` 结构松散

当前状态：

- 已通过收紧 system prompt 修复
- 本轮全量复跑已 parse pass

### 5.2 `B4_NEW` 的问题

旧问题：

- `tactics` 被压缩成字符串而不是数组对象

当前状态：

- 已通过强化数组结构契约修复
- 本轮全量复跑已 parse pass

### 5.3 `baseline_old` 的口径

必须继续强调：

- 它是“线上旧 prompt 文本”的实验对照组
- 不是“线上 DeepSeek 生产稳定性”的替代物

## 6. 当前仍需保留的注意事项

- 四状态 case 要优先看 `raw.signal`
  - 因为当前系统 normalizer 仍偏 legacy 三态
- 这轮 `parse_success_rate = 1.0` 是一个当前基线结果，不应外推成“任何时间、任何负载下都恒定 100%”
- 本地 Gemini 容量波动仍可能带来 latency 抖动与偶发重试

## 7. 下一步建议

当前最合理的后续工作不是继续堆文档，而是进入两个更实质的方向之一：

1. 将实验结论逐步迁移回正式生产模板与解析链
2. 在保持低频请求节奏的前提下，开始多案例评估

如果继续停留在单案例层面，新增价值会开始快速递减。
