'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, History } from 'lucide-react';

export function BottomNav() {
  const pathname = usePathname();
  const links = [
    { href: '/', icon: LayoutDashboard, label: '看板' },
    { href: '/history', icon: History, label: '复盘' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#12121a] border-t border-[#1e1e2e]">
      <div className="max-w-md mx-auto flex">
        {links.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-3 ${
              pathname === href ? 'text-white' : 'text-muted'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-xs mt-1">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
