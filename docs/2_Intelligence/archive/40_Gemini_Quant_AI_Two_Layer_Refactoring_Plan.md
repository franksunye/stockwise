# 量化 + AI 双层重构计划（对齐版）

**文档状态**: Completed  
**日期**: 2026-03-06  
**当前分支口径**: `feat/layer1-state-machine-v1`  
**关联文档**: `../39_Tradeability_Dual_Lane_Operations.md`, `../27_Acceptance_Criteria_v1.md`, `41_Tradeability_Quality_and_Actionability_Plan.md`, [Spec 40 (UX)](../../3_Product/Specs/40_Quant_AI_Dual_Layer_UX.md)

---

## 1. 目标定义（最终口径）

> 结论：本计划对应的 Layer-1 / Layer-2 双层重构主线已完成，本文档保留为阶段完成记录与基线沉淀，不再承接新增执行项。

1. Layer-1（量化层）拥有方向裁决权（Single Source of Truth）。
2. Layer-2（LLM / Rule Engine）负责解释、战术、风控表达，不再拥有最终方向裁决权。
3. 用户界面与输出结构保持稳定，不通过改 UI 来掩盖架构问题。

---

## 2. 当前已落地能力（2026-03-06）

### 2.1 Layer-1 状态机与映射

1. 状态机已落地：`NoSetup / Watch / TriggeredLong / RiskOff`
2. 方向映射已固定：
   - `TriggeredLong -> Long`
   - `NoSetup / Watch / RiskOff -> Side`

### 2.2 执行链路约束

1. `runner` 在模型返回后执行 Layer-1 方向强制对齐（可通过 `LAYER1_SIGNAL_ENFORCE` 应急开关回退）。
2. LLM 提示词与 synthesis 均注入 Layer-1 硬约束说明。
3. `rule-engine` 已改为“分析器角色”：
   - 可保留自身原始规则信号用于解释。
   - 最终输出方向对齐 Layer-1。

### 2.3 数据落库与可观测

`ai_predictions_v2` 已落库 Layer-1 关键字段：

1. `layer1_status`
2. `layer1_score`
3. `layer1_trigger_hit`
4. `layer1_risk_off_hit`
5. `layer1_strategy_version`
6. `layer1_payload`

---

## 3. 职责边界（策略与工程统一）

### 3.1 Layer-1（量化裁决层）

负责：

1. 可交易性判断
2. 方向裁决（Long/Side）
3. 风险否决（RiskOff）

不负责：

1. 长文本叙事
2. 用户沟通文案

### 3.2 Layer-2（解释与战术层）

负责：

1. 解释“为什么”
2. 输出战术分支（持盈/持亏/暂无操作）
3. 风险提示与反方观点

不负责：

1. 覆写最终方向

---

## 4. 研发与验证口径

1. 研发与功能验证默认使用本地 SQLite（与生产同构 schema）。
2. 模型测试按当前约束执行：优先 `hunyuan-lite` 与 `gemini local`。
3. 验证优先级：
   - 方向一致性（Layer-1 与最终 signal）
   - 输出完整性（summary/reasoning_trace/tactics）
   - 稳定性与耗时

### 4.1 当前在线口径实测基线（SQLite 回放，2026-03-06）

口径：以当前在线 LLM 模型（`deepseek-v3` + `gemini-3-flash` + `hunyuan-lite`）的历史 `ai_predictions_v2` 记录作为基线，对同一批 `symbol+date` 使用 `tradeability_v1` 重算 Layer-1 状态并映射 `Long/Side`。

1. 样本量：`n=1327`（date range: `2025-01-09` ~ `2026-03-05`）
2. 原始 LLM Long 占比：`0.60%`（`8/1327`）
3. Layer-1 重算 Long 占比：`1.51%`（`20/1327`）
4. Long 提升：`+0.90pp`（约 `2.50x`）
5. 状态分布：
   - `NoSetup`: `553` (`41.67%`)
   - `Watch`: `27` (`2.03%`)
   - `RiskOff`: `727` (`54.79%`)
   - `TriggeredLong`: `20` (`1.51%`)

结论：Layer-1 已经把“全 Side 黑盒”拆解为可解释的子状态，但当前参数下 `TriggeredLong` 覆盖仍偏低，后续迭代主目标是“在不显著恶化风险的前提下，提高 TriggeredLong 覆盖”。

---

## 5. 下一阶段（不改 UI 的前提下）

1. 扩展 Layer-1 策略版本（`tradeability_v2`）并保持同一裁决接口。
2. 增加策略实验框架（v1/v2 并行评估），不改用户前台结构。
   - 现已落地 `backend/scripts/run_tradeability_experiment.py`，用于输出版本并行对比 artifacts。
3. 固化观测面板：方向一致率、状态分布、触发率、回撤控制。
   - 现已在周验收脚本中收口为固定面板，并支持按 `strategy_version` 观察。
