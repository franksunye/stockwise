import type { Metadata } from 'next';
import { brandCoreZhCN } from '@/content/brand-core.zh-CN';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: 'Paper Portfolio Lab | ZISO AI',
  description:
    'A simulated paper portfolio lab for tracking AI-generated investment theses, risk boundaries, and review notes before real capital is involved.',
  path: '/paper-portfolio-lab',
  locale: 'en',
  alternateLocales: ['en'],
  keywords: ['paper portfolio', 'paper trading', 'AI thesis tracking', 'investment research lab', 'ZISO AI'],
});

export default function PaperPortfolioLabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
