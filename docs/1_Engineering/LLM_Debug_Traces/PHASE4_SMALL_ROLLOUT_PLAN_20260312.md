# Phase 4 小流量切换方案（2026-03-12）

## 1. 目标

在完成本地主链路影子测试后，让 `B2_PROD_SAFE` 进入**最小风险的小流量切换阶段**。

本阶段不是默认替换，而是：

- 保持 legacy 为默认
- 通过开关启用 `B2_PROD_SAFE`
- 严格观察结果
- 保留随时回退能力

## 2. 当前前提已满足

### 2.1 代码准备已完成

- 已存在并行模板：
  - [`stock_analysis_system_b2.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_system_b2.j2)
  - [`stock_analysis_user_b2.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_user_b2.j2)
- 已存在模板切换开关：
  - `STOCK_ANALYSIS_PROMPT_VARIANT=legacy`
  - `STOCK_ANALYSIS_PROMPT_VARIANT=b2`

### 2.2 结果落库具备可观察性

当前主链会保存：

- `prompt_version`
- `execution_time_ms`
- `token_usage_input`
- `token_usage_output`

因此切换后可以从 `ai_predictions_v2` 中观察：

- 是哪套模板
- 用了多少 token
- 花了多少时间

### 2.3 本地主链路影子验证已完成首轮

参考：

- [`SHADOW_VALIDATION_RESULT_20260312.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/SHADOW_VALIDATION_RESULT_20260312.md)

当前结论：

- `B2_PROD_SAFE` 已证明能进入当前主链路并被解析
- 在部分样本上显示出明显成本优势
- 收益不是每个样本都绝对成立

## 3. 推荐切换方式

## Phase 4A：单次人工切换验证

做法：

- 在受控环境中将 `STOCK_ANALYSIS_PROMPT_VARIANT=b2`
- 只跑单次、单标的、单模型验证
- 观察写入库中的 `prompt_version`

目的：

- 确认真实主链写库时，B2 路径与本地主链路影子测试一致

推荐命令思路：

- 仅对单标的运行
- 仅用 `gemini-3-flash` 或指定目标模型
- 避免一次性切全池

## Phase 4B：小范围批次切换

做法：

- 保持 `STOCK_ANALYSIS_PROMPT_VARIANT=b2`
- 只对极小范围对象执行
  - 例如指定少量 symbol
  - 或指定单一市场的极小样本

目的：

- 观察写库后的真实 token / latency / parse 行为
- 确认在非影子写库场景下仍无异常

## Phase 4C：观察窗口

观察重点：

1. `prompt_version`
   - 确认新结果确实来自 `b2.v1`

2. `signal`
   - 是否出现异常漂移

3. `confidence`
   - 是否显著偏离既有分布

4. `token_usage_input + token_usage_output`
   - 是否整体优于 legacy

5. `execution_time_ms`
   - 是否明显改善，或至少不恶化到不可接受

6. 解析链表现
   - 是否出现异常 parse fail / 空结果 / 错误 reasoning

## 4. 当前最小风险方案

我建议的小流量切换顺序是：

1. 先做 `Phase 4A`
   - 单次单标的人工切换验证

2. 再做 `Phase 4B`
   - 只选 3 到 5 个标的的小批次

3. 再看是否进入更大范围

这比“直接切整个日常分析任务”风险低得多。

## 5. 回退方案

当前回退非常直接：

- 将 `STOCK_ANALYSIS_PROMPT_VARIANT` 设回 `legacy`

因为：

- legacy 模板仍完整保留
- `B2_PROD_SAFE` 没有覆盖旧模板
- 当前切换是开关式，不是覆盖式

这意味着：

- 一旦发现信号异常、token 不降反升、或解析链出现问题
- 可在极短时间内回到 legacy

## 6. 当前不建议做的事

### 6.1 不建议直接全池切换

原因：

- 当前只完成了本地主链路小样本影子验证
- 还没到“全量默认替换”的证据强度

### 6.2 不建议和四状态主链化绑在一起

原因：

- 会把 prompt 切换问题与产品语义升级问题混在一起

### 6.3 不建议和 `internal_reasoning` 绑在一起

原因：

- 这会把输出协议升级混进模板切换阶段
- 风险面不必要扩大

## 7. 当前阶段的验收标准

如果 `Phase 4A / 4B` 要判定为通过，至少要满足：

- `prompt_version = b2.v1`
- 结果能正常入库
- 无明显 signal 异常漂移
- 无明显 parse / normalization 异常
- token 或 latency 至少不显著劣于 legacy

## 8. 一句话结论

**Phase 4 不应理解为“切生产”，而应理解为“在可回退开关保护下，让 `B2_PROD_SAFE` 进入最小范围的真实写库验证”。**
