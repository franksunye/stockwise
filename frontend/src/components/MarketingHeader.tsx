'use client';

import Link from 'next/link';
import Image from 'next/image';
import LandingMobileMenu, { type MarketingMenuLink } from '@/components/LandingMobileMenu';

import { type PublicLocale, localizePublicPath } from '@/lib/public-i18n';

type MarketingHeaderPage = 'home' | 'about' | 'pricing' | 'privacy' | 'terms' | 'refund';

interface MarketingHeaderProps {
  currentPage: MarketingHeaderPage;
  locale?: PublicLocale;
}

interface NavLabels {
  features: string;
  about: string;
  pricing: string;
  faq: string;
  openApp: string;
}

export default function MarketingHeader({ currentPage, locale = 'en' }: MarketingHeaderProps) {
  const localizedHome = localizePublicPath('/', locale);
  const localizedHomeAnchorPrefix = currentPage === 'home' ? '' : localizedHome;
  
  const labels: Record<PublicLocale, NavLabels> = {
    en: {
      features: 'Features',
      about: 'About',
      pricing: 'Pricing',
      faq: 'FAQ',
      openApp: 'Open App',
    },
    cn: {
      features: '功能',
      about: '关于',
      pricing: '价格',
      faq: 'FAQ',
      openApp: '进入应用',
    },
    ko: {
      features: '기능',
      about: '소개',
      pricing: '가격',
      faq: 'FAQ',
      openApp: '앱 열기',
    },
    es: {
      features: 'Funciones',
      about: 'Nosotros',
      pricing: 'Precios',
      faq: 'FAQ',
      openApp: 'Abrir App',
    }
  };

  const currentLabels = labels[locale] || labels.en;

  const links: MarketingMenuLink[] = [
    { href: `${localizedHomeAnchorPrefix}#features`, label: currentLabels.features },
    { href: localizePublicPath('/about', locale), label: currentLabels.about, prefetch: false, isActive: currentPage === 'about' },
    { href: localizePublicPath('/pricing', locale), label: currentLabels.pricing, prefetch: false, isActive: currentPage === 'pricing' },
    { href: `${localizedHomeAnchorPrefix}#faq`, label: currentLabels.faq },
  ];

  // If Chinese, add Learn/Support link
  if (locale === 'cn') {
    links.splice(1, 0, { href: '/cn/learn', label: '101 手册', prefetch: false });
    links.splice(2, 0, { href: '/cn/support', label: '支持中心', prefetch: false });
  }

  const localeSwitches = [
    { href: localizePublicPath(`/${currentPage === 'home' ? '' : currentPage}`, 'en'), label: 'EN', isActive: locale === 'en' },
    { href: localizePublicPath(`/${currentPage === 'home' ? '' : currentPage}`, 'cn'), label: '中文', isActive: locale === 'cn' },
    { href: localizePublicPath(`/${currentPage === 'home' ? '' : currentPage}`, 'ko'), label: '한', isActive: locale === 'ko' },
    { href: localizePublicPath(`/${currentPage === 'home' ? '' : currentPage}`, 'es'), label: 'ES', isActive: locale === 'es' },
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
        <div className="flex items-center rounded-full border border-white/10 bg-white/5 p-0.5">
          {localeSwitches.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-colors ${
                item.isActive ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-white'
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
          {currentLabels.openApp}
        </Link>
      </div>

      <LandingMobileMenu
        links={links}
        cta={{ href: 'https://app.ziso.cc', label: currentLabels.openApp }}
        localeSwitches={localeSwitches}
      />
    </nav>
  );
}
