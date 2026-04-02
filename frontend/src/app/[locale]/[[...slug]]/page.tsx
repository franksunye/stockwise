import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { brandCoreZhCN } from '@/content/brand-core.zh-CN';
import { ChineseAboutPage } from '@/components/marketing/cn/ChineseAboutPage';
import { ChineseHomePage } from '@/components/marketing/cn/ChineseHomePage';
import { ChinesePricingPage } from '@/components/marketing/cn/ChinesePricingPage';
import { ChinesePrivacyPage } from '@/components/marketing/cn/ChinesePrivacyPage';
import { ChineseRefundPage } from '@/components/marketing/cn/ChineseRefundPage';
import { ChineseTermsPage } from '@/components/marketing/cn/ChineseTermsPage';
import { EnglishAboutPage } from '@/components/marketing/en/EnglishAboutPage';
import { EnglishHomePage } from '@/components/marketing/en/EnglishHomePage';
import { EnglishPricingPage } from '@/components/marketing/en/EnglishPricingPage';
import { EnglishPrivacyPage } from '@/components/marketing/en/EnglishPrivacyPage';
import { EnglishRefundPage } from '@/components/marketing/en/EnglishRefundPage';
import { EnglishTermsPage } from '@/components/marketing/en/EnglishTermsPage';
import { KoreanAboutPage } from '@/components/marketing/ko/KoreanAboutPage';
import { KoreanHomePage } from '@/components/marketing/ko/KoreanHomePage';
import { KoreanPricingPage } from '@/components/marketing/ko/KoreanPricingPage';
import { KoreanPrivacyPage, KoreanTermsPage, KoreanRefundPage } from '@/components/marketing/ko/KoreanLegalPages';
import { SpanishAboutPage } from '@/components/marketing/es/SpanishAboutPage';
import { SpanishHomePage } from '@/components/marketing/es/SpanishHomePage';
import { SpanishPricingPage } from '@/components/marketing/es/SpanishPricingPage';
import { SpanishPrivacyPage, SpanishTermsPage, SpanishRefundPage } from '@/components/marketing/es/SpanishLegalPages';
import { ChineseLearnArticlePage } from '@/components/public/ChineseLearnArticlePage';
import { ChineseLearnIndexPage } from '@/components/public/ChineseLearnIndexPage';
import { ChineseSupportArticlePage } from '@/components/public/ChineseSupportArticlePage';
import { ChineseSupportIndexPage } from '@/components/public/ChineseSupportIndexPage';
import { isSupportedPublicLocale, type PublicLocale, SUPPORTED_PUBLIC_LOCALES } from '@/lib/public-i18n';
import { buildPageMetadata } from '@/lib/seo';
import { getAllArticles } from '@/lib/learn-content';
import { getAllSupportArticles } from '@/lib/support-content';

type PageParams = { locale: string; slug?: string[] };
type PageProps = { params: Promise<PageParams> };

export async function generateStaticParams(): Promise<PageParams[]> {
  const params: PageParams[] = [];

  // 1. Core localized marketing paths (excluding default 'en' which is handled at root level)
  const locales: PublicLocale[] = ['cn', 'ko', 'es'];
  const staticMarketingPaths = ['', 'about', 'pricing', 'privacy', 'terms', 'refund', 'learn', 'support'];

  for (const locale of locales) {
    // Basic pages
    for (const path of staticMarketingPaths) {
      params.push({
        locale,
        slug: path === '' ? undefined : path.split('/'),
      });
    }

    // 2. Localized Learn Articles
    const learnArticles = await getAllArticles({ locale });
    for (const article of learnArticles) {
      params.push({
        locale,
        slug: ['learn', article.slug],
      });
    }

    // 3. Localized Support Articles
    const supportArticles = await getAllSupportArticles({ locale });
    for (const article of supportArticles) {
      params.push({
        locale,
        slug: ['support', article.slug],
      });
    }
  }

  return params;
}

interface PageConfig {

  title: string;
  description: string;
  path: string;
  render: () => React.ReactNode;
  alternateLocales?: PublicLocale[];
}

function isContentPath(slugParts: string[]): boolean {
  return slugParts[0] === 'learn' || slugParts[0] === 'support';
}

