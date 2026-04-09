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

While `daily_growth_digest.py` provides automated reporting, use the **Turso CLI Wrapper** for **manual exploration (探索)** of user behavior and conversion leaks:

```bash
# Explore high-potential users (Referred and active)
node frontend/scripts/turso-cli.mjs query "SELECT user_id, registration_type, subscription_tier, referred_by FROM users WHERE created_at > datetime('now', '-7 days') ORDER BY created_at DESC"

# Check symbol popularity for content mapping
node frontend/scripts/turso-cli.mjs query "SELECT symbol, count(*) as count FROM user_watchlist GROUP BY symbol ORDER BY count DESC LIMIT 10"
```

### 2.2 Standard Metrics
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

## 3. Daily Growth Pulse (Unified Intelligence)

We bridge external traffic (GA4/Clarity) with internal conversion (DB) to identify growth loops and friction points.

### 3.1 Running the Digest
To generate a 24h performance snapshot across all layers:
```bash
# Required: GA4_PROPERTY_ID, GA4_CREDENTIALS_PATH, CLARITY_API_TOKEN in .env
export DB_SOURCE=cloud; python3 backend/scripts/daily_growth_digest.py
```
**Output**: `tmp/latest_growth_pulse.md` (Includes conversions, top pages, and **Detailed New User Intelligence**).

### 3.2 Key Attribution Channels
- **Search (GEO/SEO)**: High-intent users seeking prediction models.
- **Social (Hero Content)**: Viral spikes from WeChat/X posts.
- **Direct (Retention)**: Existing users returning for daily reports.

### 3.3 Behavioral Segmentation (Clarity/GA4 Tagging)
All frontend sessions are tagged for deep filtering:
- `user_id`: Cross-correlate session behavior with specific account history.
- `tier`: Analyze how "Pro" behavior differs from "Free" (e.g., higher engagement time).

---

## 4. SEO & GEO Performance

Content is optimized not just for humans, but for AI Search (GEO) and standard Search Engines (SEO).
- **Structured Data**: Inject JSON-LD (Schema.org) into all article and FAQ pages.
- **Keyword Integration**: Naturally weave in high-intent keywords (Stock Prediction, Dividend Yield, AI Analysis).

---

## 🛠️ Growth Checklist
- [ ] Content adheres to the "Ultra-Minimalist" style guide.
- [ ] Bilingual parity achieved for all marketing routes.
- [ ] Structured data (JSON-LD) is verified for search indexing.
- [ ] **Growth Digest**: Daily report reviewed for conversion leaks.
- [ ] **Clarity Audit**: Filter recordings by `tier=pro` to ensure premium experience.
