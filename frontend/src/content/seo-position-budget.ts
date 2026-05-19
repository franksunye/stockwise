import { brandCoreZhCN } from '@/content/brand-core.zh-CN';

export const POSITION_BUDGET_CANONICAL_PATH = '/tools/position-budget';

export const positionBudgetGeoLocaleCopy = {
  en: {
    title: 'Position Size Calculator for Stocks',
    description:
      'Calculate stock position size from account risk, entry, stop loss, and risk-reward targets.',
    keywords: [
      'position size calculator',
      'stock position size calculator',
      'trading position size calculator',
      'position sizing calculator',
      'stock position sizing calculator',
      'trading risk calculator',
      'risk reward ratio calculator',
      'risk to reward ratio calculator',
      'stop loss position size calculator',
      'risk per trade calculator',
    ],
  },
  cn: {
    title: '仓位预算 / 头寸计算器',
    description: '根据账户风险、入场价、止损价和风险收益比计算股票仓位。',
    keywords: ['仓位预算', '头寸计算', '单笔风险控制', '止损仓位', 'R倍数'],
  },
  ko: {
    title: 'Position Size Calculator | 포지션 사이즈 계산기',
    description:
      '계좌 위험, 진입가, 손절가, 위험 보상 비율을 기준으로 주식 포지션 크기를 계산합니다.',
    keywords: [
      'position size calculator',
      '포지션 사이즈 계산기',
      '주식 포지션 계산기',
      '손절 계산기',
      '위험 보상 비율 계산기',
    ],
  },
  es: {
    title: 'Calculadora de Trading para Tamaño de Posición',
    description:
      'Calcula el tamaño de posición en acciones a partir del riesgo de cuenta, precio de entrada, stop loss y ratio riesgo-beneficio.',
    keywords: [
      'position size calculator',
      'calculadora trading',
      'calculadora de trading',
      'calculadora de riesgo trading',
    ],
  },
} as const;

const positionBudgetGeoKeywords = Array.from(
  new Set(Object.values(positionBudgetGeoLocaleCopy).flatMap((copy) => copy.keywords)),
);

export const positionBudgetSupportArticles = [
  {
    name: 'What Is a Position Size Calculator?',
    url: '/learn/what-is-position-size-calculator',
    about: 'position size calculator basics',
  },
  {
    name: 'Calculate Stock Position Size Before You Trade',
    url: '/learn/calculate-stock-position-size-before-trade',
    about: 'stock position size and shares to buy',
  },
  {
    name: 'Risk Per Share vs. Risk Per Trade',
    url: '/learn/risk-per-share-vs-risk-per-trade',
    about: 'risk per share and risk per trade',
  },
  {
    name: 'Stop Loss Position Size Calculator',
    url: '/learn/stop-loss-position-size-calculator',
    about: 'stop loss position sizing',
  },
] as const;

/** EN-first metadata; keywords align to US search demand while keeping bilingual / cross-market cues for GEO. */
export const positionBudgetSeoCopy = {
  title: 'Position Size Calculator for Stocks | Risk, Stop Loss & R:R | ZISO AI',
  description:
    'Calculate stock position size from account risk, entry, stop loss, and risk-reward targets. Save risk budget snapshots for HK, US, and A-share workflows in ZISO.',
  keywords: [
    'position size calculator',
    'stock position size calculator',
    'trading position size calculator',
    'position sizing calculator',
    'stock position sizing calculator',
    'share size calculator',
    'shares to buy calculator',
    'how many shares to buy calculator',
    'trading risk calculator',
    'trade risk calculator',
    'trading risk management calculator',
    'risk reward ratio calculator',
    'risk to reward ratio calculator',
    'stop loss calculator',
    'stock stop loss calculator',
    'stop loss position size calculator',
    'stop loss share calculator',
    'risk per trade',
    'risk per trade calculator',
    '1% risk calculator',
    '1% rule trading',
    'risk per share',
    'R-multiple calculator',
    'R:R calculator',
    'position sizing formula',
    'ATR position sizing',
    'ATR stop loss calculator',
    'stop-loss budget',
    'risk budget calculator',
    'expected loss calculator',
    'pre trade checklist',
    'free position size calculator',
    'position budget',
    '仓位预算',
    '头寸计算',
    '头寸计算器',
    '单笔风险控制',
    '1%风险规则',
    '止损仓位',
    '止损计算器',
    '盈亏比计算器',
    'R倍数',
    '港股仓位',
    '美股仓位',
    'A股仓位',
    '포지션 사이즈 계산기',
    '주식 포지션 계산기',
    '손절 계산기',
    '위험 보상 비율 계산기',
    'calculadora trading',
    'calculadora de trading',
    'calculadora de riesgo trading',
    'ZISO AI',
    'StockWise',
  ],
} as const;

