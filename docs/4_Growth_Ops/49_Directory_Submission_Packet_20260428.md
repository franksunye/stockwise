# ZISO AI Directory Submission Packet

> Version: v0.1
> Date: 2026-04-28
> Status: Ready for first target-site submission
> Owner: Frank + Codex

This packet is the reusable source for submitting ZISO AI to AI directories, startup directories, SaaS catalogs, and launch aggregators. It is based on the current Product Hunt profile and the repo's brand-core copy.

---

## 1. Canonical Product Fields

| Field | Value |
| :--- | :--- |
| Product name | ZISO AI |
| Website | https://ziso.cc |
| Launch / invite URL | https://ziso.cc/v/PH |
| App URL | https://app.ziso.cc |
| Category | Investing, Fintech, Artificial Intelligence, Data visualization |
| Pricing | Free option available; Go is the current paid core; Plus is upcoming |
| Built with | DeepSeek-V3, Vercel, Turso |
| Founder / maker | Frank / Ye Sun |
| Support / contact | hi@ziso.cc |
| Legal boundary | Research and informational tool only. Not investment advice. |

## 2. Copy Variants

### 2.1 One-line Taglines

Use the strictest version when a directory has financial-content review.

```text
AI stock research assistant for disciplined retail investors
```

```text
Post-close AI stock research, key levels, and watchlist alerts
```

```text
AI does the research. You keep the decision.
```

Avoid:

```text
AI stock picker
Trading signal generator
Beat the market with AI
Guaranteed win rate
```

### 2.2 Short Description

```text
ZISO AI helps retail investors review the market after the close, identify key price levels, and track watchlist changes with structured AI insights and real-time alerts.
```

### 2.3 Medium Description

```text
ZISO AI is a stock research assistant for retail investors who want decision clarity, not more market noise. It turns post-close market review into a repeatable workflow: structured AI insights, key price levels, tactical anchors, and watchlist alerts. Powered by DeepSeek-V3, ZISO helps investors prepare better boundaries for the next trading day while keeping the final decision with the user.
```

### 2.4 Long Description

```text
ZISO AI is an AI stock research assistant built for disciplined retail investors.

Most investors do not lack information. They lack a calm, repeatable review workflow. ZISO AI helps users review the market after the close, understand key support and resistance levels, track watchlist changes, and read structured AI reasoning without getting buried in market noise.

The product focuses on decision clarity and risk boundaries rather than hype. Go unlocks deeper DeepSeek-V3 powered reasoning, tactical briefs, and real-time watchlist alerts. Plus is an upcoming consensus reasoning layer.

ZISO AI is a research and alerting tool. It does not provide investment advice, guarantee returns, or replace the user's own judgment.
```

### 2.5 Founder Note

```text
Hi, I'm Frank, the maker of ZISO AI. I built ZISO for retail investors who already have enough market information but still struggle with structure, discipline, and consistent post-close review.

The goal is not to create another noisy dashboard or generic AI summary. ZISO is designed to help users build a calmer nightly review workflow: actionable insights, key price levels, tactical anchors, and watchlist alerts.

I'm especially interested in feedback on workflow clarity, alerting logic, onboarding, and where AI should stop so the investor can make the final decision.
```

## 3. Directory-Specific Field Map

| Common field | Recommended value |
| :--- | :--- |
| Name | ZISO AI |
| URL | Prefer `https://ziso.cc/v/PH` for launch directories; use `https://ziso.cc` for evergreen directories |
| Tagline | AI stock research assistant for disciplined retail investors |
| Description | Use short / medium / long by field limit |
| Category 1 | Investing |
| Category 2 | Artificial Intelligence |
| Category 3 | Fintech |
| Tags | AI stock research, investing, watchlist alerts, DeepSeek, key levels, retail investors, market analysis |
| Pricing model | Freemium |
| Target users | Serious retail investors, active watchlist users, post-close review users |
| Differentiator | Structured post-close workflow, tactical levels, reasoning transparency, watchlist alerts |
| Launch offer | 5-day Go trial through invite link; 30-day code for thoughtful feedback when manually offered |
| Compliance note | Research and informational purposes only; not investment advice |

## 4. Asset Checklist

Required for most directories:

- Logo: square, preferably 512x512 or 1024x1024 PNG.
- Product screenshots: 3-5 images, ideally dashboard, tactical brief, key levels, alerts, pricing.
- Hero image: 1200x630 or 1600x900.
- Founder avatar: optional but useful for founder-led directories.
- Demo video: optional; 30-45 seconds is enough.
- Social links: X, Product Hunt, LinkedIn if available.

Current missing fields before first live submission:

- Target directory URL.
- Login/account method for the target directory.
- Whether the target directory should use the launch invite URL or canonical homepage.
- Public social links to attach.
- Logo/screenshot paths to upload if the site requires files.

## 5. First-Submission Procedure

