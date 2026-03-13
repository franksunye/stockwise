# AICouncil：复核意见 / 独立判断 当前实现说明（2026-03-13）

## 1. Why This Note Exists

2026-03-13 对 `AICouncil` 做了一次语义澄清：

- 前端原先使用 `协同观点`
- 当前改为 `复核意见`

这不是纯文案优化，而是一次对“当前真实数据来源”与“前台命名”的重新对齐。

本说明用于记录：

- 当前线上真实实现是什么
- 哪些地方是产品上可接受的自洽
- 哪些地方仍然不是严格意义上的“协同生成”

## 2. Current UI Labels

当前 `AICouncil.tsx` 中主要有两类成员卡：

- `复核意见`
- `独立判断`

对应文件：

- `frontend/src/components/dashboard/AICouncil.tsx`

## 3. Current Data Semantics

### 3.1 独立判断

`独立判断` 的正文来自分析师模型自身的结构化输出。

前端取值逻辑：

- 优先 `llm_reasoning`
- 否则 `ai_reasoning`
- 解析 JSON 后优先读 `summary`
- 没有 `summary` 时退回 `analysis`
- 再没有则退回原始字符串

因此，`独立判断` 本质上代表：

- 分析师模型自己的主结论摘要

### 3.2 复核意见

`复核意见` 的正文当前并不是独立生成的第二份分析稿。

当前前端逻辑是：

- 优先读取 `conflict_resolution`
- 如果没有，则退回同一份 reasoning 中的 `summary`

因此，`复核意见` 当前更接近：

- 分析师对量化底座输入的对照说明
- 或分歧说明 / 复核说明

而不是严格意义上的：

- “沈策先产出一份完整结论，顾深/林序再围绕该结论单独复核并生成新的协同摘要”

## 4. Production Sample That Proved This

2026-03-13 对线上 `600036`（招商银行）做了生产抽样。

样本结论：

- `deepseek-v3` 的 `llm_traces.response_parsed.signal = "Watch"`
- 同一条记录的 `response_parsed.conflict_resolution` 为：
  - 量化模型共振评分偏多，但模型自身仍给出 `Watch`
- 最终 `ai_predictions_v2` 主记录可能被系统后处理成更强的最终状态

这说明：

1. `conflict_resolution` 是 LLM 原始结构化输出的一部分
2. 它确实在参考量化底座输入
3. 但它表达的是“对照/分歧说明”，不是“协同定稿”

## 5. Important Distinction: Technical Resonance Score vs Layer-1

这里最容易混淆。

### 5.1 DeepSeek / OpenAIAdapter 路径

`deepseek-v3` 走的是：

- `backend/engine/models/openai.py`
- `backend/engine/prompts.py`

它默认使用 `stock_analysis_user_b2.j2`。

该模板默认会注入：

- 技术指标
- 资金流
- 关键位
- `共振评分`

对应模板：

- `backend/templates/prompts/stock_analysis_user_b2.j2`

### 5.2 Layer-1 Prompt Injection Switch

旧 prompt 路径存在一个开关：

- `LAYER1_PROMPT_INJECTION`

对应代码：

- `backend/engine/prompts.py`

默认值是关闭。

因此，对 `deepseek-v3` 这条线上链路，不能简单地认为它默认拿到了 Layer-1 硬约束。

### 5.3 What The Model Actually Saw

当前更稳妥的判断是：

- `deepseek-v3` 一定看到了 `共振评分`
- 但不应默认推断它一定看到了 Layer-1 四状态硬注入

因此，`复核意见` 当前复核的是：

- 量化底座输入（尤其是技术面评分、关键位、结构约束）

而不是严格限定为：

- Layer-1 四状态结论

## 6. Why Rename To “复核意见”

将 `协同观点` 改为 `复核意见` 的原因是：

- `协同观点` 暗示已经存在两套独立主体的真正协同定稿
- 当前实现并没有稳定地产出这种双主体协同摘要
- 当前卡片更像“分析师基于量化底座做出的复核说明”

所以 `复核意见` 更符合现状，也更不容易误导未来维护者。

## 7. Product Judgment

当前版本的判断是：

- 从严格工程语义看，后端还不够纯
- 从用户侧理解看，前端已经基本自洽

因为：

- `独立判断` = 分析师自己的主结论
- `复核意见` = 对量化底座的复核/分歧说明

两者来源不同、语气不同、用途不同，所以在产品体验上已经成立。

## 8. Guardrails For Future Iterations

如果未来继续演进 `AICouncil`，需要遵守以下边界：

1. 如果前端继续使用 `复核意见`，后端不必强行伪造“协同定稿”。
2. 如果未来要重新启用 `协同观点`，必须新增明确的数据层字段，例如：
   - `collab_summary`
   - `review_basis`
   - `review_mode`
3. 不要把“技术面共振评分”与 “Layer-1 四状态”混为同一个输入层。
4. 文档与前端命名必须始终反映真实实现，而不是理想中的架构。

