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

### 2.1 Writing Style (Anti-AI & Mentor Voice)
**Core Rule: If it sounds like AI, the value is zero.**
- **🚫 Anti-Patterns**: No "In conclusion," no templated openings, no "since... then..." logic loops, no neutral disclaimers.
- **✅ Best Practices**:
    - **Direct Impact**: First sentence must draw blood.
    - **Native Lingo**: Use "讲真", "割肉", "接盘侠", "关灯吃面".
    - **Short & Sharp**: Use periods to force a cold, rhythmic pace.
    - **Physical Metaphors**: Use weight, friction, and extreme scenarios (e.g., "brakes failing on a cliff").

### 2.2 Visuals: "Silent Math" (沉默的数学)
- **Palette**: Deep Void (`#050508`), Indigo-500 (`#6366f1`), Rose-500 (`#f43f5e`), Emerald-500 (`#10b981`).
- **Prompt Engine**: Swiss Style, Geometric, Minimalist. Strictly Dark Mode. NO text. NO UI elements. Symbolic and symmetrical.

---

## 3. Operational Workflow (Docs-as-Code)

### 3.1 Content Production Workflow
1. Map request to Funnel & Rhythm.
2. Draft copy using high-stance, anti-generic voice.
3. Define visual direction using the Silent Math engine.
4. **Docs-as-Code Integration**: Use Markdown frontmatter as the source of truth for all status and metadata.

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
