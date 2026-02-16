'use client';

import Link from 'next/link';
import Image from 'next/image';
import LandingMobileMenu, { type MarketingMenuLink } from '@/components/LandingMobileMenu';

type MarketingHeaderPage = 'home' | 'about' | 'pricing';

interface MarketingHeaderProps {
  currentPage: MarketingHeaderPage;
}

export default function MarketingHeader({ currentPage }: MarketingHeaderProps) {
  const homeAnchorPrefix = currentPage === 'home' ? '' : '/';

  const links: MarketingMenuLink[] = [
    { href: `${homeAnchorPrefix}#features`, label: '功能' },
    { href: '/learn', label: '101 手册', prefetch: false },
    { href: '/about', label: '关于', prefetch: false, isActive: currentPage === 'about' },
    { href: '/pricing', label: '价格', prefetch: false, isActive: currentPage === 'pricing' },
    { href: '/support', label: '支持', prefetch: false },
    { href: `${homeAnchorPrefix}#faq`, label: 'FAQ' },
  ];

  return (
    <nav className="relative z-50 flex items-center justify-between px-8 py-8 max-w-7xl mx-auto">
      <Link href="/" className="flex items-center gap-2">
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
          进入应用
        </Link>
      </div>

      <LandingMobileMenu links={links} />
    </nav>
  );
}
