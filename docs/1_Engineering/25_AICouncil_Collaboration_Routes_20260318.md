---
title: "AICouncil：协作线路与独立性审计（2026-03-18）"
doc_id: "engineering-ai-council-collaboration-routes-20260318"
doc_domain: "engineering"
doc_status: "active"
owner: "founder"
last_reviewed_at: "2026-03-19"
summary: "审计 AICouncil 各分析师的协作线路与独立性，是投研决议相关内容的工程事实源。"
---

# AICouncil：协作线路与独立性审计（2026-03-18）

> 本文档是 `24_AICouncil_Review_Opinion_Current_State_20260313.md` 的补充与延伸。
> 重点记录每位分析师在当前实现中的**真实数据管线**、**独立性状态**，以及 Layer-1 覆盖机制的作用范围。

补充口径：

- 上游术语母本见 `docs/0_Strategy/09_Decision_Stack_and_Producer_Architecture.md`
- 本文档重点回答的是 AICouncil 页面里各角色在当前代码中的真实落位，而不是产品对外文案本身

## 0. 先给角色定义

结合 2026-03-25 的统一口径，AICouncil 当前涉及三类角色：

1. `Quant Producer`
   - 如 `Layer-1 / tradeability_v2`、`TrendStrategy`
   - 负责产出规则侧原始判断
2. `AI Producer`
   - 如 `DeepSeek`、`Hunyuan`
   - 负责产出 AI 侧原始判断
3. `Interpreter`
   - 基于量化事实、规则结果或系统主结果做解读和语义转述
   - 当前也主要由 AI 承担

因此，AICouncil 不能被简单理解为“AI 解释量化”。

更准确地说，AICouncil 是：

- 若干 `Producer Outcome`
- 再加若干 `Interpretation Output`

组成的一个投研展示视图。

## 1. 审计结论速查

| 分析师 | 前端标签 | 真实独立性 | 独立性阻断点 | 备注 |
| --- | --- | --- | --- | --- |
| 沈策 × 顾深 | 复核意见 | ❌ 协作 | 设计如此 | 顾深基于量化底座做 `conflict_resolution` |
| 顾深 | 独立判断 | ✅ 有限独立 | `LAYER1_PROMPT_INJECTION` 默认关闭 | prompt 注入了共振评分，但未注入 Layer-1 四状态 |
| 林序 | 独立判断 | ❌ 被覆盖 | `runner.py:334` 全局 Layer-1 enforcement | 前端标签写"独立判断"，但 signal 已被覆盖 |
| 沈策 × 程矩 | 复核意见 | ❌ 双重覆盖 | `rule_based.py` 内部 + `runner.py` 全局 | 两层 Layer-1 对齐，方向完全由 Layer-1 决定 |

## 2. 逐模型数据管线

### 2.1 顾深（DeepSeek V3）

```
数据 → prompts.py → stock_analysis_user_b2.j2 模板
     → 注入：技术指标 + 资金流 + 关键位 + 共振评分
     → LAYER1_PROMPT_INJECTION 开关（默认关闭，不注入四状态）
     → OpenAI Adapter → DeepSeek API → 产出 reasoning JSON
     → runner._enforce_layer1_direction() → 全局 Layer-1 信号覆盖
     → 写入 ai_predictions_v2
```

**独立判断卡片**取值：`llm_reasoning.summary`（AI 原始结论）
**复核意见卡片**取值：`conflict_resolution`（AI 对量化底座输入的对照说明）

顾深的"独立"是有限度的：
- ✅ `LAYER1_PROMPT_INJECTION` 默认关闭，prompt 内不含 Layer-1 四状态硬约束
- ⚠️ prompt 内仍然注入了技术面共振评分，AI 会参考共振评分做判断
- ⚠️ `runner.py:334` 的全局 enforcement 会覆盖最终 `signal` 字段
- ✅ `llm_reasoning` 内的结论文本不受 enforcement 影响，AI 的文字分析保持独立

从统一建模上看：

- 顾深的 `signal / llm_reasoning.summary` 属于 `AI Producer Outcome`
- 顾深的 `conflict_resolution` 属于 `Interpreter Output`

### 2.2 林序（混元 Lite）

```
数据 → prompts.py → 同 stock_analysis_user_b2.j2 模板
     → 注入内容与顾深相同
     → OpenAI Adapter → 混元 Lite API → 产出 reasoning JSON
     → runner._enforce_layer1_direction() → 全局 Layer-1 信号覆盖
     → 写入 ai_predictions_v2
```

林序走的是与顾深**完全相同的代码路径**，区别仅在于调用的 LLM 模型（混元 Lite vs DeepSeek）。

**当前前端展示为"独立判断"，但 signal 字段已被 Layer-1 覆盖。** 文字分析（reasoning 内容）保持 AI 原始输出。

从统一建模上看：

- 林序具备 `AI Producer` 身份
- 但其 `signal` 当前未在主链上完整保留独立性
- `reasoning` 仍保留 `Interpreter` 与 `AI Producer` 的文本资产价值

### 2.3 程矩（Rule Engine）

