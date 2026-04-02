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
      <MarketingHeader currentPage={currentPage} locale="ko" />
      {children}
      <MarketingFooter locale="ko" />
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

export const KO_FOUNDERS = [
  {
    label: '설립자 / 리서치 리드',
    name: 'Andre Gu',
    description:
      '리서치 방향, 시스템 아키텍처 및 제품 제공을 총괄하며, 퀀트와 AI 방법론을 안정적이고 사용자 중심적인 워크플로우로 구현합니다.',
  },
  {
    label: '공동 설립자',
    name: 'Frank Sun',
    description:
      '제품 전략, 트레이딩 프레임워크 설계 및 리스크 경계를 담당하며, 모든 결과물이 설명 가능하고 실행 가능하며 검토 가능하도록 보장합니다.',
  },
] as const;

export const KO_AGENT_TEAM = [
  {
    name: 'Gu Shen (DeepSeek)',
    role: '시니어 애널리스트',
    description:
      '결론 도출, 심층 시나리오 분석 및 핵심 리스크 판단을 수행하며, 이를 명확하고 전술적인 서사로 전환합니다.',
    avatarSeed: 'gu-shen-deepseek',
    textColor: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    glowColor: 'bg-indigo-500',
    aboutGradient: 'from-indigo-500/20',
  },
  {
    name: 'Lin Xu (Hunyuan Lite)',
    role: '주니어 애널리스트',
    description:
      '보조 분석 및 다각도 분석을 추가하여 복잡한 시장 행태를 이해하기 쉽고 실행하기 쉬운 판단으로 번역하는 것을 돕습니다.',
    avatarSeed: 'lin-xu-hunyuan-lite',
    textColor: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    glowColor: 'bg-cyan-500',
    aboutGradient: 'from-cyan-500/20',
  },
  {
    name: 'Cheng Ju (Rule Engine)',
    role: '퀀트 룰 애널리스트',
    description:
      '규칙 기반의 관점, 규율 상태 및 구조적 제약을 설명하며, 주관적 판단을 배제한 퀀트 규칙의 관점을 대변합니다.',
    avatarSeed: 'cheng-ju-quant-rules',
    textColor: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    glowColor: 'bg-rose-500',
    aboutGradient: 'from-rose-500/20',
  },
  {
    name: 'Shen Ce (Quant Engineer)',
    role: '퀀트 엔지니어',
    description:
      '퀀트 모델의 기반을 구축하며, 데이터 처리, 지표, 규칙 및 파라미터를 안정적인 상용 등급 시스템으로 전환합니다.',
    avatarSeed: 'shen-ce-quant-engineer',
    textColor: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    glowColor: 'bg-violet-500',
    aboutGradient: 'from-violet-500/20',
  },
  {
    name: 'Nora',
    role: '컨텍스트 오피서',
    description:
      '뉴스와 매크로 노이즈를 필터링하고 각 신호 주변의 실제 맥락을 복구하여 전술적 결정이 공백 상태에서 내려지지 않도록 합니다.',
    avatarSeed: 'nora-context-desk',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    glowColor: 'bg-emerald-500',
    aboutGradient: 'from-emerald-500/20',
  },
  {
    name: 'Verifier',
    role: '검증 감사관',
    description:
      '장 마감 후 결과를 검토하고 적중률과 모델 편차를 추적하며, 리서치 워크플로우의 책임성이 유지되도록 돕습니다.',
    avatarSeed: 'verifier-audit-desk',
    textColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    glowColor: 'bg-amber-500',
    aboutGradient: 'from-amber-500/20',
  },
] as const;

export const KO_DEFAULT_SOURCES = [
  { name: 'ZISO AI 리서치 센터', url: 'https://ziso.cc/learn' },
  { name: 'ZISO AI 고객지원 센터', url: 'https://ziso.cc/support' },
] as const;

export const KO_BOUNDARY_NOTICE =
  '모든 콘텐츠는 리서치 및 정보 제공 목적으로만 제공됩니다. 본 사이트의 어떠한 내용도 투자 권유나 수익 보장을 구성하지 않습니다.';

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
          <p className="text-slate-400 text-sm">최종 수정일: {updatedAt}</p>
        </div>

        <div className="glass-card p-8 md:p-12 space-y-8 border-white/5 bg-white/[0.01] mt-10 text-left">
          {children}
        </div>

        <div className="mt-10">
          <Link href="/ko" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> 한국어 홈으로 돌아가기
          </Link>
        </div>
      </main>
    </PageShell>
  );
}
