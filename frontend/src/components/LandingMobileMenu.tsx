'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronRight } from 'lucide-react';

export interface MarketingMenuLink {
  href: string;
  label: string;
  prefetch?: boolean;
  isActive?: boolean;
}

interface MobileMenuCta {
  label: string;
  href: string;
}

interface LocaleSwitchLink {
  href: string;
  label: string;
  isActive?: boolean;
}

const defaultLinks: MarketingMenuLink[] = [
  { href: '#features', label: '功能' },
  { href: '/learn', label: '101 手册', prefetch: false },
  { href: '/about', label: '关于', prefetch: false },
  { href: '/pricing', label: '价格', prefetch: false },
  { href: '/support', label: '支持', prefetch: false },
  { href: '#faq', label: 'FAQ' },
];

interface LandingMobileMenuProps {
  links?: MarketingMenuLink[];
  cta?: MobileMenuCta;
  localeSwitches?: LocaleSwitchLink[];
}

export default function LandingMobileMenu({
  links = defaultLinks,
  cta = { href: 'https://app.ziso.cc', label: '进入应用' },
  localeSwitches = [],
}: LandingMobileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="md:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-white"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      <div
        className={`fixed inset-0 z-40 bg-[#050508]/98 backdrop-blur-xl flex flex-col items-center justify-center gap-6 md:hidden transition-all duration-200 ${
          open ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
        }`}
      >
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={item.prefetch}
            onClick={() => setOpen(false)}
            className={`text-2xl font-black italic tracking-tighter transition-colors ${
              item.isActive ? 'text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        ))}
        {localeSwitches.length > 0 ? (
          <div className="mt-2 flex items-center gap-3">
            {localeSwitches.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-full border px-4 py-2 text-sm font-black uppercase tracking-[0.2em] transition-colors ${
                  item.isActive
                    ? 'border-white/20 bg-white/10 text-white'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
        <Link
          href={cta.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
          className="mt-4 px-10 py-4 rounded-3xl bg-indigo-500 text-white font-black italic text-lg shadow-[0_20px_40px_rgba(99,102,241,0.3)] flex items-center gap-2"
        >
          {cta.label} <ChevronRight size={20} />
        </Link>
      </div>
    </>
  );
}