1. Open the target directory and inspect the exact form fields, category rules, and moderation policy.
2. Choose `https://ziso.cc/v/PH` only if the directory is campaign/launch oriented. Use `https://ziso.cc` for evergreen SEO directories.
3. Fill fields from this packet without making financial-performance claims.
4. Add the compliance note when the directory allows a longer description.
5. Screenshot or save the final submitted state.
6. Record the listing in the tracking table below.

## 6. Tracking Table Template

| Date | Directory | URL | Account | Submitted URL | Status | Notes | Follow-up date |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-04-28 | Indie Hackers | https://www.indiehackers.com/product/ziso-ai | ZISO_Frank | https://www.indiehackers.com/product/ziso-ai | Submitted | Product page created; edit page still requests missing info and original post | TBD |

Status values:

- Not started
- Drafted
- Submitted
- Approved
- Rejected
- Needs update
- Duplicate

## 7. Skill Candidate

This should become a Codex skill if we will submit to more than 10 directories or repeat this monthly.

Skill scope:

- Read this packet and the latest Product Hunt profile.
- Inspect each target site's live form requirements.
- Select the correct copy variant.
- Avoid regulated-finance claims.
- Track submission status in a local table.
- Produce a concise daily status report with submitted, blocked, approved, and rejected counts.

Do not automate password entry, CAPTCHA solving, or undisclosed account creation. The user should provide authentication or complete those steps interactively.

Initial skill trigger phrase:

```text
ZISO AI directory submission
```

Recommended next step before creating the skill:

Run 3-5 manual assisted submissions first, collect the field differences, then turn the stable pattern into a skill with a small target-site adapter checklist.

---

## 8. Target Adapter: Indie Hackers

Live check on 2026-04-28:

- `https://www.indiehackers.com/products` currently presents The Build Board / Products DB.
- Footer navigation exposes `Products -> Add Yours` at `https://www.indiehackers.com/products/new`.
- `https://www.indiehackers.com/new-post` redirects unauthenticated users to sign-in.
- The Products DB form requires Product Name, Product Tagline, Website, and Logo.
- Codex in-app browser cannot upload files directly; Frank must manually upload `/Users/yesun/Code/stockwise/frontend/public/logo.png`.
- Product page created at `https://www.indiehackers.com/product/ziso-ai`; Indie Hackers now prompts for missing information and an original post.

Recommended sequence:

1. Create or update the founder account profile first.
2. Add ZISO AI to Products DB via `https://www.indiehackers.com/products/new`.
3. Publish a founder-led feedback/build post only after the product profile exists.
4. Link to `https://ziso.cc` in evergreen product fields. Use `https://ziso.cc/v/PH` only in the post body if explicitly offering the launch trial.

### 8.1 Product DB Draft

```text
Name:
ZISO AI

Tagline:
AI stock research assistant for disciplined retail investors

Website:
https://ziso.cc

Logo:
/Users/yesun/Code/stockwise/frontend/public/logo.png

Description:
ZISO AI helps retail investors build a calmer post-close review workflow. It turns market noise into structured AI insights, key price levels, tactical anchors, and watchlist alerts, so users can prepare better boundaries for the next trading day while keeping the final decision themselves.

Category / tags:
AI, Investing, Fintech, SaaS, Stock research, Watchlist alerts, DeepSeek

Pricing:
Freemium

Founder:
Frank / Ye Sun
```

### 8.2 Build Board / Feedback Post Draft

```markdown
Title:
ZISO AI: I built a calmer post-close stock research workflow for retail investors

Body:
Hi Indie Hackers, I'm Frank, the maker of ZISO AI.

I built ZISO because most retail investors already have too much market information. The harder problem is structure: reviewing after the close, identifying useful price levels, and deciding where AI should stop before the investor makes the final call.

ZISO AI is an AI stock research assistant for disciplined retail investors. The workflow is intentionally narrow:

- review the market after the close
- surface structured AI insights
- identify key support / resistance / breakout references
- track watchlist changes with alerts
- keep the final decision with the user

It is not a trading signal product, and it does not provide investment advice. The product is closer to a repeatable nightly research workflow than a prediction dashboard.

I would especially value feedback on:

1. Whether the positioning is clear enough for non-professional investors.
2. Whether "post-close review + key levels + alerts" feels specific enough.
3. Whether the investment-advice boundary is obvious.
4. What would make you trust or distrust AI reasoning in a stock research workflow.

Product: https://ziso.cc
Launch trial entry: https://ziso.cc/v/PH
```

### 8.3 Indie Hackers Submission Guardrails

- Lead with founder story and workflow learning, not "try my product".
- Do not claim returns, alpha, win rate, or financial advice.
- Prefer the canonical website in the product profile for SEO.
- Keep the launch invite link inside the post only when offering feedback-driven trial access.
- If Indie Hackers prompts for revenue, MRR, user count, or Stripe verification, leave blank unless Frank wants to disclose it.
