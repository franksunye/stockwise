
import { EnglishHomePage } from '@/components/marketing/en/EnglishHomePage';
import { brandCoreZhCN } from '@/content/brand-core.zh-CN';
import { homeSeoLocaleCopy } from '@/content/seo-home';
import { buildPageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = buildPageMetadata(brandCoreZhCN.domain, {
  title: homeSeoLocaleCopy.en.title,
  description: homeSeoLocaleCopy.en.description,
  path: '/',
  locale: 'en',
  alternateLocales: ['en', 'cn', 'ko', 'es'],
  keywords: [...homeSeoLocaleCopy.en.keywords],
});

export default function RootHomePage() {
  return <EnglishHomePage />;
}
