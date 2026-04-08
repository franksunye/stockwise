---
name: growth-marketing-ops
description: User Growth & Strategic Content Operations. Covers marketing funnel mapping, 3H content rhythm, anti-AI voice standards, and product data analysis (conversion/retention).
---

# Growth & Marketing Operations

This skill unifies the strategic and analytical efforts required to scale the StockWise user base. It combines domain-specific content strategies with data-driven analysis of user acquisition and retention.

## 1. Content Strategy & Marketing Funnel

To convert anonymous visitors into active PRO users, we map content to the user journey:

### 1.1 Funnel Mapping (3H Rhythm)
- **Hero (TOFU)**: Attention-grabbing, high-concept pieces for social sharing (e.g., "The Math of Compounding").
- **Hub (MOFU)**: Regularly scheduled deep-dives to build authority (e.g., "Master Series", Weekly Market Tactics).
- **Hygiene (BOFU)**: Essential "How-To" guides and support artifacts that reduce friction.

### 1.2 Anti-AI Writing Standards
Our content must feel human, professional, and institutional.
- **Tone**: Ultra-minimalist, authoritative, and concise. Avoid "AI fluff" (excessive adjectives, filler conclusions).
- **Silent Math**: Use formatting constraints to prioritize logic and speed.
- **One-to-Many**: Every long-form article should be repurposable into Tweets, Posters, and App Alerts.

---

## 2. User Growth Analysis (Data-Driven)

We optimize the product by analyzing the behavior of the current user base via SQL.

### 2.1 Core Metrics & SQL Templates
- **Pro Conversion Rate**:
    ```sql
    SELECT count(*) filter (where subscription_tier = 'pro') * 1.0 / count(*) as conv_rate 
    FROM users;
    ```
- **Stock Heatmaps (Watchlist Activity)**:
    ```sql
    SELECT symbol, count(*) as frequency 
    FROM user_watchlist 
    GROUP BY symbol ORDER BY frequency DESC LIMIT 20;
    ```
- **Retention Cohorts**: Track how many users logged in within X days of signup.

### 2.2 Growth Experiments
When running A/B tests or landing page updates:
- **Baseline**: Establish clear success metrics before the rollout.
- **Parity**: Ensure bilingual parity for all marketing assets (CN/EN).

---

## 3. SEO & GEO Performance

Content is optimized not just for humans, but for AI Search (GEO) and standard Search Engines (SEO).
- **Structured Data**: Inject JSON-LD (Schema.org) into all article and FAQ pages.
- **Keyword Integration**: Naturally weave in high-intent keywords (Stock Prediction, Dividend Yield, AI Analysis).

---

## 🛠️ Growth Checklist
- [ ] Content adheres to the "Ultra-Minimalist" style guide.
- [ ] Bilingual parity achieved for all marketing routes.
- [ ] Structured data (JSON-LD) is verified for search indexing.
- [ ] Conversion impact analyzed after major feature launches.
