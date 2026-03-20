# 内容运营系统总纲 (Content Operations Master Guide)

**Last Updated:** 2026-03-19
**Status:** Draft for Execution
**Scope:** `docs/4_Growth_Ops` + `docs/5_Support_Ops` + content sync / traceability scripts

## 1. 为什么现在要做这件事

StockWise 已经拥有三套分散但非常有价值的能力：

1. **内容发布看板**：通过 `scripts/cmo_sync.mjs` 汇总各篇内容的渠道发布状态。
2. **内容溯源治理**：通过 `scripts/content_audit.mjs` 追踪内容与底层产品/工程文档的 `source_docs` 关系。
3. **内容对齐清单**：通过 `41_Growth_Content_Alignment_Checklist.md` 识别“产品已有能力，但内容尚未完整覆盖”的缺口。

这些能力单独存在时，已经能帮助团队“知道有什么内容”和“知道内容有没有根据”。
但它们还没有组成一条真正的生产线，暂时无法稳定回答以下经营问题：

1. 下周可以发布哪几篇文章到公众号？
2. 我们最近修订了哪几篇文章？
3. 产品逻辑变化后，我们应该充实或复核哪些文章？
4. 哪些文章文案已通过，但封面、配图或社媒卡还没准备好？
5. 哪些内容视觉方向已经确定，但图片资产尚未审核通过？

这份蓝图的目标，就是把现有系统升级成一条可执行的内容生产线：

**产品研发变化 -> 内容资产识别 -> 文案生产 -> 视觉生产 -> 审核 -> 渠道发布 -> 修订回流**

---

## 2. 系统目标

### 2.1 核心目标

建立一套以 Markdown 为单一事实源的内容运营系统，让内容团队与产品/工程团队共用同一套事实与状态。

### 2.2 这套系统必须回答的经营问题

#### A. 发布决策问题

- 下周公众号可以发哪几篇？
- 哪些文章已经审核通过但还没有排期？
- 哪些 Support 内容适合转成 Growth 内容或公众号长文？
- 哪些文章文案已定稿，但视觉仍卡在封面或配图阶段？

#### B. 维护与修订问题

- 最近 7 天我们修过哪些文章？
- 哪些文章因为产品更新而需要复核？
- 哪些内容仍然是旧口径或高风险口径？
- 哪些内容正文已更新，但图片仍在沿用旧视觉表达？

#### C. 研发联动问题

- 新上线的产品能力，是否已有对应内容资产？
- 哪些底层文档已经很成熟，但还没有转成任何对外内容？
- 某个底层产品文档发生变化后，会影响哪些文章与支持内容？

### 2.3 管理分层规则

核心原则是：

- 战略写在文档里
- 状态写在系统里
- 事实写在资产里

---

## 3. 系统边界

### 3.1 内容来源目录

#### 来源 A: Growth 内容源

- `docs/4_Growth_Ops/content`
- 典型形态：`101` 系列、Campaign、增长长文、认知型文章

#### 来源 B: Support 内容源

- `docs/5_Support_Ops/content`
- 典型形态：FAQ、能力解释、规则说明、操作指南、术语说明

### 3.2 内容消费场景

同一篇内容资产可能服务多个下游场景：

1. 网站动态内容来源
2. 公众号长文
3. 小红书/头条/Twitter 改编稿
4. 产品内帮助中心
5. 客服答复引用素材
6. Campaign 素材池

### 3.3 核心设计原则

1. **不迁移正文**：正文仍留在原目录，不因为治理升级而搬家。
2. **Markdown 是事实源**：不引入第二套人工维护数据库。
3. **元数据驱动视图**：靠 frontmatter 统一生成看板与队列。
4. **主流程与分发分层**：内容主状态和各平台状态必须分开建模。
5. **研发变更可反查内容影响**：产品/工程文档更新后，能自动定位受影响内容。

### 3.4 上游事实源规范

如果 `docs/0_Strategy`、`docs/1_Engineering`、`docs/2_Intelligence`、`docs/3_Product` 是内容系统的真实来源，那么这些文档也必须具备可被系统稳定消费的写法。

最小要求：

1. 文件路径稳定，不频繁改名
2. 一篇文档只承载一个主要主题
3. 标题与术语尽量稳定，避免同一概念反复换名却没有说明
4. 如概念发生升级，需在源文档中明确“旧名 -> 新名”
5. 被大规模引用的源文档，应逐步补齐最小 frontmatter

