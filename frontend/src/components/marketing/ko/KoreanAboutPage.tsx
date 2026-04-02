'use client';

import { Sparkles, Target, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Multiavatar from '@/components/Multiavatar';
import { PageShell, KO_FOUNDERS, KO_AGENT_TEAM, KO_BOUNDARY_NOTICE, KO_DEFAULT_SOURCES } from './KoLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';
import { JsonLd } from '@/components/seo/JsonLd';

export function KoreanAboutPage() {
  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "mainEntity": {
      "@type": "Organization",
      "name": "ZISO AI",
      "description": "ZISO AI는 멀티 에이전트 추론 아키텍처(에이전트 위원회)를 통해 복잡한 시장 데이터를 구조화된 전략적 브리핑으로 변환하는 개인 투자자용 전문 연구 파트너입니다.",
      "founder": KO_FOUNDERS.map(f => ({
        "@type": "Person",
        "name": f.name,
        "jobTitle": f.label
      })),
      "knowsAbout": [
        "시장 조사",
        "AI 추론",
        "퀀트 모델링",
        "리스크 관리"
      ]
    }
  };

  return (
    <PageShell currentPage="about">
      <JsonLd data={aboutSchema} />
      <main className="relative z-10 max-w-5xl mx-auto px-8 pt-20 pb-32">
        <div className="space-y-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest">
            <Sparkles size={12} /> ZISO AI 소개
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
            기관급 리서치 규율을,
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
              진지한 개인 투자자에 맞게 재설계했습니다.
            </span>
          </h1>
          <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-3xl">
            ZISO AI는 당신의 포켓 리서치 파트너이자 실무 실행 코치입니다.
            번거로운 시장 분석 업무를 대신 수행하며, 투자자가 각 결정 뒤에 숨겨진 깊은 논리를 통찰할 수 있도록 돕습니다.
          </p>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 max-w-3xl">
            리서치 팀이 제공하는 전면 서비스, 분석 모델, 퀀트 모델 및 자동화 워크플로우로 구동되는 후면 엔진.
          </p>
        </div>

        <section className="pt-24 grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Target className="text-indigo-400" />
            </div>
            <h2 className="text-3xl font-black tracking-tighter">우리의 사명</h2>
            <p className="text-slate-400 leading-relaxed font-bold">
              ZISO AI는 명확한 목표를 위해 구축되었습니다: <span className="text-white">일반 투자자들이 기관급 리서치 규율을 가지고 시장을 운영할 수 있도록 돕는 것입니다.</span>
            </p>
            <p className="text-slate-500 text-sm leading-relaxed">
              개인 투자자들은 대개 단편적인 정보, 부족한 복기 습관, 그리고 반응적인 의사결정의 함정에 빠지곤 합니다.
              ZISO AI는 협력하는 여러 에이전트를 사용하여 일일 시장 데이터를 처리하고, 복기 주기를 체계화하며,
              사용자가 감에 의존하는 매매에서 벗어나 더 차분하고 방어 가능한 결정을 내릴 수 있도록 지원합니다.
            </p>
          </div>
          <div className="glass-card p-1 relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 rounded-[38px] blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="bg-[#0a0a0f] rounded-[38px] p-8 relative z-10 space-y-4">
              <div className="text-indigo-300 font-black text-xl leading-tight">
                &ldquo;보이는 것을 시장 구조로 읽고, 지켜야 할 것을 규율로 수호하십시오.&rdquo;
              </div>
              <p className="text-slate-500 text-sm text-justify leading-relaxed">
                이것이 ZISO라는 이름 뒤에 숨겨진 정신입니다. 앞부분(知)은 투자자가 시장 구조를 더 명확하게 볼 수 있게 돕는 심층 리서치 작업을 의미합니다.
                뒷부분(守)은 확실성이 약할 때 자본을 보호하는 견고한 규율을 의미합니다. 게임을 이해하되, 선을 지키십시오.
                그것이 비로소 합리적인 실행을 가능하게 합니다.
              </p>
            </div>
          </div>
        </section>

        <section className="pt-24 space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black tracking-tighter">팀 및 운영 구조</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm">
              우리는 리서치 방향, 분석 표현, 퀀트 엔지니어링, 컨텍스트 지능 및 결과 감사를 명확한 역할로 분리하여,
              마치 전문 리서치 데스크가 사용자 곁에서 실시간으로 협업하는 듯한 경험을 제공합니다.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {KO_FOUNDERS.map((founder) => (
              <div key={founder.name} className="glass-card p-8 space-y-4 border-white/10 bg-white/[0.02]">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">{founder.label}</div>
                <h3 className="text-2xl font-black">{founder.name}</h3>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">{founder.description}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {KO_AGENT_TEAM.map((member) => (
              <div key={member.name} className={`p-6 rounded-[32px] bg-gradient-to-b ${member.aboutGradient} to-transparent border border-white/5 flex flex-col items-center text-center space-y-4`}>
                <div className="w-16 h-16 rounded-full bg-black/40 border border-white/10 overflow-hidden">
                  <Multiavatar name={member.avatarSeed} className="w-full h-full" />
                </div>
                <div>
                  <div className={`font-black ${member.textColor}`}>{member.name}</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{member.role}</div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{member.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pt-32 text-center space-y-12 border-b border-white/5 pb-32">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight">
            혼자 매매하는 것을 멈추십시오.
            <br />
            <span className="text-indigo-400">AI 강화 의사결정 지원을 시작하십시오.</span>
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="https://app.ziso.cc"
              className="px-10 py-5 rounded-3xl bg-indigo-500 text-white font-black shadow-lg hover:scale-105 transition-all"
            >
              앱 열기
            </Link>
            <Link
              href="/ko"
              className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-slate-400 font-black hover:text-white transition-all flex items-center gap-2"
            >
              <ArrowLeft size={18} /> 한국어 홈으로 이동
            </Link>
          </div>
        </section>

        <section className="w-full pt-10 pb-20 opacity-[0.05] hover:opacity-100 transition-opacity">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="flex-1 text-left">
              <GeoSummary
                locale="ko"
                summary={[
                  '사명: 다중 에이전트 AI 위원회를 통해 개인 투자자에게 기관급 시장 리서치 규율을 민주화합니다.',
                  '역할: DeepSeek-R1 (전술적 추론), Hunyuan (맥락 파악), 퀀트 엔진 (구조적 규칙), 검증자 (결과 감사).',
                  '방법론: 관심사 분리를 통해 분석, 리스크 감독 및 사후 감사가 독립적으로 기능하고 책임을 지도록 보장합니다.',
                ]}
              />
            </div>
            <div className="flex-1 text-left">
              <SourceBlock
                locale="ko"
                sources={[
                  ...KO_DEFAULT_SOURCES,
                  { name: '사명 및 팀', url: 'https://ziso.cc/ko/about', accessedAt: '2026-03-20' },
                ]}
              />
            </div>
          </div>
          <BoundaryNotice locale="ko" text={KO_BOUNDARY_NOTICE} />
        </section>
      </main>
    </PageShell>
  );
}
