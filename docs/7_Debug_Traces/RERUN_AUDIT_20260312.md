# 实验复跑与旧结论审计（2026-03-12）

## 范围

本次审计接手并复跑了 `docs/7_Debug_Traces/scripts/` 下全部 4 个实验脚本：

1. `prompt_benchmarker.py`
2. `test_layer1_impact.py`
3. `test_four_states.py`
4. `fair_test_four_states.py`

所有运行日志均已保存在 `results/run_logs/`，并对本次结果做了时间戳备份：

- `results/Four_Way_Benchmark_Results.rerun_20260312.json`
- `results/Layer1_Constraint_Test.rerun_20260312.json`
- `results/Layer1_Constraint_Test.retry_success_20260312.json`
- `results/Four_State_Semantics_Comparison.rerun_20260312.json`
- `results/FAIR_3_VS_4_STATES_COMPARISON.rerun_20260312.json`

## 运行情况

### 1. 实验完整性

- `prompt_benchmarker.py`：一次成功。
- `test_four_states.py`：一次成功。
- `fair_test_four_states.py`：一次成功。
- `test_layer1_impact.py`：第一次因 Gemini 容量耗尽，`B2_WITHOUT_L1` 返回 `429/503`；第二次补跑成功。

结论：本轮实验已完整复现全部 4 个脚本和全部核心场景。

### 2. 实验环境说明

- Provider：`gemini_local`
- Model：`gemini-3-flash`
- Base URL：`http://127.0.0.1:8045`
- Python：`.venv/bin/python`

### 3. 口径边界说明

本报告中的复跑结果，默认都是：

- 使用当前目录中的 prompt 文本资产
- 在本地 `gemini_local` 环境下重放

因此必须明确区分：

