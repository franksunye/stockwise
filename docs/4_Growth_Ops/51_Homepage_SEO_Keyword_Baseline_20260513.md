# ZISO Homepage SEO Keyword Baseline

> Date: 2026-05-13  
> Scope: `https://ziso.cc/` and localized homepage metadata.  
> Source: Google Trends, United States, Past 12 months, Web Search, inspected in Chrome.

## Executive Decision

The homepage should target the real demand cluster around **AI stock analysis** and **stock research**, not the internal phrase `DeepSeek-V3 powered stock intelligence`.

`stock prediction` has visible demand, but its related queries are dominated by ticker-specific price prediction intent. Use it only as a controlled long-tail concept such as `stock prediction research`; do not make it the homepage title or primary promise.

## Google Trends Baseline

| Priority | Query | Trends signal | Action |
| --- | --- | --- | --- |
| P0 | `AI stock analysis` | Average **38** in the direct product-intent group; much stronger than `stock research tool`, `AI investing assistant`, and `stock alerts app` | Use in homepage title, description, keywords, and JSON-LD |
| P0 | `stock research` | Average **38** when compared with `stock prediction`, `stock signals`, and `AI stock picker` | Use as the broad category phrase, paired with AI/product wording |
| P1 | `stock analysis app` | Average **12** in the direct app/tool group; weaker when compared with broad terms but still product-shaped | Use as a secondary keyword and app-positioning phrase |
| P1 | `AI stock research` | Average **7** in the broad research group | Use as a secondary GEO/semantic phrase |
| P2 | `stock market analysis` | Average **10** but related queries lean news-heavy | Use only in supporting copy; avoid title-level targeting |
| Exclude | `AI stock picker` | Average **0** in Trends comparison | Do not target on homepage |
| Boundary | `stock prediction` | Average **24**, but related queries are ticker-specific price-prediction searches | Do not use as homepage promise; only use bounded `research` phrasing |

## Implemented Mapping

| Surface | New primary phrase |
| --- | --- |
| EN title | `AI Stock Analysis & Stock Research App` |
| EN description | `AI stock analysis` + `stock research app` + post-close review |
| CN title | `AI 股票分析与盘后复盘工具` |
| KO title | `AI 주식 분석 및 리서치 앱` |
| ES title | `Análisis de Acciones con IA` |
| JSON-LD | `SoftwareApplication`, `FinanceApplication`, `AI stock analysis and stock research` |

## Review Rule

Check GSC after 14 days by page + query:

- `/`: `AI stock analysis`, `stock research`, `stock analysis app`
- `/cn`: `AI 股票分析`, `股票分析工具`, `盘后复盘`
- `/ko`: English query leakage plus Korean translated terms
- `/es`: `analisis de acciones con IA`, `app de analisis de acciones`, English query leakage

If impressions rise but CTR is weak, revise title. If `stock prediction` impressions appear but bounce or mismatch intent, keep that phrase out of title and move any prediction copy into risk-boundary FAQ only.
