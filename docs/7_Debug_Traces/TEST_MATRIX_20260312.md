# 测试矩阵（2026-03-12）

## 1. 当前测试矩阵的目的

这份矩阵用于回答一个问题：

**当前 `docs/7_Debug_Traces/` 到底在测哪些变量，每个 case 分别验证什么。**

它服务于两类工作：

- 日常复跑时快速知道每个 case 的定位
- 审计结论时避免把不同实验问题混在一起

## 1.1 一个必须明确的口径差异

当前目录里存在两类“baseline”概念，必须严格区分：

1. **线上真实 baseline**
   - 模型：DeepSeek
   - 证据：[`results/Raw_Production_Response.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/Raw_Production_Response.json)
   - 含义：真实生产链路下的稳定输出样本

2. **实验里的 `baseline_old`**
   - prompt：线上旧版 prompt 文本同款
   - 执行模型：当前实验脚本默认使用 `gemini_local`
   - 含义：生产 prompt 文本的离线重放对照组

因此：

- `baseline_old` 可以用于做 prompt 横向比较
- 但**不能直接用于否定线上 DeepSeek 生产稳定性**

## 2. 全量 Case 矩阵

| 组别 | Case ID | System Prompt | User Prompt | 主变量 | 主要验证点 |
|---|---|---|---|---|---|
| `four_way_benchmark` | `baseline_old` | `Baseline_Old_System.md` | `Baseline_Old_User.md` | 旧生产 prompt 文本重放 | 旧版 prompt 文本在离线重放中的 token / latency / 结构基线 |
| `four_way_benchmark` | `b1_minimal_features` | `Shared_Optimized_System.md` | `B1_Minimal_User.md` | 极简输入 | 少数据是否足够支撑可用输出 |
| `four_way_benchmark` | `b2_rich_tables` | `Shared_Optimized_System.md` | `B2_Rich_User.md` | 丰富输入 | 多周期 rich context 是否带来更完整判断 |
| `four_way_benchmark` | `b3_logic_distilled` | `B3_Adversarial_System.md` | `B3_Distilled_User.md` | 蒸馏 narrative 输入 | 逻辑蒸馏路线是否更快 / 更强 |
| `layer1_constraint` | `b2_with_l1` | `Shared_Optimized_System.md` | `B2_Rich_User.md` | 保留 Layer-1 | L1 安全阀是否有效 |
| `layer1_constraint` | `b2_without_l1` | `Shared_Optimized_System.md` | `B2_No_L1_User.md` | 去掉 Layer-1 | 去掉 L1 后是否发生信号漂移和语气漂移 |
| `four_state_semantics` | `b2_legacy_3_states` | `Shared_Optimized_System.md` | `B2_Rich_User.md` | 三态语义 | 旧语义下的表达效果 |
| `four_state_semantics` | `b4_new_4_states` | `B4_FourState_System.md` | `B2_Rich_User.md` | 四态初版 | 四状态语义是否更贴近产品动作语言 |
| `fair_3_vs_4_states` | `b2_optimized_3_states` | `Shared_Optimized_System.md` | `B2_Rich_User.md` | 三态严格版 | 作为四态公平对比基线 |
| `fair_3_vs_4_states` | `b4_strict_4_states` | `B4_STRICT_SYSTEM.md` | `B2_Rich_User.md` | 四态严格版 | 四态收益是否在控制变量后依然成立 |

## 3. 按实验问题拆解

### 3.1 输入密度路线

| 对比项 | 核心问题 |
|---|---|
| `baseline_old` vs `b1_minimal_features` | 旧版 prompt 的冗余能否通过最小输入显著降低 |
| `b1_minimal_features` vs `b2_rich_tables` | 极简输入和丰富输入的质量/成本权衡是什么 |
| `b2_rich_tables` vs `b3_logic_distilled` | 原始 rich tables 和 distilled narrative 哪种更适合模型 |

### 3.2 Layer-1 约束路线

| 对比项 | 核心问题 |
|---|---|
| `b2_with_l1` vs `b2_without_l1` | Layer-1 是冗余提示，还是必要安全阀 |

### 3.3 动作语义路线

| 对比项 | 核心问题 |
|---|---|
| `b2_legacy_3_states` vs `b4_new_4_states` | 四状态动作语义是否比三态更自然、更贴近产品表达 |

### 3.4 公平控制变量路线

| 对比项 | 核心问题 |
|---|---|
| `b2_optimized_3_states` vs `b4_strict_4_states` | 四状态收益是否来自语义本身，而不是 prompt 密度变化 |

## 4. 按 Prompt 资产拆解

### 4.1 System Prompt 维度

| System Prompt | 被哪些 Case 使用 | 作用 |
|---|---|---|
| `Baseline_Old_System.md` | `baseline_old` | 旧生产基线 |
| `Shared_Optimized_System.md` | `b1_minimal_features`, `b2_rich_tables`, `b2_with_l1`, `b2_without_l1`, `b2_legacy_3_states`, `b2_optimized_3_states` | 优化后三态通用系统提示词 |
| `B3_Adversarial_System.md` | `b3_logic_distilled` | 红蓝博弈、逻辑蒸馏版 |
| `B4_FourState_System.md` | `b4_new_4_states` | 四状态初版语义验证 |
| `B4_STRICT_SYSTEM.md` | `b4_strict_4_states` | 四状态严格公平对比版 |

### 4.2 User Prompt 维度

| User Prompt | 被哪些 Case 使用 | 作用 |
|---|---|---|
| `Baseline_Old_User.md` | `baseline_old` | 旧生产用户输入 |

补充说明：

- 这里的“旧生产基线 / 旧生产用户输入”指的是**prompt 资产来源于旧生产版本**
- 不表示当前实验执行时使用的模型也是线上同款 DeepSeek
| `B1_Minimal_User.md` | `b1_minimal_features` | 极简输入 |
| `B2_Rich_User.md` | `b2_rich_tables`, `b2_with_l1`, `b2_legacy_3_states`, `b4_new_4_states`, `b2_optimized_3_states`, `b4_strict_4_states` | rich 多周期输入主样本 |
| `B2_No_L1_User.md` | `b2_without_l1` | B2 去掉 L1 的对照输入 |
| `B3_Distilled_User.md` | `b3_logic_distilled` | narrative 蒸馏输入 |

## 5. 当前 Runner 覆盖的评估维度

统一 runner 当前不是只看 token / latency，而是覆盖 4 层：

### 5.1 Raw 层

直接从模型原始输出里提取：

- `raw.signal`
- `raw.confidence`
- raw enum 是否在允许集合内

作用：

- 判断模型本体是否漂移
- 尤其适合观察四状态 case

### 5.2 Parser 层

使用 `parse_ai_response_with_diagnostics`：

- `parse_success`
- `parse_error`
- `diagnostics`

作用：

- 判断输出是否能进入正式解析链

### 5.3 Normalized 层

使用 `normalize_ai_response`：

- `normalized.signal`
- `normalized_tactics_compliant`
- `normalized_key_levels_compliant`
- `layer1_alignment`

作用：

- 判断进入系统主链后是否仍满足结构契约

### 5.4 Meta 层

- `input_tokens`
- `output_tokens`
- `total_tokens`
- `latency_s`

作用：

- 用于成本和时延对比

## 6. 当前运行状态说明

当前所有 case 都已进入统一 runner manifest，并可顺序复跑。

当前需要特别注意的点：

- 四状态 case 要优先看 `raw.signal`
  - 因为当前系统 normalizer 仍会把不识别的四状态信号压回 legacy 三态
- `baseline_old` 在 runner 中若出现 parse fail，应优先理解为“本地 Gemini 对旧 prompt 文本的重放不稳”，而不是“线上 DeepSeek 生产不稳”
- 历史上 `b3_logic_distilled`、`b4_new_4_states` 曾是主要 parse 不稳定点
- 截至最新全量复跑，这两个 case 已完成第一轮 prompt 修复并重新跑通
- 后续若再次出现不稳定，应优先判断是上游容量波动还是新 prompt 回退

## 7. 当前推荐阅读顺序

如果要快速理解“实验体系 + 测试矩阵 + 当前状态”，建议按下面顺序阅读：

1. [`EXPERIMENT_MAP_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/EXPERIMENT_MAP_20260312.md)
2. [`TEST_MATRIX_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/TEST_MATRIX_20260312.md)
3. [`RERUN_AUDIT_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/RERUN_AUDIT_20260312.md)
4. [`EVAL_RUNNER_README.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/EVAL_RUNNER_README.md)

## 8. 一句话总结

当前测试矩阵本质上是在同时覆盖四条主线：

- `输入多还是少`
- `Layer-1 要不要硬约束`
- `动作语义该不该升级为四状态`
- `这些收益到底是语义收益还是 prompt 密度收益`
