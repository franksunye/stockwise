import Image from 'next/image';
import Link from 'next/link';

import { type PublicLocale, localizePublicPath } from '@/lib/public-i18n';

export default function MarketingFooter({ locale = 'en' }: { locale?: PublicLocale }) {
  interface FooterLocaleLabels {
    academy: string;
    support: string;
    pricing: string;
    faq: string;
    app: string;
    about: string;
    privacy: string;
    terms: string;
    refund: string;
  }

  const labels: Record<PublicLocale, FooterLocaleLabels> = {
    cn: {
      academy: '101 手册',
      support: '支持中心',
      pricing: '价格方案',
      faq: '常见问题 (FAQ)',
      app: '进入 ZISO App',
      about: '关于我们',
      privacy: '隐私协议',
      terms: '服务条款',
      refund: '退款政策',
    },
    en: {
      academy: '101 Academy',
      support: 'Support',
      pricing: 'Pricing',
      faq: 'FAQ',
      app: 'Open ZISO App',
      about: 'About',
      privacy: 'Privacy',
      terms: 'Terms',
      refund: 'Refund',
    },
    ko: {
      academy: '101 아카데미',
      support: '지원 센터',
      pricing: '가격',
      faq: 'FAQ',
      app: 'ZISO 앱 열기',
      about: '소개',
      privacy: '개인정보',
      terms: '약관',
      refund: '환불',
    },
    es: {
      academy: 'Academia 101',
      support: 'Soporte',
      pricing: 'Precios',
      faq: 'FAQ',
      app: 'Abrir ZISO App',
      about: 'Nosotros',
      privacy: 'Privacidad',
      terms: 'T&eacute;rminos',
      refund: 'Reembolso',
    },
  };

  const currentLabels = labels[locale] || labels.en;
  const localizedHome = localizePublicPath('/', locale);

  const categories = [
    {
      title: locale === 'cn' ? '产品' : locale === 'ko' ? '제품' : locale === 'es' ? 'Producto' : 'Product',
      links: [
        { href: 'https://app.ziso.cc', label: currentLabels.app },
        { href: localizePublicPath('/learn', locale), label: currentLabels.academy },
        { href: localizePublicPath('/pricing', locale), label: currentLabels.pricing },
      ]
    },
    {
      title: locale === 'cn' ? '资源' : locale === 'ko' ? '리소스' : locale === 'es' ? 'Recursos' : 'Resources',
      links: [
        { href: `${localizedHome}#faq`, label: currentLabels.faq },
        { href: localizePublicPath('/support', locale), label: currentLabels.support },
        { href: localizePublicPath('/about', locale), label: currentLabels.about },
      ]
    },
    {
      title: locale === 'cn' ? '法律' : locale === 'ko' ? '법적 고지' : locale === 'es' ? 'Legal' : 'Legal',
      links: [
        { href: localizePublicPath('/privacy', locale), label: currentLabels.privacy },
        { href: localizePublicPath('/terms', locale), label: currentLabels.terms },
        { href: localizePublicPath('/refund', locale), label: currentLabels.refund },
      ]
    }
  ];

  return (
    <footer className="relative z-10 border-t border-white/5 py-24 px-8 bg-black/20">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-20">
          <div className="col-span-2 md:col-span-1">
            <Link href={localizedHome} className="flex items-center gap-2 mb-6">
              <Image
                src="/logo.png"
                alt="ZISO AI Logo"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-sm font-black italic tracking-tighter">ZISO AI</span>
            </Link>
            <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[200px]">
              {locale === 'cn'
                ? '替你做股市功课，带你看投资门道。'
                : 'Research first, decision second. Your AI research desk.'}
            </p>
          </div>

          {categories.map((cat) => (
            <div key={cat.title}>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">
                {cat.title}
              </h4>
              <ul className="space-y-4">
                {cat.links.map((link) => (
                  <li key={link.href}>
                    <Link 
                      href={link.href}
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                      rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="text-xs font-bold text-slate-500 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
            © 2026 ZISO AI TECHNOLOGY. ALL RIGHTS RESERVED.
          </p>
        </div>
      </div>
    </footer>
  );
}
