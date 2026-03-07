# 15 Layer-1 指标引擎与参数治理（A1）

更新时间：2026-03-07  
适用范围：`tradeability_v2`（CN/HK）

## 1. 目标

把 Layer-1 从“能跑”升级为“口径可追溯、参数可审计、可回滚”。

- 指标口径统一：明确 MA/波动指标来源。
- 参数版本治理：策略参数变更可追溯。
- 运行可观测：每次裁决可看到使用的指标引擎。

## 2. `pandas-ta` 接入决策

### 2.1 决策结论

- 保持现有预计算指标链路为主（`precomputed`）。
- 仅在最新 bar 缺失 `ma5/ma10/ma20` 时，启用 fallback 计算。
- fallback 优先使用 `pandas-ta`，不可用则自动降级为原生 rolling mean。

### 2.2 决策理由

- 最小风险：不改线上主路径，不改变已有 MA 数据的行为。
- 可演进：后续可逐步迁移到统一指标服务，而不影响当前稳定性。
- 可审计：`layer1_payload.indicator_engine` 会记录实际引擎来源。

### 2.3 引擎模式

- 环境变量：`LAYER1_INDICATOR_ENGINE`
- 可选值：
  - `auto`（默认）：优先 `pandas-ta`，失败回退原生。
  - `pandas_ta`：强制尝试 `pandas-ta`，失败回退原生。
  - 其他值：走原生回退路径。

## 3. 参数治理规范

### 3.1 单一真源（Single Source of Truth）

- 策略默认版本：`tradeability_v2`
- 参数文件：`backend/strategy_config/tradeability_params_v2.json`
- 市场维度：`markets.CN` / `markets.HK`

### 3.2 变更流程（必须）

1. 修改参数文件并记录变更目的（覆盖率、回撤、触发稳定性）。
2. 按模板填写参数变更记录：
   - `docs/1_Engineering/templates/Layer1_Param_Change_Template.md`
3. 运行本地回归：
   - `python -m unittest backend.tests.test_layer1_state_machine`
   - `python -m unittest backend.tests.test_runner_layer1_enforcement`
4. 运行窗口观测脚本（建议）：
   - `python backend/scripts/observe_tradeability_windows.py --market CN --strategy-versions tradeability_v2`
5. 在里程碑/运行日志中记录：
   - 生效日期
   - 参数 diff
   - 关键指标前后对比

### 3.3 回滚策略

- 回滚优先级：
  1. 回滚参数文件到上一个已验证版本。
  2. 如需应急，设置 `LAYER1_INDICATOR_ENGINE` 为非 `auto/pandas_ta`，强制原生回退路径。
- 禁止直接改代码常量绕过参数文件。

## 4. 观测口径（A1 验收）

- 裁决 payload 必须包含 `indicator_engine`。
- 四状态覆盖率+一致性日报稳定输出（`NoSetup/Watch/TriggeredLong/RiskOff`）。
  - `python backend/scripts/metrics_layer1_consistency.py --strategy-version tradeability_v2 --persist`
- 参数变更具备“人能读懂”的变更记录与回滚点。

## 5. 关联文件

- `backend/engine/layer1_state.py`
- `backend/strategy_config/tradeability_params_v2.json`
- `backend/tests/test_layer1_state_machine.py`
- `docs/0_Strategy/04_Milestones_Execution_Log.md`
