# 17 Tradeability Promotion Execution Plan

更新时间：2026-03-09  
状态：Completed  
定位：Promotion 工程收口记录（保留作执行历史）  
当前主依据：
- `docs/2_Intelligence/39_Tradeability_Dual_Lane_Operations.md`
- `docs/1_Engineering/14_Investment_Mode_Backend_Runbook.md`
- `docs/3_Product/Specs/48_Admin_Tradeability_Control_Tower.md`

## 1. 结论

基于最近主干提交与现有代码状态，`tradeability` 的下一个大项不是继续补单个 workflow，也不是继续做前端文案 polish，而是：

**把 `research -> validate -> promote -> serve users` 的后半段工程化，重点完成 Promotion/Gate Automation。**

换句话说：

1. `research` 已经基本具备：
   - nightly sample sync
   - sidecar daily
   - weekly calibration
   - weekly experiment
2. `validate` 也已经具备基础能力：
   - weekly acceptance snapshot
   - Layer-1 consistency
   - observability metrics
3. 但 `promote -> serve users` 还没有形成可执行闭环：
   - 没有统一的 promotion verdict 产物
   - 没有自动判断“是否允许推进默认版本/模式包”
   - 没有将研究结论稳定写回产品配置层

以上缺口现在已补到第一版闭环：

1. `metrics_tradeability_promotion.py` 负责 verdict
2. `approve_tradeability_promotion.py` 负责审批产物
3. `promote_tradeability_bundle.py` 负责受控切换
4. `rollback_tradeability_bundle.py` 负责回滚
5. `promotion_audit_log` 负责审计留痕

因此，本轮最值得投入的工程主线被定义为：

**Tradeability Promotion Lane**

## 2. 已有基础

### 2.1 Research Lane 已存在

现有 workflow / 脚本已经覆盖：

- `tradeability_postclose_pipeline.yml`
- `tradeability_sample_sync_daily.yml`
- `tradeability_sidecar_daily.yml`
- `tradeability_sidecar_weekly_calibration.yml`
- `tradeability_experiment_weekly.yml`

对应脚本：

- `backend/scripts/run_tradeability_sample_sync.py`
- `backend/scripts/run_tradeability_sidecar.py`
- `backend/scripts/run_tradeability_weekly_calibration.py`
- `backend/scripts/run_tradeability_experiment.py`
- `backend/scripts/backfill_tradeability_history.py`

### 2.2 Validation Lane 已存在

现有验证与可观测能力：

- `acceptance_weekly.yml`
- `layer1_consistency_daily.yml`
- `backend/scripts/metrics_acceptance_weekly.py`
- `backend/scripts/metrics_layer1_consistency.py`

其中 `metrics_acceptance_weekly.py` 已经能输出：

- `consistency_gate`
- `triggered_coverage_gate`
- `watch_to_trigger_gate`
- `drawdown_control_gate`
- `observability_gate`
- `level1_pass`

### 2.3 Action Language 基本已落地

动作语言不是当前最大缺口，因为代码已经存在固定映射：

- `backend/engine/models/rule_based.py`
- `backend/engine/chain/steps/synthesis.py`
- `frontend/src/lib/layer1-ui.ts`

当前真实问题不是“有没有动作语言”，而是“研究结论如何推进到正式产品口径”。

## 3. 本轮收口前的真实缺口

### 3.1 缺口 A：只有 weekly snapshot，没有 promotion verdict

当前 `metrics_acceptance_weekly.py` 会输出 gate 结果，但它仍然停留在“报告层”：

1. 有 artifact
2. 有 PASS / FAIL
3. 但没有明确产出：
   - `promote_candidate = true/false`
   - `promotion_reason`
   - `hold_reason`
   - `recommended_next_action`

因此系统目前能“看见结果”，但还不能“驱动升级决策”。

### 3.2 缺口 B：Promotion Gate 没有滚动窗口化

文档要求 `2~4` 周连续观察后再判断默认替换，但当前自动化主要还是单周 artifact。

缺失内容：

1. 过去 `2~4` 周 gate 的连续性汇总
2. 是否“连续通过”而不是“某一周偶然通过”
3. 版本间滚动比较（`v1` vs `v2`）
4. 可直接消费的 go / no-go 结论

### 3.3 缺口 C：研究决策没有写回产品配置层

当前研究链路会生成 calibration / experiment artifact，但没有一个稳定入口把结果推进到：

- `backend/investment_mode.py`
- `frontend/src/lib/investment-mode.ts`
- 未来的模式参数包治理层

也就是说：

1. 研究能产结论
2. 产品配置能消费版本
3. 但两者之间没有明确的“升级提交点”

### 3.4 缺口 D：Production Effect 指标没有成为 promotion 条件的一部分

当前 acceptance 主要覆盖：

- consistency
- coverage
- watch-to-trigger
- drawdown
- observability

但尚未完整纳入正式产品结果层的表现：

- `mode_performance_snapshot`
- payoff ratio
- stability score
- hit rate 的连续窗口趋势

如果 promotion 不接入这些指标，系统仍然可能停留在“研究效果不错，但用户层结果未被验证”的状态。

## 4. 本轮完成结果

本轮已完成以下收口：

1. `metrics_tradeability_promotion.py` 已升级为三核心模式治理：
   - `steady_v1`
   - `balanced_v1`
   - `aggressive_v1`
2. `observe_only_v1` 已明确排除在核心 promotion 门禁之外。
3. approval artifact、promotion flow、Admin API、Admin 页面已承接新的治理字段。
4. promotion 相关后端单测已补齐并跑通。

因此，本文件后续不再作为主执行入口，而保留为：

- 为什么要建设 Promotion Lane 的背景记录
- 本轮工程闭环的历史说明

