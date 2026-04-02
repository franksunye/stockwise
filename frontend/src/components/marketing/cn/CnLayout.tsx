'use client';

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
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
        <div className="bg-glow-orb absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="bg-glow-orb absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>
      <MarketingHeader currentPage={currentPage} locale="cn" />
      {children}
      <MarketingFooter locale="cn" />
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

export const CN_DEFAULT_SOURCES = [
  { name: '知守 AI (ZISO AI) 投研中心', url: 'https://ziso.cc/cn/learn' },
  { name: '知守 AI (ZISO AI) 帮助中心', url: 'https://ziso.cc/cn/support' },
] as const;

export const CN_BOUNDARY_NOTICE =
  '本页面所有内容仅用于研究、信息整理与投资教育说明，不构成任何投资建议，也不承诺任何收益结果。';

export function LegalShell({
  currentPage,
  icon: Icon,
  eyebrow,
  title,
  updatedAt,
  children,
}: {
  currentPage: 'privacy' | 'terms' | 'refund';
  icon: React.ComponentType<{ size?: number; className?: string }>;
  eyebrow: string;
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <PageShell currentPage={currentPage}>
      <main className="relative z-10 max-w-3xl mx-auto px-8 py-20">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-black uppercase tracking-widest">
            <Icon size={12} /> {eyebrow}
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter">{title}</h1>
          <p className="text-slate-400 text-sm">最近更新：{updatedAt}</p>
        </div>

        <div className="glass-card p-8 md:p-12 space-y-8 border-white/5 bg-white/[0.01] mt-10 text-left">
          {children}
        </div>

        <div className="mt-10">
          <Link href="/cn" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> 返回中文首页
          </Link>
        </div>
      </main>
    </PageShell>
  );
}