建议的最小 frontmatter：

```yaml
---
title: ""
doc_id: ""
doc_domain: "product" # strategy | engineering | intelligence | product
doc_status: "active" # active | draft | deprecated | archived
owner: ""
last_reviewed_at: "2026-03-19"
summary: ""
---
```

这层规范的目标不是增加写作负担，而是让系统能够更稳地判断：

- 哪些内容引用了现行版本的源文档
- 哪些内容仍然依赖已废弃的事实源
- 哪些产品概念已改名，需要回扫站外旧内容

---

## 4. 内容资产模型

每篇内容不再只是“文章文件”，而是一个 **内容资产对象**。

### 4.1 内容资产的五层结构

#### 第一层：Asset Identity

定义这篇内容“是什么”。

```yaml
content_id: "growth-101-086"
title: "系统与直觉：在暴雪中，你该相信导航还是自己的眼睛？"
content_source: "growth" # growth | support
content_type: "article" # article | faq | guide | campaign | glossary | update
canonical_role: "canonical" # canonical | derivative
```

#### 第二层：Traceability

定义这篇内容“从哪里来”。

```yaml
source_docs:
  - docs/2_Intelligence/22Q_Quant_Research_Framework.md
traceability:
  status: "healthy" # healthy | review_needed | missing
  last_reviewed_at: "2026-03-19"
```

#### 第三层：Workflow

定义这篇内容“现在推进到哪一步”。

```yaml
workflow:
  stage: "drafting" # planned | drafting | reviewing | approved | scheduled | published | archived
  owner: "cmo"
  reviewer: "founder"
  priority: "high" # high | medium | low
  target_publish_date: "2026-03-26"
  last_action_at: "2026-03-19"
  blocked_reason: ""
```

#### 第四层：Distribution

定义这篇内容“在各个渠道分别走到哪一步”。

```yaml
distribution:
  website:
    enabled: true
    status: "live" # live | draft | hidden
  wechat:
    enabled: true
    status: "ready" # none | draft | ready | scheduled | published
    scheduled_at: "2026-03-26 21:00"
    url: ""
  xhs:
    enabled: false
    status: "none"
  twitter:
    enabled: false
    status: "none"
  toutiao:
    enabled: false
    status: "none"
```

#### 第五层：Visual Production

定义这篇内容“视觉生产推进到哪一步，以及图片资产是否交付完成”。

```yaml
visual_workflow:
  stage: "not_started" # not_started | briefing | prompt_ready | generating | reviewing | approved | delivered
  owner: ""
  reviewer: ""
  priority: "medium"
  target_ready_date: "2026-03-25"
  last_action_at: "2026-03-19"
  blocked_reason: ""
visual_assets:
  cover:
    required: true
    status: "missing" # missing | planned | generating | ready | approved
    path: ""
  body:
    required: true
    target_count: 2
    ready_count: 0
    status: "missing" # missing | partial | ready | approved
  cards:
    required: false
    target_count: 0
    ready_count: 0
    status: "not_needed" # not_needed | missing | partial | ready | approved
```

这层的目的不是重复写 `image_prompts / images / visual_strategy`。

它解决的是另一类管理问题：

1. 视觉现在是谁在负责
2. 视觉生产卡在 briefing、生成，还是审核
3. 封面、正文配图、社媒卡到底有没有交付完成

如果没有这一层，系统记录的只是“图片应该长什么样”，而不是“图片做到哪一步了”。

---

## 5. 统一 frontmatter 规范

以下是建议逐步过渡到的统一字段模型。

