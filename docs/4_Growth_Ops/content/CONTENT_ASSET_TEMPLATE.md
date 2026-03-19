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
  derivation_rule:
    body: "same_world" # same_world | derived_from_cover | independent
    cards: "derived_from_cover" # derived_from_cover | same_world | independent
visual_style_prefix: "Premium editorial finance style, realistic not cartoonish, dark high-contrast atmosphere, emotionally restrained but tense, Chinese investor context, single strong visual metaphor, clean composition, premium materials, no text, no watermark, no cheap sci-fi look, no generic corporate stock image feel."
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
---
```

## 最小约束

至少补齐以下字段：

- `content_source`
- `content_type`
- `source_docs`
- `workflow.stage`
- `workflow.target_publish_date`
- `website.enabled`
- `distribution.wechat.status`

推荐补齐：

- `campaign_role`

## 图片命名规范

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
2. 再把选定的 `cover` 作为参考图，派生 `body`
3. `cards` 优先从 `cover` 派生，而不是完全重新生成

推荐默认值：

- `generation_mode: "cover_first"`
- `derivation_rule.body: "same_world"`
- `derivation_rule.cards: "derived_from_cover"`

字段语义：

- `image_prompts.cover`
  只用于生成母版封面，是文生图主提示词
- `derivative_guidance.body`
  不是新的独立 prompt，而是“参考我给的 cover 图片，保持一致，只做局部延展”的派生指令
- `derivative_guidance.cards`
  不是新的独立 prompt，而是“参考我给的 cover 图片，改成竖版传播卡”的派生指令

推荐写法：

```yaml
image_prompts:
  cover: "..."
derivative_guidance:
  body:
    - "Use the provided cover image as the visual reference. Keep the same subject, palette, and emotional world. Create a closer supporting scene..."
    - "Use the provided cover image as the visual reference. Preserve the same metaphor and materials. Extend the same world..."
  cards:
    - "Use the provided cover image as the visual reference. Create a vertical social card derived from the same mother frame..."
```

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
