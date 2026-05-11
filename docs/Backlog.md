# 知守 AI (ZISO AI) 项目待办清单 (Backlog)

> 自 2026-05 起，Backlog 按「当前执行版本」维护：**仅保留 v1 国际版直接事项**。  
> 其它仍有价值但不属于 v1 交付面的工作，统一归档到 **Vx 候选池**（不占用当前执行优先级）。

---

## v1 国际版（当前执行面）

### A. Pricing / Learn / Support 权益一致性（P1）

#### A1. Academy Access（101 / Masters）产品承接补齐
- [ ] 明确 `pricing` 中 `Academy Access (101/Masters)` / `Master Logics` 的产品边界：当前可用内容、即将补齐内容、是否所有层级都包含。
- [ ] 在移动端 Learn 入口补 `Method Roots` / `Reference Library` 级别承接层，避免 pricing 已承诺 Masters 但 App 内只看到 101 列表。
- [ ] 优先上线 3-5 篇英文 `master_series` 样板，先覆盖 Mark Minervini、Van Tharp、Richard Wyckoff、Howard Marks、Market Wizards Reading Map。
- [ ] 在 pricing 文案、Learn 入口、Support FAQ 三处保持统一口径：Masters 是 Academy 参考库 / 方法源流，不是买卖建议或收益承诺。
- [ ] 验收标准：英文用户从 pricing 看到 `101/Masters` 后，可在 App 内或公开 Learn 入口找到对应 Masters 承接页；若内容仍在补齐中，页面必须明确标注当前可用范围与 upcoming 状态。

### B. v1 层级权益与后台供给对齐（P1/P2）

#### B1. Tier SLA / 模型预算最小闭环（面向 free/go/plus）
- [ ] 聚合 watcher demand：`free/go/plus`、活跃用户、locale、持仓/自选优先级。
- [ ] 定义 `tier -> model_policy -> budget -> priority`，并输出每日 token / 成本 / 成功率报表。
- [ ] 验收标准：`free/go/plus` 的前端权益与后台生产策略一致，核心自选股在 SLA 内完成。

### C. v1 体验体感优化（P1）

#### C1. Dashboard 冷启动 / 回前台价格滞后优化
- [ ] 先加 P0 观测：记录 `cache_age_on_hydrate`、`time_to_first_price_refresh_after_mount`、`resume_event_fired`。
- [ ] 冷启动后增加一次价格层主动刷新（仅 price channel，不触发 batch 重拉）。
- [ ] 回前台加入一次补拉策略（例如首拉 + 短延时补拉），提升恢复稳定性。
- [ ] 验收标准：冷启动与前后台切换后，价格刷新体感明显改善，且不引入闪烁与重骨架。

---

## Vx 候选池（不属于当前 v1 执行面）

> 这些事项仍有价值，但不占用 v1 执行优先级。需要启用时再迁回上方「v1 国际版」。

### Vx-A 量化引擎与双层架构演进
- 双层架构 #2 参数迭代（`TriggeredLong` 覆盖、RiskOff 占比、最大回撤联动验收）
- 乖离率（Bias）物理级强制拦截与高乖离样本回放

### Vx-B Pipeline 深度重构与编排升级
- Daily Pipeline - A Share 事件后续（可观测性、回填入口一致化、失败隔离、补缺口 SOP）
- 编排状态机统一、Analyze/Backfill 执行器收敛、`prediction_jobs` 队列化执行
- Context 预物化与两层生产、商业策略层深度落地

### Vx-C 平台治理与工程基础设施
- 高级质量工程（Signal SSOT、TS union、跨层一致性校验、历史数据清洗、LLM 审计）
- Cloudflare Scheduler 配额治理与统一编排（cron 分层、配置化路由、DO alarms 迁移）

### Vx-D 领域模型与数据治理深化
- Phase 1.5 表级审计收口：46 张表 domain/role/owner/read-write/retention 完整盘点
- canonical / shadow / projection / deprecated 标注体系与新增表 guardrail

### Vx-E Paper Portfolio Lab / AI Thesis Tracking
- 英文站 Paper Portfolio Lab 增长实验：Phase 0.1 已调整为独立英文实验页 `/paper-portfolio-lab`，并在英文 footer 保留轻入口；用于验证用户对 AI-assisted thesis tracking / paper portfolio lab 的兴趣，不接入后台用户级模拟交易功能，也不占用英文首页主叙事。
- 阶段路线见 `docs/4_Growth_Ops/51_Paper_Portfolio_Lab_Experiment_Plan_20260509.md`。
- 下一步：观察 `paper_lab_view` / `paper_lab_cta_click` / `paper_lab_case_open`，若出现明确兴趣信号，再进入 Phase 1 公开实验页设计。
- 0.1 上线后诊断待办：品牌视觉与首页主行为色脱钩、`PageShell currentPage="home"` 引发顶部 Features/FAQ 锚点失效与语言切换器丢上下文、`paper_lab_waitlist_submit` 文档列了但实现未接，详细清单与 P0/P1/P2 分级见上述实验计划第 11 节，待启动 Phase 0.1 修补轮再迁回 v1 执行面。

---

## 使用规则

1. 「v1 国际版」只记录未来 2-4 周内有望进入执行的事项。
2. 单条事项应尽量短、明确、可验收，避免写成长方案。
3. 已完成事项直接移除，不在 Backlog 中保留历史痕迹。
4. 与 v1 无直接关系的事项，不写在当前执行面，统一放入「Vx 候选池」。
5. 只有当事项被确认纳入当前版本目标时，才从「Vx 候选池」迁回「v1 国际版」。

## 维护流程

1. 每周整理一次，优先在周初或 Sprint 切换时更新。
2. 新事项先问一句：它是否直接服务 v1 国际版交付。
3. 如果答案是“是，而且未来 2-4 周会做”，写入「v1 国际版」。
4. 如果答案是“有价值，但不在 v1 当前窗口”，写入「Vx 候选池」。
5. 如果答案是“已经完成、已经过时、或者短期内不会做且没有明确战略价值”，直接移除。
6. 每次整理 Backlog 时，同时复核一次里程碑日志，避免事项在多处重复存在。

---

## 开发原则

1. 先验证，后预测。
2. 所有 AI 分析都必须有对应数值支撑。
3. 指标缺失时默认返回 `Side/观望`，零容忍幻觉。
4. 优先覆盖新股、停牌、退市等边界情况。
5. 后台任务失败必须通知，不能静默失败。

---

**最后更新**: 2026-05-09