```yaml
---
title: ""
content_id: ""
content_source: "growth"
content_type: "article"
canonical_role: "canonical"
category: ""
funnel_stage: "TOFU"
campaign: ""
source_docs:
  - docs/...
traceability:
  status: "healthy"
  last_reviewed_at: "2026-03-19"
workflow:
  stage: "planned"
  owner: ""
  reviewer: ""
  priority: "medium"
  target_publish_date: ""
  last_action_at: "2026-03-19"
  blocked_reason: ""
maintenance:
  change_status: "stable" # stable | updated | review_needed
  update_reason: "" # product_change | copy_edit | strategy_shift | seo_refresh
  external_action: "" # verify_sync | refresh_existing | publish_replacement | archive_only
  external_status: "pending" # pending | in_progress | completed
  external_note: ""
content_lifecycle:
  status: "active" # active | superseded | archived
  superseded_by: ""
website:
  enabled: true
  surface: "learn" # learn | support | campaign | hidden
visual_workflow:
  stage: "not_started"
  owner: ""
  reviewer: ""
  priority: "medium"
  target_ready_date: ""
  last_action_at: "2026-03-19"
  blocked_reason: ""
visual_assets:
  cover:
    required: true
    status: "missing"
    path: ""
  body:
    required: true
    target_count: 2
    ready_count: 0
    status: "missing"
  cards:
    required: false
    target_count: 0
    ready_count: 0
    status: "not_needed"
distribution:
  wechat:
    enabled: true
    status: "draft"
    scheduled_at: ""
    url: ""
  xhs:
    enabled: false
    status: "none"
  twitter:
    enabled: false
    status: "none"
  toutiao:
    enabled: false
    status: "none"
---
```

### 5.1 与现有字段的兼容策略

为了平滑升级，旧字段先不废弃，脚本兼容读取：

- 旧 `publish` -> 新 `distribution`
- 旧 `date` -> 优先映射为 `workflow.target_publish_date`
- 旧 `source_docs` -> 继续保留，作为溯源核心字段

兼容期内的原则：

1. 老文章可以继续只写旧字段
2. 新脚本优先读取新字段，没有则回退读取旧字段
3. 新增或大修文章优先补齐新字段

### 5.2 视觉字段的治理规则

图片在内容系统里不再只是“附件”，而是文章生产的一部分。

因此建议建立以下硬约束：

1. `workflow.stage = approved` 只代表文案通过，不等于整篇内容已具备发布条件。
2. 若 `visual_assets.cover.status != approved`，则不应把 `distribution.wechat.status` 设为 `ready / scheduled / published`。
3. 若 `visual_assets.body.required = true` 且 `visual_assets.body.status = missing`，则长文资产视为未完稿。
4. 若 `cards.required = true` 但 `cards.status != approved`，则说明分发资产仍未闭环。
5. `image_prompts / visual_strategy` 负责定义视觉方案，`visual_workflow / visual_assets` 负责定义视觉执行状态；两层缺一不可。

---

## 6. 管理分层与治理规则

### 6.1 三层分工

#### 战略层

战略文档负责回答：

- 我们为什么这样做
- 年度内容方向是什么
- 内容与产品能力如何对齐
- SEO / GEO / 邀请增长等专项工作的原则和方法是什么

#### 资产层

内容资产 frontmatter 是系统的唯一事实源，负责表达：

- 内容身份
- 内容来源
- 内容类型
- 主流程状态
- 渠道状态
- 发布日期
- 溯源关系
- 维护状态
- campaign 归属
- 前线基线标记

#### 视图层

视图层只允许自动生成，负责回答：

- 下周发什么
- 哪些内容在审核
- 哪些内容已发布
- 最近改了什么
- 产品变化影响哪些内容
- 哪些站外已发布内容需要维护

### 6.2 信息归属规则

#### 必须写进战略/治理文档的信息

- 年度叙事主线
- funnel 策略
- Hero / Hub / Hygiene 节奏
- 内容与产品能力的覆盖原则
- SEO / GEO 策略原则
- traceability 治理方法
- 系统设计与升级方案

#### 必须写进 frontmatter 的信息

- `content_id`
- `content_source`
- `content_type`
- `canonical_role`
- `campaign`
- `source_docs`
- `workflow.stage`
- `workflow.owner`
- `workflow.reviewer`
- `workflow.priority`
- `workflow.target_publish_date`
- `workflow.last_action_at`
- `maintenance.change_status`
- `maintenance.external_action`
- `maintenance.external_status`
- `maintenance.external_note`
- `content_lifecycle.status`
- `content_lifecycle.superseded_by`
- `distribution.*.status`
- `distribution.wechat.published_at`
- `distribution.wechat.baseline`

#### 只能通过自动视图展示的信息

- 下周发布队列
- 未来 4 周公众号排期
- 当前审核队列
- 当前生产队列
- 最近修订内容
- 已发布清单
- 公众号前线基线统计
- 产品变化影响清单
- 外部内容维护队列

### 6.3 禁止新增的手工管理方式

从本规则生效开始，以下内容不再作为长期管理方式新增：

1. 手工维护的“下周发布清单”
2. 手工维护的“已发布文章列表”
3. 手工维护的“待审核文章列表”
4. 手工维护的“公众号排期总表”
5. 在战略文档中直接写文章状态
6. 与自动视图表达同一件事的过程文档

