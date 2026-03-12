# 生产默认模板切换决定（2026-03-12）

## 1. 决定

自本次变更起，股票分析主链的默认模板切换为：

- 默认：`B2_PROD_SAFE`
- 回退：显式设置 `STOCK_ANALYSIS_PROMPT_VARIANT=legacy`

对应代码：

- [`prompts.py`](/Users/yesun/Code/stockwise/backend/engine/prompts.py)

## 2. 本次切换的工程含义

这次不是删除旧模板，而是调整默认解析：

- 未设置 `STOCK_ANALYSIS_PROMPT_VARIANT` 时：走 `b2`
- 显式设置 `STOCK_ANALYSIS_PROMPT_VARIANT=legacy` 时：走旧模板
- 非法值：回落到 `b2`

因此：

- 新版本成为默认路径
- 旧版本仍保留为硬回退路径

## 3. 依据

本次默认切换建立在以下证据上：

- [`SHADOW_VALIDATION_RESULT_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/SHADOW_VALIDATION_RESULT_20260312.md)
- [`PHASE3_5_LOCAL_WRITE_VALIDATION_RESULT_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/PHASE3_5_LOCAL_WRITE_VALIDATION_RESULT_20260312.md)
- [`MODEL_OUTPUT_COMPARISON_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/MODEL_OUTPUT_COMPARISON_20260312.md)
- [`PROD_DEEPSEEK_VS_LOCAL_B2_DEEPSEEK_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/PROD_DEEPSEEK_VS_LOCAL_B2_DEEPSEEK_20260312.md)

这些证据表明：

- `B2_PROD_SAFE` 已通过本地主链路影子验证
- `B2_PROD_SAFE` 已通过 `gemini-3-flash` 与 `deepseek-v3` 的本地真实写库验证
- 在 `deepseek-v3` 上没有出现主方向漂移
- 与线上真实 DeepSeek 相比，变化更接近“保守风格强化”，不是策略立场改变

## 4. 最小回归验证

本次默认切换后，已完成最小回归：

- 模板切换单测通过
- 未显式设置 `STOCK_ANALYSIS_PROMPT_VARIANT` 时，本地主链 `deepseek-v3` 已写出：
  - `prompt_version = b2.v1`
  - `signal = Side`
  - `confidence = 0.45`

说明默认值切换已经真实生效。

## 5. 回退说明

若线上观察到异常，可直接回退为：

```bash
STOCK_ANALYSIS_PROMPT_VARIANT=legacy
```

该回退不会要求删除 B2 模板，也不要求代码回滚。
