'use client';

import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageShell } from './KoLayout';

const KO_PRICING_PLANS = [
  {
    name: 'Free',
    eyebrow: '스타터 액세스',
    price: '0',
    period: '영구 무료',
    description: 'AI 지원 시장 복기를 처음 경험해보려는 투자자를 위한 플랜입니다.',
    features: [
      '규칙 기반 추세 신호 레이어',
      '일일 시장 요약 브리핑',
      '시장 황력 및 매크로 분위기 카드',
      '일일 3회 AI 종목 체크',
      '커뮤니티 접속 권한',
    ],
    cta: '무료로 시작하기',
    href: 'https://app.ziso.cc',
    highlight: false,
    accent: 'text-slate-300',
  },
  {
    name: 'Pro',
    eyebrow: '코어 제품',
    price: '29.9',
    period: '월간 / 연간 ¥299',
    description: '더 깊이 있는 야간 리서치와 강력한 실행 규율을 원하는 투자자를 위한 플랜입니다.',
    features: [
      'DeepSeek 추론 레이어 (Go)',
      '코칭 스타일의 전술 브리핑',
      '10개의 관심 종목 정밀 모니터링',
      '주요 가격대 및 심리 분석 잠금 해제',
      '주요 설정 변경 시 실시간 규율 알림',
      'Pro 전용 아이덴티티 배지',
    ],
    cta: '앱 열기',
    href: 'https://app.ziso.cc',
    highlight: true,
    accent: 'text-indigo-300',
  },
  {
    name: 'Alpha',
    eyebrow: '하이엔드 워크플로우',
    price: '1,999',
    period: '연간',
    description: '더 심도 있는 모니터링과 우선적인 지원이 필요한 고급 사용자를 위한 플랜입니다.',
    features: [
      '장중 이벤트 분석',
      '전용 전략 대시보드',
      '자동화된 심층 분석 보고서',
      'API 레벨의 로우 데이터 접근',
      '우선 순위 고객 지원',
    ],
    cta: '고객 지원 문의',
    href: 'mailto:hi@ziso.cc',
    highlight: false,
    accent: 'text-emerald-300',
  },
] as const;

const KO_FEATURE_COMPARISON = [
  { label: 'AI 추론 깊이', free: '규칙 엔진 + 기본 AI', pro: '심층 추론 레이어 (Go)', highlight: true },
  { label: '브리핑 스타일', free: '기본 요약', pro: '코칭 스타일 서사 및 원인 분석', highlight: true },
  { label: '관심 종목 용량', free: '3개', pro: '10개', highlight: true },
  { label: '시장 커버리지', free: '중국 및 홍콩 주식', pro: '중국 및 홍콩 주식', highlight: false },
  { label: '실시간 규율 알림', free: '없음', pro: '있음 (주요 설정 변경 시)', highlight: true },
  { label: '데이터 리듬', free: '장 마감 후', pro: '장 마감 후 + 선별적 실시간 알림', highlight: false },
] as const;

export function KoreanPricingPage() {
  return (
    <PageShell currentPage="pricing">
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40">
        <div className="text-center space-y-4 mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            규율 있는 투자자를 위한 체계적인 요금제
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
            당신만의 전용
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">ZISO 리서치 위원회를 선임하십시오.</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium max-w-3xl mx-auto leading-relaxed mt-6">
            ZISO AI 구독은 단순한 기능 구매가 아닙니다. 24시간 가동되는 전문 리서치 위원회를 고용하는 것에 가깝습니다.
            감정적 간섭을 줄이고, 야간 복기 습관을 강화하며, 의사결정을 더 차분하고 투명하며 일관되게 만들도록 설계되었습니다.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-20">
          {KO_PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`glass-card p-8 flex flex-col relative overflow-hidden ${
                plan.highlight ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-white/5'
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-5 right-[-35px] rotate-45 bg-indigo-600 text-white text-[10px] font-black px-10 py-1 uppercase tracking-tighter">
                  코어 플랜
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
            <h2 className="text-3xl font-black tracking-tighter">기능 상세 비교</h2>
            <p className="text-slate-500 text-sm mt-2">단순 탐색 단계에서 규율 있는 데일리 매매 시스템으로 전환할 때 무엇이 달라지는지 확인해 보십시오.</p>
          </div>

          <div className="glass-card overflow-hidden border-white/5 bg-white/[0.01]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="py-6 px-8 text-sm font-black uppercase tracking-widest text-slate-500">핵심 역량</th>
                  <th className="py-6 px-8 text-sm font-black text-slate-300">Free</th>
                  <th className="py-6 px-8 text-sm font-black text-indigo-300">Pro</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {KO_FEATURE_COMPARISON.map((row) => (
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
      </main>
    </PageShell>
  );
}
