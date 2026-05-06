# 英文移动端内容入口完善计划（2026-05-06）

## 1. 结论

英文移动端内容入口已经接入真实内容，不是空入口；主要欠缺是内容结构不完整、英文内容覆盖不足、公开站与 App 内入口的内容分层还没有形成清晰的用户旅程。

当前最需要补齐的不是继续大量铺文章，而是先把英文入口从“能读的 101 列表”升级成“新用户能按问题进入、按阶段学习、读完能理解产品价值”的轻量学习系统。

## 2. 当前证据

### 2.1 移动端入口链路

- App 内用户中心有 `Support` 和 `Learn` 两个移动端内容入口。
- `Learn` 入口渲染 `LearnCenterView`，通过 `/api/learn?locale=en` 拉取英文 101 内容。
- `Support` 入口渲染 `SupportCenterView`，通过 `/api/support?locale=en` 拉取英文帮助内容。
- Learn 文章详情在 App 内打开，同时提供外链到公开站 `/learn/{slug}`。

### 2.2 英文 Learn 内容池

- 英文 `101_academy` 当前有 21 个 Markdown 文件，其中 20 篇会被 `/api/learn` 作为 `101-*` 文章返回。
- 分类分布严重偏斜：19 篇是 `The Mind`，1 篇是 `Academy`；`The Method`、`The Money`、`The Machine`、`The Case` 基本没有形成英文可见内容。
- 中文 `101_academy` 有 125 个 Markdown 文件。以同 slug 对比，中文还有约 101 个 `101-*` 文件没有对应英文版本。
- 英文 syllabus 中规划了 Method、Machine、Risk & Survival 等模块，但公开和 App 内可见内容没有跟上这个 syllabus。

### 2.3 英文 Support 内容池

- 英文 Support 当前有 22 篇，覆盖 Features、Logic & Discipline、Notifications、Tiers & Growth、Security 等基础问题。
- 中文 Support 当前有 60 篇，约 38 篇尚无英文对应版本。
- 英文 Support 更接近“功能说明”，但还缺少国际新用户最关心的 trust、pricing、alerts、trial、what to do next 这类转化型 FAQ 组合页。

### 2.4 战略匹配

现有内容战略已经明确三条线：

- `101_academy` 是主课，负责认知教育和方法论入口。
- `support` 是说明书，负责能力解释、使用帮助和 BOFU 信任。
- `master_series` 是参考书和权威库存，负责方法源流与长期品牌信任。

国际版 GTM 的目标用户是 serious retail investors，核心叙事是 post-close review、decision clarity、risk boundary、execution discipline。英文移动端内容入口目前只部分承接了 `discipline`，还没有充分承接 `workflow`、`key levels`、`alerts`、`Go tier` 和 `trust boundary`。

## 3. 主要缺口

### P0 缺口：移动端首屏缺少“问题导向”

现在 Learn 是按分类和文章列表呈现，适合已经愿意学习的人；但国际新用户更常带着问题进入：

- What is ZISO actually helping me do tonight?
- Is this a stock picker or a research workflow?
- What do I do when a signal changes?
- Why should I trust post-close AI research?
- What do Free / Go / Plus change in practice?

入口需要让用户先选问题，再进入文章，而不是直接面对课程目录。

### P0 缺口：英文 101 分类不完整

移动端显示了五个分类：`The Mind`、`The Method`、`The Money`、`The Machine`、`The Case`。但英文内容几乎都落在 `The Mind`。这会让入口看起来像心理文章库，而不是完整的 AI stock research academy。

### P1 缺口：Support 与 Learn 没有互相导流

Learn 讲认知，Support 讲功能，但当前两者在移动端主要是并列入口，没有形成：

- 读完 FOMO / Loss Aversion -> 推荐 notification discipline / tactical brief guide。
- 读完 key levels / risk boundary -> 推荐 how to read tactical brief。
- 读完 tiers/pricing -> 推荐 Go tier 的真实使用场景。

### P1 缺口：国际版转化问题未被内容入口系统承接

GTM 里明确 Go 是当前主卖层，Plus 是 upcoming；但移动端内容没有形成一组围绕 Go 的英文解释路径：

- Why Go exists.
- What DeepSeek-powered reasoning changes.
- How 10 watchlist names should be used.
- What 200 reports/month means in a nightly review workflow.
- What Plus upcoming means and what not to expect now.

### P2 缺口：master_series 没有英文移动端承接方式

`master_series` 已经是长期权威建设线，但当前英文移动端内容入口没有可见的“reference library”或“method roots”层。短期不需要全部翻译，但需要建立 3-5 个英文样板，让用户知道 ZISO 的方法论不是凭空发明。

## 4. 分阶段完善计划

### Phase 0：入口整理与信息架构校准（1-2 天）

目标：不大规模写内容，先让入口逻辑正确。

交付：

