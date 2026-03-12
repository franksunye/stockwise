# Phase 3.5 本地写库链路验证结果（2026-03-12）

## 1. 执行对象

本次验证使用：

- 环境：`DB_SOURCE=local`
- 模板开关：`STOCK_ANALYSIS_PROMPT_VARIANT=b2`
- 模型：`gemini-3-flash`、`deepseek-v3`
- 标的：`300502`
- 日期：`2026-03-12`
- 模式：真实主链执行，写入本地 `ai_predictions_v2`

对应方案：

- [`PHASE3_5_LOCAL_WRITE_VALIDATION_PLAN_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/PHASE3_5_LOCAL_WRITE_VALIDATION_PLAN_20260312.md)

相关对照：

- [`MODEL_OUTPUT_COMPARISON_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/MODEL_OUTPUT_COMPARISON_20260312.md)
- [`PROD_DEEPSEEK_VS_LOCAL_B2_DEEPSEEK_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/PROD_DEEPSEEK_VS_LOCAL_B2_DEEPSEEK_20260312.md)

## 2. 主链执行结果

### 2.1 `gemini-3-flash`

执行结果：

- 主链成功完成
- `gemini_local` 成功返回
- `Saved 1 results`

模型执行日志关键值：

- `latency ≈ 26.5s`
- `total_tokens = 8579`

### 2.2 `deepseek-v3`

执行结果：

- 主链成功完成
- 第 1 次 LLM 请求遇到 `SSL EOF`
- 自动重试后第 2 次成功返回
- `Saved 1 results`

模型执行日志关键值：

- `latency ≈ 43.5s`
- `total_tokens = 4356`
- `trace attempt = 2`

## 3. 本地库回查结果

### 3.1 本次新增写入记录

回查本地 `ai_predictions_v2`：

| symbol | date | model_id | prompt_version | signal | confidence | token_usage_input | token_usage_output | execution_time_ms | is_primary |
|---|---|---|---|---|---:|---:|---:|---:|---:|
| `300502` | `2026-03-12` | `gemini-3-flash` | `b2.v1` | `Side` | `0.85` | `4547` | `1399` | `26529` | `0` |
| `300502` | `2026-03-12` | `deepseek-v3` | `b2.v1` | `Side` | `0.4` | `3427` | `929` | `46379` | `1` |

同时，本地该日期现有记录为：

| model_id | prompt_version | signal | confidence | is_primary |
|---|---|---|---:|---:|
| `deepseek-v3` | `b2.v1` | `Side` | `0.4` | `1` |
| `gemini-3-flash` | `b2.v1` | `Side` | `0.85` | `0` |
| `hunyuan-lite` | `v1` | `Side` | `0.5` | `0` |
| `rule-engine` | `v1` | `Side` | `0.5` | `0` |

### 3.2 `deepseek-v3` 写入后的结果片段

本地库中的 `ai_reasoning` 开头为：

```json
{"signal": "Side", "confidence": 0.4, "summary": "股价放量跌破关键均线，主力大幅流出，短期趋势转弱。量化状态为RiskOff，应优先防守，等待企稳信号。", ...}
```

这说明：

- `deepseek-v3` 的 JSON 输出已被正式解析链正常接收
- `ai_reasoning` 已成功落库
- 本次 `B2_PROD_SAFE` 并未破坏 DeepSeek 的结果结构

## 4. 核心结论

这次验证说明：

1. `B2_PROD_SAFE` 不仅能通过本地主链路影子测试，还能走完整的本地写库主链。
2. `prompt_version = b2.v1` 已在 `gemini-3-flash` 与 `deepseek-v3` 两条模型链路上正确落库。
3. `signal / confidence / token / execution_time / ai_reasoning` 等关键字段都正常写入。
4. `deepseek-v3` 在本地验证中虽然经历了 1 次网络重试，但最终写库成功，说明当前主链对该模型具备可运行性。
5. 本地验证会改写本地 `is_primary` 状态，因此这一步仅适用于本地 SQLite，不应直接等同于线上切换。

## 5. 补充对照解释

为了避免把“本地跑通”误解成“线上已等价替换”，本次验证又补了两组对照：

1. `DeepSeek + B2_PROD_SAFE` vs `Gemini + B2_PROD_SAFE`
   - 见 [`MODEL_OUTPUT_COMPARISON_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/MODEL_OUTPUT_COMPARISON_20260312.md)
   - 结论：
     - 两边都能通过正式解析链
     - DeepSeek 更克制、更接近线上既有风格
     - Gemini 更快、更执行导向

2. 线上真实 DeepSeek vs 本地 `DeepSeek + B2_PROD_SAFE`
   - 见 [`PROD_DEEPSEEK_VS_LOCAL_B2_DEEPSEEK_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/PROD_DEEPSEEK_VS_LOCAL_B2_DEEPSEEK_20260312.md)
   - 结论：
     - 主信号未漂移，仍为 `Side`
     - 置信度接近（`0.45` vs `0.4`）
     - 本地 `b2.v1` 更显式表达 `RiskOff` 约束
     - 当前更像“保守风格强化”，不是“策略立场改变”

## 6. 当前阶段判断

截至目前，`B2_PROD_SAFE` 已完成：

- Phase 1：兼容层语义修复
- Phase 2：并行模板接入
- Phase 3：本地主链路影子测试
- Phase 3.5：本地写库链路验证

因此它已经具备进入下一阶段的条件：

- **极小范围的真实线上写库验证**

但这并不意味着：

- 已经适合默认切换
- 可以跳过小流量阶段