1. **线上真实 baseline**
   - 是 DeepSeek 生产链路
   - 可参考 [`results/Raw_Production_Response.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/Raw_Production_Response.json)

2. **本报告中的 `baseline_old`**
   - 是线上旧版 prompt 文本的离线重放对照组
   - 但执行模型是本地 Gemini，不是线上 DeepSeek

所以本报告里的 parse / latency / token 结论，用于评估：

- prompt 文本实验路线
- 本地 Gemini 重放表现

不应用来直接否定“线上 DeepSeek baseline 已经稳定”的事实。

说明：由于上游 Gemini 容量会波动，单次 token / latency 存在自然抖动；本次审计更重视“方向性结论是否稳定”，不把单次绝对数值当成严格常数。

## 复跑结果摘要

### A. 四方基准 (`Four_Way_Benchmark_Results.json`)

| 场景 | total_tokens | latency | 结构备注 |
|---|---:|---:|---|
| OLD_BASELINE | 11267 | 22.87s | 结构完整 |
| B1_MINIMAL_FEATURES | 4189 | 14.90s | 结构完整 |
| B2_RICH_TABLES | 6106 | 17.70s | 结构完整 |
| B3_LOGIC_DISTILLED | 4227 | 16.92s | `tactics` 退化为字符串 |

观察：

- Baseline 最重，这个结论稳定。
- B1 与 B3 都明显比 Baseline 轻。
- B1 比 B3 更省 token、也更快。
- B3 输出结构再次失稳，说明它的速度优势不能单独看。

### B. Layer-1 影响测试 (`Layer1_Constraint_Test.json`)

| 场景 | signal | confidence | total_tokens | latency |
|---|---|---:|---:|---:|
| B2_WITH_L1 | `Side` | 0.35 | 6178 | 18.95s |
| B2_WITHOUT_L1 | `Short/Wait` | 0.85 | 6114 | 19.20s |

观察：

- 去掉 L1 后，模型不但显著提高信心，还直接漂移出既定信号枚举，产出 `Short/Wait`。
- 保留 L1 时，结论被压回 `Side`，并保持低置信度、防守式语气。
- 这说明 L1 不只是“提醒”，而是显著影响动作语义与风险姿态的安全阀。

### C. 三态 vs 四态（普通对比，`Four_State_Semantics_Comparison.json`）

| 场景 | signal | total_tokens | latency | 结构备注 |
|---|---|---:|---:|---|
| B2_LEGACY_3_STATES | `Side` | 6499 | 20.69s | 结构完整 |
| B4_NEW_4_STATES | `RiskOff` | 4514 | 12.63s | `tactics` 退化为对象，非数组 |

观察：

- 四状态语义确实更容易让模型给出 `RiskOff`，不再被 `Side` 语义束缚。
- 但这个版本的 B4 结构不稳定，不能直接视为生产可用方案。

### D. 三态 vs 四态（公平对比，`FAIR_3_VS_4_STATES_COMPARISON.json`）

| 场景 | signal | valid_structure | total_tokens | latency |
|---|---|---|---:|---:|
| B2_OPTIMIZED_3_STATES | `Side` | true | 5477 | 14.69s |
| B4_STRICT_4_STATES | `RiskOff` | true | 5844 | 18.41s |

观察：

- 在“结构约束密度对齐”的公平对比下，四状态版本仍能更自然地产出 `RiskOff`。
- 但它并没有在本次复跑中带来更低 token 或更低 latency。
- 也就是说，“四状态语义更贴近产品动作语言”成立，但“因此更省成本”在这次公平实验里不成立。

## 对旧报告结论的逐条审计

审计对象：

- `0_Handover_Report.md`
- `PROMPT_AUDIT_20260312.md`

### 结论 1：Baseline 存在严重 token 冗余，优化版能显著降本

判定：**成立**

依据：

- Baseline `11267` tokens。
- B1 `4189`、B2 `6106`、B3 `4227`。

这条结论在复跑后仍非常稳。即便数值较旧结果有波动，方向完全一致。

### 结论 2：Schema 上移、user prompt 去静态契约是正确方向

判定：**成立**

依据：

- Baseline 仍是最重输入。
- 优化版 prompt 普遍更轻。
- 同时本地生产模板仍保留大量静态 schema 文本，这说明实验目录提出的问题真实存在。

补充意见：

- 这条结论不该停留在 prompt 文档层，应该迁移到正式模板和 API schema 层。

### 结论 3：B2 比 B1 更有“多周期视野”，建议保留 B2

判定：**部分成立，证据仍偏主观**

依据：

- B2 输出通常会引用更多周线/月线背景。
- 但当前实验没有统一质量打分，也没有人工盲评表。
- 从纯工程指标看，B1 明显更轻、更快。

结论：

- 可以说“B2 可能带来更强叙事深度”。
- 不能仅凭当前单 case 把“生产环境必须保留 B2”当成硬结论。

### 结论 4：B3 是极致速度路线，若追求 `<10s` 响应可优先考虑

判定：**不成立**

依据：

- 本次 B3 latency 为 `16.92s`，并未达到 `<10s`。
- B1 latency 为 `14.90s`，比 B3 更快。
- 更重要的是，B3 再次出现结构退化：`tactics` 不是数组而是字符串。

结论：

- B3 的“叙事蒸馏”方向值得研究。
- 但“速度最优”与“可直接上生产”的结论，本次复跑不支持。

### 结论 5：Layer-1 约束不是多余提示，而是关键安全阀

判定：**成立，且比旧报告更强**

依据：

- 去掉 L1 后：`signal = Short/Wait`, `confidence = 0.85`
- 保留 L1 后：`signal = Side`, `confidence = 0.35`

这说明 L1 的作用不仅是压低置信度，还会显著限制模型越权输出不受控动作语义。

补充意见：

- 旧报告说“移除 L1 后信心漂移”，这次复跑证明该判断正确。
- 但还应补一句：移除 L1 后，**signal enum 也发生漂移**，这是更严重的工程风险。

### 结论 6：四状态语义能减少歧义，提高语义效率，并降低 token / 成本

判定：**部分成立，且原表述过强**

拆分如下：

1. “减少歧义”：
   - **成立**
   - 四状态输出更自然给出 `RiskOff`，动作语义更贴近产品语义。

2. “提高语义效率”：
   - **部分成立**
   - 在普通对比里，B4_NEW_4_STATES 的确更短。
   - 但该版本结构不稳定，不能只看 token。

3. “降低 token / 成本”：
   - **本次公平对比不成立**
   - `B4_STRICT_4_STATES = 5844 tokens`
   - `B2_OPTIMIZED_3_STATES = 5477 tokens`
   - latency 也更慢。

结论：

- 四状态的主要价值是“语义对齐”，不是已被证明的“性能红利”。
- 旧报告把“语义更准”直接外推为“成本更低”，这一步证据不足。

## 我对当前专项的最新判断

### 1. 研究方向基本正确

当前实验已经稳定证明了三件事：

- Baseline prompt 的确过重。
- Layer-1 注入是必要的。
- 四状态语义比三态更贴近产品动作语言。

### 2. 旧报告里最需要收敛的，是“把单次结果写成普遍定律”

最明显的两个例子：

- B3 被写成“极致速度最优解”，复跑不支持。
- 四状态被写成“更省 token”，公平对比不支持。

## 修复后状态补记

在完成本报告初版后，又对两个历史不稳定点做了定向修复：

- [`prompts/B3_Adversarial_System.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/prompts/B3_Adversarial_System.md)
- [`prompts/B4_FourState_System.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/prompts/B4_FourState_System.md)

修复目的分别是：

- `B3`：禁止非法 JSON、补强 `signal/confidence/tactics` 必填结构
- `B4_NEW`：禁止将 `tactics` 压缩成字符串，强制数组对象结构

修复后的验证结果：

- [`results/eval_runs/20260312_214830/eval_results.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/eval_runs/20260312_214830/eval_results.json)
  - `B3` 已 parse pass
