# 内容资产 Frontmatter 模板

适用范围：

- `docs/4_Growth_Ops/content/*`
- `docs/5_Support_Ops/content/*`

目标：

- 新增内容时直接进入统一内容运营系统
- 减少旧字段和新字段混用造成的判断歧义

```yaml
---
title: ""
content_id: ""
content_source: "growth" # growth | support
content_type: "article" # article | faq | guide | campaign | glossary | update
canonical_role: "canonical" # canonical | derivative
category: ""
funnel_stage: "TOFU" # TOFU | MOFU | BOFU
campaign_role: "" # hook | bridge | conversion
campaign: ""
source_docs:
  - docs/...
traceability:
  status: "healthy" # healthy | review_needed | missing
  last_reviewed_at: "2026-03-19"
workflow:
  stage: "planned" # planned | drafting | reviewing | approved | scheduled | published | archived
  owner: "cmo"
  reviewer: "founder"
  priority: "medium" # high | medium | low
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
  stage: "not_started" # not_started | briefing | prompt_ready | generating | reviewing | approved | delivered
  owner: "" # designer | cmo | founder | agent
  reviewer: ""
  priority: "medium" # high | medium | low
  target_ready_date: ""
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
image: ""
images:
  cover: ""
  body: []
  cards: []
image_specs:
  cover: "1200x675" # 16:9, wechat/headline cover
  body: "1080x720" # 3:2, inline reading rhythm
  card: "1080x1440" # 3:4, xiaohongshu/social card
image_prompts:
  cover: ""
derivative_guidance:
  body: []
  cards: []
visual_strategy:
  concept_core: ""
  generation_mode: "cover_first" # cover_first | independent
  body_asset_policy: "reuse_then_derive" # reuse_then_derive | derive_only | independent_body
  derivation_rule:
    body: "same_world" # same_world | derived_from_cover | independent
    cards: "derived_from_cover" # derived_from_cover | same_world | independent
visual_style_prefix: "Premium editorial finance style for mass-audience educational content, realistic not cartoonish, emotionally legible before intellectually impressive, Chinese retail investor context, one simple visual metaphor, clean composition, relatable human tension, premium but grounded materials, lighter premium editorial palette, soft neutral background, clean indoor or daylight-style lighting, calm clear restrained mood, professional finance magazine illustration feel rather than cinematic drama, stylized realism, simplified forms, limited details, no text, no watermark, no cheap sci-fi look, no hologram overload, no giant robot or monster imagery, no generic corporate stock image feel, no blockbuster poster drama, no industrial repair-diagram feel, no cute illustration style, no oppressive darkness, no horror-movie contrast, no thriller atmosphere."
distribution:
  wechat:
    enabled: true
    status: "draft" # none | draft | ready | scheduled | published
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
wechat_layout:
  profile: "finance_editorial_v1" # finance_editorial_v1 | support_clean_v1 | campaign_brief_v1
  density: "airy" # airy | balanced | compact
  body_font_size: 15
  line_spacing: 1.8
  paragraph_spacing: 1.0
  heading_style: "rule_divider" # rule_divider | bold_plain | number_kicker
  accent_color: "ink_gold" # ink_gold | ink_red | ink_green | neutral_only
  cover_mode: "light_editorial" # light_editorial | hybrid_editorial | data_brief
  body_image_policy: "cover_plus_1_or_2" # cover_only | cover_plus_1_or_2 | cover_plus_3
  checklist_version: "wechat_layout_v1"
---
```

## 最小约束

至少补齐以下字段：

- `content_source`
- `content_type`
- `source_docs`
- `workflow.stage`
- `workflow.target_publish_date`
- `visual_workflow.stage`
- `website.enabled`
- `distribution.wechat.status`

推荐补齐：

- `campaign_role`
- `visual_assets.cover.status`
- `visual_assets.body.status`
- `wechat_layout.profile`
- `wechat_layout.checklist_version`

## 公众号排版管理建议

如果内容要发公众号，仅管理 `distribution.wechat.status` 还不够，因为“能发”不代表“版式已经达标”。

建议把公众号版式也纳入内容资产，最少补这一组字段：

