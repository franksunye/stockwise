# Engineering Internationalization (i18n) Documentation

Welcome to the Internationalization (i18n) subdirectory. This section provides technical guidelines, architecture decisions, and implementation details for the global deployment and cross-border support of the StockWise platform.

## 📁 Directory Structure

- [00_Globalization_Strategy_V2.md](./00_Globalization_Strategy_V2.md): The core V2 strategy for globalizing the marketing site and content.
- [01_Stock_Name_Internationalization.md](./01_Stock_Name_Internationalization.md): Current production standard for CN/HK stock-name i18n (runtime source of truth, ETL flow, fallback and maintenance rules).
- [02_Global_First_ISR_Architecture.md](./02_Global_First_ISR_Architecture.md): Architecture for performance optimization and static generation in a global context.
- [03_Globalization_Strategy_and_Evolution.md](./03_Globalization_Strategy_and_Evolution.md): High-level strategy for global expansion and evolution.
- [04_App_Locale_Resolution_Model.md](./04_App_Locale_Resolution_Model.md): Runtime model for app locale resolution, including the verified 2026-04-15 first-visit locale bug root cause, temporary invite-locale patch boundary, and cleanup backlog.

## 🌐 Principles and Strategy

Our internationalization strategy follows the [GLOBALIZATION_IMPLEMENTATION_DESIGN.md](../GLOBALIZATION_IMPLEMENTATION_DESIGN.md) document. 

Key engineering principles:
1. **Public/App Separation**: Public-facing SEO pages use `next-intl` with localized prefixes, while the authenticated app (`dashboard`) uses a cross-subdomain locale cookie.
2. **Data-Driven i18n**: Stock names and company profiles are localized in the database (`stock_meta`), not just in UI files.
3. **Pinyin as ID**: For CN markets, Pinyin remains a first-class identifier for searching and navigation.
4. **Symbol as Universal Key**: When an English translation is unavailable, we always default to the Stock Symbol to ensure user clarity.

## 🛠️ Common Workflows

- **Updating Global Metadata**: Run `python backend/main.py --sync-meta` to refresh symbols and localized names from upstream APIs.
- **Translating UI Messages**: Update `frontend/src/messages/en.json` for dashboard labels.
- **Translating Marketing Content**: Create localized Markdown files under `docs/4_Growth_Ops/content/`.

---
*Last Updated: 2026-04-15 (updated §04 with verified root cause and backlog)*