- [`results/eval_runs/20260312_214750/eval_results.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/eval_runs/20260312_214750/eval_results.json)
  - `B4_NEW` 已 parse pass

随后进行了修复后单案例全量复跑：

- [`results/eval_runs/20260312_214935/summary.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/eval_runs/20260312_214935/summary.json)

核心结果：

- `parse_success_rate = 1.0`
- `assertion_pass_rate = 1.0`

因此本报告前文中关于 `B3` 与 `B4_NEW` “结构不稳定”的描述，应该理解为：

- **对修复前轮次成立**
- **对当前最新基线已不再成立**

当前更准确的表述是：

- `B3` 与 `B4_NEW` 曾是主要不稳定点
- 现阶段已完成第一轮结构修复，并在单案例全量复跑中跑通

换句话说，旧报告里方向性结论大多没错，但性能类结论写得太满。

### 3. 当前最真实的瓶颈已经不是 prompt 创意，而是评估方法

当前实验仍有 3 个限制：

- 样本量基本是单一股票单一日期。
- 质量评估缺少统一量表。
- 模型容量波动会影响单次 latency 与 token。

所以，这个专项下一阶段不该继续堆新 prompt 版本，而应该先补：

1. 多 case 数据集
2. 统一评估指标
3. 结构正确性与业务正确性分开评分

## 建议的专项下一步

### P0

- 把这次复跑结果视为新的基线，不再引用旧 JSON 里的性能数值。
- 修订 `0_Handover_Report.md` 中关于 B3 和四状态成本优势的绝对化表述。

### P1

- 新增一个统一 eval runner，固定输出：
  - parse success
  - schema compliance
  - signal enum compliance
  - L1 alignment
  - token
  - latency

### P1

- 把四状态实验拆成两个问题看：
  - 语义是否更准
  - 性能是否更优

不要再把这两件事混成一个结论。

### P2

- 对 B3 增加结构强约束后再测一次，否则它目前只是“可读性实验”，不是可上线模板。

## 最终结论

本次复跑后，我对旧报告的总判断是：

- **核心问题诊断是对的**
- **部分性能收益结论写得过满**
- **Layer-1 安全阀结论被再次验证**
- **四状态语义价值成立，但其成本优势尚未被稳定证明**
- **B3 仍处于研究态，不应被表述为生产最优解**

本报告优先级高于目录中旧的性能类口头结论，后续若继续推进模板晋升，应以本次复跑结果为准。
