'use client';

import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageShell, EN_BOUNDARY_NOTICE, EN_DEFAULT_SOURCES } from './EnLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';
import { JsonLd } from '@/components/seo/JsonLd';

const EN_PRICING_PLANS = [
  {
    name: 'Free',
    eyebrow: 'Starter Access',
    price: '0',
    period: 'Forever Free',
    description: 'Perfect for starters exploring AI-assisted market reviews.',
    features: [
      '3 Watchlist Stocks (incl. Insights/day)',
      'Service Model: Hunyuan Lite',
      'Basic System Notifications',
      'Academy Access (101/Masters)',
    ],
    cta: 'Start Free',
    href: 'https://app.ziso.cc',
    highlight: false,
    accent: 'text-slate-300',
  },
  {
    name: 'Go',
    eyebrow: 'Most Popular',
    price: '4.99',
    period: 'Monthly / $49.9 Yearly',
    description: 'Unlock DeepSeek actionable insights, 10 watchlist stocks, 200 monthly reports, and all-category real-time alerts.',
    features: [
      '10 Watchlist Stocks (incl. Insights/day)',
      'Service Model: DeepSeek',
      'Full Real-time Notifications',
      'Academy Access (101/Masters)',
      'Go Identity Badge',
    ],
    cta: 'Subscribe Go',
    href: 'https://app.ziso.cc',
    highlight: true,
    accent: 'text-indigo-300',
  },
  {
    name: 'Plus',
    eyebrow: 'Coming Soon High-End',
    price: 'TBA',
    period: 'Waiting List',
    description: 'Advanced consensus reasoning and priority expert support.',
    features: [
      '10 Watchlist Stocks (incl. Insights/day)',
      'Service Model: DeepSeek + Gemini',
      'Full Real-time Notifications',
      'Academy Access (101/Masters)',
      'Plus Identity Badge',
    ],
    cta: 'Join Waiting List',
    href: 'mailto:hi@ziso.cc',
    highlight: false,
    accent: 'text-emerald-300',
  },
] as const;

