# B2 变体澄清（2026-03-12）

## 1. 为什么需要这份说明

当前目录中的 `B2` 有两个不同语境：

1. **实验室 B2**
2. **生产迁移中的 B2**

如果不区分，后续会出现一个严重问题：

- 把“实验室 B2”的结论错误套用到“生产迁移版 B2”
- 或把“生产迁移版 B2”的验证结果，错误回写为“实验室 B2 已验证”

这在方法论上是不严谨的。

## 2. 实验室 B2 是什么

本专项原始实验中，`B2` 指的是：

- System: [`prompts/Shared_Optimized_System.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/prompts/Shared_Optimized_System.md)
- User: [`prompts/B2_Rich_User.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/prompts/B2_Rich_User.md)

它是一个**实验版本**，用于验证：

- rich input 是否优于极简输入
- XML 风格输入边界是否更稳
- Layer-1 安全阀在该输入结构下是否有效
- 它与 B1 / B3 / B4 的对比表现

实验室 B2 的所有结论，仅能对应这个 prompt 资产组合。

## 3. 生产迁移中的 B2 是什么

当前迁入生产代码的版本，不是实验室 B2 的逐字复刻，而是一个**生产裁剪版 B2**：

- System: [`stock_analysis_system_b2.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_system_b2.j2)
- User: [`stock_analysis_user_b2.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_user_b2.j2)
- 开关：`STOCK_ANALYSIS_PROMPT_VARIANT=b2`

建议将它明确称为：

- **`B2_PROD_SAFE`**

原因：

- 它保留了 B2 的核心结构思想
- 但没有原样带入实验版全部元素
- 它的目标是“低风险迁移”，不是“实验 prompt 原样复刻”

## 4. `B2_PROD_SAFE` 相比实验室 B2，保留了什么

- richer input 的整体方向
- XML 风格的数据边界
- system/user 职责重新分配
- 更清晰的 Layer-1 风险约束表达
- 保持 rich context，而不是退回极简输入

## 5. `B2_PROD_SAFE` 相比实验室 B2，暂缓了什么

- `internal_reasoning`
- 更激进的研究态输出协议
- 任何超出当前正式 parser/schema 的字段
- 会扩大当前生产风险面的实验成分

## 6. 方法论边界

必须严格遵守下面这条边界：

- **实验室 B2 的历史 benchmark 结果，不能直接视为 `B2_PROD_SAFE` 的验证结果**

反过来也一样：

- **`B2_PROD_SAFE` 的本地/影子验证结果，不能回写成“实验室 B2 已验证”**

因此后续文档与沟通建议采用以下命名：

- `B2_LAB`
  - 指实验目录中的 `Shared_Optimized_System.md + B2_Rich_User.md`
- `B2_PROD_SAFE`
  - 指生产代码中的 `stock_analysis_system_b2.j2 + stock_analysis_user_b2.j2`

## 7. 当前结论应该怎么说

严谨表述应为：

- 当前实验结论显示，**`B2_LAB` 是最好的生产晋升候选路线**
- 当前生产代码中已并行引入 **`B2_PROD_SAFE`**
- `B2_PROD_SAFE` 是基于 `B2_LAB` 思想裁剪后的生产候选变体
- 下一步需要验证的是 **`B2_PROD_SAFE`**，不是再次声称“实验室 B2 已经迁移完成”

## 8. 后续要求

如果未来希望严谨比较两者，必须补做以下之一：

1. 在实验室目录中补录 `B2_PROD_SAFE` 的专门测试结果
2. 单独建立 `B2_LAB vs B2_PROD_SAFE` 对照记录

否则不应把两者混写为同一个版本。
