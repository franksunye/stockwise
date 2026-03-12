# 独立审查意见（Codex）

日期：2026-03-12

## 1. 我对这个目录工作的理解

`docs/7_Debug_Traces/` 已经不是单纯的“问题记录”，而是一套较完整的 Prompt 实验工作区，包含四部分：

1. `prompts/`：保存线上基线、优化版 system prompt、不同 user prompt 形态，以及四状态实验模板。
2. `results/`：保存单 case 基准结果、Layer-1 影响测试、三态/四态公平比较、样本响应。
3. `scripts/`：提供可重复运行的实验脚本，而不是手工复制粘贴对比。
4. 顶层说明文档：将这轮实验的结论汇总为 prompt engineering 的中间结论。

这套工作的核心目标并不是“把某次回答改漂亮”，而是：

- 降低生产 prompt 的 token 成本与时延。
- 提高 JSON 结构稳定性。
- 让 Layer-1 与 Layer-2 的职责边界更清晰。
- 让模型输出更符合 StockWise 的真实动作语义，而不是泛化的涨跌判断。

这个方向本身是对的，而且比常见的“只调 wording”要成熟很多。

## 2. 我的独立判断

### 2.1 当前最大的价值，不在 prompt 文案本身，而在“研究结论尚未进入主链”

本地代码核对后，我认为当前最重要的事实不是实验结论对不对，而是它们与生产链路仍然存在明显脱节：

- `backend/templates/prompts/stock_analysis_system.j2` 仍是旧式三态 schema 和大段文本约束。
- `backend/templates/prompts/stock_analysis_user.j2` 仍是 Markdown 表格主导，没有采用实验目录主推的 XML 结构化输入。
- `backend/engine/prompts.py` 在审查当时仍保留 `as_of_date` 即进入“回填模式”的旧逻辑；该问题现已进入第一轮修复。
- `backend/engine/prompts.py` 仍把 `RiskOff / Watch / NoSetup` 全部压扁成 `Side`，只保留 `TriggeredLong -> Long`。

所以，这个目录目前更像“研究轨道已经领先，生产轨道还没跟上”。

### 2.2 这轮实验最大的真发现，不是“B4 更聪明”，而是“语义对齐减少了解释摩擦”

`results/FAIR_3_VS_4_STATES_COMPARISON.json` 和 `results/Four_State_Semantics_Comparison.json` 显示，四状态语义不是单纯改名。

我更认同的解释是：

- 三态下，模型被迫把 `RiskOff / Watch / NoSetup` 都挤进 `Side`，会产生额外解释负担。
- 四态下，标签本身已经带有动作语义，模型不需要再用大段 reasoning 去解释“为什么虽然很危险但我还只能写 Side”。
- 这就是为什么四态结果往往同时带来更短输出、更高一致性、更少废话。

换句话说，这不是“prompt 技巧的胜利”，而是“产品语义模型终于和量化状态机对齐”。

### 2.3 现在继续深挖 prompt A/B 的边际收益已经变低，下一步应该升级约束层

你们现在还主要依赖：

- system prompt 里写一大段 JSON 契约
- user prompt 里重复强调字段要求
- 事后靠 `schema_normalizer.py` 修修补补

这条路可以继续优化，但边际收益已经在下降。原因很直接：

- 模型仍可能给出“结构合法但业务语义错”的结果。
- 研究结果里已经出现过 `tactics` 从数组退化成字符串的情况。
- `schema_normalizer.py` 虽然能兜底，但它是在“补坏输出”，不是在“阻止坏输出产生”。

我的结论是：你们下一阶段应该从“prompt-first”转向“schema-first”。

## 3. 我认为最重要的 7 个问题

### 3.1 P0：生产链仍保留错误的回填语义

审查时的 `backend/engine/prompts.py` 逻辑是：只要传 `as_of_date`，就写“请假装今天是 ...”。这会污染当天真实生产分析的上下文语气。

