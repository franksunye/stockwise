# Unified Eval Runner

## 目的

`eval_runner.py` 用来把 `docs/7_Debug_Traces/` 里的单点实验，收口成统一的批量评估流程。

它解决的问题：

- 不再为每个实验问题单独写一个脚本。
- 把 prompt 组合、预期断言、评分维度集中到 manifest。
- 同时记录原始输出、解析结果、normalizer 后结果和断言结果。

## 口径说明

runner 当前默认运行在本地 `gemini_local`。

这意味着：

- 它评估的是“某套 prompt 文本在本地 Gemini 重放下的表现”
- 不是“线上 DeepSeek 生产链路的 1:1 稳定性复刻”

尤其是 `baseline_old`：

- 它的 prompt 文本来自线上旧生产版本
- 但 runner 执行时使用的是本地 Gemini

因此：

- `baseline_old` 适合做 prompt 横向实验
- 不应直接拿来推翻线上 DeepSeek 已稳定运行这一事实

## 文件

- Runner: [`scripts/eval_runner.py`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/scripts/eval_runner.py)
- Manifest: [`eval_manifest.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/eval_manifest.json)
- 输出目录: `results/eval_runs/<run_id>/`

## 当前评估维度

- `parse_success`
- `raw.signal`
- `normalized.signal`
- `raw enum compliance`
- `normalized tactics compliance`
- `normalized key levels compliance`
- `layer1 alignment`
- `total_tokens`
- `latency_s`
- case assertions pass/fail

## 运行方式

全量运行：

```bash
.venv/bin/python docs/7_Debug_Traces/scripts/eval_runner.py
```

只跑某个 group：

```bash
.venv/bin/python docs/7_Debug_Traces/scripts/eval_runner.py --group fair_3_vs_4_states
```

只跑某个 case：

```bash
.venv/bin/python docs/7_Debug_Traces/scripts/eval_runner.py --case b2_without_l1
```

## Manifest 结构

每个 case 至少包含：

- `id`
- `group`
- `system_prompt`
- `user_prompt`
- `signal_mode`

可选：

- `expected_layer1_status`
- `assertions`

当前支持的 assertions：

- `parse_success`
- `raw_signal_in`
- `normalized_signal_in`
- `raw_confidence_gte`
- `raw_confidence_lte`
- `normalized_tactics_compliant`
- `normalized_key_levels_compliant`
- `layer1_alignment`
- `raw_enum_compliant`

## 结果理解

runner 会同时保留三层结果：

1. `raw`
   - 基于模型原始 JSON 提取
   - 适合看模型真实输出有没有漂移

2. `parser`
   - 使用 `parse_ai_response_with_diagnostics`
   - 适合看解析链是否稳定

3. `normalized`
   - 经过 `normalize_ai_response`
   - 适合看进入系统主链后是否满足结构契约

这三层不要混看。

- `raw` 更接近模型本体能力
- `normalized` 更接近生产可落地能力

补充：

- 对 `baseline_old` 而言，这里的“模型本体能力”指的是本地 Gemini 的重放能力，不是线上 DeepSeek 本体能力。

## 当前限制

- Manifest 还主要覆盖单 case 研究样本。
- `signal_mode=four_state` 场景下，系统 normalizer 仍会把输出压回 legacy 三态，因此应优先看 `raw.signal`。
- 当前尚未接入人工盲评与多 case 数据集。

## 下一步建议

1. 增加多股票、多日期 manifest。
2. 增加人工评分字段。
3. 增加 promotion gate 汇总报告。