function buildLocalizedMeta(locale: Exclude<PublicLocale, 'cn' | 'en'>, page: 'home' | 'about' | 'pricing') {
  const metaLabels = {
    ko: {
      home: { title: 'ZISO AI | AI가 리서치를 수행합니다. 결정은 귀하가 내립니다.', desc: '진지한 개인 투자자를 위한 구조화된 시장 리서치, 전술 브리핑 및 실행 규율.' },
      about: { title: 'ZISO AI 소개', desc: 'ZISO AI가 존재하는 이유, 리서치 프레임워크 및 워크플로우 구성 방식.' },
      pricing: { title: '가격 | ZISO AI', desc: '더 강력한 야간 리서치와 실행 규율을 원하는 투자자를 위한 구독 플랜.' },
    },
    es: {
      home: { title: 'ZISO AI | La IA investiga. Tú tomas la decisión.', desc: 'Investigación de mercado estructurada, informes tácticos y disciplina de ejecución para inversores minoristas serios.' },
      about: { title: 'Sobre ZISO AI', desc: 'Por qué existe ZISO AI, cómo enfoca la investigación y cómo se estructura el flujo de trabajo.' },
      pricing: { title: 'Precios | ZISO AI', desc: 'Planes de suscripción para inversores que desean una investigación nocturna más sólida y disciplina de ejecución.' },
    },
  } as const;

  return metaLabels[locale][page];
}