如果某份文档只是记录：

- 哪篇已发
- 哪篇待发
- 哪篇待审核
- 哪篇已修订

则它应被迁移到：

- 内容 frontmatter
- 自动视图

### 6.4 系统入口原则

团队日常查看内容运营状态时，默认入口应为自动视图，而不是零散文档。

推荐入口顺序：

1. `docs/4_Growth_Ops/content/_views/pipeline.md`
2. `docs/4_Growth_Ops/content/_views/next-release.md`
3. `docs/4_Growth_Ops/content/_views/recently-updated.md`
4. `docs/4_Growth_Ops/content/_views/change-impact.md`
5. `docs/4_Growth_Ops/content/_views/external-maintenance.md`
6. `docs/4_Growth_Ops/content/README.md`

### 6.5 团队执行清单

#### 新增内容时

1. 使用 `docs/4_Growth_Ops/content/CONTENT_ASSET_TEMPLATE.md`
2. 补齐最小 frontmatter
3. 明确 `source_docs`
4. 明确 `workflow.stage`
5. 明确 `workflow.target_publish_date`
6. 明确 `distribution.wechat.status`
7. 运行 `npm run content:sync`

#### 推进内容状态时

1. 只更新该文章自己的 frontmatter
2. 不额外维护手工状态表
3. 更新后运行 `npm run content:sync`
4. 通过视图检查结果，而不是回写到战略文档

#### 产品有变化时

1. 优先更新底层文档
2. 运行 `npm run content:audit`
3. 查看 `docs/4_Growth_Ops/content/_views/change-impact.md`
4. 查看 `docs/4_Growth_Ops/content/_views/external-maintenance.md`
5. 决定哪些内容进入 `maintenance.review_needed`
6. 再安排修订与发布节奏

#### 禁止的执行习惯

1. 先写一份排期文档，再回头补内容状态
2. 用聊天记录充当发布状态记录
3. 在多个文档里重复写“已发布/待审核/待发布”
4. 把内容状态写进年度战略或专项计划文档

---

## 7. 系统回答问题的方式

### 7.1 问题一：下周可以发布哪几篇到公众号？

系统判断条件：

- `workflow.stage` 属于 `approved` 或 `scheduled`
- `distribution.wechat.enabled = true`
- `distribution.wechat.status` 属于 `ready` 或 `scheduled`
- `workflow.target_publish_date` 落在下周

系统输出视图：

- `Next Week WeChat Queue`

输出字段：

- 标题
- 来源目录
- 漏斗层级
- owner
- 审核人
- 目标发布日期
- 当前公众号状态

### 6.2 问题二：我们已经修订哪几篇文章了？

系统判断条件：

- `maintenance.change_status = updated`
- 或 `workflow.last_action_at` 落在最近 7/14 天

系统输出视图：

- `Recently Updated Content`

输出字段：

- 标题
- 修订日期
- 修订原因
- owner
- 是否需要重新审核

### 6.3 问题三：产品有了变化，我们应该充实哪些文章？

系统判断逻辑：

1. 从底层文档变更中识别受影响 `source_docs`
2. 反查所有依赖这些 `source_docs` 的内容资产
3. 结合 `Alignment Checklist` 判断是否存在未覆盖项
4. 结合 `Under-utilized Internal Docs` 判断是否需要新增内容

系统输出两个队列：

- `Affected Content By Product Change`
- `Missing Content Opportunities`

---

## 7. 核心自动视图

系统不只生成一张 README，而应生成多张面向不同决策的看板。

### 7.1 Master Registry

所有内容资产主索引。

作用：

- 全量盘点
- 提供唯一入口

建议输出路径：

- `docs/4_Growth_Ops/content/README.md` 或升级为新的统一总表

### 7.2 Pipeline Board

按 `workflow.stage` 分组的生产流程看板。

作用：

- 看哪些在策划
- 哪些在写
- 哪些待审核
- 哪些已通过待排期

建议输出路径：

- `docs/4_Growth_Ops/content/_views/pipeline.md`

### 7.3 Next Release Queue

按日期聚焦下周/本周要发的内容。

作用：

- 回答“下周能发什么”

建议输出路径：

- `docs/4_Growth_Ops/content/_views/next-release.md`

### 7.4 Recently Updated

按修订时间排序。

