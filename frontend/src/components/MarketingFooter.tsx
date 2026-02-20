import Image from 'next/image';
import Link from 'next/link';

const footerLinks = [
  { href: '/learn', label: '101 手册' },
  { href: '/status', label: '系统状态' },
  { href: '/support', label: '支持中心' },
  { href: '/pricing', label: '价格方案' },
  { href: '/about', label: '关于我们' },
  { href: '/privacy', label: '隐私协议' },
  { href: '/terms', label: '服务条款' },
  { href: '/refund', label: '退款政策' },
];

export default function MarketingFooter() {
  return (
    <footer className="relative z-10 border-t border-white/5 py-20 px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="ZISO AI Logo"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="text-sm font-black italic tracking-tighter">ZISO AI | 替你做股市功课，带你看投资门道</span>
        </Link>
        <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">
          © 2026 ZISO AI TECHNOLOGY. ALL RIGHTS RESERVED.
        </p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs font-bold text-slate-500">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-white transition-colors">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