```
数据 → RuleAdapter.predict()
     → QuantEngine.run("trend") → TrendStrategy.analyze()
         → 独立规则集：MA20 趋势 + RSI 震荡过滤 + 多周期共振
         → 产出 raw_action (Long / Short / Side)
     → _align_signal_with_layer1(raw_action, layer1_status) → 内部 Layer-1 对齐
     → runner._enforce_layer1_direction() → 全局 Layer-1 再次覆盖
     → 写入 ai_predictions_v2
```

程矩有**两层 Layer-1 覆盖**：
1. `rule_based.py:117`：`_align_signal_with_layer1` 将 TrendStrategy 原始信号强制对齐到 Layer-1
2. `runner.py:334`：`_enforce_layer1_direction` 全局再覆盖一次（冗余但存在）

**程矩自己的 TrendStrategy 规则与 Layer-1 的 Tradeability 规则是完全不同的两套规则**（详见第 3 节）。

从统一建模上看：

- `TrendStrategy` 是独立 `Quant Producer`
- 它与 `Layer-1 / tradeability_v2` 是同层关系，不是其子模式
- 当前问题不在于角色不存在，而在于其 `Producer Outcome` 在主链上被覆盖

## 3. 程矩规则 vs Layer-1 规则：对比

| 维度 | 程矩 TrendStrategy | Layer-1 Tradeability |
| --- | --- | --- |
| 代码位置 | `backend/quant/strategies/trend.py` | `backend/engine/layer1_state.py` |
| 输入数据 | 单根日线 + 周线 + 月线 | 最近 21+ 根日线序列 |
| 核心逻辑 | MA20 站上/跌破 + RSI 震荡过滤 + 多周期共振 | VCP 收敛 + 放量突破 + 强势收盘 + 动能拐头 |
| 输出信号 | Long / Short / Side | TriggeredLong / Watch / RiskOff / NoSetup |
| 复杂度 | 简单规则（~90 行） | 多条件评分体系（~520 行） |
| 参数化 | 无外部参数文件 | `strategy_config/tradeability_params_v2.json` + bundle 系统 |

两者**不共享任何逻辑和数据**。程矩本可以产出独立于 Layer-1 的不同信号方向。

## 4. 林序与程矩的关系

在当前实现中，林序（hunyuan-lite）与程矩（rule-engine）之间**没有任何代码层面的关系**：

- 它们在 `runner.py` 中作为独立 task 并行执行（`asyncio.gather`）
- 各自拿到独立的数据上下文，各自产出独立的结果
- 不共享中间结果、不互相引用
- 唯一的交集是：都被同一个 Layer-1 覆盖了方向，且都属于 Free 用户 `allowedModels`

用户可能观察到两者"结论很像"，原因是 Layer-1 归一导致，而非两者之间存在协作。

换句话说，林序与程矩在领域上是两个平行 Producer：

- 林序 = `AI Producer`
- 程矩 = `Quant Producer`

它们的相似，不应被误读为“AI 和规则是一套东西”，而是当前主链裁决口径过强导致的结果收敛。

## 5. 前端协作线路（`buildCouncilCards()`）

当前 `AICouncil.tsx` 中 `buildCouncilCards()` 构建 4 张卡片：

| 序号 | 卡片 key | 标签 | 数据来源 |
| --- | --- | --- | --- |
| 1 | `shen-ce-gu-shen-collab` | 沈策 × 顾深 · 复核意见 | `buildCollabSummary(deepseekPred)` |
| 2 | `gu-shen-independent` | 顾深 · 独立判断 | `getCouncilSummary(deepseekPred.llm_reasoning)` |
| 3 | `lin-xu-independent` | 林序 · 独立判断 | `getCouncilSummary(linxuPred.llm_reasoning)` |
| 4 | `shen-ce-cheng-ju-rule` | 沈策 × 程矩 · 复核意见 | `buildRuleSummary(rulePred)` |

### 当前 PRO/Free 在 AICouncil 中的门控

- **API 层**：`predictions/route.ts` 在 `mode=full`（AICouncil 使用）时**不应用**  `tierFilter`，所有模型的预测都会返回
- **前端层**：`AICouncil.tsx` **没有** tier 感知，所有用户看到相同的 4 张卡片
- **整体结论**：当前 PRO/Free 在投研决议面板中**没有差异化体验**

## 6. 待决事项

> 以下为 2026-03-18 讨论中产生的演进思路，尚未确定是否执行。

1. **是否解除程矩的 Layer-1 绑定**：让 TrendStrategy 的 `raw_action` 直接作为最终信号，恢复程矩独立性
2. **是否为林序新增复核意见卡片**：类似"沈策 × 林序 | 复核意见"
3. **是否在后端 runner 层面也为林序豁免 Layer-1 enforcement**（使林序的"独立判断"名副其实），还是仅在前端展示层面用 `llm_signal` 渲染
4. **PRO/Free 卡片分级**：PRO 看 5 张（顾深线 2 张 + 林序线 2 张 + 程矩 1 张），Free 看 3 张（林序线 2 张 + 程矩 1 张）
