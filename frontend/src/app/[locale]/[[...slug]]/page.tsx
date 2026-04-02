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
import { ChineseLearnArticlePage } from '@/components/public/ChineseLearnArticlePage';
import { ChineseLearnIndexPage } from '@/components/public/ChineseLearnIndexPage';
import { ChineseSupportArticlePage } from '@/components/public/ChineseSupportArticlePage';
import { ChineseSupportIndexPage } from '@/components/public/ChineseSupportIndexPage';
import { isSupportedPublicLocale, type PublicLocale } from '@/lib/public-i18n';
import { buildPageMetadata } from '@/lib/seo';

type Params = Promise<{ locale: string; slug?: string[] }>;

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
      };
    }

    if (path === 'about') {
      return {
        title: '关于知守 AI',
        description: '让普通投资者也能拥有机构级的投研外脑。',
        path: '/about',
        render: () => <ChineseAboutPage />,
      };
    }

    if (path === 'pricing') {
      return {
        title: '价格方案 | 知守投研委员会',
        description: '选聘您的知守委员会。订阅不仅是购买功能，更是雇佣了一组 24/7 在岗的专业交易委员会。',
        path: '/pricing',
        render: () => <ChinesePricingPage />,
      };
    }

    if (path === 'privacy') {
      return {
        title: '隐私政策 | 知守 AI',
        description: '知守 AI 中文站隐私政策与数据处理说明。',
        path: '/privacy',
        render: () => <ChinesePrivacyPage />,
      };
    }

    if (path === 'terms') {
      return {
        title: '服务条款 | 知守 AI',
        description: '知守 AI 中文站服务条款与使用边界说明。',
        path: '/terms',
        render: () => <ChineseTermsPage />,
      };
    }

    if (path === 'refund') {
      return {
        title: '退款政策 | 知守 AI',
        description: '知守 AI 中文站订阅退款与取消续订规则。',
        path: '/refund',
        render: () => <ChineseRefundPage />,
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

  if (path === '') {
    const meta = locale === 'en' ? null : buildLocalizedMeta(locale, 'home');
    return {
      title: meta?.title || 'ZISO AI | AI Does the Research. You Keep the Decision.',
      description: meta?.desc || 'Structured market research, tactical briefings, and execution discipline for serious retail investors.',
      path: '/',
      render: () => <EnglishHomePage />,
    };
  }

  if (path === 'about') {
    const meta = locale === 'en' ? null : buildLocalizedMeta(locale, 'about');
    return {
      title: meta?.title || 'About ZISO AI',
      description: meta?.desc || 'Why ZISO AI exists, how it frames research, and how the workflow is structured.',
      path: '/about',
      render: () => <EnglishAboutPage />,
    };
  }

  if (path === 'pricing') {
    const meta = locale === 'en' ? null : buildLocalizedMeta(locale, 'pricing');
    return {
      title: meta?.title || 'Pricing | ZISO AI',
      description: meta?.desc || 'Subscription plans for investors who want stronger nightly research and execution discipline.',
      path: '/pricing',
      render: () => <EnglishPricingPage />,
    };
  }

  if (path === 'privacy') {
    return {
      title: 'Privacy Policy | ZISO AI',
      description: 'Privacy and data handling policy for the ZISO AI public website.',
      path: '/privacy',
      render: () => <EnglishPrivacyPage />,
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

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedPublicLocale(locale)) return {};

  const slugParts = slug || [];
  if (locale !== 'cn' && isContentPath(slugParts)) {
    return {};
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

export default async function LocalePreviewRoute({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isSupportedPublicLocale(locale)) notFound();

  const slugParts = slug || [];
  if (locale !== 'cn' && isContentPath(slugParts)) {
    permanentRedirect(`/cn/${slugParts.join('/')}`);
  }

  const config = getPageConfig(locale, slugParts);
  if (!config) notFound();

  return config.render();
}
