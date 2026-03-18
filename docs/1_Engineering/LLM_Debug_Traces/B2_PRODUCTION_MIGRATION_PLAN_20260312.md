# B2 生产迁移方案（2026-03-12）

## 1. 目标

将当前实验结论中的主候选路线 `B2_RICH_TABLES`，以**低风险、可回退、分阶段**的方式迁移回生产主链。

本方案强调：

- 不是一次性替换
- 不是休克式切换
- 优先保证线上稳定性
- 每一步都可单独验证

当前实验结论见：

- [`PRODUCTION_PROMOTION_RECOMMENDATION_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/PRODUCTION_PROMOTION_RECOMMENDATION_20260312.md)

## 2. 当前现状

### 2.1 生产主链仍是旧模板

当前正式生产 prompt 主链文件是：

- [`backend/templates/prompts/stock_analysis_system.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_system.j2)
- [`backend/templates/prompts/stock_analysis_user.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_user.j2)
- [`backend/engine/prompts.py`](/Users/yesun/Code/stockwise/backend/engine/prompts.py)

而实验主候选 `B2` 对应的 prompt 资产是：

- [`prompts/Shared_Optimized_System.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/prompts/Shared_Optimized_System.md)
- [`prompts/B2_Rich_User.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/prompts/B2_Rich_User.md)

也就是说，**当前实验结论尚未进入正式主链**。

### 2.2 当前主链有两个已知风险点

#### 风险点 A：`as_of_date` 曾触发误导性的“回填模式”

位置：

- [`backend/engine/prompts.py:520`](/Users/yesun/Code/stockwise/backend/engine/prompts.py:520)

现状：

- 旧逻辑中，只要传 `as_of_date`，就会注入“请假装今天是某日”的语境

风险：

- 会把正常历史复盘任务误引导成“角色扮演式回填”
- 污染模型的时间语境

#### 风险点 B：Layer-1 四状态在 prompt 入口被压扁

位置：

- [`backend/engine/prompts.py:527`](/Users/yesun/Code/stockwise/backend/engine/prompts.py:527)
- [`backend/engine/schema_normalizer.py:339`](/Users/yesun/Code/stockwise/backend/engine/schema_normalizer.py:339)

现状：

- Layer-1 在 prompt 注入时只保留 legacy 三态表达
- normalizer 也默认只接受 `Long / Short / Side`

风险：

- 实验里关于四状态的语义收益，当前无法安全迁回主链

## 3. 迁移原则

### 原则 1：先迁“结构”，不先迁“语义体系”

当前最适合先进入生产的，不是四状态，也不是激进蒸馏路线，而是：

- `B2` 的 prompt 结构思想
- system/user 职责重新分配
- Layer-1 作为安全阀的明确表达

这意味着：

- **先保持 legacy 三态**
- **先不改下游信号枚举**
- **先不动前端/数据库契约**

### 原则 2：先做兼容修复，再做模板迁移

如果直接替换模板，而不先修：

- `as_of_date`
- Layer-1 注入逻辑

那么迁移后的结果仍会被旧逻辑污染。

### 原则 3：始终保留旧模板回退能力

迁移期间必须能做到：

- 新旧模板并存
- 按开关选择
- 出现异常可快速回退

## 4. 推荐迁移阶段

## Phase 0：冻结当前基线

目标：

- 固化“迁移前”基线，防止后续判断失焦

输入基线：

- 线上真实基线：DeepSeek 生产记录
- 本地实验基线：[`CURRENT_BASELINE_STATUS_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/CURRENT_BASELINE_STATUS_20260312.md)

动作：

- 不改生产行为
- 仅把当前基线文档作为迁移前参照

交付物：

- 当前已有，无需新增代码

风险：

- 无

## Phase 1：兼容层修复，不切模板

目标：

- 修掉会污染迁移结果的已知主链问题
- 不引入新的 prompt 版本切换

建议改动：

1. 修 `as_of_date` 文案语义
   - 保留 `as_of_date` 参数
   - 从“请假装今天是 X”改成“历史复盘模式：分析基准日为 X，仅基于该日及之前数据判断”

