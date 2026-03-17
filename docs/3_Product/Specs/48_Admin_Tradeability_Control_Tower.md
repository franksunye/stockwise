# 功能规格说明书：Admin Tradeability Control Tower (Spec 48)

> 定位：面向内部运营、量化、工程的 PC 端控制台。
> 本 Spec 聚焦“Research Lane / Production Lane / Promotion Center”的统一展示与操作边界，用于产品、前端、后端统一实现。

> 关联文档：
> - `docs/1_Engineering/archive/17_Tradeability_Promotion_Execution_Plan.md`
> - `docs/2_Intelligence/27C_Dual_Lane_Operations_Manual.md`
> - `docs/2_Intelligence/archive/41_Tradeability_Quality_and_Actionability_Plan.md`
> - `docs/1_Engineering/16_Observability_Thresholds_and_Incidents.md`
>
> 专项状态：
> - Investment Mode / Tradeability 专项已完成，本文继续作为现行后台规格

> 术语约定：
> - 中文统一使用“生产线 / 实验线”。
> - 英文统一对应 `Production Decision Lane / Research Quant Lane`。

---

## 0. 背景与问题

当前系统已经具备：
- 双流水线：`Research Quant Lane` 与 `Production Decision Lane`
- 周度实验与验收：`calibration / experiment / acceptance / promotion verdict`
- 生产级升级机制：`approve / promote / rollback / audit`

但 Admin 侧仍是散点能力：
- `/admin` 偏系统概况
- `/admin/observability` 偏运行观测
- 缺少一屏收口的“策略实验与升级控制塔”

因此，当前缺口不是后端机制，而是：

**缺少一个让团队能快速回答“现在研究到哪、线上跑什么、能不能升级、出了问题怎么回滚”的统一 Admin 界面。**

---

## 1. 核心目标（Goal）

把 tradeability 的双流水线、实验门禁、生产升级和回滚审计，统一收口到一个 PC 端 Admin 控制台里。

这份控制台必须解决 4 个问题：

1. 实验线当前跑到哪里了
2. 生产线当前用的是什么版本，表现如何
3. 当前 candidate 能不能 promotion，卡在哪
4. 最近谁做了 approve / promote / rollback

---

## 2. 用户与使用场景

### 2.1 目标用户

- 运营负责人
- 量化研究负责人
- 后端工程负责人
- Admin 值班人员

### 2.2 高频场景

1. 早上查看昨晚双流水线是否正常
2. 周度查看 `v1 / v2 / future_v3` 的实验结果
3. 判断某个 candidate 是否满足 promotion 条件
4. 审核后执行 promotion
5. promotion 后观测生产效果
6. 异常时快速判断是否 rollback

---

## 3. 信息架构（IA）

新增统一页面：

- `/admin/tradeability`

页面分为 4 个一级模块：

1. `System Overview`
2. `Research Lane`
3. `Production Lane`
4. `Promotion Center`

页面原则：

- 一屏先给结论，再允许下钻
- 默认展示当前 active market：`CN / HK`
- 默认展示当前 candidate 与 baseline
- 所有复杂 artifact 使用渐进披露

---

## 4. 页面结构（UI Blueprint）

### 4.1 顶部总览区（Executive Summary）

顶部必须固定展示 6 张摘要卡：

1. 当前生产版本
   - 例：`tradeability_v2`
2. 当前研究候选
   - 例：`tradeability_v2` / `future_v3`
3. Promotion Gate
   - `PASS / FAIL / HOLD`
4. Pass Streak
   - 例：`0w / 2w / 4w`
5. Production Health
   - `Healthy / Warning / Critical`
6. Last Action
   - 最近一次 `approve / promote / rollback`

摘要卡目标：

- 不进入明细也能做第一判断
- 管理层 10 秒内知道当前状态

### 4.2 System Overview

用于回答：“系统现在整体健康么？”

展示内容：

- `daily pipeline success rate`
- `mode pipeline success rate`
- `api_latency_p95_ms`
- `confidence_low_ratio_7d`
- `latest trading date`
- `latest prediction date`
- `latest mode snapshot date`
- `observability status`

