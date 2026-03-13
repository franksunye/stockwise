'use client';

import Link from 'next/link';
import Image from 'next/image';
import LandingMobileMenu, { type MarketingMenuLink } from '@/components/LandingMobileMenu';

type MarketingHeaderPage = 'home' | 'about' | 'pricing';
type MarketingHeaderLocale = 'zh' | 'en';

interface MarketingHeaderProps {
  currentPage: MarketingHeaderPage;
  locale?: MarketingHeaderLocale;
}

export default function MarketingHeader({ currentPage, locale = 'zh' }: MarketingHeaderProps) {
  const basePrefix = locale === 'zh' ? '' : '/en';
  const localizedHome = locale === 'zh' ? '/' : '/en';
  const localizedHomeAnchorPrefix = currentPage === 'home' ? '' : localizedHome;
  const labels = locale === 'zh'
    ? {
        features: '功能',
        learn: '101 手册',
        about: '关于',
        pricing: '价格',
        support: '支持',
        faq: 'FAQ',
        openApp: '进入应用',
      }
    : {
        features: 'Features',
        learn: 'Learn',
        about: 'About',
        pricing: 'Pricing',
        support: 'Support',
        faq: 'FAQ',
        openApp: 'Open App',
      };

  const links: MarketingMenuLink[] = [
    { href: `${localizedHomeAnchorPrefix}#features`, label: labels.features },
    { href: `${basePrefix}/learn`, label: labels.learn, prefetch: false },
    { href: `${basePrefix}/about`, label: labels.about, prefetch: false, isActive: currentPage === 'about' },
    { href: `${basePrefix}/pricing`, label: labels.pricing, prefetch: false, isActive: currentPage === 'pricing' },
    { href: `${basePrefix}/support`, label: labels.support, prefetch: false },
    { href: `${localizedHomeAnchorPrefix}#faq`, label: labels.faq },
  ];

  return (
    <nav className="relative z-50 flex items-center justify-between px-8 py-8 max-w-7xl mx-auto">
      <Link href={localizedHome} className="flex items-center gap-2">
        <Image src="/logo.png" alt="ZISO AI Logo" width={40} height={40} className="rounded-xl" />
        <span className="text-xl font-black italic tracking-tighter">
          ZISO <span className="text-indigo-500">AI</span>
        </span>
      </Link>

      <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-400">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={item.prefetch}
            className={item.isActive ? 'text-white transition-colors' : 'hover:text-white transition-colors'}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="https://app.ziso.cc"
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white"
        >
          {labels.openApp}
        </Link>
      </div>

      <LandingMobileMenu links={links} cta={{ href: 'https://app.ziso.cc', label: labels.openApp }} />
    </nav>
  );
}
