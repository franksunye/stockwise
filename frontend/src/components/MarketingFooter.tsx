import Image from 'next/image';
import Link from 'next/link';

import { type PublicLocale, localizePublicPath } from '@/lib/public-i18n';

export default function MarketingFooter({ locale = 'en' }: { locale?: PublicLocale }) {
  const footerLinks: Array<{ href: string; label: string }> = [];
  const homePath = localizePublicPath('/', locale);

  if (locale === 'cn') {
    footerLinks.push(
      { href: '/cn/learn', label: '101 手册' },
      { href: '/cn/support', label: '支持中心' },
      { href: localizePublicPath('/pricing', 'cn'), label: '价格方案' },
      { href: localizePublicPath('/about', 'cn'), label: '关于我们' },
      { href: localizePublicPath('/privacy', 'cn'), label: '隐私协议' },
      { href: localizePublicPath('/terms', 'cn'), label: '服务条款' },
      { href: localizePublicPath('/refund', 'cn'), label: '退款政策' }
    );
  } else {
    interface FooterLocaleLabels {
      pricing: string;
      about: string;
      privacy: string;
      terms: string;
      refund: string;
    }
    const labels: Record<Exclude<PublicLocale, 'cn'>, FooterLocaleLabels> = {
      en: { pricing: 'Pricing', about: 'About', privacy: 'Privacy', terms: 'Terms', refund: 'Refund' },
      ko: { pricing: '가격', about: '소개', privacy: '개인정보', terms: '약관', refund: '환불' },
      es: { pricing: 'Precios', about: 'Nosotros', privacy: 'Privacidad', terms: 'Términos', refund: 'Reembolso' }
    };
    const currentLabels = (labels[locale as Exclude<PublicLocale, 'cn'>] || labels.en) as FooterLocaleLabels;

    footerLinks.push(
      { href: localizePublicPath('/pricing', locale), label: currentLabels.pricing },
      { href: localizePublicPath('/about', locale), label: currentLabels.about },
      { href: localizePublicPath('/privacy', locale), label: currentLabels.privacy },
      { href: localizePublicPath('/terms', locale), label: currentLabels.terms },
      { href: localizePublicPath('/refund', locale), label: currentLabels.refund }
    );
  }

  return (
    <footer className="relative z-10 border-t border-white/5 py-20 px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
        <Link href={homePath} className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="ZISO AI Logo"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="text-sm font-black italic tracking-tighter">
            {locale === 'cn'
              ? 'ZISO AI | 替你做股市功课，带你看投资门道'
              : 'ZISO AI | Research first, decision second'}
          </span>
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
