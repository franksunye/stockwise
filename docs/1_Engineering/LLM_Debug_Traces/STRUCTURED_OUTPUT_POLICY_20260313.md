# Structured Output 策略原则（2026-03-13）

## 1. 结论先行

在当前 StockWise 的跨模型架构里，**structured output 不是必须项，而是按 provider 能力分层启用的增强项**。

因此，后续实现必须遵守以下总原则：

- **跨模型统一底座仍然是：`prompt -> raw text -> parser -> normalizer`**
- **structured output 只作为“支持时启用”的增强层**
- **不允许为了追求 schema 约束，而破坏 DeepSeek 等主模型的稳定响应**

## 2. 为什么不是“必须”

当前系统已经有一条可工作的通用链路：

1. prompt 约束输出结构
2. parser 提取 JSON
3. normalizer 修复边缘不一致

这条链虽然不完美，但具备两个关键优点：

- 能跨不同 LLM 复用
- 不依赖某一家供应商的特定 API 能力

如果把 structured output 直接提升为“必须”，会立刻带来两个风险：

1. 供应商能力不一致，主链行为会分裂
2. 某些模型（尤其 DeepSeek）在强制 JSON 模式下可能更不稳定

## 3. Provider 分层原则

### 3.1 Gemini

定位：

- **适合优先尝试 structured output**

原因：

- Gemini 官方支持 `response_mime_type=application/json`
- 同时支持 `response_json_schema`
- 本地 `gemini_local` 是当前最适合做低成本实验的链路

因此：

- Gemini 可作为 **schema-first optional path**
- 但不能替代通用 parser/normalizer

### 3.2 OpenAI 兼容链

定位：

- **理论上最适合 structured outputs**

原因：

- OpenAI 官方支持 `json_schema` + `strict: true`
- schema 约束能力最强

因此：

- 若未来需要接入 OpenAI 官方严格 schema，可单独做 provider 级支持
- 但不能把这套能力倒逼到 DeepSeek 链路

### 3.3 DeepSeek

定位：

- **当前不应强推 structured output**

原因：

- DeepSeek 当前更明确支持的是 `response_format={"type":"json_object"}`
- 这更接近“返回 JSON 对象文本”，而不是严格 schema 约束
- 官方文档也明确提示：
  - 需要 prompt 内含 `json`
  - 需要显式引导
  - 某些情况下可能出现空内容

专项内历史经验也已经表明：

- 为了减少解析错误而对 DeepSeek 强加 JSON 请求参数，曾导致响应质量或稳定性恶化

因此：

- **DeepSeek 默认继续使用 prompt-first + parser fallback**
- 不把 `json_object` 模式作为默认生产策略
- 若要测试，必须是单独实验，不得直接主链默认开启

## 4. 工程策略

后续实现应明确分三层：

### Layer A：Canonical Path

所有模型统一保留：

- prompt 输出约束
- parser
- normalizer

这是系统的**规范主路径**。

### Layer B：Provider Capability

按模型能力可选增加：

- Gemini：`response_json_schema`
- OpenAI：`json_schema` / strict outputs
- DeepSeek：默认不开启，最多实验性支持 `json_object`

这是**增强路径**，不是主路径。

### Layer C：Fallback Guarantee

无论 structured output 是否启用，只要模型返回了文本，就必须能够退回：

- JSON block extract
- parser
- normalizer

也就是说：

- **fallback 不能被删除**
- **structured output 不能成为单点依赖**

## 5. 当前专项的正式决策

从 2026-03-13 起，本专项关于 structured output 的默认立场固定为：

1. **先不把 structured output 作为跨模型统一要求**
2. **若要实现，优先只在 `gemini_local` 做可开关实验**
3. **DeepSeek 主链默认不启用强制 JSON 请求参数**
4. **parser / normalizer 继续作为跨 provider 的规范底座**

## 6. 一句话版本

**Gemini 可以 schema-first 试点，DeepSeek 保持 prompt-first，跨模型兼容仍以 parser/normalizer 为准。**
