import { brandCoreZhCN } from '@/content/brand-core.zh-CN';

export const POSITION_BUDGET_CANONICAL_PATH = '/tools/position-budget';

/** EN-first metadata; keywords include bilingual / cross-market cues for GEO + indexing. */
export const positionBudgetSeoCopy = {
  title: 'Position Budget — Shares, Risk & R-Multiples | ZISO AI',
  description:
    'Estimate position size from risk per trade, plus entry, stops, targets, and saved snapshots—for HK, US, and A-share workflows in your StockWise / ZISO workspace.',
  keywords: [
    'position sizing',
    'risk per trade',
    'R-multiple calculator',
    'stop-loss budget',
    'expected loss calculator',
    '仓位预算',
    '头寸计算',
    '单笔风险控制',
    '止损仓位',
    'R倍数',
    '港股仓位',
    '美股仓位',
    'A股仓位',
    'ZISO AI',
    'StockWise',
  ],
} as const;

/** JSON‑LD blob for GEO / SERP richness (avoid external schema typings). */
export function positionBudgetJsonLdScriptInnerHtml(): string {
  const origin = brandCoreZhCN.domain.replace(/\/$/, '');
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ZISO Position Budget',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    url: `${origin}${POSITION_BUDGET_CANONICAL_PATH}`,
    inLanguage: ['en-US', 'zh-CN'],
    description: positionBudgetSeoCopy.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    isAccessibleForFree: true,
    provider: {
      '@type': 'Organization',
      name: 'VisuTry AI Labs',
      url: origin,
    },
  });
}
