# 当前本地 Gemini 基线（2026-03-12）

## 1. 目的

本文件用于冻结当前默认模板下的本地 Gemini 主链结果，作为后续继续开发的最小对照锚点。

## 2. 运行方式

使用：

- [`local_write_regression.py`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/scripts/local_write_regression.py)

本次运行参数：

- `symbol = 300502`
- `date = 2026-03-12`
- `model = gemini-3-flash`
- `variant = default`

结果目录：

- [`results/local_write_regressions/20260312_235130/summary.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/local_write_regressions/20260312_235130/summary.json)
- [`results/local_write_regressions/20260312_235130/results.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/local_write_regressions/20260312_235130/results.json)

## 3. 本次基线结果

| 维度 | 值 |
|---|---|
| `model` | `gemini-3-flash` |
| `prompt_version` | `b2.v1` |
| `signal` | `Side` |
| `confidence` | `0.88` |
| `execution_time_ms` | `45191` |
| `token_usage_input` | `4557` |
| `token_usage_output` | `1376` |

本地库中的 `summary` 为：

- `股价放量跌破MA20支撑，主力资金大幅流出，触发RiskOff约束，短期趋势走弱。`

## 4. 当前用途

后续如果继续修改：

- prompt 模板
- Layer-1 注入语义
- 解析链或 normalizer

都应优先与这份基线比较，至少回答：

1. `prompt_version` 是否仍正确
2. `signal` 是否发生异常漂移
3. `confidence` 是否明显失真
4. `token / execution_time` 是否明显恶化

## 5. 当前建议

下一步如果继续本地开发，最合理的是：

- 再补一轮 `--variant legacy` 的 Gemini 基线
- 形成 `legacy vs b2` 的正式本地对照线

这样后续任何改动都不会失去旧模板参照。
