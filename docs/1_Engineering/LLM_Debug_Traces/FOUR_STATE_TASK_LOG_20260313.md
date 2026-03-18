# 四状态升级任务日志（2026-03-13）

## 1. 本轮目标

将四状态语义从“主链最终结果可保留”推进到“模型原始输出也尽量直接使用四状态”，并明确哪些残留问题属于 prompt 可解，哪些属于模型旧枚举惯性。

## 2. 已完成工作

### 2.1 四状态进入主链母语

已完成：

- [`signal_semantics.py`](/Users/yesun/Code/stockwise/backend/engine/signal_semantics.py)
- [`parsers.py`](/Users/yesun/Code/stockwise/backend/engine/parsers.py)
- [`schema_normalizer.py`](/Users/yesun/Code/stockwise/backend/engine/schema_normalizer.py)
- [`runner.py`](/Users/yesun/Code/stockwise/backend/engine/runner.py)
- [`rule_based.py`](/Users/yesun/Code/stockwise/backend/engine/models/rule_based.py)

结果：

- canonical 信号已统一为：
  - `TriggeredLong`
  - `Watch`
  - `NoSetup`
  - `RiskOff`
- 三态退为兼容投影

### 2.2 B2 模板改为四状态协议

已持续迭代：

- [`stock_analysis_system_b2.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_system_b2.j2)
- [`stock_analysis_user_b2.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_user_b2.j2)

版本演进：

- `b2.v2`
  - 首次明确要求四状态输出
- `b2.v3`
  - 去掉品牌词和会话化措辞
- `b2.v4`
  - 强化 `Watch / NoSetup` 和 `TriggeredLong / Long` 的边界定义
- `b2.v5`
  - 强化“先定 signal，再写其余字段”
  - 增加 `NoSetup` / `TriggeredLong` 最小 JSON 示例

### 2.3 本地 Gemini 验证结论

已实际验证的案例：

| 案例 | Layer-1 | 结果 |
|---|---|---|
| `300502 / 2026-03-12` | `RiskOff` | 原始输出可直接为 `RiskOff` |
| `601869 / 2026-03-12` | `Watch` | 原始输出可直接为 `Watch` |
| `00700 / 2026-03-12` | `NoSetup` | 原始输出仍会先落到 `Side`，再被 enforcement 收口为 `NoSetup` |
| `300394 / 2026-03-10` | `TriggeredLong` | 原始输出仍会先落到 `Long`，再被 enforcement 收口为 `TriggeredLong` |

结论：

- `RiskOff / Watch`：原始四状态已跑通
- `NoSetup / TriggeredLong`：内容语义已改善，但枚举槽位仍有旧三态惯性

## 3. 语义有效性核查

已确认四状态本身有内部正式依据，也有外部交易语境参照：

- 内部依据文档：
  - [`FOUR_STATE_SEMANTICS_VALIDATION_20260313.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/FOUR_STATE_SEMANTICS_VALIDATION_20260313.md)
- 专项结果文档：
  - [`FOUR_STATE_PROMOTION_RESULT_20260313.md`](/Users/yesun/Code/stockwise/docs/7_Debug_Traces/FOUR_STATE_PROMOTION_RESULT_20260313.md)

本轮结论：

- 四状态框架本身成立
- 当前问题不在语义是否正确，而在模型对旧枚举的残留先验

## 4. 新增概念：legacy enum inertia

为避免将 `Side -> NoSetup` 或 `Long -> TriggeredLong` 误判为主链失败，本轮新增显式概念：

- `legacy enum inertia`

定义：

- `Side -> Watch / NoSetup / RiskOff`
- `Long -> TriggeredLong`

当前实现：

- 新增判定函数：
  - [`signal_semantics.py`](/Users/yesun/Code/stockwise/backend/engine/signal_semantics.py)
- `runner` 命中时打专门日志：
  - `Layer1 signal enforced due to legacy enum inertia: ...`

这意味着：

- 这类现象现在被正式视为“模型旧枚举惯性”
- 不再只是模糊的 prompt 失败或解析异常

## 5. 本轮测试

当前已验证通过：

- `test_signal_semantics.py`
- `test_runner_layer1_enforcement.py`
- `test_parsers_funnel.py`
- `test_prompt_variant_switch.py`

最新针对性结果：

- `13 passed`

## 6. 当前停点

当前建议停在这里，不再继续堆 prompt：

1. `NoSetup` 与 `TriggeredLong` 的内容表述已经明显改善
2. 但原始枚举仍可能回退到 `Side / Long`
3. 继续只靠 prompt 强推，边际收益已经下降

因此当前主张是：

- 保留 `b2.v5`
- 保留 Layer-1 enforcement
- 接受并记录 `legacy enum inertia`
- 将 canonical signal 视为主链正式结果

## 7. 下一步建议

下一步不建议继续大改 prompt，建议改做轻量统计：

1. 统计 `legacy enum inertia` 命中频率
2. 区分：
   - `NoSetup -> Side`
   - `TriggeredLong -> Long`
3. 用统计结果决定后续是否还值得继续优化 raw `signal`

一句话：

**这轮已经把四状态主链打通，并把残留问题收口为“legacy enum inertia”；下一步应从继续堆 prompt，转向观测和量化这个现象。**
