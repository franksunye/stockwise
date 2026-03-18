# 四状态语义升级实施方案（2026-03-13）

## 1. 目标

将四状态语义从“研究表达”升级为主链内部母语：

- `TriggeredLong`
- `Watch`
- `NoSetup`
- `RiskOff`

三态：

- `Long`
- `Short`
- `Side`

不再作为主链默认表达，只保留为兼容层。

## 2. 本轮改动范围

本轮优先改动以下层级：

1. 语义基础层
   - [`signal_semantics.py`](/Users/yesun/Code/stockwise/backend/engine/signal_semantics.py)

2. 解析与标准化层
   - [`parsers.py`](/Users/yesun/Code/stockwise/backend/engine/parsers.py)
   - [`schema_normalizer.py`](/Users/yesun/Code/stockwise/backend/engine/schema_normalizer.py)

3. Prompt 主链层
   - [`prompts.py`](/Users/yesun/Code/stockwise/backend/engine/prompts.py)
   - [`stock_analysis_system_b2.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_system_b2.j2)
   - [`stock_analysis_user_b2.j2`](/Users/yesun/Code/stockwise/backend/templates/prompts/stock_analysis_user_b2.j2)

4. Layer-1 enforcement 与规则引擎
   - [`runner.py`](/Users/yesun/Code/stockwise/backend/engine/runner.py)
   - [`rule_based.py`](/Users/yesun/Code/stockwise/backend/engine/models/rule_based.py)

5. 最小消费端兼容
   - [`brief_generator.py`](/Users/yesun/Code/stockwise/backend/engine/brief_generator.py)
   - [`brief_assembler.py`](/Users/yesun/Code/stockwise/backend/engine/services/brief_assembler.py)
   - [`notification_service.py`](/Users/yesun/Code/stockwise/backend/notification_service.py)

## 3. 当前实施原则

### 3.1 主链内部使用四状态

内部结果允许并优先保留：

- `TriggeredLong`
- `Watch`
- `NoSetup`
- `RiskOff`

### 3.2 三态只做兼容投影

保留 `to_legacy_signal()` 之类的兼容映射，但不再反向污染主链。

### 3.3 Layer-1 不再压缩成 `Side`

`runner.py` 的 enforcement 现在直接对齐：

- `TriggeredLong -> TriggeredLong`
- `Watch -> Watch`
- `NoSetup -> NoSetup`
- `RiskOff -> RiskOff`

## 4. 下一批仍需关注的点

本轮之后，四状态升级还剩两类后续项：

1. 让模型自身更稳定地产生四状态
   - 当前 `b2.v2` 已在 `RiskOff` 案例上让 Gemini 原始 JSON 直接输出 `RiskOff`
   - 下一步重点不再是“证明四态能不能说出来”，而是扩展验证：
     - `Watch`
     - `NoSetup`
     - `TriggeredLong`
   - 目标是让四状态在不同 Layer-1 语义下都能自然、稳定地产生

2. 扩展更多消费端语义兼容
   - 当前已补 brief / notification 的关键路径
   - 但全仓库仍有部分 `Long/Short/Side` 假设，后续应继续排查

## 5. 一句话结论

**本轮的目标不是一次性清空所有 legacy 假设，而是先把四状态抬成主链母语，并把最关键的解析、enforcement 和展示路径改通。**
