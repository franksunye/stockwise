---
title: "大师系列内容接入方案 2026"
source_docs:
  - docs/2_Intelligence/registry/MASTER_SERIES_NOTEBOOKLM_PLAN.md
  - docs/4_Growth_Ops/content/CONTENT_ASSET_TEMPLATE.md
  - docs/4_Growth_Ops/content/README.md
  - docs/4_Growth_Ops/content/cn/101_academy/ZISO_101_SYLLABUS.md
  - docs/0_Strategy/06_Quant_Industry_Positioning_Map.md
  - docs/0_Strategy/09_Decision_Stack_and_Producer_Architecture.md
category: "Content Ops"
funnel_stage: "TOFU"
date: "2026-03-25"
publish:
  wechat:
    status: "draft"
---

# 大师系列内容接入方案 2026

## 1. 先给结论

`大师系列` 不应该并入 `101`，也不应该挤占 `support` 的生产线。

它最合理的定位是：

**作为 Growth 体系下的第三条内容线存在。**

三条线分别承担不同职责：

1. `101_academy`
   - 负责基础认知、统一世界观、稳定主线教育
2. `support`
   - 负责产品解释、功能说明、用户使用与信任承接
3. `master_series`
   - 负责方法源流、人物与门派、经典系统拆解、上游知识库存

一句话：

**101 讲“你应该先理解什么”，support 讲“产品现在具体怎么工作”，master series 讲“这些方法从哪里来，以及我们如何吸收它们”。**

---

## 2. 为什么不能直接塞进现有 101 / support pipeline

如果直接并进现有前线队列，会出现 4 个问题：

1. `101` 的教学序列会被打断
   - `101` 现在已经有明确 syllabus 和成熟度主线
2. `support` 的 BOFU 节奏会被稀释
   - support 的任务是解释产品，不是扩张交易人物宇宙
3. 当前 `wechat_4_week_sprint_2026q2` 会被主题混入
   - 影响前线节奏判断与 next-release 视图
4. 大师系列天然是“库存型栏目”
   - 它更适合先做知识资产，再按窗口转译发布

所以这里要解决的不是“能不能放进 content”，而是：

**如何放进 content 系统，同时不污染现有前线 pipeline。**

---

## 3. 推荐架构：共用系统，不共用前线

推荐采用：

```text
docs/2_Intelligence/registry
  -> 研究与知识卡
  -> NotebookLM 资料包定义

docs/4_Growth_Ops/content/master_series
  -> 大师系列 canonical 内容资产
  -> PPT 文案稿
  -> 小红书 / 公众号母稿

docs/4_Growth_Ops/content/101_academy
  -> 只保留 101 主线

docs/5_Support_Ops/content
  -> 只保留产品与功能解释
```

也就是说：

1. `registry` 是知识底座
2. `master_series` 是内容库存与对外栏目资产
3. `101` 和 `support` 继续保持各自纯度

---

## 4. 栏目关系：谁是上游，谁是下游

### 4.1 大师系列是上游知识库存

它的任务不是替代 `101`，而是给 `101` 和部分公众号主题提供更厚的上游事实源。

例如：

1. `Alexander Elder`
   - 可为 `101-08 3M Framework`、多周期、风险纪律类文章提供源头解释
2. `Mark Minervini / SEPA / VCP`
   - 可为突破、右侧交易、趋势模板类文章提供源流支撑
3. `Turtle / ATR Stop / Donchian`
   - 可为风控与趋势突破类内容提供方法母本

### 4.2 101 是统一教学主线

`101` 的职责仍然是把复杂世界翻成普通投资者的学习路径。

所以：

- `101` 可以引用大师系列
- 但不需要背上“大师人物介绍”负担
- 大师系列只作为 source pool，不改写 101 syllabus

### 4.3 support 不承担人物世界观扩张

`support` 只在以下情况下引用大师系列：

1. 该大师或方法已经进入产品解释层
2. 用户确实会从这个背景中获益
3. 不会造成“产品在模仿某位大师”的误解

否则不进入 support。

---

## 5. 目录与命名建议

建议新增目录：

`docs/4_Growth_Ops/content/master_series/`

该目录下放 canonical 内容资产，不放临时策划碎片。

### 推荐文件类型

1. `ms-01_mark_minervini.md`
2. `ms-02_pradeep_bonde.md`
3. `ms-03_alexander_elder.md`
4. `ms-04_turtle_trading.md`
5. `ms-05_warren_buffett.md`
6. `ms-06_sepa.md`

### 推荐编号逻辑

- `ms` = `master_series`
- 编号只代表内容资产顺序，不代表发布顺序

这样做的好处是：

1. 和 `101` 编号体系完全隔离
2. 一眼看出栏目归属
3. 后续即便扩到 30-50 篇也不会和 101/support 混淆

---

## 6. Frontmatter 约定：纳入系统，但默认不抢前线

大师系列应继续使用统一 frontmatter 规范，但字段建议这样定：

```yaml
content_source: growth
content_type: article
canonical_role: canonical
category: "Master Series"
funnel_stage: TOFU
campaign_role: bridge
campaign: master_series_2026q2
rhythm: Hub
website:
  enabled: true
  surface: learn
distribution:
  wechat:
    enabled: false
    status: none
  xhs:
    enabled: true
    status: draft
```

