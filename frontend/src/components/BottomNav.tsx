'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ListFilter, LayoutDashboard, History } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  const links = [
    { href: '/stock-pool', icon: ListFilter, label: '股票池' },
    { href: '/', icon: LayoutDashboard, label: '决策' },
    { href: '/history', icon: History, label: '复盘' },
  ];

  return (
    <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-1 p-2 rounded-[32px] bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        {links.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center justify-center gap-2 px-6 py-3 rounded-full transition-all duration-300 group ${
                isActive 
                  ? 'bg-white/10 text-white shadow-inner' 
                  : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
              <span className={`text-xs font-bold tracking-tight overflow-hidden transition-all duration-300 ${isActive ? 'max-w-[100px] opacity-100' : 'max-w-0 opacity-0'}`}>
                {label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500 shadow-[0_0_10px_2px_rgba(99,102,241,0.5)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
