import { EnglishSupportArticlePage } from '@/components/public/EnglishSupportArticlePage';
import { getAllSupportArticles, getSupportArticleBySlug } from '@/lib/support-content';
import { buildPageMetadata } from '@/lib/seo';
import { Metadata } from 'next';
import { getV1SupportAllowlist, isSupportSlugAllowedForLocale } from '@/lib/support-v1';

export async function generateStaticParams() {
  const articles = await getAllSupportArticles({ locale: 'en' });
  const allowlist = getV1SupportAllowlist('en');
  const scopedArticles = allowlist
    ? articles.filter((article) => allowlist.includes(article.slug))
    : articles;
  return scopedArticles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!isSupportSlugAllowedForLocale('en', slug)) return {};
  const article = await getSupportArticleBySlug(slug, { locale: 'en' });
  
  if (!article) return {};

  return buildPageMetadata('ziso.cc', {
    title: article.title,
    description: article.category || `ZISO AI Support: ${article.title}`,
    path: `/support/${slug}`,
    locale: 'en',
    index: true,
  });
}

export default async function SupportDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <EnglishSupportArticlePage slug={slug} />;
}
