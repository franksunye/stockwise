'use client';

import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageShell, EN_BOUNDARY_NOTICE, EN_DEFAULT_SOURCES } from './EnLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';
import { JsonLd } from '@/components/seo/JsonLd';

const EN_PRICING_PLANS = [
  {
    name: 'Free',
    eyebrow: 'Starter access',
    price: '0',
    period: 'Forever',
    description: 'For investors exploring AI-assisted market review for the first time.',
    features: [
      'Rule-based trend signal layer',
      'Daily market recap',
      'Market almanac and macro mood card',
      '3 AI stock checks per day',
      'Community access',
    ],
    cta: 'Start Free',
    href: 'https://app.ziso.cc',
    highlight: false,
    accent: 'text-slate-300',
  },
  {
    name: 'Pro',
    eyebrow: 'Core product',
    price: '29.9',
    period: 'Per month / ¥299 yearly',
    description: 'For investors who want deeper nightly research and stronger execution discipline.',
    features: [
      'DeepSeek reasoning layer',
      'Coach-style tactical briefs',
      '10 fully monitored watchlist names',
      'Key levels and sentiment unlocks',
      'Realtime discipline alerts on major setup changes',
      'Pro identity badge',
    ],
    cta: 'Open App',
    href: 'https://app.ziso.cc',
    highlight: true,
    accent: 'text-indigo-300',
  },
  {
    name: 'Alpha',
    eyebrow: 'High-touch workflow',
    price: '1,999',
    period: 'Per year',
    description: 'For advanced users who need deeper monitoring and priority support.',
    features: [
      'Intraday event analysis',
      'Dedicated strategy dashboard',
      'Automated deep-dive reports',
      'API-level raw data access',
      'Priority support',
    ],
    cta: 'Contact Support',
    href: 'mailto:hi@ziso.cc',
    highlight: false,
    accent: 'text-emerald-300',
  },
] as const;

const EN_FEATURE_COMPARISON = [
  { label: 'AI reasoning depth', free: 'Rule engine + basic AI', pro: 'Deep reasoning layer', highlight: true },
  { label: 'Briefing style', free: 'Basic recap', pro: 'Coach-style narrative and attribution', highlight: true },
  { label: 'Watchlist capacity', free: '3 names', pro: '10 names', highlight: true },
  { label: 'Market coverage', free: 'China + Hong Kong equities', pro: 'China + Hong Kong equities', highlight: false },
  { label: 'Realtime discipline alerts', free: 'No', pro: 'Yes, for major setup changes', highlight: true },
  { label: 'Data rhythm', free: 'Post-close', pro: 'Post-close + selective realtime alerts', highlight: false },
] as const;