展示规则：

- 绿色：达标
- 黄色：接近门限
- 红色：未达标
- 所有指标显示当前值、阈值、最近趋势

### 4.3 Research Lane（实验线）

用于回答：“实验线最近谁更好？”

展示内容：

- `candidate_version`
- `baseline_version`
- 最近 `2~4` 周 rolling verdict
- weekly calibration 摘要
- weekly experiment 摘要
- weekly acceptance 摘要
- `consistency`
- `triggered_coverage`
- `watch_to_trigger`
- `drawdown_control`
- `observability_gate`

展示形式：

- 左侧版本对比表
- 右侧周度时间线
- 底部 artifact 折叠区

关键要求：

- 必须能同屏看到 `candidate vs baseline`
- 必须能一眼看到 blocking reasons

### 4.4 Production Lane

用于回答：“线上现在在跑什么，真实表现如何？”

展示内容：

- 当前 active strategy version
- 当前 active mode bundle
- 默认模式重点卡（当前默认模式仍需单独重点展示）
- `mode_performance_snapshot`
- `hit_rate`
- `payoff_ratio`
- `max_drawdown`
- `stability_score`
- `sample_size`
- 最近 7d / 30d / 90d 趋势

展示形式：

- 顶部 KPI
- 中部按 `mode_id` 的表现表
- 底部 market tabs：`CN / HK`

关键要求：

- 研究指标与产品指标必须明确分区
- 不允许把 `quant_tradeability_signals` 误当作用户侧正式表现
- 当前后台以“各模式分别看绩效”为主，不把模式总和作为核心管理指标
- 展示目标是判断每个投资模式分别为用户提供了什么价值
- `稳健 / 平衡 / 进取` 作为核心模式进入同类比较视图
- `仅观察` 需以特殊模式标记展示，不参与与 `稳健 / 平衡 / 进取` 的同类最优比较
- 绩效展示属于模式价值评估，不得被表达为收益承诺或营销式胜率排行
- `hit_rate`、`payoff_ratio`、`stability_score` 默认应伴随 `sample_size`、时间窗和风险指标一起展示，避免单指标误导

### 4.5 Promotion Center

用于回答：“能不能升，谁批的，怎么切，怎么退？”

展示内容：

- current verdict
- blocking reasons
- recommended action
- latest approval artifact
- latest promotion action
- latest rollback action
- `promotion_audit_log` 时间线

操作入口：

- `Approve`
- `Execute Promotion`
- `Rollback`

操作原则：

- UI 可以发起动作
- 真正执行仍必须走受控后端 API
- 所有动作都必须写审计
- promotion verdict 应逐步从“单默认模式判断”升级为“三核心模式治理判断”
- 真正执行仍以 bundle 为单位，而不是把每个模式拆成彼此独立的升级动作

---

## 5. 核心状态模型（State Model）

控制塔必须统一使用以下状态口径：

### 5.1 Gate Verdict

- `PASS`
- `FAIL`
- `HOLD`

定义：

- `PASS`：满足 promotion gate，允许进入审批/执行
- `FAIL`：存在明确阻塞，不允许 promotion
- `HOLD`：数据不完整或观察窗口未满，不下升级结论

### 5.2 Production Health

- `Healthy`
- `Warning`
- `Critical`

定义：

- `Healthy`：所有核心运行指标达标
- `Warning`：有轻微偏离，但不必阻断
- `Critical`：必须显著告警，并阻断 promotion

### 5.3 Promotion Action Status

- `idle`
- `approved`
- `executed`
- `rolled_back`
- `rejected`

---

## 6. 前后端契约（API Contract）

新增一个聚合 API 组：

### 6.1 `GET /api/admin/tradeability/summary`

返回顶部总览：

- `active_market`
- `production_version`
- `candidate_version`
- `promotion_gate_status`
- `pass_streak_weeks`
- `production_health`
- `last_action`

### 6.2 `GET /api/admin/tradeability/research`

返回实验线数据：