- `wechat_layout.profile`
  管这篇文章使用哪一套公众号版式模板，例如财经杂志长文、支持说明文、活动短稿
- `wechat_layout.density`
  管排版密度，避免有的文章过挤、有的文章过松
- `wechat_layout.body_font_size / line_spacing / paragraph_spacing`
  管正文阅读参数，减少每次临场手调
- `wechat_layout.heading_style`
  管小标题层级表达方式，避免样式漂移
- `wechat_layout.accent_color`
  管强调色，保证品牌统一而不过度装饰
- `wechat_layout.cover_mode`
  管封面和正文整体气质是否一致
- `wechat_layout.checklist_version`
  管本次发布遵循的是哪一版排版检查清单

协同约束建议：

1. 当 `distribution.wechat.enabled = true` 时，默认要求补齐 `wechat_layout.profile`。
2. 当文章进入 `workflow.stage = approved` 且待公众号发布时，`wechat_layout.checklist_version` 应视为必填。
3. 若文章是 `TOFU / MOFU` 长文，默认不应使用 `compact` 密度，除非明确是快讯或战报型内容。

## 图片命名规范

## 视觉管理规范

仅有 `image_prompts / images / visual_strategy` 还不够，因为这些字段只能描述“设计应该长什么样”，不能回答“设计现在做到哪一步”。

因此每篇内容新增两层视觉管理字段：

- `visual_workflow`
  管这篇内容的视觉生产流程状态
- `visual_assets`
  管不同图片角色是否已经产出、审核、交付

建议这样理解：

- `visual_workflow.stage`
  管流程阶段：
  - `not_started`
  - `briefing`
  - `prompt_ready`
  - `generating`
  - `reviewing`
  - `approved`
  - `delivered`
- `visual_assets.cover.status`
  管封面图是否已经可用于正文 / 网站 / 公众号
- `visual_assets.body.status`
  管正文配图是否已达到最小阅读节奏要求
- `visual_assets.cards.status`
  管社媒传播图是否已补齐

推荐协同规则：

1. `workflow.stage` 不应早于 `approved`，如果正文已准备发布，但 `visual_workflow.stage` 仍在 `briefing / generating`，应视为内容资产未真正完稿。
2. 若 `visual_assets.cover.status != approved`，不应将 `distribution.wechat.status` 设为 `ready` 或更后状态。
3. 若文章声明有 `images.body` 或 `images.cards` 目标数量，则 `visual_assets.body/cards.ready_count` 应与实际文件数量同步维护。

建议所有内容图片都按“文章 slug + 图片角色”命名，避免后期混乱。

示例：

- `101-68_general_llm_illusion_cover.png`
- `101-68_general_llm_illusion_body_1.png`
- `101-68_general_llm_illusion_body_2.png`
- `101-68_general_llm_illusion_card_1.png`
- `101-68_general_llm_illusion_card_2.png`

固定角色：

- `cover`
- `body_1`
- `body_2`
- `card_1`
- `card_2`

默认建议：

- 每篇至少有 `cover`
- 正文长文默认配 `body_1`、`body_2`
- 有跨平台分发需求时补 `card_1`
- 强传播文章可再补 `card_2`

## 生成一致性规范

不要把一篇文章的 `cover / body / cards` 当成 3 套独立图片。

默认生成方式：

1. 先生成 `cover`，作为整篇文章的视觉母版
2. 先判断 `body` 是否可以直接复用 `cover`
3. 如果需要变化，再把选定的 `cover` 作为参考图，派生 `body`
4. `cards` 优先从 `cover` 派生，而不是完全重新生成

推荐默认值：

- `generation_mode: "cover_first"`
- `body_asset_policy: "reuse_then_derive"`
- `derivation_rule.body: "same_world"`
- `derivation_rule.cards: "derived_from_cover"`

`body_asset_policy` 建议这样理解：

- `reuse_then_derive`
  先复用 `cover` 或其裁切版作为 `body_1`，只有在阅读节奏需要变化时再派生 `body_2`
- `derive_only`
  `body` 不直接复用 `cover`，但都从 `cover` 参考图派生
- `independent_body`
  少用。只在正文确实需要另一种同主题场景时才使用

