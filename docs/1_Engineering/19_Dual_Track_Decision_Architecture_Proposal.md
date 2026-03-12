# 19 Dual-Track Decision Architecture Proposal

更新时间：2026-03-13  
状态：Proposal  
定位：将 Layer-1 量化结论与 LLM 原始结论/分析过程同时资产化的双轨决策方案

关联文档：

- [`docs/1_Engineering/13_Quant_Engine_Architecture.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/13_Quant_Engine_Architecture.md)
- [`docs/1_Engineering/17_Investment_Mode_API_Signal_Unification_Plan.md`](/Users/yesun/Code/stockwise/docs/1_Engineering/17_Investment_Mode_API_Signal_Unification_Plan.md)
- [`docs/3_Product/00_Domain_Entities_Glossary.md`](/Users/yesun/Code/stockwise/docs/3_Product/00_Domain_Entities_Glossary.md)
- [`docs/7_Debug_Traces/FOUR_STATE_TASK_LOG_20260313.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/FOUR_STATE_TASK_LOG_20260313.md)

## 1. 背景

当前主链默认采用：

1. Layer-1 先给出量化结论
2. LLM 在 Layer-1 约束下生成解释、战术与报告
3. 若 LLM 原始 `signal` 与 Layer-1 不一致，由主链 enforcement 收口

这个方案保证了稳定性，但也牺牲了一部分信息：

- LLM 自己原始是怎么判断的
- LLM 和 Layer-1 在哪里分歧
- LLM 的推理与战术展开是否具有独立价值

因此，当前系统虽然“最终信号稳定”，但并没有充分利用后台分析资产。

## 2. 核心想法

将当前单一收口结果，拆成三层可并存资产：

1. `B-S`
   - Layer-1 / QuantEngine 的结论
2. `A-S`
   - LLM 的原始结论（未被 Layer-1 覆盖前）
3. `A-L`
   - LLM 的原始分析过程与战术展开

这样，系统不再只有一个“最终答案”，而是同时保留：

- 量化纪律结论
- AI 原始判断
- AI 展开说明

## 3. 目标

本方案的目标不是削弱 Layer-1，也不是把 LLM 放回“随意决定方向”的位置。

目标是：

1. 保留 Layer-1 作为纪律与执行主轴
2. 同时将 LLM 的原始判断与分析过程沉淀为可用资产
3. 为前端提供更丰富的展示可能性
4. 为后台研究提供“分歧分析”的数据基础

## 4. 概念分层

建议统一采用以下命名：

### 4.1 Layer-1 结论

- 字段建议：`layer1_signal`
- 含义：Layer-1 / QuantEngine 给出的结构化主判断
- 当前应等价于：
  - `TriggeredLong`
  - `Watch`
  - `NoSetup`
  - `RiskOff`

### 4.2 LLM 原始结论

- 字段建议：`llm_raw_signal`
- 含义：LLM 原始返回的 `signal`
- 注意：
  - 这不是最终对外主信号
  - 它可能出现旧枚举惯性，如：
    - `Side -> NoSetup`
    - `Long -> TriggeredLong`

### 4.3 LLM 原始分析过程

- 字段建议：`llm_reasoning`
- 含义：LLM 原始输出中的解释、推理、战术、摘要
- 本质：这是高密度内容资产，不应因为最终信号被收口就被埋掉

### 4.4 系统最终主信号

- 字段建议：`canonical_signal`
- 含义：系统最终对外主信号
- 短期建议：
  - 继续以 `layer1_signal` 为准
- 长期可以保留升级空间：
  - 融合决策
  - 分模式决策
  - 分页面展示决策

## 5. Why：为什么值得做

### 5.1 产品价值更高

首页只展示单一主信号，信息密度有限。  
如果后台同时保存 `A-S / A-L / B-S`，则前端可以在不同场景展示不同层次。

例如：

1. 首页卡片
   - 展示 `canonical_signal`
2. 策略内参
   - 展示 `llm_reasoning`
3. 投资决议页
   - 并列展示：
     - `layer1_signal`
     - `llm_raw_signal`
     - `canonical_signal`

### 5.2 后台分析价值最大化

当 `layer1_signal` 与 `llm_raw_signal` 同时存在，后台可以分析：

1. 哪些场景下 LLM 经常和规则分歧
2. 哪些分歧有启发价值
3. 哪些分歧只是旧枚举惯性或模型幻觉
4. 是否值得在未来设计更复杂的融合层

### 5.3 更适合构建“AI + 量化”品牌叙事

这个方案能自然展示：

- 量化规则的纪律性
- AI 的解释能力
- 两者之间的协同与张力

