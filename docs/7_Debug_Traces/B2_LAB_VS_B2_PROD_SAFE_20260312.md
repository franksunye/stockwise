# B2_LAB vs B2_PROD_SAFE 对照记录（2026-03-12）

## 1. 目的

这份文档用于解决一个方法论问题：

- 当前实验结论中的 `B2`
- 与当前生产代码中并行引入的 `b2` 模板

并不是同一个对象。

因此，必须明确区分：

- **`B2_LAB`**
- **`B2_PROD_SAFE`**

否则后续的验证、汇报和晋升判断都会失真。

## 2. 两个对象分别是什么

### 2.1 `B2_LAB`

定义：

- System: [`prompts/Shared_Optimized_System.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/prompts/Shared_Optimized_System.md)
- User: [`prompts/B2_Rich_User.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/prompts/B2_Rich_User.md)

它是实验室里的原始 B2 方案，用于做：

- B1/B2/B3 对比
- Layer-1 有无对比
- 四状态相关对照

### 2.2 `B2_PROD_SAFE`

定义：

- System: [`stock_analysis_system_b2.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_system_b2.j2)
- User: [`stock_analysis_user_b2.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_user_b2.j2)
- 开关：`STOCK_ANALYSIS_PROMPT_VARIANT=b2`

它是为了低风险迁移而从 `B2_LAB` 裁剪出的生产候选变体。

## 3. 为什么不能把它们当成同一个版本

原因很简单：

- `B2_PROD_SAFE` 没有逐字复刻 `B2_LAB`
- 它保留的是结构思想，不是完整实验 prompt
- 因此它的效果必须单独验证

方法论边界：

- `B2_LAB` 的 benchmark 结果，**不能**直接当作 `B2_PROD_SAFE` 的结果
- `B2_PROD_SAFE` 的本地验证结果，**也不能**倒推出“实验室 B2 已经生产化完成”

## 4. 差异总表

| 维度 | `B2_LAB` | `B2_PROD_SAFE` |
|---|---|---|
| 使用位置 | 实验室专项 | 生产代码并行模板 |
| 目标 | 验证 rich input 路线是否成立 | 低风险迁移 B2 的核心收益 |
| system prompt | 研究态优化版 | 生产兼容版 |
| user prompt | 原始实验 rich user | 生产兼容版 XML rich user |
| XML 边界 | 有 | 有 |
| Layer-1 约束 | 有 | 有 |
| 输出 schema | 带研究态痕迹 | 严格保持当前正式 schema |
| `internal_reasoning` | 有相关实验思路，且在实际结果中出现过 | 不引入 |
| 解析目标 | 实验 parser + normalizer | 当前正式 parser + normalizer |
| 风险偏好 | 允许研究性尝试 | 严格控制改动面 |

## 5. `B2_PROD_SAFE` 保留了什么

- richer input 路线
- XML 风格数据边界
- system/user 职责重分配
- 明确的 Layer-1 风险约束
- 多周期上下文输入

## 6. `B2_PROD_SAFE` 暂缓了什么

- `internal_reasoning`
- 研究态输出协议
- 超出当前 `StockAnalysisResult` 的字段
- 任何会扩大前后端契约变化的部分

## 7. 当前已掌握的验证结果

### 7.1 `B2_LAB` 已有结果

参考：

- [`results/eval_runs/20260312_214935/eval_results.json`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/results/eval_runs/20260312_214935/eval_results.json)

其中 `b2_rich_tables` 的结果：

- `raw_signal = Side`
- `confidence = 0.25`
- `latency_s = 27.695`
- `total_tokens = 7443`
- `parse_success = true`
- `assertions_passed = true`

### 7.2 `B2_PROD_SAFE` 已有结果

当前已完成本地真实案例验证：

- 本地库：同步后的真实 `300502 / 2026-03-12`
- 模型：`gemini_local`
- 开关：`STOCK_ANALYSIS_PROMPT_VARIANT=b2`

验证结果：

- `raw_signal = Side`
- `confidence = 0.85`
- `normalized_signal = Side`
- `latency ≈ 32.5s`
- `total_tokens = 9730`
- `parse_success = strict`

结论：

- `B2_PROD_SAFE` 已经证明“能跑通”
- 但它的量化效果还不能直接视为 `B2_LAB` 的延续结果

## 8. 当前严谨结论

应该这样表述：

1. `B2_LAB` 是当前实验结论中的主晋升候选路线。
2. 当前生产代码已并行引入 `B2_PROD_SAFE`。
3. `B2_PROD_SAFE` 已完成第一轮本地真实案例可运行验证。
4. 下一步要验证的是 `B2_PROD_SAFE` 的稳定性与收益，而不是重复宣称“B2 已全部迁移完成”。

## 9. 下一步建议

如果要继续严谨推进，建议后续所有验证、汇报和评估，都使用下面的命名：

- `B2_LAB`
- `B2_PROD_SAFE`

不要再只写“B2”。
