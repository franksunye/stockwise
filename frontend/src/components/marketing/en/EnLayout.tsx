'use client';

import React from 'react';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingHeader from '@/components/MarketingHeader';

export function PageShell({
  currentPage,
  children,
}: {
  currentPage: 'home' | 'about' | 'pricing' | 'privacy' | 'terms' | 'refund';
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden font-sans">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[120px] rounded-full" />
      </div>
      <MarketingHeader currentPage={currentPage} locale="en" />
      {children}
      <MarketingFooter locale="en" />
      <style jsx global>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 40px;
        }
      `}</style>
    </div>
  );
}

export const EN_FOUNDERS = [
  {
    label: 'Founder / Research Lead',
    name: 'Andre Gu',
    description:
      'Leads research direction, systems architecture, and product delivery, turning the quant-plus-AI methodology into a stable, user-facing workflow.',
  },
  {
    label: 'Co-Founder',
    name: 'Frank Sun',
    description:
      'Owns product strategy, trading framework design, and risk boundaries, ensuring every output remains explainable, actionable, and reviewable.',
  },
] as const;

export const EN_AGENT_TEAM = [
  {
    name: 'DeepSeek',
    role: 'Senior Analyst',
    description:
      'Produces the lead conclusion, deeper scenario analysis, and core risk judgment, then turns that work into a clear tactical narrative.',
    avatarSeed: 'gu-shen-deepseek',
    textColor: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    glowColor: 'bg-indigo-500',
    aboutGradient: 'from-indigo-500/20',
  },
  {
    name: 'Lin Xu (Hunyuan Lite)',
    role: 'Junior Analyst',
    description:
      'Adds supporting analysis and alternate angles, helping translate complex market behavior into judgments that are easier to understand and act on.',
    avatarSeed: 'lin-xu-hunyuan-lite',
    textColor: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    glowColor: 'bg-cyan-500',
    aboutGradient: 'from-cyan-500/20',
  },
  {
    name: 'Cheng Ju (Rule Engine)',
    role: 'Junior Rule Analyst',
    description:
      'Explains the rule-based view, discipline state, and structural constraints, representing the quant rule perspective without pretending to be discretionary judgment.',
    avatarSeed: 'cheng-ju-quant-rules',
    textColor: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    glowColor: 'bg-rose-500',
    aboutGradient: 'from-rose-500/20',
  },
  {
    name: 'Shen Ce (Quant Engineer)',
    role: 'Quant Engineer',
    description:
      'Builds the quant model foundation, turning data handling, indicators, rules, and parameters into a stable production-grade system.',
    avatarSeed: 'shen-ce-quant-engineer',
    textColor: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    glowColor: 'bg-violet-500',
    aboutGradient: 'from-violet-500/20',
  },
  {
    name: 'Nora',
    role: 'Context Officer',
    description:
      'Filters news and macro noise, then restores the real context around each signal so tactical decisions are not made in a vacuum.',
    avatarSeed: 'nora-context-desk',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    glowColor: 'bg-emerald-500',
    aboutGradient: 'from-emerald-500/20',
  },
  {
    name: 'Verifier',
    role: 'Validation Auditor',
    description:
      'Reviews outcomes after the close, tracks hit rate and model drift, and helps keep the research workflow accountable over time.',
    avatarSeed: 'verifier-audit-desk',
    textColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    glowColor: 'bg-amber-500',
    aboutGradient: 'from-amber-500/20',
  },
] as const;

export const EN_DEFAULT_SOURCES = [
  { name: 'ZISO AI Research Center', url: 'https://ziso.cc/learn' },
  { name: 'ZISO AI Help Center', url: 'https://ziso.cc/support' },
] as const;

export const EN_BOUNDARY_NOTICE =
  'All content is provided for research and informational purposes only. Nothing on this site constitutes investment advice or a promise of returns.';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export function LegalShell({
  icon: Icon,
  eyebrow,
  title,
  updatedAt,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  eyebrow: string;
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <PageShell currentPage="home">
      <main className="relative z-10 max-w-3xl mx-auto px-8 py-20">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-black uppercase tracking-widest">
            <Icon size={12} /> {eyebrow}
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter">{title}</h1>
          <p className="text-slate-400 text-sm">Last updated: {updatedAt}</p>
        </div>

        <div className="glass-card p-8 md:p-12 space-y-8 border-white/5 bg-white/[0.01] mt-10 text-left">
          {children}
        </div>

        <div className="mt-10">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back to English home
          </Link>
        </div>
      </main>
    </PageShell>
  );
}