## 5. 下一个大项的工程定义

### 大项名称

**Promotion Lane Automation**

### 目标

将当前已有的：

- sample sync
- sidecar
- weekly calibration
- weekly acceptance

收敛为一条真正可执行的升级决策链路：

`research artifacts -> rolling evaluation -> promotion verdict -> product config update`

## 6. 执行拆解

### P0.1 产出统一 Promotion Verdict

新增一个明确的脚本或模块，例如：

- `backend/scripts/metrics_tradeability_promotion.py`

职责：

1. 读取最近 `2~4` 周的 acceptance / calibration / experiment artifact
2. 汇总为单个 verdict JSON/MD
3. 输出：
   - `candidate_version`
   - `window_start/window_end`
   - `promotion_gate_pass`
   - `pass_streak_weeks`
   - `blocking_reasons`
   - `recommended_action`

验收：

1. 可在 CI 中直接运行
2. 输出单一 verdict，而不是让人手工拼多个 artifact

### P0.2 建立 Rolling Gate Workflow

新增 workflow，例如：

- `.github/workflows/tradeability_promotion_gate.yml`

职责：

1. 每周在 calibration / acceptance 之后运行
2. 读取近 `2~4` 周历史
3. 形成统一 go / no-go
4. 推送 artifact 与 webhook 摘要

验收：

1. 每周有固定 promotion verdict
2. 明确写出：
   - 是否允许进入下一阶段
   - 若不允许，卡在哪一条 gate

### P0.3 明确“研究结果 -> 产品配置”升级入口

新增一个受控升级脚本，例如：

- `backend/scripts/promote_tradeability_bundle.py`

职责：

1. 接受 promotion verdict 的结果
2. 只在人工确认后修改产品配置
3. 优先修改模式参数包，而不是直接散改多处代码

建议策略：

1. 不直接改 `DEFAULT_STRATEGY_VERSION`
2. 优先改 mode bundle / params bundle 的映射
3. 保留可回滚记录

当前已完成第一版：

1. `promote_tradeability_bundle.py` 在 `--execute` 时默认要求 `approval_json`
2. `approve_tradeability_promotion.py` 会把 PASS verdict 变成显式审批产物
3. `rollback_tradeability_bundle.py` 支持显式版本回滚，也支持从最近一次 applied promotion audit 推断回滚目标
4. 所有步骤都会写 `promotion_audit_log`

### P1.1 把 Production Effect 指标接入 Promotion Gate

扩展当前周验收逻辑，纳入：

- `mode_performance_snapshot`
- hit rate
- payoff ratio
- stability score
- sample size

目标：

1. Promotion 不只看研究侧 `quant_tradeability_signals`
2. 还看用户正式展示链路的结果是否稳定
3. 核心治理对象从“单默认模式”升级为“三核心模式”，默认模式继续重点展示

当前已完成第一版：

1. `metrics_tradeability_promotion.py` 已接入 `mode_performance_snapshot`
2. 当前 verdict 已升级为三核心模式治理，并保留 `balanced_v1 / universal / 30d` 作为默认模式重点视图
3. 已纳入 gate：
   - `sample_size`
   - `hit_rate`
   - `max_drawdown`
   - `payoff_ratio`
   - `stability_score`
4. gate 结果会进入：
   - `promotion_gate_pass`
   - `blocking_reasons`
   - promotion verdict artifact

本轮最终执行口径为：

1. `稳健 / 平衡 / 进取` 三个核心模式进入 promotion 治理视角
2. `平衡` 保持默认模式重点展示
3. `仅观察` 不参与核心模式同类比较与 promotion 核心门禁
4. 真正 promote / rollback 仍以 mode bundle / params bundle 为执行单位

### P1.2 收口前台动作语言

虽然动作语言已存在，但还可做一次统一收口：

1. 统一文案词典
2. 明确 `TriggeredLong / Watch / RiskOff / NoSetup` 的 UI 文案主口径
3. 避免 `建议进场 / 建议观察 / 建议防守 / 暂无信号` 与文档中的“可尝试建仓 / 继续观察 / 暂停新增仓位 / 不建议出手”长期漂移

这项是重要项，但不是当前最大工程阻塞。

## 6. 一周内建议顺序

### Day 1-2

完成 `metrics_tradeability_promotion.py`

输出：

1. 单一 promotion verdict JSON
2. 单一 promotion verdict Markdown
3. 支持读取近 2~4 周窗口

### Day 3

新增 `tradeability_promotion_gate.yml`

输出：

1. 每周自动 verdict
2. webhook 摘要
3. artifact 留档

### Day 4

把 `mode_performance_snapshot` 指标接入 promotion verdict

### Day 5

补一个“人工确认后执行”的 promotion 脚本

输出：

1. 受控升级入口
2. 明确 rollback 口径

当前新增：

1. `promotion_audit_log`
2. verdict 生成时自动写审计
3. promotion dry-run / execute / noop 都会写审计
4. approval / rollback 也会写审计

下一步应继续补：

1. GitHub environment 级别审批门禁
2. 单一配置源，避免长期靠 source replacement
3. rollback 后的自动健康复核

## 7. 不建议当前优先做的事

以下事情有价值，但不应排在当前大项之前：

1. 再写更多 tradeability 理念文档
2. 再补单独的本地研究脚本
3. 继续做页面文案 polish
4. 直接把某个版本硬切成默认

原因：

当前真正缺的不是“研究能力”或“展示能力”，而是“升级决策的自动化中间层”。

## 8. 最终判断

如果只用一句话描述当前仓库的“下一个大项”，应写成：

**从 Research/Validation 走向 Promotion Automation，把 weekly acceptance 从“报告”升级成“可执行的升级决策系统”。**