const EN_FEATURE_COMPARISON = [
  { isGroup: true, label: 'Actionable Insights' },
  { label: 'Service Model', free: 'Hunyuan Lite', go: 'DeepSeek', plus: 'DeepSeek + Gemini', highlight: true },
  { label: 'Watchlist Stock Count', free: '3 Stocks', go: '10 Stocks', plus: '10 Stocks', highlight: true },
  { label: 'Monthly Report Quota', free: '60 / Month', go: '200 / Month', plus: '200 / Month' },
  { label: 'Market Coverage', free: 'US / HK / CN', go: 'US / HK / CN', plus: 'US / HK / CN' },
  { label: 'Signals / Tactical Briefs', free: '✅', go: '✅', plus: '✅' },
  { label: 'Key Levels / Short Pressure', free: '✅', go: '✅', plus: '✅' },
  { label: 'Deduction / Risk Reflection', free: '❌', go: '✅', plus: '✅' },
  { label: 'Conflict Explanation', free: '❌', go: '✅', plus: '✅' },
  { label: 'Report Sharing', free: '❌', go: 'Unlimited', plus: 'Unlimited' },
  
  { isGroup: true, label: 'System Notifications' },
  { label: 'Real-time Alerts', free: 'Limited', go: 'Full Real-time', plus: 'Full Real-time', highlight: true },
  { label: 'Notification Categories', free: 'Basic', go: 'All Categories', plus: 'All Categories' },

  { isGroup: true, label: 'ZISO Academy' },
  { label: '101 Guides', free: 'Included', go: 'Included', plus: 'Included' },
  { label: 'Master Logics', free: 'Included', go: 'Included', plus: 'Included' },
  { label: 'Upcoming Content', free: 'Included', go: 'Included', plus: 'Included' },
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
      "highPrice": "49.9",
      "priceCurrency": "USD"
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
          "text": "A subscription is for the continuous compute and multi-agent reasoning required to deliver nightly Actionable Insights and tactical briefs."
        }
      }
    ]
  };

  return (
    <PageShell currentPage="pricing">
      <JsonLd data={softwareSchema} />
      <JsonLd data={faqSchema} />
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40">
        <div className="text-center space-y-4 mb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            Structured pricing for disciplined investors
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight italic">
            Appoint your own
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent italic">ZISO research council.</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium max-w-3xl mx-auto leading-relaxed mt-6">
            A subscription here is not just buying features. It is closer to hiring a round-the-clock research council.
            Our "Go" tier is designed to reduce emotional interference, strengthen your nightly review habit, and make
            decision-making calmer, cleaner, and more consistent.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-20">
          {EN_PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`glass-card p-8 flex flex-col relative overflow-hidden text-left ${
                plan.highlight ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-white/5'
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-5 right-[-35px] rotate-45 bg-indigo-600 text-white text-[10px] font-black px-10 py-1 uppercase tracking-tighter">
                  Recommended
                </div>
              )}

              <div className="mb-8">
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${plan.accent}`}>{plan.eyebrow}</p>
                <h3 className="text-3xl font-black mt-4 italic">{plan.name}</h3>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold">$</span>
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
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black italic transition-all active:scale-95 ${
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
            <h2 className="text-3xl font-black tracking-tighter italic uppercase">Feature depth comparison</h2>
            <p className="text-slate-500 text-sm mt-2">A clearer view of what changes when you move from exploration to disciplined daily use.</p>
          </div>

          <div className="glass-card overflow-hidden border-white/5 bg-white/[0.01]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="py-6 px-8 text-sm font-black uppercase tracking-widest text-slate-500">Capability</th>
                  <th className="py-6 px-8 text-sm font-black italic">Free</th>
                  <th className="py-6 px-8 text-sm font-black italic text-indigo-300">Go (Core)</th>
                  <th className="py-6 px-8 text-sm font-black italic text-emerald-400/60">Plus (Upcoming)</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {EN_FEATURE_COMPARISON.map((row: any, i: number) => {
                  if (row.isGroup) {
                    return (
                      <tr key={i} className="bg-white/[0.03]">
                        <td colSpan={4} className="py-4 px-8 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400/80">
                          {row.label}
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                      <td className="py-5 px-8 text-slate-400 font-bold">{row.label}</td>
                      <td className="py-5 px-8 text-slate-500">{row.free}</td>
                      <td className={`py-5 px-8 ${row.highlight ? 'text-indigo-100 font-black bg-indigo-500/5' : 'text-slate-300'}`}>{row.go}</td>
                      <td className="py-5 px-8 text-slate-500 italic opacity-60">{row.plus}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section id="faq" className="pt-24 pb-10 w-full max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black tracking-tighter uppercase mb-2 italic"> Pricing <span className="text-indigo-500 uppercase">FAQ</span> </h2>
            <p className="text-slate-400 font-medium italic">Understanding the value of your ZISO research council</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter italic text-indigo-400">Why is this a subscription?</p>
              <p className="text-slate-400 text-sm leading-relaxed">A subscription is not just for software; it is for the continuous compute and multi-agent reasoning required to deliver professional Actionable Insights. You are hiring a disciplined council that works when the market is closed.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter italic text-indigo-400">What makes Go different from Free?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Free is rule-based with 3 checks/day. Go is reasoning-based with 10 checks/day. Go unlocks the DeepSeek logic layer, providing deeper tactical narratives, full realtime notifications, and key price levels.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter italic text-indigo-400">What is "Plus"?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Plus is our upcoming high-end tier. It will feature "Consensus Reasoning" where multiple models (DeepSeek + Gemini) cross-validate each other to provide the highest confidence levels for professional traders.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter italic text-indigo-400">Can I upgrade or downgrade anytime?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Absolutely. All billing is handled via Stripe's secure portal, allowing you to move between tiers or cancel your monthly commitment at any time with no hidden fees.</p>
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
                  'Free Tier: 3 Actionable Insights per day using basic rule engines.',
                  'Go Tier: 10 Actionable Insights per day powered by DeepSeek reasoning.',
                  'Plus Tier: Consensus-driven insights with multi-model validation (DeepSeek + Gemini).',
                ]}
              />
            </div>
            <div className="flex-1 text-left">
              <SourceBlock
                locale="en"
                sources={[
                  ...EN_DEFAULT_SOURCES,
                  { name: 'Subscription Pricing', url: 'https://ziso.cc/pricing', accessedAt: '2026-04-03' },
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
