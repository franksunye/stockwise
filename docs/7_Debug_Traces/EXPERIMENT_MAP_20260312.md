# Prompt 实验全貌地图（2026-03-12）

## 1. 这组实验到底在回答什么

`docs/7_Debug_Traces/` 这一专项不是在随意调 prompt，而是在系统回答 4 个问题：

1. 旧版生产 prompt 为什么又重又不稳？
2. 如果把静态契约上移到 system prompt，能不能显著降 token？
3. 输入数据应该给“原始多周期表格”，还是给“蒸馏后的趋势叙述”？
4. Layer-1 / Layer-2 的动作语义，到底应该继续用三态，还是升级为四态？

因此，目录里的不同版本不是平行备选模板，而是围绕不同假设设计的实验分支。

## 2. 实验对象总表

| 版本 | 文件 | 核心目标 | 主要改动 | 主要测试问题 |
|---|---|---|---|---|
| Baseline | `Baseline_Old_System.md` + `Baseline_Old_User.md` | 还原线上旧版 | 大量 schema 约束、长表格、三态语义、user 尾部硬约束 | 旧版到底有多重、多冗余 |
| B1 | `Shared_Optimized_System.md` + `B1_Minimal_User.md` | 测最小输入可不可用 | 保留优化 system，user 只给核心数据 | 少数据是否足够支撑可靠结论 |
| B2 | `Shared_Optimized_System.md` + `B2_Rich_User.md` | 测丰富输入的上限 | XML 化 rich data，多周期表格、历史预测、L1 约束 | 多周期信息是否带来更深层判断 |
| B2 No L1 | `Shared_Optimized_System.md` + `B2_No_L1_User.md` | 测 L1 的必要性 | 与 B2 基本相同，但移除 L1 硬约束 | 没有 L1 时模型是否会漂移 |
| B3 | `B3_Adversarial_System.md` + `B3_Distilled_User.md` | 测逻辑蒸馏路线 | 用 narrative 代替大表，system 强制红蓝博弈 | 蒸馏输入能否更快、更聪明 |
| B4 初版 | `B4_FourState_System.md` + `B2_Rich_User.md` | 测四状态语义直觉效果 | 让 signal 从三态变四态 | 四状态是否更贴近产品动作语义 |
| B4 Strict | `B4_STRICT_SYSTEM.md` + `B2_Rich_User.md` | 做公平对比 | 四状态，但结构约束密度与 B2 对齐 | 四状态的收益来自语义，还是来自 prompt 密度差异 |

## 3. 各版本的设计意图

### 3.1 Baseline

定位：线上旧版生产 prompt 的**文本对照组**。

特征：

- system prompt 很长，承担了 persona、schema、输出要求、文本约束。
- user prompt 也很长，包含完整多周期表格和大量尾部验证规则。
- 使用三态：`Long / Short / Side`。
- Layer-1 被压缩成 `Long / Side` 的老表达方式。

需要特别注意：

- `Baseline_Old_System.md` + `Baseline_Old_User.md` 代表的是**线上旧版 prompt 文本**。
- 但当前目录下的实验脚本默认使用的是 `gemini_local` 做重放。
- 因此，`baseline_old` 在实验中是“生产 prompt 文本基线”，**不是线上 DeepSeek 生产稳定性本身的直接复刻**。

它的作用不是“候选方案”，而是基线标尺：

- token 有多高
- latency 有多慢
- 输出结构是否稳

### 3.2 B1

定位：最小输入版。

特征：

- 继续使用优化后的共享 system prompt。
- user prompt 只保留最小必要信息：
  - 基础 meta
  - 最近 5 日价格行为
  - 核心技术指标
  - L1 约束

它主要在测试：

- 如果 system prompt 足够强，少量高价值数据是否足够让模型产出可靠结果。

当前理解：

- B1 是“成本效率优先”的路线。
- 它不是为了最深分析，而是为了验证“最少上下文能否成立”。

### 3.3 B2

定位：丰富输入版，也是当前研究里最接近“主候选”的路线。

特征：

- 使用共享优化 system prompt。
- user prompt 用 XML 风格分块。
- 给出：
  - 日线表
  - 周线表
  - 月线表
  - AI 历史预测
  - 技术指标
  - L1 约束

它主要在测试：

- richer context 是否能带来更强的多周期判断和更好的战术细节。

当前理解：

- B2 是“质量优先”的路线。
- 它假设模型需要较完整的上下文，才能做出更有层次的交易解释。

### 3.4 B2 No L1

定位：B2 的对照实验。

特征：

- 与 B2 基本一致。
- 只去掉 `layer1_hard_constraints`。

它主要在测试：

- L1 硬约束到底是不是冗余重复。

当前理解：

- 这是整个目录里最重要的安全实验之一。
- 它不在测“表达风格”，而是在测系统有没有方向越权风险。

### 3.5 B3

定位：逻辑蒸馏版。

特征：

- user prompt 不再给大表，而是给 narrative：
  - 日线趋势结论
  - 周月线结论
  - 资金博弈结论
  - AI 历史反思
- system prompt 强制执行“红蓝博弈”。

它主要在测试：

- 如果先由人或后端把 raw data 蒸馏成高密度叙述，模型是否能更快、更深地推理。

当前理解：

