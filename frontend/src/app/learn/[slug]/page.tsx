import { EnglishLearnArticlePage } from '@/components/public/EnglishLearnArticlePage';
import { getAllArticles, getArticleBySlug } from '@/lib/learn-content';
import { buildPageMetadata } from '@/lib/seo';
import { Metadata } from 'next';

export async function generateStaticParams() {
  const articles = await getAllArticles({ locale: 'en' });
  return articles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug, { locale: 'en' });
  
  if (!article) return {};

  return buildPageMetadata('ziso.cc', {
    title: article.title,
    description: article.subtitle || `Master the principles of systematical trading: Learn about ${article.title} in ZISO 101 Academy. Explore how AI and probability theory help you manage risk and emotional biases.`,
    path: `/learn/${slug}`,
    locale: 'en',
    index: true,
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <EnglishLearnArticlePage slug={slug} />;
}
