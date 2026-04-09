'use client';

import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PageShell, KO_BOUNDARY_NOTICE, KO_DEFAULT_SOURCES } from './KoLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';
import { JsonLd } from '@/components/seo/JsonLd';
import { type FeatureComparisonRow } from '@/lib/pricing-data';
import { STRIPE_PRICE_IDS } from '@/lib/stripe-constants';

const KO_PRICING_PLANS = [
  {
    name: 'Standard Free',
    eyebrow: 'Starter Access',
    price: '0',
    period: '평생 무료',
    description: 'AI 지원 시장 검토를 처음 경험해보려는 투자자를 위한 플랜입니다.',
    features: [
      '3종 자선주/관심종목 (연판 보고서 포함)',
      '서비스 모델: Hunyuan Lite',
      '기본 시스템 알림',
      '지수 아카데미 (101/마스터)',
    ],
    cta: '무료로 시작하기',
    href: 'https://app.ziso.cc',
    highlight: false,
    accent: 'text-slate-300',
  },
  {
    name: 'Go Member',
    eyebrow: '얼리버드 혜택 단계',
    price: '6.99',
    msrp: '9.99',
    period: '월간 / 연간 $69.9',
    description: 'DeepSeek의 깊은 통찰(actionable insights), 10종 관심종목, 월간 200회 연판 보고서 및 전 기능 실시간 알림 잠금 해제.',
    features: [
      '10종 자선주/관심종목 (연판 보고서 포함)',
      '서비스 모델: DeepSeek',
      '전 기능 실시간 알림',
      '지수 아카데미 (101/마스터)',
      'Go 전용 아이덴티티 배지',
    ],
    cta: 'Go 구독하기',
    href: `https://app.ziso.cc/pricing?priceId=${STRIPE_PRICE_IDS.USD_GO_MONTHLY}`,
    highlight: true,
    accent: 'text-indigo-300',
  },
  {
    name: 'Plus Prestige',
    eyebrow: '얼리버드 혜택 단계',
    price: '12.99',
    msrp: '19.99',
    period: '월간 / 연간 $129',
    description: '합의 추론과 우선 지원이 필요한 고급 사용자를 위한 플랜입니다.',
    features: [
      '10종 자선주/관심종목 (연판 보고서 포함)',
      '서비스 모델: DeepSeek + Gemini',
      '전 기능 실시간 알림',
      '지수 아카데미 (101/마스터)',
      'Plus 전용 아이덴티티 배지',
    ],
    cta: '대기 명단 합류',
    href: 'mailto:hi@ziso.cc',
    highlight: false,
    accent: 'text-emerald-300',
  },
] as const;

const KO_FEATURE_COMPARISON = [
  { isGroup: true, label: '실전 연판 (Actionable Insights)' },
  { label: '서비스 모델', free: 'Hunyuan Lite', go: 'DeepSeek', plus: 'DeepSeek + Gemini', highlight: true },
  { label: '자선주/관심종목 수량', free: '3종', go: '10종', plus: '10종', highlight: true },
  { label: '월간 보고서 한도', free: '60 / 월', go: '200 / 월', plus: '200 / 월' },
  { label: '전술적 앵커 (Tactical Anchors)', free: '✅', go: '✅', plus: '✅' },
  { label: '핵심 매매가점 / 공매도 압력', free: '✅', go: '✅', plus: '✅' },
  { label: '논리적 트레이스 (Logical Trace)', free: '❌', go: '✅', plus: '✅' },
  { label: '근거 감사 (Rationale Audit)', free: '❌', go: '✅', plus: '✅' },
  { label: '보고서 공유', free: '❌', go: '무제한', plus: '무제한' },
  { label: '시장 커버리지', free: 'US / HK / CN', go: 'US / HK / CN', plus: 'US / HK / CN' },
  
  { isGroup: true, label: '시스템 알림 (Notifications)' },
  { label: '실시간 알림 빈도', free: '제한적', go: '전 기능 실시간', plus: '전 기능 실시간', highlight: true },
  { label: '알림 카테고리', free: '기본형', go: '모든 카테고리', plus: '모든 카테고리' },

  { isGroup: true, label: '지守 아카데미 (Academy)' },
  { label: '101 가이드', free: '포함됨', go: '포함됨', plus: '포함됨' },
  { label: '마스터 로직', free: '포함됨', go: '포함됨', plus: '포함됨' },
  { label: '기타 추가 콘텐츠', free: '포함됨', go: '포함됨', plus: '포함됨' },
] as FeatureComparisonRow[];