- B3 是“信息蒸馏优先”的路线。
- 它的真正价值不在于 narrative 本身，而在于验证“预摘要输入”是否值得做成后端能力。

### 3.6 B4 初版

定位：四状态语义的第一版验证。

特征：

- 核心改动不是数据，而是 signal 语义：
  - `TriggeredLong`
  - `Watch`
  - `RiskOff`
  - `NoSetup`

它主要在测试：

- 三态是不是太粗，导致模型明明看到 `RiskOff`，却只能输出 `Side`。

当前理解：

- B4 初版更像“语义方向验证”，不是可上线模板。
- 它证明的是四状态有没有表达价值，而不是结构上是否已经成熟。

### 3.7 B4 Strict

定位：四状态的公平对比版。

特征：

- 仍是四状态语义。
- 但在结构约束密度上尽量与 B2 对齐。

它主要在测试：

- 四状态带来的收益，究竟来自“语义本身”，还是来自“你顺便把 prompt 也写得更紧”。

当前理解：

- 这是 B4 系列里最有方法论价值的一版。
- 它把“语义收益”和“提示词密度收益”尽量拆开了。

## 4. 目录里的主要实验脚本分别做什么

### 4.1 `prompt_benchmarker.py`

作用：

- 一次性对比 4 组场景：
  - 旧 baseline
  - B1
  - B2
  - B3

主要产出：

- `results/Four_Way_Benchmark_Results.json`

它回答的问题：

- 不同输入形态的 token / latency / 输出形态差异。

### 4.2 `test_layer1_impact.py`

作用：

- 对比 B2 有 L1 与无 L1。

主要产出：

- `results/Layer1_Constraint_Test.json`

它回答的问题：

- 没有 Layer-1 时，模型是否仍会守住产品动作边界。

### 4.3 `test_four_states.py`

作用：

- 对比三态 vs 四态的直观效果。

主要产出：

- `results/Four_State_Semantics_Comparison.json`

它回答的问题：

- 四状态是否能让模型更自然地说出 `RiskOff` 等动作语言。

### 4.4 `fair_test_four_states.py`

作用：

- 做三态 vs 四态的控制变量实验。

主要产出：

- `results/FAIR_3_VS_4_STATES_COMPARISON.json`

它回答的问题：

- 四状态的收益是否在公平条件下依然成立。

## 5. 当前已验证的结论

### 5.1 可以认为已经较稳的结论

1. Baseline 确实过重。
2. Schema 上移和输入结构化是正确方向。
3. Layer-1 硬约束是必要安全阀。
4. 四状态语义更贴近产品动作语言。

### 5.2 只能算“部分成立”的结论

1. B2 比 B1 更好。
   - 目前只能说 B2 更丰富，不等于已被证明整体更优。
2. 四状态更省 token。
   - 普通对比可能成立，公平对比不成立。

### 5.3 当前不成立或证据不足的结论

1. B3 是极致速度最优解。
2. B3 已经适合直接上生产。

## 6. 一张图看懂版本关系

可以把这几条路线理解成 3 个维度的组合实验：

### 维度 A：输入密度

- Baseline：超重
- B1：极简
- B2：丰富
- B3：蒸馏

### 维度 B：语义体系

- Baseline / B1 / B2 / B3：三态
- B4：四态

### 维度 C：系统约束强度

- Baseline：旧式、分散
- Shared Optimized：统一上移
- B4 Strict：四态且高强度对齐

所以：

- `B1 vs B2` 主要是在比输入多寡。
- `B2 vs B2 No L1` 主要是在比安全阀。
- `B2 vs B4` 主要是在比语义体系。
- `B2 vs B4 Strict` 主要是在比语义体系的净收益。
- `B2 vs B3` 主要是在比 raw tables 和 distilled narrative。

## 7. 现在应该怎么读这个目录

如果你要快速理解全貌，建议顺序如下：

1. 先看 [`0_Handover_Report.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/0_Handover_Report.md)
   - 了解原作者怎么定义这轮研究。
2. 再看 [`RERUN_AUDIT_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/RERUN_AUDIT_20260312.md)
   - 了解哪些旧结论被复跑支持，哪些需要收口。
3. 再看 `prompts/`
   - 带着“每个版本想验证什么”的问题去看，不要把它们当普通模板。
4. 最后看 `results/`
   - 用结果验证假设，不反过来从结果猜实验目的。

额外提醒：

- `results/Raw_Production_Response.json` 是线上真实生产输出样本。
- `scripts/*.py` 跑出来的 `baseline_old` 是用本地 `gemini_local` 对同款 prompt 文本做的离线重放。
- 这两者不能混用来判断“线上 DeepSeek 是否稳定”。

## 8. 当前专项的正确推进方式

这一组实验的下一步，不应该是继续盲目新增 `B5/B6`。

更合理的是：

1. 把当前各版本的目标和结论固定下来。
2. 为多 case 建立统一评估框架。
3. 再决定哪一条路线值得继续深化：
   - B1：极简高效
   - B2：丰富稳健
   - B3：后端蒸馏
   - B4：四状态语义升级

## 9. 一句话总结

这套实验的全貌可以概括为：

**Baseline 是问题原型，B1/B2/B3 在探索“输入应该多还是应该精”，B2 No L1 在验证安全阀价值，B4/B4 Strict 在验证“产品动作语义是否应该升级到四状态”。**
