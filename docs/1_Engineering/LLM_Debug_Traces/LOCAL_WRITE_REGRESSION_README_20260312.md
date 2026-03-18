# 本地写库回归工具（2026-03-12）

## 1. 目的

把 `B2_PROD_SAFE` 的本地主链真实写库验证固化成可重复脚本，避免每次手动执行：

- `backend/main.py --analyze`
- 再手工查 `ai_predictions_v2`

## 2. 脚本

- [`local_write_regression.py`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/scripts/local_write_regression.py)

## 3. 默认行为

- 环境：`DB_SOURCE=local`
- 默认模型：`gemini-3-flash`
- 默认模板：使用当前代码默认值
- 默认冷却：`5s`

说明：

- 默认不跑 `deepseek-v3`，避免不必要的付费请求
- 如需对照 DeepSeek，必须显式传 `--models deepseek-v3`

## 4. 常用示例

使用当前默认模板跑默认本地模型：

```bash
.venv/bin/python docs/7_Debug_Traces/scripts/local_write_regression.py \
  --symbol 300502 \
  --date 2026-03-12
```

强制按旧模板回归：

```bash
.venv/bin/python docs/7_Debug_Traces/scripts/local_write_regression.py \
  --symbol 300502 \
  --date 2026-03-12 \
  --variant legacy
```

只跑 DeepSeek：

```bash
.venv/bin/python docs/7_Debug_Traces/scripts/local_write_regression.py \
  --symbol 300502 \
  --date 2026-03-12 \
  --models deepseek-v3
```

## 5. 输出

结果保存到：

- [`results/local_write_regressions/`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/local_write_regressions)

每次运行会落：

- `summary.json`
- `results.json`

## 6. 当前用途

这个工具适合后续本地开发阶段做两类事：

1. 改 prompt 后，快速确认主链仍能写本地库
2. 比较 `legacy` 与 `b2` 在同一案例、同一模型上的落库结果