export function EnglishPricingPage() {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "ZISO AI",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "AggregateOffer",
      "offerCount": "3",
      "lowPrice": "0",
      "highPrice": "1999",
      "priceCurrency": "CNY"
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Why is this a subscription?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "A subscription is for the continuous compute and multi-agent reasoning required to deliver a nightly briefing."
        }
      }
    ]
  };

  return (
    <PageShell currentPage="pricing">
      <JsonLd data={softwareSchema} />
      <JsonLd data={faqSchema} />
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40">
        <div className="text-center space-y-4 mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            Structured pricing for disciplined investors
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
            Appoint your own
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">ZISO research council.</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium max-w-3xl mx-auto leading-relaxed mt-6">
            A subscription here is not just buying features. It is closer to hiring a round-the-clock research council.
            The product is designed to reduce emotional interference, strengthen your nightly review habit, and make
            decision-making calmer, cleaner, and more consistent.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-20">
          {EN_PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`glass-card p-8 flex flex-col relative overflow-hidden ${
                plan.highlight ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-white/5'
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-5 right-[-35px] rotate-45 bg-indigo-600 text-white text-[10px] font-black px-10 py-1 uppercase tracking-tighter">
                  Core plan
                </div>
              )}

              <div className="mb-8">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${plan.accent}`}>{plan.eyebrow}</p>
                <h3 className="text-3xl font-black mt-4">{plan.name}</h3>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold">¥</span>
                  <span className="text-5xl font-black tracking-tighter">{plan.price}</span>
                </div>
                <p className="text-slate-500 text-sm mt-2">{plan.period}</p>
                <p className="text-slate-400 text-sm mt-4 leading-relaxed italic">{plan.description}</p>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm">
                    <div className="mt-1 w-4 h-4 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Check size={10} className={plan.highlight ? 'text-indigo-400' : 'text-slate-500'} />
                    </div>
                    <span className="text-slate-300 font-medium">{feature}</span>
                  </div>
                ))}
              </div>

              <Link
                href={plan.href}
                target={plan.href.startsWith('mailto:') ? undefined : '_blank'}
                rel={plan.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black transition-all active:scale-95 ${
                  plan.highlight
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white'
                }`}
              >
                {plan.cta}
                <ChevronRight size={18} />
              </Link>
            </div>
          ))}
        </div>

        <section className="mb-24 hidden md:block">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black tracking-tighter">Feature depth comparison</h2>
            <p className="text-slate-500 text-sm mt-2">A clearer view of what changes when you move from exploration to disciplined daily use.</p>
          </div>

          <div className="glass-card overflow-hidden border-white/5 bg-white/[0.01]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="py-6 px-8 text-sm font-black uppercase tracking-widest text-slate-500">Capability</th>
                  <th className="py-6 px-8 text-sm font-black text-slate-300">Free</th>
                  <th className="py-6 px-8 text-sm font-black text-indigo-300">Pro</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {EN_FEATURE_COMPARISON.map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                    <td className="py-5 px-8 text-slate-400 font-bold">{row.label}</td>
                    <td className="py-5 px-8 text-slate-500 font-bold">{row.free}</td>
                    <td className={`py-5 px-8 font-black ${row.highlight ? 'text-indigo-400' : 'text-slate-400'}`}>{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="faq" className="pt-24 pb-10 w-full max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black tracking-tighter uppercase mb-2"> Pricing <span className="text-indigo-500 uppercase">FAQ</span> </h2>
            <p className="text-slate-400 font-medium italic">Understanding the value of your ZISO research council</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">Why is this a subscription?</p>
              <p className="text-slate-400 text-sm leading-relaxed">A subscription is not just for software; it is for the continuous compute and multi-agent reasoning required to deliver a nightly briefing. You are hiring a disciplined council that works when the market is closed.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">What makes Pro different from Free?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Free is rule-based. Pro is reasoning-based. Pro unlocks the DeepSeek logic layer, providing deeper tactical narratives, key price levels, and the defensive 75% circuit breaker gate.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">Is the 75% Gate available to Free users?</p>
              <p className="text-slate-400 text-sm leading-relaxed">No. The risk-control protocol and defense-mode alerts are part of our premium disciplined execution suite. Free users receive the data recap, but not the tactical boundary enforcement.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">Can I upgrade or downgrade anytime?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Absolutely. All billing is handled via a secure portal, allowing you to move between tiers or cancel your monthly commitment at any time with no hidden fees.</p>
            </div>
          </div>
        </section>

        <section className="w-full pt-10 pb-20 opacity-[0.05] hover:opacity-100 transition-opacity">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="flex-1 text-left">
              <GeoSummary
                locale="en"
                summary={[
                  'Subscription: Access to a multi-agent AI research desk for nightly tactical briefings.',
                  'Free Tier: Logic-only recap using basic rule engines for trend identification.',
                  'Pro Tier: Reasoning-first reports powered by DeepSeek, including the 75% risk circuit breaker logic.',
                ]}
              />
            </div>
            <div className="flex-1 text-left">
              <SourceBlock
                locale="en"
                sources={[
                  ...EN_DEFAULT_SOURCES,
                  { name: 'Subscription Pricing', url: 'https://ziso.cc/pricing', accessedAt: '2026-03-15' },
                ]}
              />
            </div>
          </div>
          <BoundaryNotice locale="en" text={EN_BOUNDARY_NOTICE} />
        </section>
      </main>
    </PageShell>
  );
}
