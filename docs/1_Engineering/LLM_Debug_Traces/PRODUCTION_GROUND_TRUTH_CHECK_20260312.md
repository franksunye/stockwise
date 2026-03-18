# 线上真实数据核对（2026-03-12）

## 目的

本文件用于澄清一个关键口径问题：

- 实验目录中的 `baseline_old`
- 线上真实生产链路中的 baseline

这两者不能混为一谈。

本次核对的目标，是直接查询线上真实数据，确认：

1. `300502 / 2026-03-12` 的主预测到底来自哪个模型
2. 主预测结果是否与目录中的线上样本一致
3. 当前线上模型优先级配置是否支持“DeepSeek 作为真实 baseline”这一事实

## 核对时间

- 核对日期：2026-03-12
- 数据源：线上 Turso 数据库
- 核对方式：通过仓库内 `frontend/scripts/turso-cli.mjs` 查询

## 已核实事实

### 1. `300502 / 2026-03-12` 的主预测是 DeepSeek

线上 `ai_predictions_v2` 查询结果显示：

- `symbol = 300502`
- `date = 2026-03-12`
- `target_date = 2026-03-13`
- `model_id = deepseek-v3`
- `signal = Side`
- `confidence = 0.45`
- `is_primary = 1`
- `trace_id = tr-3c45a88221a1`
- `layer1_status = RiskOff`

同一天还存在：

- `hunyuan-lite`
- `rule-engine`

但二者均为：

- `is_primary = 0`

结论：

- **线上真实主预测（primary）确实是 `deepseek-v3`**

### 2. 线上主预测结果与目录中的真实样本一致

目录中的 [`results/Raw_Production_Response.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/Raw_Production_Response.json) 显示：

- `signal = Side`
- `confidence = 0.45`

这与线上 `ai_predictions_v2` 的 primary 记录完全一致。

结论：

- **`Raw_Production_Response.json` 可视为线上真实结果样本的可信镜像**

### 3. 当前线上模型优先级配置支持 DeepSeek 作为真实 baseline

线上 `prediction_models` 查询结果显示：

#### `deepseek-v3`

- `provider = adapter-openai`
- `priority = 100`
- `is_active = 1`
- `config_json.model = deepseek-chat`

#### `gemini-3-flash`

- `provider = adapter-gemini-local`
- `priority = 90`
- `is_active = 1`

#### `hunyuan-lite`

- `priority = 85`
- `is_active = 1`

结论：

- **当前线上主预测链路中，DeepSeek 的优先级高于 Gemini 与 Hunyuan**
- 因此，把 DeepSeek 视为线上真实 baseline，是符合数据库事实的

## 必须明确的边界

### 线上真实 baseline

指的是：

- 真实生产数据库中的主预测记录
- 真实生产链路中的主模型
- 当前已核实为 `deepseek-v3`

### 实验里的 `baseline_old`

指的是：

- 线上旧版 prompt 文本资产
- 在实验环境中被离线重放

当前实验脚本默认使用：

- `gemini_local`

因此：

- `baseline_old` 是**生产 prompt 文本基线**
- 不是**线上 DeepSeek 生产稳定性本体**

## 当前可以下的正确结论

### 可以明确说的

1. 线上真实主预测在本案例中是 `deepseek-v3`
2. 线上真实结果是 `Side / 0.45`
3. 目录中的 `Raw_Production_Response.json` 与线上主记录一致
4. 线上模型优先级配置支持 DeepSeek 作为真实 baseline

### 不能混说的

1. 不能把本地 `gemini_local` 对 `baseline_old` 的重放结果，当作线上 DeepSeek 稳定性结论
2. 不能因为实验中 `baseline_old` 有 parse fail，就推出“线上 DeepSeek baseline 不稳定”

## 补充说明

本次尝试进一步拉取线上 `llm_traces` 中对应 DeepSeek trace 的完整大字段（`system_prompt / user_prompt / response_raw`）时，遇到了 Turso 连接层的 `ECONNRESET`。

但这不影响本文件的核心结论，因为：

- `ai_predictions_v2` 已足以确认真实 primary 记录
- `prediction_models` 已足以确认真实线上模型配置
- `Raw_Production_Response.json` 已与线上主记录的关键结果值对齐

## 最终结论

**线上真实 baseline = DeepSeek。**

**实验中的 `baseline_old` = 线上旧 prompt 文本在本地 Gemini 环境下的离线重放对照组。**

后续所有实验结论，都应在这个边界之上解读。
