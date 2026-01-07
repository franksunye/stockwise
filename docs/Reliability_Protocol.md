# StockWise AI Reliability Protocol (可信度保障协议)

## 核心问题
**"我们如何确保 LLM 生成的日报是可信赖、可靠的？"**

信任是金融产品的基石。如果 AI "一本正经地胡说八道" (Hallucination)，用户将瞬间流失。
为了解决这个问题，我们设计了 **"三层防护架构" (The 3-Layer Defense Architecture)**。

---

## 第一层：职能隔离 (Separation of Concerns)

我们将 AI 分为两个完全不同的角色，严禁越权。

### 1. The Analyst (分析师 - 负责产出数据)
*   **模型**: `DeepSeek-Reasoning` / `Gemini-Pro`
*   **任务**: 看着原始数据 (K线、RSI、新闻)，进行复杂的逻辑推理，产出结构化的结论 (Signal: Long, Confidence: 80%, Reason: "RSI Divergence").
*   **可靠性来源**: 这一步是 "重型计算"，我们在数据库中保存了它的原始推理过程 (`ai_reasoning` 字段)。

### 2. The Reporter (记者 - 负责撰写文案)
*   **模型**: `Gemini-Flash` (快速、廉价)
*   **任务**: **它不被允许做分析。** 它的唯一任务是把 Analysis 的结论翻译成"人话"。
*   **Prompt 约束**: "You are a reporter. Inputs are [Signal: Long, Reason: RSI Divergence]. write a brief. **Do NOT add any outside information.**"
*   **比喻**: 厨师 (Analyst) 负责做菜，服务员 (Reporter) 只负责报菜名。服务员绝对不能自己进厨房加盐。

**结论**: 日报的观点 **100% 继承自** 经过验证的数据库记录，生成日报的过程仅仅是 "格式转换"，极大降低了幻觉风险。

---

## 第二层：数据锚定 (Data Grounding)

我们在 Prompt 中使用 **"Fact-Checking Injection" (事实注入)** 技术。

当生成日报时，我们不仅仅给 LLM 文本，我们强制注入**硬指标**：

```json
{
  "symbol": "Tencent",
  "hard_facts": {
    "price": 400.2,
    "change": "+2.5%",
    "rsi": 72
  },
  "analyst_opinion": "Overbought risk."
}
```

**系统指令 (System Prompt)**:
> *"Every claim you make must be backed by the 'hard_facts' provided. If you say 'Price surged', verify that 'change' is positive. If you cannot find the data in the input, do not mention it."*

如果 LLM 试图写 "腾讯发布了新游戏" (但输入里没有)，Prompt 规则会强行抑制这种生成。

---

## 第三层：链接溯源 (Traceability)

即使做到了前两点，我们也必须给予用户**"验证权"**。

*   **UI 设计**: 日报卡片不是终点。
*   **交互**: 每一句 "AI 认为..." 的文字后面，都必须有一个显眼的 **[查看图表]** 或 **[查看推理原文]** 按钮。
*   **心理学**: 当用户知道"我可以随时查证原始数据"时，他们反而会更信任摘要。

---

## 技术实现路线图

1.  **Snapshotting (快照)**: 在生成日报前，先固化 (Freeze) 所有 Input Data。
2.  **Deterministic Ops**: 设置 LLM 的 `temperature = 0.2` (低创造性，高准确性)。
3.  **Sanity Check (卫兵脚本)**: 在后端增加一个简单的 Regex 脚本。
    *   *Check*: 如果 Input Signal 是 `Short`，但 Output 文本包含 "Buy" / "Bullish"，直接丢弃并告警。

通过这一套协议，我们将 "AI 创作" 的不确定性，限制在了 "文风" 层面，而将 "事实" 和 "观点" 牢牢锁定在数据库的结构化记录中。
