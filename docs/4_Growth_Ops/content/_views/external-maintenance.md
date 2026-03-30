# 外部内容维护队列 (External Maintenance Queue)

> 自动生成时间：2026/3/30 15:24:40
> 说明：这张视图专门提醒“站内内容已更新，但站外已发布内容可能已过时”的维修任务。
> 发现机制：底层 `source_docs` 变更、站内内容晚于外部发布日期、以及人工显式标记 `maintenance.review_needed`。

## 维护动作概览

- 核对同步：6 篇
- 发布替代文：2 篇
- 刷新旧文：2 篇
- 待处理：8 篇
- 处理中：2 篇

## 待复核的已发布外部内容

| 内容资产 | 来源 | 外部渠道 | 最近外发 | 处理状态 | 建议动作 | 触发原因 | 替代关系 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [投研决议：多维度的共识](../../../5_Support_Ops/content/ai-council-logic.md) | Support | 公众号 | 2026-02-18 周三 | 处理中 / review_needed | 发布替代文<br>公众号旧文仍沿用“智囊团”历史语义，建议以“投研决议”现行口径重发替代说明。 | 站内内容晚于外部发布日期，需检查外部口径是否已过时<br>已显式标记待复核：product_change | `wechat: 投研决议（现行版，待发布）` |
| [共识分级定义 (Consensus Levels)](../../../5_Support_Ops/content/consensus-levels.md) | Support | 公众号 | 2026-02-19 周四 | 处理中 / review_needed | 发布替代文<br>旧文建立在历史 AICouncil/共识语义上，建议按现行决议口径发布新版解释文。 | 已显式标记待复核：product_change | `wechat: 投研决议共识机制（现行版，待发布）` |
| [AI 除了写 PPT 还能做什么？论‘冷酷实习生’对焦虑的终极拯救](../101_academy/2026-03-02_ai_lifestyle.md) | Growth | 公众号 | 2026-03-02 周一 | 待处理 / stable | 核对同步 | 底层文档已更新：`docs/0_Strategy/01_Product_Positioning_and_Boundaries.md` | - |
| [量化思维入门：像工程师一样处理生活中的‘概率游戏’](../101_academy/2026-03-02_quant_thinking.md) | Growth | 公众号 | 2026-03-03 周二 | 待处理 / stable | 核对同步 | 底层文档已更新：`docs/0_Strategy/05_Quant_Signal_and_Execution_Axioms.md` | - |
| [置信度：这不是胜算，是把握](../../../5_Support_Ops/content/confidence-explained.md) | Support | 公众号 | 2026-03-04 周三 | 待处理 / updated | 刷新旧文<br>公众号旧文主题仍成立，但需要按现行置信度口径补强说明。 | 站内内容晚于外部发布日期，需检查外部口径是否已过时 | - |
| [策略内参：怎么看干货？](../../../5_Support_Ops/content/tactical-brief-guide.md) | Support | 公众号 | 2026-03-05 周四 | 待处理 / updated | 刷新旧文<br>公众号旧文仍可沿用，但应按当前策略内参结构与术语刷新表述。 | 站内内容晚于外部发布日期，需检查外部口径是否已过时 | - |
| [101-68: 让“龙虾”替你炒股？它敢说，你敢信么](../101_academy/101-68_general_llm_illusion.md) | Growth | 公众号 | 2026-03-20 周五 | 待处理 / updated | 核对同步 | 底层文档已更新：`docs/0_Strategy/05_Quant_Signal_and_Execution_Axioms.md` | - |
| [101-12: 你以为自己在做短线，很多时候其实只是在给人送钱](../101_academy/101-12_l4_hft_illusion.md) | Growth | 公众号 | 2026-03-23 周一 | 待处理 / updated | 核对同步 | 底层文档已更新：`docs/0_Strategy/05_Quant_Signal_and_Execution_Axioms.md` | - |
| [101-100: 很多人不是不会炒股，而是连自己是什么段位都没弄明白](../101_academy/101-100_maturity_prologue.md) | Growth | 公众号 | 2026-03-25 周三 | 待处理 / updated | 核对同步 | 底层文档已更新：`docs/0_Strategy/01_Product_Positioning_and_Boundaries.md`<br>站内内容晚于外部发布日期，需检查外部口径是否已过时 | - |
| [机会成本：很多人不是没机会，而是钱先被一只烂股拖住了](../101_academy/101-40_opportunity_cost.md) | Growth | 公众号 | 2026-03-27 周五 | 待处理 / updated | 核对同步 | 底层文档已更新：`docs/0_Strategy/05_Quant_Signal_and_Execution_Axioms.md`<br>站内内容晚于外部发布日期，需检查外部口径是否已过时 | - |

## 已处理归档

- 当前无已处理项目

## 如何使用这张视图

1. 先看“触发原因”，判断是底层文档变更、站内先更新，还是人工判定的语义变化。
2. 决定动作：更新原外部文章、发新版替代文，或把旧文标记为历史版本。
3. 开始处理时回写 `maintenance.external_status = in_progress`。
4. 完成处理后，回写 `maintenance.external_status = completed`，并补齐新的外部渠道状态。
5. 如果旧文已被新口径替代，再补 `content_lifecycle.superseded_by`。
