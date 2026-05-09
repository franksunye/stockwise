'use client';

import { Suspense } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { pricingPlans, featureComparison, type FeatureComparisonRow } from '@/lib/pricing-data';
import { PageShell } from './CnLayout';
import { JsonLd } from '@/components/seo/JsonLd';
import { createTranslator, type MessageBundle } from '@/lib/i18n';
import cnMessages from '@/messages/cn.json';

function PricingContent() {
  const t = createTranslator(cnMessages as MessageBundle, 'pricing');

  const getAnnualPrice = (planEnName: string) => {
    if (planEnName === 'Go') return '¥499';
    return '';
  };

  const renderFeature = (feature: string) => {
    if (feature.startsWith('pricing.')) {
        const [keyWithPrefix, val] = feature.split('|');
        const key = keyWithPrefix.replace('pricing.', '');
        if (key === 'features.insights') return t('features.insights', { count: val });
        if (key === 'features.model') return t('features.model', { model: val });
        return t(key as Parameters<typeof t>[0]);
    }
    return feature;
  };

  const renderComparisonValue = (value?: string) => {
    if (!value) return value;
    if (value.startsWith('pricing.')) {
      return t(value.replace('pricing.', '') as Parameters<typeof t>[0]);
    }
    return value;
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "知守 AI (ZISO AI)",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "AggregateOffer",
      "offerCount": "3",
      "lowPrice": "0",
      "highPrice": "299",
      "priceCurrency": "CNY"
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "为什么是订阅制？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "订阅是为了维持交付深夜战术简报所需的持续计算和多智能体推理。你正在聘请一个在市场收盘后仍在工作的纪律严明的委员会。"
        }
      }
    ]
  };

  return (
    <PageShell currentPage="pricing">
      <JsonLd data={softwareSchema} />
      <JsonLd data={faqSchema} />
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40 text-center">
        <div className="space-y-4 mb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4 mx-auto">
              知其白 · 守其黑 | Native Agentic Support
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter italic leading-tight">
            选聘您的 <br /> 
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">知守 · 投研委员会</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed mt-6">
            订阅不仅是购买功能，更是雇佣了一组 24/7 在岗的专业交易委员会。让知守委员会帮您克服情绪干扰，构建理性的复盘习惯。
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-20">
          {pricingPlans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
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
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${
                  plan.color === 'indigo' ? 'bg-indigo-500/10 text-indigo-400' :
                  plan.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' :
                  'bg-slate-500/10 text-slate-400'
                }`}>
                  <plan.icon size={24} />
                </div>
                <h3 className="text-2xl font-black italic mb-1">
                  {t(`${plan.enName.toLowerCase()}.name` as Parameters<typeof t>[0])}
                </h3>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">{plan.enName}</p>
              </div>

              <div className="mb-8 text-left">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold">¥</span>
                  <span className="text-5xl font-black tracking-tighter">{plan.price}</span>
                <span className="text-slate-500 text-sm ml-2">
                    {t(`${plan.enName.toLowerCase()}.period` as Parameters<typeof t>[0], { price: getAnnualPrice(plan.enName) })}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mt-4 leading-relaxed italic">
                  {t(`${plan.enName.toLowerCase()}.description` as Parameters<typeof t>[0])}
                </p>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm">
                    <div className="mt-1 w-4 h-4 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Check size={10} className={plan.highlight ? 'text-indigo-400' : 'text-slate-500'} />
                    </div>
                    <span className="text-slate-300 font-medium">
                        {renderFeature(feature)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                {plan.enName === 'Plus' ? (
                  <Link
                    href={plan.href || '#'}
                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black italic transition-all active:scale-95 ${
                      plan.enName === 'Plus'
                      ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white'
                    }`}
                  >
                    {plan.enName === 'Plus' ? '加入等待名单' : '免费开始'}
                    <ChevronRight size={18} />
                  </Link>
                ) : (
                  <Link
                    href="https://app.ziso.cc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black italic transition-all active:scale-95 ${
                      plan.highlight
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 hover:shadow-indigo-600/40'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white'
                    }`}
                  >
                    {plan.enName === 'Go' ? '前往 App 订阅' : '进入 App'}
                    <ChevronRight size={18} />
                  </Link>
                )}
                {plan.enName === 'Go' && (
                  <p className="mt-1 text-[11px] text-slate-500">请在 App 内完成订阅。</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <section className="mb-24 hidden md:block">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase">功能深度对照</h2>
          </div>
          <div className="glass-card overflow-hidden border-white/5 bg-white/[0.01]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="py-6 px-8 text-sm font-black uppercase tracking-widest text-slate-500">能力维度</th>
                  <th className="py-6 px-8 text-sm font-black italic">基础版 (FREE)</th>
                  <th className="py-6 px-8 text-sm font-black italic text-indigo-400">GO 会员 (核心)</th>
                  <th className="py-6 px-8 text-sm font-black italic text-emerald-400/60">PLUS (待发布)</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {featureComparison.map((row: FeatureComparisonRow, i: number) => {
                  if (row.isGroup) {
                    return (
                      <tr key={i} className="bg-white/[0.03]">
                        <td colSpan={4} className="py-4 px-8 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400/80">
                          {row.label.startsWith('pricing.') ? t(row.label.replace('pricing.', '') as Parameters<typeof t>[0]) : row.label}
                        </td>
                      </tr>
                    );
                  }

                  const label = row.label.startsWith('pricing.') ? t(row.label.replace('pricing.', '') as Parameters<typeof t>[0]) : row.label;

                  return (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                      <td className="py-5 px-8 text-slate-400 font-bold whitespace-nowrap">{label}</td>
                      <td className="py-5 px-8 text-slate-500">
                        {renderComparisonValue(row.free)}
                      </td>
                      <td className={`py-5 px-8 ${row.highlight ? 'text-indigo-100 font-black bg-indigo-500/5' : 'text-slate-300'}`}>
                        {renderComparisonValue(row.go)}
                      </td>
                      <td className="py-5 px-8 text-slate-500 italic opacity-60">
                        {renderComparisonValue(row.plus)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </PageShell>
  );
}

export function ChinesePricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050508] flex items-center justify-center text-indigo-500">Loading...</div>}>
      <PricingContent />
    </Suspense>
  );
}