4. 参数调优固化执行顺序（单参数小步迭代）：
   - 优先放宽进场触发相关阈值（`breakout_volume_mult` / `momentum_change_threshold`），观察 `TriggeredLong coverage`。
   - 同步监控 `RiskOff` 占比与最大回撤，避免以覆盖率换风险失控。
   - 每轮仅改 1 个参数，按周固化决策日志。
   - 现已在 `backend/scripts/run_tradeability_weekly_calibration.py` 中按固定顺序执行。

---

## 6. 非目标（当前阶段）

1. 不以“压缩 token”作为目标本身。
2. 不为追求速度牺牲分析信息完整性。
3. 不在本阶段改动前端交互与视觉层。

---

## 7. 下一阶段执行计划（Plan 41 Draft）

当前 `Plan 40` 的智能侧主线已基本完成，下一阶段不再以“继续定义双层架构”为重点，而转入“数据增强 + 历史观测重建 + 生产影子运行”的执行阶段。

### 7.1 阶段目标

1. 不等待未来数周自然积累数据，而是通过增强本地数据和历史回灌，提前重建 Layer-1 观测面板。
2. 用时间窗口而不是单次全样本汇总来判断 `tradeability_v2` 是否具备稳定性。
3. 在历史重建证据充分后，再进入生产 sidecar 并行观察，而不是直接切默认版本。

### 7.2 执行顺序

#### Step 1: 数据底座增强

目标：

1. 扩充本地 `daily_prices` 的有效样本覆盖。
2. 确保目标市场下有足够标的、足够交易日、足够完整的技术字段。

验收口径：

1. 样本覆盖不再停留在“少量在线样本”。
2. `ma5 / ma10 / ma20 / macd_hist / change_percent` 缺失率可接受。
3. 本地数据可支撑 `tradeability_v1/v2` 的历史重算。

#### Step 2: 历史 Sidecar 回灌

目标：

1. 对过去时间区间按交易日重算 `tradeability_v1` 和 `tradeability_v2`。
2. 将结果批量写入 `quant_tradeability_signals`，形成可分析的历史状态表。

验收口径：

1. `quant_tradeability_signals` 不再只有单日样本。
2. 可按 `date + strategy_version + market` 查询连续状态分布。
3. 可直接生成 `TriggeredLong / Watch / RiskOff / NoSetup` 的日度轨迹。

#### Step 3: 时间窗口观测框架

目标：

1. 固定使用滚动窗口分析，而不是只看全样本平均值。
2. 形成对 `tradeability_v1/v2` 的统一观测口径。

默认窗口：

1. `60` 交易日
2. `120` 交易日
3. `250` 交易日
4. 三段 walk-forward 窗口

核心指标：

1. 方向一致率
2. 状态分布
3. `TriggeredLong coverage`
4. `RiskOff` 占比
5. `Watch -> TriggeredLong` 转化
6. 回撤控制

#### Step 4: 决策与生产影子运行

目标：

1. 从历史重建结果中筛出一个最优 `tradeability_v2` 候选。
2. 仅将该候选放入生产 sidecar 并行观察，不直接切默认。

验收口径：

1. 多窗口下指标稳定，不依赖单周尖峰。
2. 与 `tradeability_v1` 相比，覆盖率改善不是以风险失控为代价。
3. 满足 `39_Tradeability_Dual_Lane_Operations.md` 中的 `v2 Default Promotion Gate` 前，不允许切默认。

### 7.3 阶段产出物

1. 数据增强后的本地样本底座。
2. 历史 sidecar 回灌脚本与结果表。
3. 时间窗口观测脚本或报表 artifacts。
4. `tradeability_v2` 是否允许进入生产影子运行的结论。

### 7.4 当前建议

下一步优先级如下：

1. 先增强本地数据。
2. 再做 `quant_tradeability_signals` 历史回灌。
3. 然后做窗口化观测。
4. 最后再进入生产影子运行。

结论：

下一阶段的关键，不再是“再写一个智能计划文档”，而是把 Layer-1 从“当前在线单日可观察”推进到“历史窗口可验证、可比较、可决策”。

### 7.5 当前本地执行进展（2026-03-06）

Plan 41 的前三步已在本地完成，且不依赖等待未来数周自然积累线上观测。

#### Step 1 完成：本地数据底座增强

执行脚本：

1. `backend/scripts/enhance_local_tradeability_data.py`

本地 CN 样本底座已从小样本扩展到研究可用规模：

1. `daily_prices` 覆盖标的数：`79 -> 499`
2. `daily_prices` 总行数：`37907 -> 254429`
3. 最近交易日覆盖标的数：`73 -> 495`
4. 当前板块分布：
   - `6` 开头：`222`
   - `0` 开头：`144`
   - `3` 开头：`133`

