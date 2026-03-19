---
name: stockwise-content-ops
description: Execute StockWise content marketing operations, including TOFU/MOFU/BOFU funnel mapping, 3H rhythm planning (Hero/Hub/Hygiene), anti-AI writing voice, Silent Math visual constraints, one-to-many content repurposing, and the repo's Docs-as-Code content operations system (asset frontmatter, source_docs traceability, external maintenance, and auto-generated views). Use when requests involve article planning, copywriting standards, channel distribution strategy, content ops governance, content inventory/queue management, or image prompt direction for StockWise brand assets.
---

# StockWise Content Ops (Elite Enhanced)

## Overview

Apply StockWise content SOP with consistent strategy, tone, and visual language. 
This skill integrates the **ZISO World-Class Playbook** (Philosophical Depth) with **Docs-as-Code Operational Mastery** (System Efficiency).

---

## 1. Strategy: The Grand Narrative & Funnel

### 1.1 Funnel Stages (TOFU/MOFU/BOFU)
*   **TOFU (Awareness)**: Pierce illusions about "easy AI money." Use reverse-consensus insights and realistic "anxiety killers."
*   **MOFU (Consideration)**: Psychological Detox. Establish trust through extreme transparency and "StockWise 101" education.
*   **BOFU (Conversion)**: "Execution over Analysis." Focus on automated defense mechanisms and the "Rational Sanctuary."

### 1.2 3H Distribution Rhythm
*   **Hygiene (Daily)**: AI minimal reports, mood snapshots, "Golden Rule" cards. For Social/IM.
*   **Hub (Weekly/Bi-weekly)**: weekend reviews, serialized `101` long-reads. For Official Accounts/Academy.
*   **Hero (Quarterly/Annually)**: Industry "bombshell" reports, whitepapers, 30-day challenges. High-quality production.

---

## 2. Creative Standards: Anti-AI & Silent Math

### 2.1 Writing Style (Scientifically Rigorous Pop-Science)
**Core Rule: Professionalism is the goal; accessibility is the bridge.**
- **✅ Best Practices**:
    - **Metaphor First (隐喻先行)**: Use intuitive metaphors (e.g., "Dealer", "Fishing Rod Bend", "Scales") *before* defining technical terms (MFE, MAE, R-multiples).
    - **WeChat Article Density (公众号正文密度)**: Write like a strong Chinese long-form public account article, not like slogan cards, poetry, or a teleprompter script. Keep paragraph continuity; reserve short standalone lines only for decisive turns or sharp conclusions.
    - **Pure Chinese Flow (纯净中文流)**: Remove bilingual terms (e.g., `(Management)`) from the main body. Keep the prose naturally Chinese to avoid reading "stutters."
    - **Authority Descriptors (权威短注)**: Use brief inline descriptions for institutions and authors (e.g., "华尔街顶级巨头 Citadel", "头寸管理大师 Van Tharp") to build instant trust.
    - **认知对齐 (行话指南)**：不再使用传统的“附录”标题，而是使用如“认知对齐：行话指南”这类更具极客感且符合用户心智的标题。Use a standardized `<small>` footer glossary for all English technical terms and institution/author details.
    - **Direct Impact**: First sentence must draw blood.
    - **Native Lingo**: Use "讲真", "割肉", "接盘侠", "关灯吃面".
    - **Short & Sharp**: Use periods to force a cold, rhythmic pace.
    - **Not Closed-Door Writing (避免闭门造车)**: Before revising a live-facing article, check current Chinese internet discourse and hot expressions around the topic. Use contemporary user-facing language and examples when they sharpen relevance, but always anchor conclusions back to StockWise strategy docs.
    - **Role-Aware Editing (按战役角色改稿)**: `hook` articles should prioritize immediacy, user pain, and spreadability; `bridge` articles should clarify maps, frameworks, and level differences; `conversion` articles should land on product mechanics, boundaries, and actionability.
    - **Keep the Blade, Remove the Gimmick (保留锋利，去掉花活)**: Strong openings are encouraged, but body paragraphs should read like an article, not fragmented copywriting. If a draft starts reading like verse, compress it back into normal article paragraphs.
    - **10w+ Standard (10w+ 生产标准)**:
        - Do not optimize only for correctness; optimize for click, retention, recognition, and forwarding.
        - Title must work for strangers in WeChat discovery, not just existing users.
        - The first 150 Chinese characters must quickly hit a real user action, embarrassment, fear, or familiar bad habit.
        - Every article should contain 2-3 “传播单元”: screenshot-worthy lines, quotable turns, or identity-level conclusions people want to forward.
        - Prefer real scenes first, theory second. Start from behaviors like asking AI for tomorrow's涨跌, staring at分时图, waiting to解套, or刷新闻安慰持仓.
        - Prepare multiple title/opening candidates when reach matters; assume iteration beats first-draft instinct.
    - **WeChat Discovery Awareness (适配看一看传播)**:
        - Strong copy must still work when the reader does not know ZISO.
        - Ask: would this title earn a click from a stranger, and would the first screen earn another 10 seconds?
    - **Support Boundary (Support 文体边界)**:
        - `Support` content is not written like `101`.
        - `Support` pieces should read like concise help docs, system explainers, or product notes: short, direct, concrete, low-flourish.

### 2.2 Visuals: "Silent Math" (沉默的数学)
- **Palette**: Deep Void (`#050508`), Indigo-500 (`#6366f1`), Rose-500 (`#f43f5e`), Emerald-500 (`#10b981`).
- **Prompt Engine**: Swiss Style, Geometric, Minimalist. Strictly Dark Mode. NO text. NO UI elements. Symbolic and symmetrical.

---

## 3. Operational Workflow (Docs-as-Code)

### 3.1 Content Production Workflow
1. Map request to Funnel & Rhythm.
2. Read source docs and identify the hard strategic boundary or product truth the article must not violate.
3. Check current Chinese web discourse for the topic before revising public-facing copy; absorb hot user language, product names, and misconceptions if relevant.
4. Draft or revise copy using high-stance, anti-generic voice and WeChat-article paragraph density.
5. If the article is intended to compete for broad reach, explicitly rework:
   - 3 title options
   - first-screen opening
   - 2-3传播单元
   - a clearer reason to share/save/follow
6. Define visual direction using the Silent Math engine.
7. **Docs-as-Code Integration**: Use Markdown frontmatter as the source of truth for all status and metadata.

### 3.2 Metadata (Frontmatter) Rules
- **workflow.\***: Main pipeline tracking.
- **distribution.\***: Channel delivery status.
- **maintenance.\***: Revision (`change_status`, `external_action`).
- **source_docs**: Required field linking to underlying strategy files in `0_Strategy` or `1_Engineering`.

### 3.3 Repurposing (One-to-Many)
- **Anchor**: Create master MD in `docs/4_Growth_Ops/content/`.
- **Fission**: Extract quotes for social (Hygiene), split into carousels (TOFU), archive in Academy (BOFU).

---

## 4. Automation & Governance

### 4.1 CMO Sync (`/cmo-sync`)
Scan all MD assets and refresh `docs/4_Growth_Ops/content/README.md` and related views. Prefer generated views over manual lists.

### 4.2 Content Audit (`/content-audit`)
Execute traceability audit. Identify "orphan" content without strategic backbone or outdated content requiring updates after a strategy change.

---

## 5. Reference & Assets
- **Drafts/Assets**: `docs/4_Growth_Ops/content/*` and `docs/5_Support_Ops/content/*`.
- **Strategy Source**: `docs/0_Strategy/`.
- **Visual Archive**: `frontend/public/images/learn/`.