function getPageConfig(locale: PublicLocale, slugParts: string[]): PageConfig | null {
  const path = slugParts.join('/');

  if (locale === 'cn') {
    if (path === '') {
      return {
        title: '知守 AI | 让交易回归理性的从容',
        description: '复杂的分析交给 AI，简单的决策留自己。知守 AI 自动为你完成复盘与数据建模。',
        path: '/',
        render: () => <ChineseHomePage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'about') {
      return {
        title: '关于知守 AI',
        description: '让普通投资者也能拥有机构级的投研外脑。',
        path: '/about',
        render: () => <ChineseAboutPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'pricing') {
      return {
        title: '价格方案 | 知守投研委员会',
        description: '选聘您的知守委员会。订阅不仅是购买功能，更是雇佣了一组 24/7 在岗的专业交易委员会。',
        path: '/pricing',
        render: () => <ChinesePricingPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'privacy') {
      return {
        title: '隐私政策 | 知守 AI',
        description: '知守 AI 中文站隐私政策与数据处理说明。',
        path: '/privacy',
        render: () => <ChinesePrivacyPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'terms') {
      return {
        title: '服务条款 | 知守 AI',
        description: '知守 AI 中文站服务条款与使用边界说明。',
        path: '/terms',
        render: () => <ChineseTermsPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'refund') {
      return {
        title: '退款政策 | 知守 AI',
        description: '知守 AI 中文站订阅退款与取消续订规则。',
        path: '/refund',
        render: () => <ChineseRefundPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'learn') {
      return {
        title: 'ZISO AI 101 | 知守日课',
        description: '你的理性避难所。教你如何用 AI 和概率论在市场中活下来。',
        path: '/learn',
        render: () => <ChineseLearnIndexPage />,
        alternateLocales: ['cn'],
      };
    }

    if (slugParts[0] === 'learn' && slugParts[1]) {
      return {
        title: 'ZISO AI 101 | 知守日课',
        description: '中文 101 学院文章详情页。',
        path: `/learn/${slugParts[1]}`,
        render: () => <ChineseLearnArticlePage slug={slugParts[1]} />,
        alternateLocales: ['cn'],
      };
    }

    if (path === 'support') {
      return {
        title: '支持中心 | 知守 AI',
        description: '查看知守 AI 的功能说明、支持文档与机制边界。',
        path: '/support',
        render: () => <ChineseSupportIndexPage />,
        alternateLocales: ['cn'],
      };
    }

    if (slugParts[0] === 'support' && slugParts[1]) {
      return {
        title: '支持文档 | 知守 AI',
        description: '知守 AI 中文帮助中心详情页。',
        path: `/support/${slugParts[1]}`,
        render: () => <ChineseSupportArticlePage slug={slugParts[1]} />,
        alternateLocales: ['cn'],
      };
    }

    return null;
  }

  if (locale === 'ko') {
    if (path === '') {
      const meta = buildLocalizedMeta('ko', 'home');
      return {
        title: meta.title,
        description: meta.desc,
        path: '/',
        render: () => <KoreanHomePage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'about') {
      const meta = buildLocalizedMeta('ko', 'about');
      return {
        title: meta.title,
        description: meta.desc,
        path: '/about',
        render: () => <KoreanAboutPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'pricing') {
      const meta = buildLocalizedMeta('ko', 'pricing');
      return {
        title: meta.title,
        description: meta.desc,
        path: '/pricing',
        render: () => <KoreanPricingPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'privacy') {
      return {
        title: '개인정보 처리방침 | ZISO AI',
        description: 'ZISO AI 한국어 사이트 개인정보 처리방침 및 데이터 처리 안내.',
        path: '/privacy',
        render: () => <KoreanPrivacyPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'terms') {
      return {
        title: '서비스 이용약관 | ZISO AI',
        description: 'ZISO AI 한국어 사이트 서비스 이용약관 및 사용 범위 안내.',
        path: '/terms',
        render: () => <KoreanTermsPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'refund') {
      return {
        title: '환불 규정 | ZISO AI',
        description: 'ZISO AI 한국어 사이트 구독 환불 및 취소 규칙 안내.',
        path: '/refund',
        render: () => <KoreanRefundPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }
  }

  if (locale === 'es') {
    if (path === '') {
      const meta = buildLocalizedMeta('es', 'home');
      return {
        title: meta.title,
        description: meta.desc,
        path: '/',
        render: () => <SpanishHomePage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'about') {
      const meta = buildLocalizedMeta('es', 'about');
      return {
        title: meta.title,
        description: meta.desc,
        path: '/about',
        render: () => <SpanishAboutPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'pricing') {
      const meta = buildLocalizedMeta('es', 'pricing');
      return {
        title: meta.title,
        description: meta.desc,
        path: '/pricing',
        render: () => <SpanishPricingPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'privacy') {
      return {
        title: 'Política de Privacidad | ZISO AI',
        description: 'Política de privacidad y tratamiento de datos para el sitio web en español de ZISO AI.',
        path: '/privacy',
        render: () => <SpanishPrivacyPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'terms') {
      return {
        title: 'Términos de Servicio | ZISO AI',
        description: 'Términos que rigen el uso de los servicios y análisis del sitio web en español de ZISO AI.',
        path: '/terms',
        render: () => <SpanishTermsPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }

    if (path === 'refund') {
      return {
        title: 'Política de Reembolso | ZISO AI',
        description: 'Política de reembolso y reglas de cancelación para el sitio web en español de ZISO AI.',
        path: '/refund',
        render: () => <SpanishRefundPage />,
        alternateLocales: ['en', 'cn', 'ko', 'es'],
      };
    }
  }

  if (path === '') {
    const meta = locale === 'en' ? null : buildLocalizedMeta(locale, 'home');
    return {
      title: meta?.title || 'ZISO AI | AI Does the Research. You Keep the Decision.',
      description: meta?.desc || 'Structured market research, tactical briefings, and execution discipline for serious retail investors.',
      path: '/',
      render: () => <EnglishHomePage />,
      alternateLocales: ['en', 'cn', 'ko', 'es'],
    };
  }

  if (path === 'about') {
    const meta = locale === 'en' ? null : buildLocalizedMeta(locale, 'about');
    return {
      title: meta?.title || 'About ZISO AI',
      description: meta?.desc || 'Why ZISO AI exists, how it frames research, and how the workflow is structured.',
      path: '/about',
      render: () => <EnglishAboutPage />,
      alternateLocales: ['en', 'cn', 'ko', 'es'],
    };
  }

  if (path === 'pricing') {
    const meta = locale === 'en' ? null : buildLocalizedMeta(locale, 'pricing');
    return {
      title: meta?.title || 'Pricing | ZISO AI',
      description: meta?.desc || 'Subscription plans for investors who want stronger nightly research and execution discipline.',
      path: '/pricing',
      render: () => <EnglishPricingPage />,
      alternateLocales: ['en', 'cn', 'ko', 'es'],
    };
  }

  if (path === 'privacy') {
    return {
      title: 'Privacy Policy | ZISO AI',
      description: 'Privacy and data handling policy for the ZISO AI public website.',
      path: '/privacy',
      render: () => <EnglishPrivacyPage />,
      alternateLocales: ['en', 'cn', 'ko', 'es'],
    };
  }

  if (path === 'terms') {
    return {
      title: 'Terms of Service | ZISO AI',
      description: 'Terms governing the use of ZISO AI analysis, briefings, and subscription services.',
      path: '/terms',
      render: () => <EnglishTermsPage />,
    };
  }

  if (path === 'refund') {
    return {
      title: 'Refund Policy | ZISO AI',
      description: 'Refund policy for first-time Pro subscribers and billing support flows.',
      path: '/refund',
      render: () => <EnglishRefundPage />,
    };
  }

  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedPublicLocale(locale)) return {};

  const slugParts = slug || [];
  if (isContentPath(slugParts)) {
    // Content pages in non-CN locales either render their own or redirect to EN
    if (locale !== 'cn') {
      return {}; // Metadata will be handled by the redirect or the target page
    }
  }

  const config = getPageConfig(locale, slugParts);
  if (!config) return {};

  return buildPageMetadata(brandCoreZhCN.domain, {
    title: config.title,
    description: config.description,
    path: config.path,
    locale,
    index: true,
    alternateLocales: config.alternateLocales,
  });
}

export default async function LocalePreviewRoute({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!isSupportedPublicLocale(locale)) notFound();


  const slugParts = slug || [];
  if (isContentPath(slugParts)) {
    if (locale !== 'cn') {
      // Redirect KO/ES content paths to the root English content
      permanentRedirect(`/${slugParts.join('/')}`);
    }
    // CN content paths continue to render below via getPageConfig
  }

  const config = getPageConfig(locale, slugParts);
  if (!config) notFound();

  return config.render();
}