样本选择口径：

1. 优先保留 `global_stock_pool` 已关注标的。
2. 保留已有历史覆盖样本，避免研究口径断裂。
3. 对 CN 使用 `6/0/3` 板块分层配额，而不是简单按代码顺序抓取。
4. 排除 `ST / *ST / 退市` 名称，避免异常样本污染。

结论：本地样本已从“中等规模研究样本”进一步扩展到接近 `500` 标的的横截面研究底座，足以支撑更高置信度的 `tradeability_v2` 稳定性验证。

#### Step 2 完成：历史 Sidecar 回灌

执行脚本：

1. `backend/scripts/backfill_tradeability_history.py`

本地 `quant_tradeability_signals` 已完成历史回灌：

1. 回灌行数：`487924`
2. 覆盖标的：`498`
3. 策略版本：`tradeability_v1 / tradeability_v2`
4. 日期范围：`2024-01-30 ~ 2026-03-06`

补充运维结论：

1. 在接近 `500` 标的样本下，SQLite 本地回灌应使用分批提交，而不应单事务一次性写入全部 sidecar 历史。
2. 当前回灌脚本已按批次写入，能够稳定支撑本地大样本研究。

结论：本地观测面板已不再依赖单日 sidecar 结果，而具备连续历史状态轨迹，并且具备大样本可重复回灌能力。

#### Step 3 完成：时间窗口观测框架

执行脚本：

1. `backend/scripts/observe_tradeability_windows.py`

产物：

1. `tmp/tradeability_observability/cn_window_observability.json`
2. `tmp/tradeability_observability/cn_window_observability.md`

固定窗口：

1. `rolling_60`
2. `rolling_120`
3. `rolling_250`
4. `walk_forward_1/2/3`

当前结论：

1. 扩样后，`tradeability_v2` 相对 `v1` 的优势没有被推翻。
2. `v2` 依然表现为“更高 TriggeredLong 覆盖 + 更高 RiskOff 占比”。
3. 这说明下一阶段应继续围绕 `v2` 做稳定性验证，而不是回退到 `v1`。

#### 当前本地最优 `tradeability_v2` 基线

经 `backend/scripts/run_tradeability_weekly_calibration.py` 在扩容后的 CN 样本上按单参数顺序调优后，当前本地研究基线参数更新为：

```json
{
  "vcp_ratio": 1.0,
  "breakout_volume_mult": 0.9,
  "strong_close_threshold": 0.55,
  "momentum_change_threshold": 2.3,
  "risk_off_ma": 5
}
```

对应全窗口对比结果：

1. `tradeability_v1`
   - `Triggered coverage = 1.91%`
   - `RiskOff = 52.17%`
   - `Max DD = 93.80%`
   - `T+3 win = 47.35%`
2. `tradeability_v2`
   - `Triggered coverage = 5.10%`
   - `RiskOff = 53.83%`
   - `Max DD = 85.71%`
   - `T+3 win = 49.47%`

关键判断：

1. 新 `v2` 已在接近 `500` 标的的本地样本下稳定跨过 `TriggeredLong coverage > 5%` 目标线。
2. `RiskOff` 仍偏高，但并未高到足以推翻 `v2` 的相对优势。
3. 在继续获得更长历史或更大样本前，不建议再做大幅调参；应先将该参数组作为新的本地研究基线。

#### 下一步建议

1. 以当前 `tradeability_v2` 参数作为本地研究默认基线，并冻结为下一阶段的比较基准。
2. 下一轮调优目标不再优先追求更高 `TriggeredLong coverage`，而应转向“收益质量优化”：
   - 降低无效触发和过高的 `Watch -> TriggeredLong`
   - 控制 `RiskOff` 占比与最大回撤
   - 优先微调 `vcp_ratio` 与 `strong_close_threshold`，而不是继续大幅放宽进场阈值
3. 将当前 Layer-1 四状态整理成面向普通投资者可执行的动作语言：
   - `TriggeredLong -> 可尝试建仓`
   - `Watch -> 继续观察`
   - `RiskOff -> 暂停新增仓位 / 已有仓位应收缩`
   - `NoSetup -> 不建议出手`
4. 在满足 `39_Tradeability_Dual_Lane_Operations.md` 中的 `v2 Default Promotion Gate` 前，不做默认切换。

#### 下一阶段执行重点（Plan 41.5）

下一阶段的重点，不是让 `v2` “更频繁出手”，而是让 `v2` “更会挑机会，并把防守信号翻译成人能执行的动作建议”。

执行顺序：

1. 先冻结当前 `v2` 为研究基线，不继续做大幅参数漂移。
2. 再进行一轮收益质量导向的保守微调。
3. 同步定义并固化普通投资者可理解的动作语言。
4. 最后再进入线上 sidecar 影子观察，验证动作语言与历史回放是否一致。