- 在移动端 Learn 顶部增加 4 个问题导向入口：
  - Start Here
  - Understand Signals
  - Manage Risk
  - Use ZISO Better
- 把现有英文 101 文章重新校准 category，避免 19 篇全部挤在 `The Mind`。
- 补一份英文 Learn 目录表，标记每篇文章的 funnel stage、category、next article、related support slug。
- 检查 `ZISO_101_SYLLABUS.md` 是否应该继续作为内部规划文件，避免它进入公开站静态参数但不可见。

验收：

- App 内 Learn 首屏不再只是文章列表。
- 五个分类至少有 3 个能看到英文文章。
- `/api/learn?locale=en` 返回内容与移动端分类一致。

### Phase 1：英文 101 最小闭环补齐（3-5 天）

目标：先补齐能支撑国际新用户理解产品的 12 篇核心英文文章，而不是追平中文 125 篇。

优先补齐：

- The Method：
  - 101-14 EOD Edge
  - 101-21 RSI Decoded
  - 101-25 Support and Resistance
  - 101-28 Left Side vs Right Side Trading
- The Money：
  - 101-52 Stop Loss Art
  - 101-54 Position Sizing
  - 101-55 Drawdown Math
  - 101-57 One Percent Rule
- The Machine：
  - 101-61 LLM vs Quant
  - 101-68 General LLM Illusion
  - 101-69 ZISO Rhythm
  - 101-72 Confidence Decode

验收：

- 英文 Learn 可见文章达到 32 篇左右。
- `The Mind / The Method / The Money / The Machine` 都有完整入口。
- 每篇新增英文文章都有 `source_docs`、`website.enabled`、`funnel_stage`、`rhythm` 等基础元数据。

### Phase 2：Support 转化 FAQ 补齐（2-4 天）

目标：把英文帮助中心从“说明书”补成“转化信任层”。

新增或优先翻译：

- key-levels-mapping
- confidence-explained
- model-tiers-diff
- tradeability-tower
- invite-wall-rationale
- android-notification-limit / ios-tuning
- multi-day-verification
- failure-retrospective

新增 1 个聚合页或移动端分组：

- `Getting Started`
- `Signals & Key Levels`
- `Alerts & Notifications`
- `Pricing & Access`
- `Trust & Verification`

验收：

- 英文 Support 从 22 篇提升到 30 篇左右。
- Pricing / trial / invite / alert failure / confidence / verification 都有英文可引用页面。
- Learn 文章可以通过 `related support` 推荐到具体帮助页。

### Phase 3：移动端内容旅程打通（3-5 天）

目标：让内容入口服务 onboarding 和留存，而不是只是静态阅读。

交付：

- Learn 文章详情底部增加 `Next: Learn` 和 `Use it in ZISO` 两类下一步。
- Support 文章详情底部增加相关 Learn 推荐。
- 从 pricing、onboarding trial、notification setup、tactical brief drawer 进入对应 Support 文章。
- 建立内容点击事件：
  - learn_catalog_open
  - learn_article_open
  - support_article_open
  - content_related_click
  - content_open_public_page

验收：

- 用户在 App 内读完 1 篇内容后，有明确下一步。
- Growth dashboard 可以看英文用户最常打开的 Learn / Support 内容。

### Phase 4：英文 master_series 样板入口（1 周）

目标：先形成权威信号，不追求完整库。

首批样板：

- Mark Minervini
- Van Tharp
- Richard Wyckoff
- Howard Marks
- Market Wizards Reading Map

入口方式：

- 不直接塞进 101 主课列表。
- 在 Learn 内新增 `Method Roots` 或 `Reference Library` 小入口。
- 每篇 master_series 文章底部连接到 1-2 篇 101 课程和 1 个产品能力解释。

验收：

- 英文移动端出现“方法源流”层。
- 首批 5 篇能支撑 ZISO 的风险纪律、趋势、仓位、周期、方法透明化叙事。

## 5. 推荐执行顺序

1. 先做 Phase 0：入口结构和分类校准。
2. 然后做 Phase 1 的 12 篇英文 101 核心补齐。
3. 同步做 Phase 2 的 8 篇 Support 转化 FAQ。
4. 最后再做 Phase 3/4 的导流、埋点和 master_series 样板。

这个顺序的原因是：当前最大问题不是内容总量，而是英文移动端用户第一眼不知道该从哪里开始、读完不知道下一步做什么。

## 6. 本轮不建议做的事

- 不建议把中文 101 的 100 多篇一次性机器翻译上线。质量和分类会失控。
- 不建议马上把 master_series 全量英文公开。应先做样板和入口验证。
- 不建议只修公开站 `/learn`，忽略 App 内 `LearnCenterView`。用户说的移动端内容入口，主要价值在 App 内。
- 不建议把 Learn 写成产品广告。Learn 负责建立认知，Support 和 pricing 承接转化。

