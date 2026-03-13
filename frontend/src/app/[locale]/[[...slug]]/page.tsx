import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LocalePreviewPage from '@/components/marketing/LocalePreviewPage';
import { brandCoreZhCN } from '@/content/brand-core.zh-CN';
import { getArticleBySlug as getLearnArticleBySlug } from '@/lib/learn-content';
import { getArticleBySlug as getSupportArticleBySlug } from '@/lib/support-content';
import { isSupportedPublicLocale } from '@/lib/public-i18n';
import { buildPageMetadata } from '@/lib/seo';

type Params = Promise<{ locale: string; slug?: string[] }>;

interface PreviewConfig {
  title: string;
  description: string;
  canonicalPath: string;
  isFallback?: boolean;
  alternateLocales?: Array<'zh' | 'en'>;
}

function getStaticPreviewConfig(slugParts: string[]): PreviewConfig | null {
  const path = slugParts.join('/');

  const staticConfig: Record<string, PreviewConfig> = {
    '': {
      title: 'ZISO AI English Preview',
      description: 'Public English infrastructure is active for SEO and GEO validation. Full English rollout is intentionally deferred.',
      canonicalPath: '/',
      alternateLocales: ['zh', 'en'],
    },
    about: {
      title: 'About ZISO AI',
      description: 'English public metadata and route validation for the ZISO AI marketing site.',
      canonicalPath: '/about',
      alternateLocales: ['zh', 'en'],
    },
    pricing: {
      title: 'Pricing | ZISO AI',
      description: 'English preview of pricing route infrastructure for the public website.',
      canonicalPath: '/pricing',
      alternateLocales: ['zh', 'en'],
    },
    privacy: {
      title: 'Privacy Policy | ZISO AI',
      description: 'English verification page for privacy route infrastructure.',
      canonicalPath: '/privacy',
      alternateLocales: ['zh', 'en'],
    },
    terms: {
      title: 'Terms of Service | ZISO AI',
      description: 'English verification page for terms route infrastructure.',
      canonicalPath: '/terms',
      alternateLocales: ['zh', 'en'],
    },
    refund: {
      title: 'Refund Policy | ZISO AI',
      description: 'English verification page for refund route infrastructure.',
      canonicalPath: '/refund',
      alternateLocales: ['zh', 'en'],
    },
    learn: {
      title: 'Learn | ZISO AI',
      description: 'English infrastructure preview for the Learn library.',
      canonicalPath: '/learn',
      alternateLocales: ['zh', 'en'],
    },
    support: {
      title: 'Support | ZISO AI',
      description: 'English infrastructure preview for the Support hub.',
      canonicalPath: '/support',
      alternateLocales: ['zh', 'en'],
    },
  };

  return staticConfig[path] || null;
}

async function resolvePreviewConfig(slugParts: string[]): Promise<PreviewConfig | null> {
  const staticConfig = getStaticPreviewConfig(slugParts);
  if (staticConfig) return staticConfig;

  if (slugParts.length === 2 && slugParts[0] === 'learn') {
    const article = await getLearnArticleBySlug(slugParts[1], { locale: 'en', fallbackToDefault: true });
    if (!article) return null;
    return {
      title: `${article.title} | English Preview | ZISO AI Learn`,
      description: 'English content for this Learn article is not published yet. This route exists as a controlled fallback preview.',
      canonicalPath: `/learn/${slugParts[1]}`,
      isFallback: true,
      alternateLocales: ['zh'],
    };
  }

  if (slugParts.length === 2 && slugParts[0] === 'support') {
    const article = getSupportArticleBySlug(slugParts[1], { locale: 'en', fallbackToDefault: true });
    if (!article) return null;
    return {
      title: `${article.title} | English Preview | ZISO AI Support`,
      description: 'English content for this Support article is not published yet. This route exists as a controlled fallback preview.',
      canonicalPath: `/support/${slugParts[1]}`,
      isFallback: true,
      alternateLocales: ['zh'],
    };
  }

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
    index: false,
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

  return (
    <LocalePreviewPage
      eyebrow="English Preview"
      title={config.title}
      description={config.description}
      canonicalPath={config.canonicalPath}
      isFallback={config.isFallback}
    />
  );
}