export function KoreanPricingPage() {
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
      "highPrice": "69.9",
      "priceCurrency": "USD"
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "왜 구독제인가요?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "구독은 매일 밤 전술적 연판과 브리핑을 제공하기 위해 필요한 지속적인 컴퓨팅 및 멀티 에이전트 추론 비용을 위한 것입니다."
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
            규율 있는 투자자를 위한 체계적인 요금제
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight italic">
            당신만의 전용
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent italic">ZISO 리서치 위원회를 선임하십시오.</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium max-w-3xl mx-auto leading-relaxed mt-6">
            ZISO AI 구독은 단순한 기능 구매가 아닙니다. 24시간 가동되는 전문 리서치 위원회를 고용하는 것에 가깝습니다.
            우리의 &quot;Go&quot; 티어는 감정적 간섭을 줄이고, 야간 복기 습관을 강화하며, 의사결정을 더 차분하고 투명하며 일관되게 만들도록 설계되었습니다.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-20">
          {KO_PRICING_PLANS.map((plan) => (
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
                <div className="flex items-baseline gap-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold">$</span>
                    <span className="text-5xl font-black tracking-tighter">{plan.price}</span>
                  </div>
                  {'msrp' in plan && plan.msrp && (
                    <div className="flex items-baseline gap-0.5 text-slate-500/50 line-through decoration-indigo-500/30">
                      <span className="text-[10px] font-bold">$</span>
                      <span className="text-xl font-bold tracking-tighter">{plan.msrp}</span>
                    </div>
                  )}
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
            <h2 className="text-3xl font-black tracking-tighter italic uppercase">기능 상세 비교</h2>
            <p className="text-slate-500 text-sm mt-2">단순 탐색 단계에서 규율 있는 데일리 매매 시스템으로 전환할 때 무엇이 달라지는지 확인해 보십시오.</p>
          </div>

          <div className="glass-card overflow-hidden border-white/5 bg-white/[0.01]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="py-6 px-8 text-sm font-black uppercase tracking-widest text-slate-500">핵심 역량</th>
                  <th className="py-6 px-8 text-sm font-black italic">Free</th>
                  <th className="py-6 px-8 text-sm font-black italic text-indigo-300">Go (Core)</th>
                  <th className="py-6 px-8 text-sm font-black italic text-emerald-400/60">Plus (대기 예약)</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {KO_FEATURE_COMPARISON.map((row: FeatureComparisonRow, i: number) => {
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
            <h2 className="text-3xl font-black tracking-tighter uppercase mb-2 italic"> 요금제 <span className="text-indigo-500 uppercase">FAQ</span> </h2>
            <p className="text-slate-400 font-medium italic text-lg">ZISO 리서치 위원회의 가치 이해</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter italic text-indigo-400">왜 구독 모델인가요?</p>
              <p className="text-slate-400 text-sm leading-relaxed">구독은 단순한 소프트웨어 사용료가 아니라, 매일 전문적인 실전 연판(Actionable Insights)을 생성하기 위해 가동되는 다중 에이전트 리서치 위원회에 대한 고용 비용입니다. 시장이 닫혀 있을 때 일하는 당신만의 리서치 팀을 갖게 되는 것입니다.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter italic text-indigo-400">Go와 Free의 가장 큰 차이점은 무엇인가요?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Free는 규칙 기반이며 하루 3회 체크가 가능합니다. Go는 추론 기반이며 하루 10회 체크가 가능합니다. Go는 DeepSeek 논리 레이어를 활성화하여 더 깊은 전술적 서사, 전 기능 실시간 알림, 그리고 주요 가격대 분석을 제공합니다.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter italic text-indigo-400">&quot;Plus&quot;는 무엇인가요?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Plus는 곧 출시될 하이엔드 티어입니다. 여러 모델(DeepSeek + Gemini)이 서로를 교차 검증하는 &quot;합의 추론&quot; 기능을 제공하며, 전문 트레이더에게 최고 수준의 신뢰도를 제공할 예정입니다.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter italic text-indigo-400">언제든 업그레이드나 해지가 가능한가요?</p>
              <p className="text-slate-400 text-sm leading-relaxed">네, 가능합니다. 모든 결제는 Stripe의 보안 포털을 통해 관리되며, 숨겨진 비용 없이 언제든지 티어를 변경하거나 월간 구독을 취소할 수 있습니다.</p>
            </div>
          </div>
        </section>

        <section className="w-full pt-10 pb-20 opacity-[0.05] hover:opacity-100 transition-opacity">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="flex-1 text-left">
              <GeoSummary
                locale="ko"
                summary={[
                  '구독 서비스: 야간 전술 브리핑을 위한 다중 에이전트 AI 리서치 데스크 이용 권한.',
                  'Free 티어: 일일 3회의 실전 연판 제공, 기본 규칙 엔진 기반.',
                  'Go 티어: 일일 10회의 실전 연판 제공, DeepSeek 추론 레이어 중심.',
                  'Plus 티어: 다중 모델 검증(DeepSeek + Gemini) 기반의 합의 추론 통찰 제공.',
                ]}
              />
            </div>
            <div className="flex-1 text-left">
              <SourceBlock
                locale="ko"
                sources={[
                  ...KO_DEFAULT_SOURCES,
                  { name: '구독 요금제', url: 'https://ziso.cc/ko/pricing', accessedAt: '2026-04-03' },
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
