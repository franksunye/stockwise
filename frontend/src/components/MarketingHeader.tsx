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
  const currentLocalePathByPage: Record<MarketingHeaderPage, string> = {
    home: locale === 'zh' ? '/' : '/en',
    about: locale === 'zh' ? '/about' : '/en/about',
    pricing: locale === 'zh' ? '/pricing' : '/en/pricing',
  };
  const zhPathByPage: Record<MarketingHeaderPage, string> = {
    home: '/',
    about: '/about',
    pricing: '/pricing',
  };
  const enPathByPage: Record<MarketingHeaderPage, string> = {
    home: '/en',
    about: '/en/about',
    pricing: '/en/pricing',
  };
  const labels = locale === 'zh'
    ? {
        features: '功能',
        about: '关于',
        pricing: '价格',
        faq: 'FAQ',
        openApp: '进入应用',
        localeZh: '中',
        localeEn: 'EN',
      }
    : {
        features: 'Features',
        about: 'About',
        pricing: 'Pricing',
        faq: 'FAQ',
        openApp: 'Open App',
        localeZh: '中',
        localeEn: 'EN',
      };

  const links: MarketingMenuLink[] = locale === 'zh'
    ? [
        { href: `${localizedHomeAnchorPrefix}#features`, label: '功能' },
        { href: `${basePrefix}/learn`, label: '101 手册', prefetch: false },
        { href: `${basePrefix}/about`, label: '关于', prefetch: false, isActive: currentPage === 'about' },
        { href: `${basePrefix}/pricing`, label: '价格', prefetch: false, isActive: currentPage === 'pricing' },
        { href: `${basePrefix}/support`, label: '支持', prefetch: false },
        { href: `${localizedHomeAnchorPrefix}#faq`, label: 'FAQ' },
      ]
    : [
        { href: `${localizedHomeAnchorPrefix}#features`, label: 'Features' },
        { href: `${basePrefix}/about`, label: 'About', prefetch: false, isActive: currentPage === 'about' },
        { href: `${basePrefix}/pricing`, label: 'Pricing', prefetch: false, isActive: currentPage === 'pricing' },
        { href: `${localizedHomeAnchorPrefix}#faq`, label: 'FAQ' },
      ];

  const localeSwitches = [
    { href: locale === 'zh' ? currentLocalePathByPage[currentPage] : zhPathByPage[currentPage], label: labels.localeZh, isActive: locale === 'zh' },
    { href: locale === 'en' ? currentLocalePathByPage[currentPage] : enPathByPage[currentPage], label: labels.localeEn, isActive: locale === 'en' },
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
        <div className="flex items-center rounded-full border border-white/10 bg-white/5 p-1">
          {localeSwitches.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] transition-colors ${
                item.isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <Link
          href="https://app.ziso.cc"
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white"
        >
          {labels.openApp}
        </Link>
      </div>

      <LandingMobileMenu
        links={links}
        cta={{ href: 'https://app.ziso.cc', label: labels.openApp }}
        localeSwitches={localeSwitches}
      />
    </nav>
  );
}