作用：

- 回答“最近修了什么”

建议输出路径：

- `docs/4_Growth_Ops/content/_views/recently-updated.md`

### 7.5 Product Change Impact Board

展示底层文档变更影响的内容资产。

作用：

- 回答“产品变了该补什么”

建议输出路径：

- `docs/4_Growth_Ops/content/_views/change-impact.md`

### 7.6 External Maintenance Queue

展示已在公众号等外部渠道发布、但因产品变化或站内更新而需要维护的内容资产。

作用：

- 回答“哪些站外内容已经落后于当前产品版本”
- 把“发新内容”和“维护旧内容”拆成两条并行工作流

建议输出路径：

- `docs/4_Growth_Ops/content/_views/external-maintenance.md`

自动发现机制：

1. `source_docs` 的最新变更时间晚于内容资产最近动作时间
2. 内容资产最近动作时间晚于外部发布日期
3. 人工显式标记 `maintenance.change_status = review_needed`
4. 如已被新口径替代，再标记 `content_lifecycle.status = superseded`
5. 为外部平台补 `maintenance.external_action`，明确是“刷新旧文”还是“发布替代文”
6. 外部维护开始时更新 `maintenance.external_status = in_progress`，完成后更新为 `completed`

### 7.7 Underutilized IP Board

展示内部文档尚未转成对外内容的高价值材料。

作用：

- 为新 campaign 提供源头

建议输出路径：

- 可继续由 `44_Content_Traceability_Matrix.md` 承担，或拆分独立视图

---

## 8. 与现有文件的关系

### 8.1 保留并继续使用

- `docs/4_Growth_Ops/41_Growth_Content_Alignment_Checklist.md`
- `docs/4_Growth_Ops/44_Content_Traceability_Matrix.md`
- `scripts/content_audit.mjs`
- `scripts/cmo_sync.mjs`

### 8.2 升级方向

#### `41_Growth_Content_Alignment_Checklist.md`

从“营销对齐清单”升级为“产品能力 -> 内容覆盖矩阵”的来源之一。

新增用途：

- 标识哪些能力尚无外部内容
- 标识哪些支持内容已过期

#### `44_Content_Traceability_Matrix.md`

继续作为溯源健康看板。

新增用途：

- 为“产品变化影响队列”提供输入

#### `scripts/cmo_sync.mjs`

---

## 9. 当前成果固化

截至 2026-03-19，这套内容运营系统已经形成以下稳定成果：

### 9.1 已稳定落地的能力

1. 统一内容资产池
   - 扫描 `docs/4_Growth_Ops/content` 与 `docs/5_Support_Ops/content`
   - Markdown + frontmatter 作为单一事实源
2. 统一运营视图
   - `README.md`
   - `pipeline.md`
   - `next-release.md`
   - `recently-updated.md`
   - `change-impact.md`
   - `external-maintenance.md`
3. 公众号已发布基线管理
   - 已支持真实链接、真实发布日期、前线基线标记
4. 外部内容维护机制
   - 已支持 `review_needed`
   - 已支持 `refresh_existing / publish_replacement`
   - 已支持旧口径内容进入维修队列
5. 上游事实源规范
   - 已为当前被引用的 source 文档补齐最小元数据
   - `Content Traceability Matrix` 已能识别缺失 source 元数据与废弃 source

### 9.2 当前系统已经可以直接回答的问题

1. 下周公众号准备发什么
2. 最近修了什么内容
3. 产品变化影响哪些内容
4. 哪些外部已发布内容需要维护
5. 哪些 source 文档还没有转成内容资产

### 9.3 当前明确仍由系统承担的入口

团队日常默认入口：

1. `docs/4_Growth_Ops/content/_views/pipeline.md`
2. `docs/4_Growth_Ops/content/_views/next-release.md`
3. `docs/4_Growth_Ops/content/_views/external-maintenance.md`
4. `docs/4_Growth_Ops/content/_views/change-impact.md`
5. `docs/4_Growth_Ops/content/README.md`

---

## 10. 后续待做 / 待完善

以下事项不是“系统缺失”，而是下一阶段优化 backlog。

### 10.1 高优先级

1. 为 `external-maintenance` 增加处理闭环
   - 区分 `处理中 / 已处理`
   - 支持维护完成后的回写语义
2. 为“发布替代文”的旧内容补 `superseded_by`
   - 尤其是投研决议 / 共识类历史公众号文章