/** JSON‑LD blob for GEO / SERP richness (avoid external schema typings). */
export function positionBudgetJsonLdScriptInnerHtml(): string {
  const origin = brandCoreZhCN.domain.replace(/\/$/, '');
  const pageUrl = `${origin}${POSITION_BUDGET_CANONICAL_PATH}`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        '@id': `${pageUrl}#software`,
        name: 'ZISO Position Size Calculator',
        alternateName: [
          'ZISO Position Budget',
          'StockWise Position Budget',
          'Stock position size calculator',
          'Risk per trade calculator',
          positionBudgetGeoLocaleCopy.cn.title,
          positionBudgetGeoLocaleCopy.ko.title,
          positionBudgetGeoLocaleCopy.es.title,
        ],
        applicationCategory: 'FinanceApplication',
        applicationSubCategory: 'Stock position size calculator',
        operatingSystem: 'Web',
        url: pageUrl,
        inLanguage: ['en-US', 'zh-CN', 'ko-KR', 'es-ES'],
        description: positionBudgetSeoCopy.description,
        keywords: Array.from(new Set([...positionBudgetSeoCopy.keywords, ...positionBudgetGeoKeywords])).join(
          ', ',
        ),
        featureList: [
          'Stock position size calculation from account risk',
          'Risk per share and risk per trade budgeting',
          'Stop loss based share count calculation',
          'Risk-reward ratio and R-multiple estimation',
          'Saved risk budget snapshots',
        ],
        hasPart: Object.entries(positionBudgetGeoLocaleCopy).map(([locale, copy]) => ({
          '@type': 'WebPageElement',
          name: copy.title,
          inLanguage:
            locale === 'cn' ? 'zh-CN' : locale === 'ko' ? 'ko-KR' : locale === 'es' ? 'es-ES' : 'en-US',
          description: copy.description,
          keywords: copy.keywords.join(', '),
        })),
        subjectOf: positionBudgetSupportArticles.map((article) => ({
          '@type': 'Article',
          name: article.name,
          url: `${origin}${article.url}`,
          about: article.about,
        })),
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
      },
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How does a position size calculator decide how many shares to buy?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'It starts with account size and risk per trade, then divides that risk budget by the distance between entry price and stop loss.',
            },
          },
          {
            '@type': 'Question',
            name: 'What is the difference between risk per share and risk per trade?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Risk per share is the price distance from entry to stop. Risk per trade is the total account amount you are willing to lose if the stop is hit.',
            },
          },
          {
            '@type': 'Question',
            name: 'Does ZISO choose the stop loss automatically?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No. The calculator estimates share count from the stop and risk inputs you provide. It does not promise a perfect stop or investment outcome.',
            },
          },
        ],
      },
      {
        '@type': 'HowTo',
        '@id': `${pageUrl}#howto`,
        name: 'How to calculate stock position size before a trade',
        step: [
          { '@type': 'HowToStep', name: 'Set account size and risk per trade' },
          { '@type': 'HowToStep', name: 'Enter planned entry price and stop loss' },
          { '@type': 'HowToStep', name: 'Review risk per share, share count, expected loss, and R multiple' },
        ],
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'ZISO AI', item: origin },
          { '@type': 'ListItem', position: 2, name: 'Position Size Calculator', item: pageUrl },
        ],
      },
    ],
  });
}