这不是措辞问题，是上下文真实性问题。对交易型任务，模型是否认为自己在“回测”还是“实时”，会影响风险语言和执行语气。

建议：

- 保留 `as_of_date` 作为分析基准日参数，但统一改为“历史复盘模式”文案。
- 若 `as_of_date == 当天数据日期`，明确写“实时分析”。
- 这个修复优先级应高于继续改 prompt 文风。

### 3.2 P0：四状态已经存在于系统内部，但主提示链仍在三态压缩

本地代码显示：

- Layer-1 状态机、数据库字段、指标统计、测试中已经广泛使用 `NoSetup / Watch / TriggeredLong / RiskOff`。
- 但 `prepare_stock_analysis_prompt()` 仍然将除 `TriggeredLong` 外全部压缩为 `Side`。

这会造成两个后果：

- 研究侧在做四状态实验，生产侧却持续把高分辨率状态降采样。
- 你们在产品、文档、评估、前端口径上说“四状态”，但 LLM 主输入仍被迫用三态表述。

建议：

- 把四状态作为 Layer-2 输入的原生枚举。
- 若前台或老表仍需要三态，做展示层兼容，不要在 prompt 入口处就降级。

### 3.3 P0：当前最该做的是接入“原生结构化输出”，不是继续堆 JSON 文字要求

本地 `backend/engine/llm_client.py` 目前还只是普通文本生成调用，没有把 JSON Schema 作为 API 层约束下发。

这意味着：

- 你们把大量 token 花在“请输出合法 JSON”上。
- 结构不稳时还要靠 normalizer 做修复。
- 研究中所有“格式稳定性改进”都还停留在 prompt 文本层。

外部官方文档已经给出更强的做法：

- OpenAI Structured Outputs 支持直接提供 JSON Schema，并可 `strict: true`。
- Gemini Structured Outputs 支持 `response_mime_type=application/json` 与 `response_json_schema`。

这会比“多写几条必须输出纯 JSON”更接近工程解法。

建议：

1. 为 StockWise 预测结果定义单一 JSON Schema。
2. 在 `LLMClient` 增加 provider 级 structured output 能力开关。
3. 先在 `gemini_local` 链路尝试 schema 约束，再保留 normalizer 作为最后兜底。

### 3.4 P1：实验脚本的“方法论强度”仍不足以支持模板晋升

目前目录里的 benchmark 有价值，但还不够像真正的 release gate。

我看到的问题：

- 绝大多数结论仍来自单一股票单一日期样本。
- 有脚本出现 `429 / no capacity`，导致对比结果不完整。
- 结果评估偏重 token、延迟和主观可读性，缺少统一的“结构得分 / 业务得分 / 方向一致性得分”。

建议：

- 扩展到最少 30-50 个 case。
- 覆盖 4 种典型状态：TriggeredLong / Watch / RiskOff / NoSetup。
- 固化评估维度：
  - JSON 解析成功率
  - tactics 契约达标率
  - key_levels 合法率
  - Layer-1 一致率
  - 平均输入/输出 token
  - 平均时延
  - 人工抽检质量分

没有这个 eval 框架，B2/B3/B4 的结论仍偏研究感，而不是上线依据。

### 3.5 P1：B3“逻辑蒸馏”方向值得做，但必须由后端生成，而不是人工写 narrative

我同意目录里的一个核心判断：蒸馏后的 narrative 可能比原始大表更高效。

但我不建议把 B3 直接理解为“以后让人先写摘要再喂模型”。那样不可审计，也不可扩展。

正确方向应该是：

- 后端先从多周期行情和资金流中提取结构化事实。
- 再由 deterministic summarizer 生成受控 narrative 块。
- narrative 作为补充层，不替代原始关键价位和指标层。

也就是说，B3 的本质价值不是“用自然语言替代数据”，而是“让后端先做一层事实蒸馏，再交给模型做解释”。