关键点在 3 个：

1. `campaign` 单独命名
   - 不并入 `wechat_4_week_sprint_2026q2`
2. `distribution.wechat.enabled` 默认先关
   - 先做库存，不自动挤入公众号前线队列
3. `xhs` 可默认开启
   - 因为这条线更适合先从图卡和收藏内容跑起来

---

## 7. 排期原则：和 101 / support 并行，但不争抢固定坑位

### 7.1 现有前线保持不动

当前建议继续维持：

1. `101`
   - 作为微信主前线的主教育线
2. `support`
   - 作为 BOFU / 信任承接 / 产品解释线

### 7.2 大师系列作为“库存优先、窗口发布”

大师系列默认流程应是：

1. 先进入 `master_series` 目录
2. 先完成 PPT 文案与 NotebookLM 事实包
3. 先完成小红书版图卡
4. 只有当出现合适窗口时，再转译为公众号

更具体一点：

1. `小红书`
   - 可周更 `1-2` 组
2. `公众号`
   - 默认周更 `0-1` 篇
   - 且只在 101 / support 队列不拥挤时插入

这意味着：

**大师系列更像内容储备池，不像必须按 Mon/Wed/Fri 打满的前线战役。**

---

## 8. 发布策略：一套母稿，多种出口

建议每篇 `master_series` 资产都视作“一母多子”：

1. `canonical 母稿`
   - 存在 `content/master_series/`
2. `PPT 版`
   - 供 NotebookLM -> PPT 输出
3. `小红书版`
   - 更短，更卡片化
4. `公众号版`
   - 在窗口期二次改写
5. `101 / support 引用片段`
   - 只摘取其中和主线有关的事实块

这样它与现有内容系统的关系就是：

- `master_series` 产母稿
- `101` / `support` 按需取材
- 不反过来把 101/support 变成人物栏目

---

## 9. 如何避免污染 pipeline 视图

这是接入时最现实的问题。

如果所有大师系列都补了公众号发布日期，它们会直接出现在 `next-release` 里，打乱前线判断。

所以要采用以下约束：

1. 大师系列默认 `workflow.stage = planned`
2. 默认不填近期 `workflow.target_publish_date`
   - 或只填季度内宽松日期，不参与当前周排期
3. 默认 `distribution.wechat.enabled = false`
4. 只有被提级为“本周要上公众号”的篇目，才改成：
   - `distribution.wechat.enabled = true`
   - `workflow.target_publish_date = 具体日期`
   - `distribution.wechat.status = draft / ready`

这样内容依然在系统里，但不会自动挤进前线判断。

---

## 10. 视觉与渠道定位

这条线视觉上不应完全复用 `101` 的“认知钩子”打法，也不适合 support 的说明文气质。

更适合：

1. `人物 + 方法 + 时代感`
2. `档案卡 / 图鉴 / 门派图谱`
3. `更强系列感、更强收藏感`

所以建议：

1. 保留统一品牌约束
2. 单独做一个 `master_series` 的封面与卡片视觉母版
3. 不强制复用 101 的标题风格

换句话说：

**内容系统共用，栏目视觉可分化。**

---

## 11. 与现有 campaign 的关系

当前内容系统里，很多前线资产挂在：

- `wechat_4_week_sprint_2026q2`

大师系列不建议直接挂这个 campaign。

建议单独命名：

- `master_series_2026q2`
- 或 `trading_masters_2026q2`

这样可以明确区分两类任务：

1. `前线战役`
   - 为当前增长、解释、转化服务
2. `知识资产战役`
   - 为长期权威、渠道沉淀、上游素材服务

---

## 12. 实操流程建议

推荐把大师系列做成一条单独 SOP：

1. 在 `registry` 确认该主题是否已有 card
2. 建 `NotebookLM` 资料包
3. 产出 `10 条事实 + 3 条观点 + 3 条误解`
4. 写 `master_series canonical` 母稿
5. 拆成 `PPT 版`
6. 拆成 `小红书版`
7. 判断是否值得提级为 `公众号版`
8. 若提级，再进入微信排版与 distribution 流程

这里和 `101/support` 最大区别是：

**大师系列先做资产，再决定是否前线发布。**

---

## 13. 我建议的组织原则

如果从内容运营全局看，最稳的组织法是：

1. `101`
   - 主课
2. `support`
   - 产品使用说明与信任托底
3. `master_series`
   - 参考书、人物志、门派图谱、方法源流

用户感知上也更自然：

1. 先在 `101` 学会框架
2. 再在 `大师系列` 看到这些框架从哪来
3. 最后在 `support` 里理解产品里具体如何落地

这是一个有机整体，但不是一条混在一起的流水线。

---

## 14. 下一步最值得做的不是立刻写 20 篇

最值得先做的是 3 件事：

1. 新增 `docs/4_Growth_Ops/content/master_series/` 目录
2. 先做 `3-6` 篇 canonical 样板资产
3. 给这条线定义独立 `campaign` 和默认 frontmatter

等这三件事稳了，再批量铺开，不会反噬现有 `101` 和 `support` pipeline。
