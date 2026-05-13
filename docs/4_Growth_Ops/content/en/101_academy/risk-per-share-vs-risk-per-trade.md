---
title: "Risk Per Share vs Risk Per Trade: The Formula Behind Position Size"
subtitle: "One number describes the stock. The other describes your account."
content_id: "growth-seo-risk-per-share-vs-risk-per-trade"
content_source: "growth"
content_type: "article"
canonical_role: "canonical"
date: "2026-05-13"
category: "The Money"
funnel_stage: "MOFU"
campaign_role: "conversion"
campaign: "position_budget_seo_keyword_cluster_2026q2"
rhythm: "Hub"
traceability:
  status: "healthy"
  last_reviewed_at: "2026-05-13"
workflow:
  stage: "published"
  owner: "cmo"
  reviewer: "founder"
  priority: "high"
  target_publish_date: "2026-05-13"
  last_action_at: "2026-05-13"
maintenance:
  change_status: "created"
  update_reason: "seo_refresh"
website:
  enabled: true
  surface: "learn"
source_docs:
  - docs/4_Growth_Ops/52_Position_Budget_SEO_GEO_Aggressive_Expansion_20260513.md
  - docs/3_Product/Specs/trade_management/57_Position_Budget_Plugin_P0_Spec_20260511.md
distribution:
  wechat:
    status: "none"
---

# Risk Per Share vs Risk Per Trade: The Formula Behind Position Size

Position sizing becomes much easier once you separate two numbers:

- Risk per share
- Risk per trade

They sound similar. They are not the same.

## Risk per share

Risk per share is the distance between your entry price and stop-loss price.

Example:

- Entry: $80
- Stop: $76
- Risk per share: $4

This number comes from the trade setup. A wider stop means each share carries more risk.

## Risk per trade

Risk per trade is the total amount of account risk you are willing to spend on the idea.

Example:

- Account size: $30,000
- Planned risk: 1%
- Risk per trade: $300

This number comes from your account rule. It should not change just because the chart looks exciting.

## The formula

Once both numbers are known, position size is simple:

> Position size = risk per trade / risk per share

Using the examples above:

> $300 / $4 = 75 shares

That means a 75-share position risks about $300 if the stop is hit.

## Why this matters

Many investors look only at the stop.

They say, "The stop is just $4 away." But $4 per share means very different things if the position is 50 shares, 500 shares, or 2,000 shares.

Risk per share tells you the unit risk.

Risk per trade tells you the account risk.

Position size connects them.

## Common mistake

The mistake is widening the stop without reducing the position.

If risk per share goes from $4 to $8, the position size should usually shrink. Otherwise the same trade now risks twice as much money.

That is not a small adjustment. It is a different trade.

## Use the formula before action

A good position size calculator should make these numbers visible:

- Entry
- Stop
- Risk per share
- Risk per trade
- Share count
- Expected loss

ZISO's Position Size Calculator uses that structure so the trade has a budget before it becomes an order.

Use the calculator here:

- [ZISO Position Size Calculator](/tools/position-budget)

---

*ZISO AI: AI does the research. You keep the decision.*