3. 让 `next-release` 与真实战役排期更强绑定
   - 进一步减少纯推断状态
4. 批量补齐更多内容资产的 `maintenance.external_action`
   - 让外部维修队列更准确

### 10.2 中优先级

1. 为更多未被引用但高价值的 source 文档补最小元数据
2. 逐步标记更多历史文档为 `deprecated`
   - 让系统真正能触发 `Deprecated Sources`
3. 为 source 文档补更清晰的术语迁移说明
   - 尤其是产品概念改名类场景
4. 优化 `change-impact` 与 `external-maintenance` 的联动提示

### 10.3 长期方向

1. 建立“产品变更 -> 内容复核 -> 外部补救”固定节奏
2. 让 campaign 与维护动作共享一个统一优先级框架
3. 让内容系统逐步支持更完整的复盘与历史版本观测

### 10.4 明确不做的事情

为避免系统再次膨胀，以下方式不建议重新引入：

1. 手工维护发布清单
2. 手工维护下周排期文档
3. 在战略文档里写具体文章状态
4. 引入第二套人工状态数据库

从“发布状态总表生成器”升级为：

- 统一内容资产索引生成器
- 流程看板生成器
- 发布队列生成器
- 修订视图生成器

#### `scripts/content_audit.mjs`

继续负责：

- `source_docs` 健康
- 孤儿内容检测
- 闲置 IP 检测

后续可补：

- 输出受影响资产列表

---

## 11. 内容生产线工作流

### 11.1 主流程

#### Step 1: 研发变化或内容机会出现

来源可能是：

- 产品 spec 更新
- 工程协议更新
- 对齐清单发现缺口
- 闲置 IP 被选中
- 商业节点需要 campaign

#### Step 2: 生成内容任务

系统落地为一篇 canonical 内容资产，进入：

- `workflow.stage = planned`

#### Step 3: 内容生产

进入：

- `workflow.stage = drafting`

#### Step 4: 审核与对齐

校验：

- `source_docs` 是否充分
- 口径是否与产品一致
- 是否适合目标漏斗层级

审核中状态：

- `workflow.stage = reviewing`

#### Step 5: 审核通过与排期

进入：

- `workflow.stage = approved`

随后排期：

- `workflow.stage = scheduled`

#### Step 6: 分发执行

各平台分别推进 `distribution.*.status`

#### Step 7: 上线后维护

产品变更时，系统将内容打回复核：

- `maintenance.change_status = review_needed`

---

## 12. 推荐的实施顺序

### Phase 1: 统一索引

目标：

- 把 `Growth + Support` 两个来源整合进统一资产索引

交付：

- 新版主索引视图
- 基础兼容脚本

### Phase 2: 流程建模

目标：

- 引入 `workflow` / `maintenance` / `distribution` 新字段

交付：

- Pipeline Board
- Next Release Queue
- Recently Updated 视图

### Phase 3: 研发联动

目标：

- 打通 `content_audit` 与“变更影响视图”

交付：

- Product Change Impact Board
- Missing Content Opportunities

### Phase 4: Agent 协作标准化

目标：

- 让 CMO / 内容 agent / 支持内容 agent 使用同一套字段和视图

交付：

- 标准 frontmatter 模板
- 标准操作 SOP

---

## 11. 这套系统的最终形态

当系统完整落地后，团队将不再靠记忆和零散表格推进内容，而是通过一条实实在在的生产线运转：

1. **研发定义能力**
2. **系统识别受影响内容**
3. **内容进入生产与审核**
4. **系统自动输出可发布清单**
5. **发布后回写状态**
6. **产品变化再次触发修订**

这意味着内容团队不再是“临时接单写稿”，而是与产品研发并行的一条业务生产线。

---

## 12. 下一步执行建议

建议立即启动以下三项最小落地动作：

1. 升级 `scripts/cmo_sync.mjs`，把扫描范围正式扩展到 `docs/4_Growth_Ops/content` + `docs/5_Support_Ops/content`
2. 为脚本增加对 `workflow` / `maintenance` / `distribution` 新字段的兼容读取
3. 先生成 3 个新视图：
   - `Pipeline Board`
   - `Next Release Queue`
   - `Recently Updated`

完成这一步后，系统就能开始稳定回答：

1. 下周能发什么
2. 最近改了什么
3. 哪些内容需要继续推进

再下一步再接入“产品变化影响队列”，把研发联动真正打通。