2. 梳理 Layer-1 注入逻辑
   - 至少不要把更细粒度状态粗暴压成误导性文案
   - 先做到“风险约束含义保真”，不急于引入四状态枚举

目标文件：

- [`backend/engine/prompts.py`](/Users/yesun/Code/stockwise/backend/engine/prompts.py)

为什么先做这一步：

- 这是对主链行为的“兼容修正”
- 影响面小
- 能减少后续模板切换时的噪音

验证方式：

- 用当前单案例跑旧模板
- 确认输出结构、主信号、解析链未明显回归

回退方式：

- 单文件回退即可

风险等级：

- 低

## Phase 2：引入 B2 风格模板，但默认不启用

目标：

- 让生产代码中具备 B2 版本能力
- 但默认仍走旧模板

建议改动：

1. 在正式模板目录中新增一套 B2 风格模板
   - 例如：
     - `stock_analysis_system_b2.j2`
     - `stock_analysis_user_b2.j2`

2. 在 [`backend/engine/prompts.py`](/Users/yesun/Code/stockwise/backend/engine/prompts.py) 中增加版本选择能力
   - 可通过显式参数或环境变量切换
   - 默认保持旧模板

3. 不删除旧模板

当前状态（2026-03-12）：

- 已实现
- 新增正式模板：
  - [`stock_analysis_system_b2.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_system_b2.j2)
  - [`stock_analysis_user_b2.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_user_b2.j2)
- 已在 [`prompts.py`](/Users/yesun/Code/stockwise/backend/engine/prompts.py) 中加入默认关闭的模板切换
- 当前开关：
  - `STOCK_ANALYSIS_PROMPT_VARIANT=legacy`（默认）
  - `STOCK_ANALYSIS_PROMPT_VARIANT=b2`