字段语义：

- `image_prompts.cover`
  只用于生成母版封面，是文生图主提示词
  严格只写“场景与语义”，不要重复风格前缀
- `derivative_guidance.body`
  不是新的独立 prompt，而是“参考我给的 cover 图片，做正文插图或局部延展”的派生指令
  默认要写成：
  - `simple article illustration`
  - `not a second cover`
  - `one relatable detail only`
- `derivative_guidance.cards`
  不是新的独立 prompt，而是“参考我给的 cover 图片，改成竖版传播卡”的派生指令
  默认要写成：
  - `complete portrait-format social card`
  - `large central subject`
  - `intentional headline space`
- `visual_style_prefix`
  只放统一风格 DNA，不要把单篇画面语义写进来

执行优先级：

1. 先问：`cover` 能不能直接兼任 `body_1`
2. 如果能，正文第一张图直接复用 `cover` 或 `cover` 裁切版
3. 只有当文章中段需要新的阅读节奏时，再做 `body_2` 派生图
4. `cards` 默认始终从 `cover` 派生

推荐写法：

```yaml
image_prompts:
  cover: "..."
derivative_guidance:
  body:
    - "Use the provided cover image as the visual reference, but treat this image as a simple article illustration rather than a second cover. Focus on one relatable detail only..."
    - "Use the provided cover image as the visual reference, but create a simple supporting article illustration instead of a new concept poster..."
  cards:
    - "Use the provided cover image as the visual reference. Create a complete portrait-format social card derived from the same mother frame..."
```

提示词设计语言默认值：

- `cover`
  可以承担完整创意和母隐喻
  但优先写成“正常场景 + 一个明显错误线索”的具体瞬间，不要先写抽象概念
- `body`
  只服务正文理解，不做第二张封面
- `card`
  优先服务移动端传播，不默认当作品集海报

封面母题经验规则：

- 优先画一个普通读者 `1` 秒能看懂的失控现场，而不是抽象金融概念
- 最稳定的结构通常是：
  - 一个正常场景
  - 一个错位的控制者 / 动作 / 时机
  - 一个非常明确的危险或错误线索
- `68` 和 `12` 的共同经验是：
  - 不要先解释技术
  - 不要让科技装置当主角
  - 不要让机房、服务器、悬浮 UI 抢走注意力
  - 先画“普通人为什么会被误导 / 为什么已经晚了”
- 一张封面只讲一个意思：
  - 例如“会说人话但没有刹车”
  - 或“还没按下去，但机会已经过去了”
- 封面如果缩小到手机列表图后还要成立；若缩小后只剩科技氛围，说明母题不够具体

`body` 避免：

- photorealistic AI scene
- full concept poster
- floating dashboards
- readable screen text
- anime / cute illustration

`card` 避免：

- pasted-layout look
- tiny subject in huge blank area
- exaggerated acting
- comedy / meme energy

## 团队使用方式

新增或大修内容时，按下面顺序执行：

1. 从这个模板复制 frontmatter
2. 填完最小约束字段
3. 如果已经进入公众号计划，补 `campaign`
4. 如果已经发布到公众号，补 `distribution.wechat.published_at`
5. 如果属于已确认前线基线，补 `distribution.wechat.baseline: "frontline_q1_2026"`
6. 如果外部旧文已被新口径替代，补 `content_lifecycle.status: "superseded"` 与 `superseded_by`
7. 如果站外旧文需要维护，补 `maintenance.external_action`
8. 如果已经开始处理外部维修任务，补 `maintenance.external_status: "in_progress"`；完成后改成 `completed`
9. 保存后运行 `npm run content:sync`
10. 去 [pipeline.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/_views/pipeline.md)、[next-release.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/_views/next-release.md) 和 [external-maintenance.md](/Users/yesun/Code/stockwise/docs/4_Growth_Ops/content/_views/external-maintenance.md) 检查结果

## 迁移原则

- 老文章可以继续保留 `publish`
- 新文章优先使用 `distribution`
- 若大修旧文章，顺手补齐新字段
- `source_docs` 优先引用现行、主题单一、路径稳定的上游文档