- `market`
- `candidate_version`
- `baseline_version`
- `rolling_verdict`
- `weekly_acceptance`
- `weekly_experiment`
- `weekly_calibration`
- `blocking_reasons`

### 6.3 `GET /api/admin/tradeability/production`

返回生产线数据：

- `market`
- `active_strategy_version`
- `active_mode_bundle`
- `performance_snapshots`
- `health_metrics`

### 6.4 `GET /api/admin/tradeability/promotion`

返回升级中心数据：

- `current_verdict`
- `approval_artifact`
- `latest_promotion`
- `latest_rollback`
- `audit_timeline`

### 6.5 `POST /api/admin/tradeability/approve`

作用：

- 生成审批产物
- 不直接切生产

### 6.6 `POST /api/admin/tradeability/promote`

作用：

- 基于审批产物执行 promotion

要求：

- 没有 approval artifact 时必须拒绝

### 6.7 `POST /api/admin/tradeability/rollback`

作用：

- 回滚到上一个稳定版本或显式指定版本

---

## 7. 数据来源与边界

### 7.1 Research Lane 数据源

- `quant_tradeability_signals`
- weekly acceptance artifacts
- weekly experiment artifacts
- weekly calibration artifacts
- promotion verdict artifacts

### 7.2 Production Lane 数据源

- `mode_decision_log`
- `mode_simulated_trade_ledger`
- `mode_performance_snapshot`
- `task_logs`
- `api/admin/observability` 同源指标

### 7.3 审计数据源

- `promotion_audit_log`

### 7.4 强制边界

- `Research Lane` 不等于用户侧正式结果
- `Production Lane` 才是产品真实口径
- UI 中必须用明确标题和标签区分两者

---

## 8. 权限与安全

该页面仅对管理员开放。

强制要求：

- 复用现有 admin 鉴权
- 所有写操作必须记录 `operator`
- 所有写操作必须要求二次确认
- `promote` 与 `rollback` 必须落审计

高风险操作约束：

- `Approve`：中风险
- `Execute Promotion`：高风险
- `Rollback`：高风险

---

## 9. UI 原则

### 9.1 PC 优先

- 页面只为 PC Admin 设计
- 首屏宽度优先服务“同屏对比”和“时间线阅读”

### 9.2 先结论后细节

- 顶部卡片先给结论
- 明细区再给证据
- 原始 JSON/Markdown artifact 默认折叠

### 9.3 明确颜色系统

- 绿色：通过/健康
- 黄色：观察/警告
- 红色：失败/阻断
- 灰色：未知/无数据

### 9.4 避免误导

- 禁止把研究指标装饰成用户收益结论
- 禁止混淆 `candidate` 与 `production`
- 禁止在同一组件里混用不同口径的 KPI

---

## 10. 验收标准（Done）

- [ ] `/admin/tradeability` 已存在，并成为双流水线统一入口
- [ ] 顶部总览区可在 10 秒内回答“现在能不能 promotion”
- [ ] Research Lane 能同屏展示 `candidate vs baseline`
- [ ] Production Lane 能清晰展示当前线上版本与真实产品表现
- [ ] Promotion Center 能展示 `approve / promote / rollback` 的最新状态
- [ ] 审计时间线可查看最近至少 20 条操作记录
- [ ] 所有写操作都经过后端受控 API，而不是前端直改
- [ ] 所有关键指标都能显示“当前值 + 阈值 + 状态”
- [ ] 页面明确区分研究口径与生产口径

---

## 11. 分阶段实施建议

### Phase 1

- 新增 `/admin/tradeability`
- 接 summary / research / production / promotion 四个只读 API
- 先完成统一展示

### Phase 2

- 接入 `approve / promote / rollback` 操作
- 接入 `promotion_audit_log` 时间线

### Phase 3

- 增加 market compare
- 增加 artifact drill-down
- 增加异常定位快捷入口

---

## 12. 一句话定义

**Admin Tradeability Control Tower 不是普通后台报表页，而是你们双流水线实验、验证、升级、回滚的统一驾驶舱。**