- 注意：
  - 当前生产代码引入的是 **`B2_PROD_SAFE`**
  - 不是实验目录中 `B2_RICH_TABLES` 的逐字复刻
  - 详见 [`B2_VARIANT_CLARIFICATION_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/B2_VARIANT_CLARIFICATION_20260312.md)

为什么不直接覆盖旧模板：

- 覆盖式改动难以比对
- 线上出现问题时难快速止损
- 不利于 shadow run 或小范围验证

验证方式：

- 本地同 case 对比旧模板 vs B2 模板
- 重点看：
  - parse 是否稳定
  - token 是否下降
  - tactics / key_levels 合规性是否维持

回退方式：

- 切回旧模板选择开关

已完成的最小验证：

- 模板切换单测通过：
  - [`test_prompt_variant_switch.py`](/Users/yesun/Code/stockwise/backend/tests/test_prompt_variant_switch.py)
- 本地 `300502 / 2026-03-12 / gemini_local` 在 `STOCK_ANALYSIS_PROMPT_VARIANT=b2` 下已成功跑通并完成严格解析

风险等级：

- 低到中

## Phase 3：影子验证，不替换线上主输出

目标：

- 用生产数据上下文验证 B2 模板
- 但不让它直接成为主结果

建议做法：

- 对同一输入，同时生成：
  - 旧模板结果
  - B2 模板结果
- B2 结果仅存档或内部审计，不参与主决策展示

适合验证的问题：

- 真实生产上下文下是否仍结构稳定
- 与当前主输出相比，是否明显更轻或更清晰

为什么这一步重要：

- 单案例实验和真实主链仍有差异
- 影子验证能在不影响用户的前提下补证据

风险等级：

- 中

说明：

- 如果当前主链暂时不方便做双写，也可以先在离线脚本层做“生产上下文重放”
- 当前已完成的本地证据：
  - [`SHADOW_VALIDATION_RESULT_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/SHADOW_VALIDATION_RESULT_20260312.md)
  - [`PHASE3_5_LOCAL_WRITE_VALIDATION_RESULT_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/PHASE3_5_LOCAL_WRITE_VALIDATION_RESULT_20260312.md)
  - [`MODEL_OUTPUT_COMPARISON_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/MODEL_OUTPUT_COMPARISON_20260312.md)
  - [`PROD_DEEPSEEK_VS_LOCAL_B2_DEEPSEEK_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/PROD_DEEPSEEK_VS_LOCAL_B2_DEEPSEEK_20260312.md)
- 当前这些证据共同支持：
  - `B2_PROD_SAFE` 已在本地主链路上完成影子验证与真实写库验证
  - 在 `deepseek-v3` 上未出现主方向漂移
  - 本地 `b2.v1` 的变化更接近“保守风格强化”，不是策略立场改变

## Phase 4：小流量切换

目标：

- 让 B2 模板开始承担少量真实生产请求

前置条件：

- Phase 1 已完成
- Phase 2 已完成
- Phase 3 验证无明显回归

建议策略：

- 先按低比例开启
- 只在可监控的范围内放量
- 保留一键切回旧模板能力

重点观察：

- parse 成功率
- tactics/key_levels 合规率
- token / latency
- 主信号是否异常偏移

风险等级：

- 中

## Phase 5：默认切换到 B2

目标：

- 在验证充分后，将 B2 作为默认生产模板

仍然保留：

- 旧模板回退开关
- 针对异常日期或模型波动的应急回切能力

风险等级：

- 中

## 5. 当前不建议进入的内容

以下内容不建议和 B2 迁移绑在同一批次：

### 5.1 不建议同时引入四状态主链化

原因：

- 需要改 `schema_normalizer.py`
- 需要改前后端契约
- 需要核对历史数据、数据库消费方、UI 展示

这已经不是“B2 迁移”，而是“产品语义升级”

### 5.2 不建议同时迁入 B3 蒸馏路线

原因：

- B3 虽已修复，但研究属性仍强于生产属性

### 5.3 不建议直接覆盖现有旧模板

原因：

- 丧失精确回退能力
- 不利于分阶段验证

## 5.4 后续候选能力（不属于当前主线）

### `internal_reasoning` 影子实验

说明：

- `internal_reasoning` 出现在实验版优化 prompt 思路中
- 当前正式生产 schema、解析器和前后端契约都**没有**这个字段
- 因此它不属于本次 B2 迁移范围

为什么未来可能值得做：

- 有机会提升复杂场景下的推理完整度
- 便于内部审计与质检
- 可以帮助区分“模型真实推理深度”与“最终摘要质量”

为什么现在不应纳入主线：

- 会增加 token 与 latency
- 会增加自由文本长度，提升结构不稳定风险
- 当前没有业务消费方，贸然加入只会扩大改动面

建议进入方式：

1. 仅作为影子字段实验
   - 只进入 trace / 调试记录
   - 不进入当前正式 `StockAnalysisResult`

2. 单独评估 4 个指标
   - 质量是否提升
   - parse 是否更稳或更差
   - token 是否明显增加
   - latency 是否明显上升

3. 只有在 B2 默认切换稳定后，再决定是否正式化

当前结论：

- `internal_reasoning` 是**后续候选能力**
- **不是当前 B2 迁移计划的一部分**

## 6. 建议的最小实施顺序

如果只看“下一步先做什么”，我建议按这个顺序：

1. Phase 1
   - 修 `as_of_date`
   - 修 Layer-1 注入表述

2. Phase 2
   - 新增 B2 风格正式模板
   - 在 `prompts.py` 增加模板版本选择

3. Phase 3
   - 做影子验证或离线生产上下文重放

4. Phase 4
   - 小流量切换

5. Phase 5
   - 默认切 B2

## 7. 每阶段验收标准

### Phase 1 验收

- 旧模板主输出不出现明显回归
- `as_of_date` 语义不再误导
- Layer-1 文案更忠实表达风险约束

### Phase 2 验收

- 新旧模板都可运行
- 默认路径仍为旧模板
- B2 路径在本地评估中结构稳定

### Phase 3 验收

- B2 在真实生产上下文重放下无明显结构恶化
- token 和可读性优于旧模板

### Phase 4 验收

- 小流量期间无明显解析异常
- 无显著信号漂移事故
- 延迟和错误率可接受

### Phase 5 验收

- B2 默认运行稳定
- 回退路径仍可用

## 8. 一句话总结

**B2 迁移应采取“先修兼容层，再引入并存模板，再做影子验证，最后小流量切换”的路线；不建议一步替换旧生产模板。**
