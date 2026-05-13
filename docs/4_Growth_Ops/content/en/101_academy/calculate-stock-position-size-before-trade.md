---
title: "How to Calculate Stock Position Size Before a Trade"
subtitle: "Start from risk, not from how badly you want the trade."
content_id: "growth-seo-calculate-stock-position-size-before-trade"
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
  - docs/3_Product/Specs/trade_management/57_Position_Budget_Plugin_P0_Spec_20260511.md
  - docs/4_Growth_Ops/content/en/101_academy/101-102_quant_trinity_management.md
  - docs/4_Growth_Ops/content/en/101_academy/101-103_quant_trinity_execution.md
distribution:
  wechat:
    status: "none"
---

# How to Calculate Stock Position Size Before a Trade

The wrong way to size a stock trade starts with the question, "How many shares can I afford?"

The better question is:

> How many shares can I buy if I am only willing to lose a fixed amount when the trade is wrong?

That is the core of stock position sizing.

## Step 1: Decide the account risk

Start with the maximum amount you are willing to lose on this trade.

Some investors use a percentage of account equity, such as 0.5% or 1%. Others use a fixed dollar amount. The exact number depends on your account size, strategy, and risk tolerance.

The important rule is that the number comes before the trade, not after the chart becomes exciting.

Example:

- Account size: $20,000
- Risk per trade: 1%
- Account risk: $200

This means the planned loss for the trade should not exceed $200 if the stop is hit.

## Step 2: Define entry and stop

Next, define the entry price and stop-loss price.

Example:

- Entry price: $50
- Stop-loss price: $48
- Risk per share: $2

The risk per share is the distance between entry and stop.

If your stop is wider, each share carries more risk. If each share carries more risk, the number of shares must shrink.

## Step 3: Divide account risk by risk per share

Use the formula:

> Position size = account risk / risk per share

In the example:

- Account risk: $200
- Risk per share: $2
- Position size: 100 shares

If the trade is stopped out at $48, the loss is roughly $200 before fees and slippage.

## Step 4: Check the target and risk-reward ratio

Now add the target.

Example:

- Target price: $56
- Potential reward per share: $6
- Risk per share: $2
- Risk-reward ratio: 1:3

This does not mean the trade will work. It means the structure is visible.

You can now judge whether the setup deserves risk. If the target is too close, or the stop is unrealistically tight, the trade may not be worth taking.

## Step 5: Respect the result

The calculator's output is not a suggestion to negotiate with.

If the result says 100 shares, buying 300 shares means you changed the risk plan. The trade may still feel more exciting, but the math is no longer the same.

This is where many investors fail. They do the calculation, then override it because the chart looks strong.

A position size calculator only protects you if you let it set the boundary.

## Common mistakes

### Mistake 1: Sizing from cash

Having enough cash to buy 500 shares does not mean 500 shares fit the risk plan.

Cash available and risk allowed are different concepts.

### Mistake 2: Moving the stop after sizing

If you widen the stop after entering, your risk per share increases. The original position size is no longer valid.

### Mistake 3: Ignoring gaps and slippage

A stop price is a plan, not a guarantee. Real fills can be worse, especially around earnings, news, or thin liquidity.

This is why position sizing should be conservative enough to survive imperfect execution.

## Use the calculation before the trade

The best time to calculate stock position size is after the research is complete and before the order is placed.

In ZISO's workflow, the sequence is:

1. Use AI stock research to understand the setup.
2. Define entry, stop, and target.
3. Use the Position Size Calculator to convert risk into shares.
4. Execute only if the plan still makes sense.

That sequence matters. Research without risk becomes storytelling. Risk without research becomes mechanical gambling.

Use the tool here:

- [ZISO Position Size Calculator](/tools/position-budget)

---

*ZISO AI: AI does the research. You keep the decision.*
