'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronRight } from 'lucide-react';

const links = [
  { href: '#features', label: '功能' },
  { href: '/learn', label: '101 手册', prefetch: false },
  { href: '/about', label: '关于', prefetch: false },
  { href: '/pricing', label: '价格', prefetch: false },
  { href: '/support', label: '支持', prefetch: false },
  { href: '#faq', label: 'FAQ' },
];

export default function LandingMobileMenu() {
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
            className="text-2xl font-black italic tracking-tighter text-slate-300 hover:text-white transition-colors"
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="https://app.ziso.cc"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
          className="mt-4 px-10 py-4 rounded-3xl bg-indigo-500 text-white font-black italic text-lg shadow-[0_20px_40px_rgba(99,102,241,0.3)] flex items-center gap-2"
        >
          进入应用 <ChevronRight size={20} />
        </Link>
      </div>
    </>
  );
}
