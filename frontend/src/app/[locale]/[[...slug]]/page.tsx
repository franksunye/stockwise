import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  EnglishAboutPage,
  EnglishHomePage,
  EnglishPricingPage,
  EnglishPrivacyPage,
  EnglishRefundPage,
  EnglishTermsPage,
} from '@/components/marketing/EnglishPublicPages';
import { brandCoreZhCN } from '@/content/brand-core.zh-CN';
import { isSupportedPublicLocale } from '@/lib/public-i18n';
import { buildPageMetadata } from '@/lib/seo';

type Params = Promise<{ locale: string; slug?: string[] }>;

interface PreviewConfig {
  title: string;
  description: string;
  canonicalPath: string;
  isFallback?: boolean;
  alternateLocales?: Array<'zh' | 'en'>;
  index?: boolean;
  render?: () => React.ReactNode;
}

function getStaticPreviewConfig(slugParts: string[]): PreviewConfig | null {
  const path = slugParts.join('/');

  const staticConfig: Record<string, PreviewConfig> = {
    '': {
      title: 'ZISO AI | AI Does the Research. You Keep the Decision.',
      description: 'Structured market research, tactical briefings, and execution discipline for serious retail investors.',
      canonicalPath: '/',
      alternateLocales: ['zh', 'en'],
      index: true,
      render: () => <EnglishHomePage />,
    },
    about: {
      title: 'About ZISO AI',
      description: 'Why ZISO AI exists, how it frames research, and how the workflow is structured.',
      canonicalPath: '/about',
      alternateLocales: ['zh', 'en'],
      index: true,
      render: () => <EnglishAboutPage />,
    },
    pricing: {
      title: 'Pricing | ZISO AI',
      description: 'Subscription plans for investors who want stronger nightly research and execution discipline.',
      canonicalPath: '/pricing',
      alternateLocales: ['zh', 'en'],
      index: true,
      render: () => <EnglishPricingPage />,
    },
    privacy: {
      title: 'Privacy Policy | ZISO AI',
      description: 'Privacy and data handling policy for the ZISO AI public website.',
      canonicalPath: '/privacy',
      alternateLocales: ['zh', 'en'],
      index: true,
      render: () => <EnglishPrivacyPage />,
    },
    terms: {
      title: 'Terms of Service | ZISO AI',
      description: 'Terms governing the use of ZISO AI analysis, briefings, and subscription services.',
      canonicalPath: '/terms',
      alternateLocales: ['zh', 'en'],
      index: true,
      render: () => <EnglishTermsPage />,
    },
    refund: {
      title: 'Refund Policy | ZISO AI',
      description: 'Refund policy for first-time Pro subscribers and billing support flows.',
      canonicalPath: '/refund',
      alternateLocales: ['zh', 'en'],
      index: true,
      render: () => <EnglishRefundPage />,
    },
  };

  return staticConfig[path] || null;
}

async function resolvePreviewConfig(slugParts: string[]): Promise<PreviewConfig | null> {
  const staticConfig = getStaticPreviewConfig(slugParts);
  if (staticConfig) return staticConfig;

  return null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isSupportedPublicLocale(locale) || locale !== 'en') {
    return {};
  }

  const slugParts = slug || [];
  const config = await resolvePreviewConfig(slugParts);
  if (!config) {
    return buildPageMetadata(brandCoreZhCN.domain, {
      title: 'Page Not Found | ZISO AI',
      description: 'This public preview route does not exist.',
      path: '/404',
      locale: 'en',
      index: false,
      alternateLocales: ['zh'],
      canonicalPath: '/404',
      canonicalLocale: 'zh',
    });
  }

  return buildPageMetadata(brandCoreZhCN.domain, {
    title: config.title,
    description: config.description,
    path: slugParts.length === 0 ? '/' : `/${slugParts.join('/')}`,
    locale: 'en',
    index: config.index ?? false,
    alternateLocales: config.alternateLocales,
    canonicalPath: config.canonicalPath,
    canonicalLocale: config.isFallback ? 'zh' : 'en',
  });
}

export default async function LocalePreviewRoute({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isSupportedPublicLocale(locale) || locale !== 'en') {
    notFound();
  }

  const slugParts = slug || [];
  const config = await resolvePreviewConfig(slugParts);
  if (!config) {
    notFound();
  }

  if (config.render) {
    return config.render();
  }
  notFound();
}