这比只展示单一信号更能体现系统深度。

## 6. 风险

### 6.1 用户认知混乱

如果前端同时展示多个“信号”，但命名含糊，用户会认为系统自相矛盾。

因此前台不能都叫“信号”。

建议采用：

- `量化纪律结论`
- `AI 解读结论`
- `系统执行结论`

### 6.2 误把 LLM 原始值当最终建议

`llm_raw_signal` 只能被视为研究或解释层资产，不能在首页直接替代 `canonical_signal`。

### 6.3 数据模型混乱

如果只是在现有 `signal` 字段上不断 overlay，会导致：

- 字段语义不稳定
- 历史数据难解释
- 前后端各自猜字段含义

所以必须明确分层存储。

## 7. 推荐展示策略

### 7.1 首页 / 列表页

只展示：

- `canonical_signal`

原因：

- 首页强调稳定、一致、低认知负担

### 7.2 策略内参 / Tactical Brief

重点展示：

- `llm_reasoning`

原因：

- LLM 最擅长的本来就是解释、展开、战术表达

### 7.3 投资决议页 / Decision View

并列展示：

- `layer1_signal`
- `llm_raw_signal`
- `canonical_signal`

并用明确标签区分三者角色。

## 8. 数据结构建议

当前阶段采用：

- **不改数据库 schema**
- **复用现有主表与决策 log**
- **在 API 聚合层显式组织双轨视图**

### 8.1 后端概念字段

建议至少在应用层构建以下结构：

```json
{
  "layer1_signal": "NoSetup",
  "llm_raw_signal": "Side",
  "canonical_signal": "NoSetup",
  "llm_reasoning": {
    "signal": "Side",
    "summary": "……",
    "reasoning_trace": []
  }
}
```

### 8.2 Phase 1 实现建议（当前共识）

Phase 1 明确不做以下事情：

1. 不给 `ai_predictions_v2` 新增一组 mode-specific 列
2. 不把 `llm_traces` 作为产品主读取链路
3. 不为了双轨展示先改数据库 schema

Phase 1 直接复用：

1. `ai_predictions_v2`
   - 基础预测快照
   - 当前 `signal`
   - 当前 `layer1_status`
   - 当前 `ai_reasoning`
2. `mode_decision_log`
   - 各 mode 的决策结果

API 层负责把这些字段重新组织成：

- Layer-1 结论视图
- AI 解释视图
- 当前 mode 决策视图

### 8.3 中期建议

中期如果确认产品真的需要把“原始 LLM 结论”作为一等产品字段长期暴露，再考虑是否做 schema 升级。

但那是后续增强，不是当前 Phase 1 前置条件。

## 9. 与当前四状态升级的关系

当前四状态升级已经证明：

1. `canonical_signal` 可以稳定维持四状态
2. `llm_raw_signal` 仍可能存在旧枚举惯性
3. `llm_reasoning` 的内容质量已经高于 raw `signal` 的枚举纯净度

这正好说明双轨方案是有必要的：

- 不要为了追求 raw `signal` 完全纯净，而浪费已经很有价值的 `A-L`
- 应该把 `A-S / A-L / B-S` 同时保留下来

## 10. 分阶段实施建议

### Phase 1：先聚合，不改库

目标：

- 后台把现有 `signal / layer1_status / ai_reasoning / mode_decision_log` 统一组织成双轨视图

特点：

- 不改数据库 schema
- 不动前端主展示
- 风险最低

### Phase 2：内部观察视图

目标：

- 给内部运营/研发做一个简单视图
- 观察：
  - 分歧频率
  - 枚举惯性
  - 内容价值

### Phase 3：深度页展示

目标：

- 在策略内参或投资决议页引入双轨展示

特点：

- 不先改首页
- 先在高信息密度页面试水

### Phase 4：决定是否进一步产品化

根据真实使用情况决定是否：

1. 增加更显式的数据模型字段
2. 增加“规则 vs AI”对照模块
3. 设计更复杂的融合决策逻辑

## 11. 当前建议

当前建议直接采纳以下原则：

1. `layer1_status` 继续作为执行主轴
2. `ai_reasoning` 继续作为核心内容资产
3. mode 结果继续保留在 `mode_decision_log`
4. 前台暂不同时大面积展示多个“信号”，先从 API 聚合与内部视图开始
5. 当前阶段不为此改数据库 schema

一句话：

**当前最值得做的，不是继续把 LLM 完全压进 Layer-1，而是把“量化纪律结论”和“AI 原始判断/解释”同时资产化，让后台分析价值和前端展示价值都最大化。**
