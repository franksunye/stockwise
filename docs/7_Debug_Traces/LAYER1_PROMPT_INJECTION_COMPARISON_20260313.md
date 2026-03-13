# Layer-1 Prompt Injection 对照（2026-03-13）

## 1. 目的

本次对照用于验证：

- 当 `Layer-1` 只作为独立事实输入时，是否仍有必要注入到 prompt
- 关闭 `Layer-1` prompt 注入后，分析模型原始语义是否发生明显变化

说明：

- 本次对照不关闭 Layer-1 计算
- 不关闭主链最终 `signal` enforcement
- 仅切换 prompt 层是否注入量化模型结论

## 2. 对照设置

- 标的：`300502`
- 日期：`2026-03-12`
- 模型：`gemini-3-flash`
- 模板：`b2.v6`
- 环境：本地主链，写本地 SQLite

两组运行：

1. `LAYER1_PROMPT_INJECTION=1`
2. `LAYER1_PROMPT_INJECTION=0`

## 3. 结果

| 维度 | `injection=1` | `injection=0` | 观察 |
| --- | --- | --- | --- |
| `prompt_version` | `b2.v6` | `b2.v6` | 模板一致 |
| 顶层 `signal` | `RiskOff` | `RiskOff` | 最终主结论一致 |
| `ai_reasoning.signal` | `Side` | `Side` | 分析模型原始语义未变 |
| `layer1_status` | `RiskOff` | `RiskOff` | 量化模型结论一致 |
| `execution_time_ms` | `22103` | `22108` | 基本一致 |
| `token_usage_input` | `5442` | `5183` | 关闭注入后更省输入 token |
| `token_usage_output` | `1382` | `1329` | 关闭注入后输出略短 |

## 4. 核心结论

### 4.1 开关有效

关闭 `Layer-1` prompt 注入后：

- 输入 token 明显下降
- 说明量化模型上下文块确实被移除

### 4.2 在该案例上，原始分析模型结论未受注入影响

不论 `Layer-1` 是否注入 prompt：

- `ai_reasoning.signal` 都是 `Side`
- 顶层 `signal` 都由主链收口为 `RiskOff`

这说明在当前案例上：

- `Layer-1` prompt 注入并没有改变分析模型原始方向判断
- 它更多影响的是上下文密度，而不是原始语义

### 4.3 当前产品主链仍由最终收口决定外显结果

即使关闭 `Layer-1` prompt 注入：

- `signal` 仍然是 `RiskOff`

原因是：

- 当前最终收口仍发生在主链 enforcement，而不是 prompt 本身

## 5. 当前判断

这一轮对照说明：

1. `Layer-1` prompt 注入已经可以安全做成开关
2. 对当前 `RiskOff` 案例，是否注入不会改变原始分析模型结论
3. 关闭注入的主要收益是：
   - prompt 更轻
   - 更接近“双轨下的独立分析模型输入”

## 6. 一句话版本

**在 `300502 / 2026-03-12 / gemini-3-flash` 这条案例上，关闭 Layer-1 prompt 注入会减少 token，但不会改变分析模型原始语义；最终结果仍由主链收口为 `RiskOff`。**
