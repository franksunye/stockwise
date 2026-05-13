import { brandCoreZhCN } from '@/content/brand-core.zh-CN';

export type HomeSeoLocale = 'en' | 'cn' | 'ko' | 'es';

export const HOME_CANONICAL_PATH = '/';

export const homeSeoLocaleCopy = {
  en: {
    path: '/',
    title: 'AI Stock Analysis & Stock Research App | ZISO AI',
    description:
      'ZISO AI is an AI stock analysis and stock research app for serious retail investors. Review markets after the close, audit reasoning, and prepare the next session.',
    keywords: [
      'AI stock analysis',
      'stock research',
      'AI stock research',
      'stock analysis app',
      'stock market analysis',
      'post-close market research',
      'stock research app',
      'stock prediction research',
      'investment research assistant',
      'retail investor research tool',
      'ZISO AI',
    ],
  },
  cn: {
    path: '/cn',
    title: 'AI 股票分析与盘后复盘工具 | 知守 AI',
    description:
      '知守 AI 是面向严肃投资者的 AI 股票分析与盘后复盘工具，帮助用户审计市场逻辑、设置风险边界，并为下一交易日制定计划。',
    keywords: [
      'AI 股票分析',
      '股票分析工具',
      '盘后复盘',
      'AI 投研助手',
      '股票研究工具',
      '交易纪律',
      '美股分析',
      '港股分析',
      'A股分析',
      '知守 AI',
      'ZISO AI',
    ],
  },
  ko: {
    path: '/ko',
    title: 'AI 주식 분석 및 리서치 앱 | ZISO AI',
    description:
      'ZISO AI는 진지한 개인 투자자를 위한 AI 주식 분석 및 장 마감 후 리서치 앱입니다. 시장을 복기하고 추론을 감사하며 다음 세션을 준비합니다.',
    keywords: [
      'AI stock analysis',
      'stock research',
      'AI 주식 분석',
      '주식 리서치 앱',
      '주식 분석 앱',
      '장 마감 리서치',
      '투자 리서치 도구',
      'ZISO AI',
    ],
  },
  es: {
    path: '/es',
    title: 'Análisis de Acciones con IA | ZISO AI',
    description:
      'ZISO AI es una app de análisis de acciones con IA para inversores serios. Revisa el mercado tras el cierre, audita el razonamiento y prepara la próxima sesión.',
    keywords: [
      'AI stock analysis',
      'stock research',
      'analisis de acciones con IA',
      'analisis bursatil con IA',
      'app de analisis de acciones',
      'investigacion de mercado post-cierre',
      'herramienta de investigacion bursatil',
      'ZISO AI',
    ],
  },
} as const;

export const homeSeoKeywords = Array.from(
  new Set(Object.values(homeSeoLocaleCopy).flatMap((copy) => copy.keywords)),
);

export function buildHomeSoftwareJsonLd(locale: HomeSeoLocale = 'en'): Record<string, unknown> {
  const copy = homeSeoLocaleCopy[locale];
  const origin = brandCoreZhCN.domain.replace(/\/$/, '');
  const localeMap: Record<HomeSeoLocale, string> = {
    en: 'en-US',
    cn: 'zh-CN',
    ko: 'ko-KR',
    es: 'es-ES',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ZISO AI',
    alternateName: [
      'ZISO AI stock analysis app',
      'ZISO stock research app',
      '知守 AI',
      homeSeoLocaleCopy.ko.title,
      homeSeoLocaleCopy.es.title,
    ],
    applicationCategory: 'FinanceApplication',
    applicationSubCategory: 'AI stock analysis and stock research',
    operatingSystem: 'Web',
    url: `${origin}${copy.path}`,
    inLanguage: localeMap[locale],
    description: copy.description,
    keywords: copy.keywords.join(', '),
    featureList: [
      'AI stock analysis for US, Hong Kong, and China A-share markets',
      'Post-close market review and next-session preparation',
      'Multi-agent rationale audit and logic trace',
      'Risk boundaries, tactical anchors, and watchlist alerts',
    ],
    audience: {
      '@type': 'Audience',
      audienceType: 'Serious retail investors',
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  };
}
