# 四状态语义升级结果（2026-03-13）

## 1. 已完成内容

### 1.1 新增统一语义层

新增：

- [`signal_semantics.py`](/Users/yesun/Code/stockwise/backend/engine/signal_semantics.py)

提供：

- canonical 四状态
- legacy 三态投影
- 中文标签
- 通知权重

### 1.2 Parser 与 Normalizer 已支持四状态

已完成：

- [`parsers.py`](/Users/yesun/Code/stockwise/backend/engine/parsers.py)
- [`schema_normalizer.py`](/Users/yesun/Code/stockwise/backend/engine/schema_normalizer.py)

当前行为：

- `TriggeredLong / Watch / NoSetup / RiskOff` 可以被直接解析与保留
- 不再默认压回 `Long / Short / Side`

### 1.3 Layer-1 enforcement 已升级为四状态

已完成：

- [`runner.py`](/Users/yesun/Code/stockwise/backend/engine/runner.py)
- [`rule_based.py`](/Users/yesun/Code/stockwise/backend/engine/models/rule_based.py)

当前行为：

- 最终结果不再把 `RiskOff / Watch / NoSetup` 压成 `Side`
- enforcement 还会同步修正 `reasoning` JSON 内的 `signal`
- `Side -> NoSetup/Watch/RiskOff` 与 `Long -> TriggeredLong` 现在会被显式标记为 `legacy enum inertia`

### 1.4 B2 模板已切换到四状态协议

已完成：

- [`stock_analysis_system_b2.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_system_b2.j2)
- [`prompts.py`](/Users/yesun/Code/stockwise/backend/engine/prompts.py)

当前行为：

- B2 system prompt 明确要求输出四状态
- Layer-1 注入文案不再把 `Watch / NoSetup / RiskOff` 说成笼统“观望”

### 1.5 关键消费端已补兼容

已完成：

- [`brief_generator.py`](/Users/yesun/Code/stockwise/backend/engine/brief_generator.py)
- [`brief_assembler.py`](/Users/yesun/Code/stockwise/backend/engine/services/brief_assembler.py)
- [`notification_service.py`](/Users/yesun/Code/stockwise/backend/notification_service.py)

## 2. 测试结果

本轮针对性测试全部通过：

- `test_signal_semantics.py`
- `test_parsers_funnel.py`
- `test_schema_normalizer_tactics_contract.py`
- `test_runner_layer1_enforcement.py`
- `test_rule_engine_layer1_alignment.py`
- `test_prompt_variant_switch.py`

结果：

- **22 passed**

## 3. 本地主链验证结论

本地 Gemini 主链回归已验证到的事实：

1. 默认 `b2` 路径仍可正常完成主链分析
2. 在真实 `Layer1=RiskOff` 案例上，最终落库信号已可以是 `RiskOff`
3. 在 `b2.v3` 模板中，system/user prompt 已收敛成纯协议式约束：
   - `signal` 只能使用 `TriggeredLong / Watch / NoSetup / RiskOff`
   - 不再使用品牌词和会话化措辞
4. 最新本地主链验证结果如下：

| 案例 | Layer-1 | `prompt_version` | 运行日志中的原始模型信号 | 落库 `signal` | 落库 `ai_reasoning.signal` | 结论 |
|---|---|---|---|---|---|---|
| `300502 / 2026-03-12` | `RiskOff` | `b2.v2` | `RiskOff` | `RiskOff` | `RiskOff` | 模型已原生输出四状态 |
| `00700 / 2026-03-12` | `NoSetup` | `b2.v4` | `Side` | `NoSetup` | `NoSetup` | 定义更清楚，但原始输出仍依赖 enforcement 抬正 |
| `601869 / 2026-03-12` | `Watch` | `b2.v3` | `Watch` | `Watch` | `Watch` | 模型已原生输出四状态 |
| `300394 / 2026-03-10` | `TriggeredLong` | `b2.v4` | `Long` | `TriggeredLong` | `TriggeredLong` | 总结语义更清楚，但原始输出仍受旧多头词汇惯性影响 |

这说明：

- **主链四状态已经生效**
- **Gemini 已能在部分状态上直接输出四状态**
- 后置 enforcement 仍然必要，尤其对 `NoSetup` 和 `TriggeredLong`
- 这两类现象现在应被理解为“模型旧枚举惯性”，而不是主链协议错误

## 4. 当前结论

本轮四状态升级已经完成了最关键的一步：

- 四状态不再只是研究语义
- 已进入主链内部解析、标准化和 enforcement

当前更准确的状态是：

- **主链内部四态已打通**
- **`RiskOff / Watch` 已能原生输出**
- **`NoSetup / TriggeredLong` 仍存在旧三态惯性**
- **`b2.v4` 已提升语义解释质量，但尚未消除这两类原始枚举回退**

## 5. 下一步

下一轮优化应聚焦：

1. 继续精修 `B2_PROD_SAFE`
   - 重点解决 `NoSetup -> Side` 与 `TriggeredLong -> Long` 这两类残留映射惯性
   - 其中 `NoSetup` 更像“中性观望偷懒映射”，`TriggeredLong` 更像“旧多头词汇惯性”

2. 主链继续保留 canonicalization
   - 在当前阶段，不建议为了追求 raw `signal` 纯净而移除 enforcement
   - 更合理的做法是接受并记录 `legacy enum inertia`，同时保证最终 canonical signal 正确

2. 继续排查仓库内残留的三态硬编码
   - 尤其是少数非主链消费点

一句话：

**四状态升级的“管道工程”已经完成；现在模型已经能原生说出 `RiskOff / Watch`，下一步要收掉 `NoSetup / TriggeredLong` 上残留的旧三态惯性。**
