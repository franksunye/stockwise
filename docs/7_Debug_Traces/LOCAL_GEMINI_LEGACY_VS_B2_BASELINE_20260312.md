# 本地 Gemini：Legacy vs B2 基线对照（2026-03-12）

## 1. 对照对象

- 标的：`300502`
- 日期：`2026-03-12`
- 模型：`gemini-3-flash`
- 环境：本地主链、写本地 SQLite

对照方式：

- `legacy`：`STOCK_ANALYSIS_PROMPT_VARIANT=legacy`
- `b2`：`STOCK_ANALYSIS_PROMPT_VARIANT=b2`

## 2. 核心结果

| 维度 | `legacy` | `b2` | 观察 |
|---|---|---|---|
| `prompt_version` | `v3.6` | `b2.v1` | 模板切换正常 |
| `signal` | `Side` | `Side` | 主信号一致 |
| `confidence` | `0.85` | `0.85` | 置信度一致 |
| `execution_time_ms` | `34161` | `25939` | `b2` 更快 |
| `token_usage_input` | `7177` | `4557` | `b2` 输入更省 |
| `token_usage_output` | `1227` | `1417` | `b2` 输出略长 |

## 3. 摘要对照

| 版本 | `summary` |
|---|---|
| `legacy` | 股价跌破MA20关键支撑且主力资金大幅流出，短期动能转弱，建议离场观望或缩减仓位。 |
| `b2` | 股价跌破MA20且主力大幅流出，触发RiskOff约束，短期趋势转弱，建议离场观望或严控仓位。 |

## 4. 当前判断

这轮本地 Gemini 对照说明：

1. `legacy` 与 `b2` 在该案例上没有发生主信号漂移。
2. `b2` 把 `RiskOff` 约束表达得更显式。
3. `b2` 输入 token 明显下降，且本轮时延更低。
4. `b2` 输出略长，但没有造成结构问题。

## 5. 当前用途

后续继续本地开发时，这份文档应作为最直接的 Gemini 对照基线：

- 如果 `signal` 偏离 `Side`
- 或 `confidence` 明显偏离 `0.85`
- 或 `execution_time_ms / token_usage_input` 明显恶化

都应被视为需要解释的变化，而不是默认接受。