### 3.6 P1：`schema_normalizer.py` 是资产，但现在职责过重

我认可这个文件的存在价值，因为它确实在兜底一些现实世界的脏输出。

但它当前暴露出一个信号：上游结构控制还不够强。

如果系统长期依赖 normalizer 去补：

- tactics 数量
- key_levels 长度
- 缺失字段
- 价格顺序

那说明 schema 约束被放错层了。

建议：

- 保留 normalizer，但把目标从“经常修”改成“偶尔兜底”。
- 为 normalizer 增加质量指标上报，把“修复率”作为 prompt/template 退化监控。

### 3.7 P2：当前 user prompt 里历史 AI 预测回顾，可能正在引入不必要的行为偏置

`stock_analysis_user.j2` 会把近 5 次 AI 历史预测与准确率直接喂给模型。

这有潜在收益，但也有风险：

- 好处：模型会修正自身过度乐观或过度悲观的惯性。
- 风险：模型可能过拟合“最近自己老错”，转而变得过度保守。

尤其在交易任务里，模型不应该对“自己前几次错了”产生情绪补偿。

建议：

- 历史预测回顾作为实验变量保留，而不是默认长期固定。
- 单独做一次 ablation：
  - 有 AI history
  - 无 AI history
  - 只保留“错误模式摘要”，不保留原始预测表

我怀疑第三种会更优。

## 4. 我建议的落地顺序

### 第一阶段：先修主链错位

1. 修复 `as_of_date` 的“回填模式”误触发。
2. 把四状态从 Layer-1 注入到主 prompt 链，而不是压扁成 `Side`。
3. 把 `docs/7_Debug_Traces/prompts/Shared_Optimized_System.md` 的核心约束迁移到正式模板。

### 第二阶段：再做工程化约束升级

1. 在 `LLMClient` 增加 structured output 支持。
2. 产出唯一的预测结果 JSON Schema。
3. 让 `schema_normalizer.py` 退回到“兜底层”。

### 第三阶段：建立真正的晋升机制

1. 把 `docs/7_Debug_Traces/scripts/` 升级为多样本 eval runner。
2. 增加 case manifest。
3. 设定 promotion gate，模板变更必须附带新旧分数对比。

## 5. 我不建议现在做的事情

- 不建议继续投入大量时间优化“中英文混写美感”。
- 不建议先做 prompt 文风美化或人格设定升级。
- 不建议在生产前直接押注 B3 narrative-only 路线。
- 不建议继续让实验目录和正式模板长期分叉。

这些都不是当前收益最大的点。

## 6. 结论

这轮工作方向是正确的，而且质量明显高于普通 prompt 调整。

但我的独立结论是：

- 你们已经基本完成了“研究证明”。
- 现在真正缺的是“生产落地”和“评估制度化”。

如果只继续在 `docs/7_Debug_Traces/` 内做更漂亮的 prompt 版本，收益会越来越低。

最值得做的下一步，不是再写一个 B5，而是把三件事真正落地：

1. 修复主链中的回填语义和三态压缩。
2. 引入原生 structured outputs。
3. 用多样本 eval 取代单 case 论证。

## 7. 外部参考

以下外部资料是我在形成上述意见时参考的官方文档：

- OpenAI Structured Outputs：
  https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI Prompt Caching：
  https://developers.openai.com/api/docs/guides/prompt-caching
- Anthropic Prompting Best Practices（XML tags）：
  https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices#structure-prompts-with-xml-tags
- Gemini Structured Output：
  https://ai.google.dev/gemini-api/docs/structured-output

这些资料支持了几个关键判断：

- 静态前缀前置有明确缓存收益。
- XML 标签对复杂 prompt 边界管理有明确价值。
- JSON Schema 级约束比纯文本“输出纯 JSON”更接近工程解法。
- 即便启用 structured output，业务侧仍必须做二次校验。
