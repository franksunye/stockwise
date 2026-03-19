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
