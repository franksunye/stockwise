'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { PageShell, KO_BOUNDARY_NOTICE, KO_DEFAULT_SOURCES } from './KoLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';
import { JsonLd } from '@/components/seo/JsonLd';

export function KoreanHomePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "ZISO AI는 정확히 무엇인가요?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ZISO AI는 개인 투자자가 감당하기 어려운 매일의 시장 분석을 대신 수행하는 전문가급 AI 연구 및 분석 파트너입니다. 딥러닝 모델과 멀티 에이전트 추론 시스템을 결합하여 복잡한 시장 노이즈를 구조화된 실행 가능한 전략으로 변환합니다."
        }
      },
      {
        "@type": "Question",
        "name": "AI 추론은 어떻게 작동하나요?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "단순한 예측 봇과 달리, ZISO AI는 '에이전트 위원회(Council of Agents)' 아키텍처를 사용합니다. DeepSeek-R1의 깊은 논리적 추론과 Hunyuan의 언어적 뉘앙스, 그리고 정형화된 퀀트 규칙 엔진을 결합하여 모든 전략적 브리핑이 데이터에 근거하고 설명 가능하도록 보장합니다."
        }
      }
    ]
  };

  return (
    <PageShell currentPage="home">
      <JsonLd data={faqSchema} />
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40 flex flex-col items-center text-center">
        <div className="space-y-6 max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-black uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            ZISO AI | 진지한 개인 투자자를 위한 장 마감 후 시장 리서치
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight">
            AI가 리서치를 수행합니다.
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
              결정은 귀하가 내립니다.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            ZISO AI는 장 마감 후의 시장 데이터를 주요 가격대, 실행 상태, 컨텍스트 및 리스크 경계가 포함된 체계적인 브리핑으로 변환합니다.
            이제 개인 투자자도 장중 반응이 아닌, 다음 세션을 위한 철저한 준비를 할 수 있습니다.
          </p>
          <div className="pt-10 flex flex-col md:flex-row items-center justify-center gap-4">
            <Link
              href="https://app.ziso.cc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-5 rounded-3xl bg-indigo-500 text-white font-black text-lg shadow-[0_20px_40px_rgba(99,102,241,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              앱 열기 <ChevronRight size={20} />
            </Link>
            <Link href="/ko/pricing" className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-white font-black text-lg hover:bg-white/10 transition-all">
              요금제 보기
            </Link>
          </div>
        </div>

        <div className="w-full max-w-5xl relative mt-20">
          <div className="relative h-[500px] md:h-[700px] w-full flex items-center justify-center">
            <div className="absolute left-[5%] md:left-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 -rotate-12 origin-bottom-right hidden sm:flex items-center justify-center p-2 transition-transform hover:-translate-x-2">
              <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                <Image src="/images/landing/analysis-depth.png" alt="AI 분석 상세" fill sizes="(min-width: 768px) 25vw, 45vw" className="object-cover" />
              </div>
            </div>

            <div className="absolute right-[5%] md:right-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 rotate-12 origin-bottom-left hidden sm:flex items-center justify-center p-2 transition-transform hover:translate-x-2">
              <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                <Image src="/images/landing/alert-popup.png" alt="실시간 규율 알림" fill sizes="(min-width: 768px) 25vw, 45vw" className="object-cover" />
              </div>
            </div>

            <div className="relative w-[70%] sm:w-[50%] md:w-[32%] aspect-[9/19] bg-[#1A1A25] rounded-[40px] border border-white/20 shadow-[0_0_100px_rgba(99,102,241,0.2)] z-30 flex items-center justify-center p-2 md:p-3 transition-transform hover:scale-[1.02]">
              <div className="w-full h-full bg-[#050508] rounded-[30px] border border-white/10 overflow-hidden relative">
                <Image src="/images/landing/main-dashboard.png" alt="메인 대시보드 미리보기" fill priority sizes="(min-width: 1024px) 32vw, (min-width: 640px) 50vw, 70vw" className="object-cover" />
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full border border-white/5 z-20" />
              </div>
            </div>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] -z-10 rounded-full" />
        </div>

        <section id="features" className="pt-48 w-full grid md:grid-cols-2 gap-20 items-center text-left">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em]">
              내일의 계획을 세우십시오
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              시장이 평온할 때 복기하십시오.
              <br />
              <span className="text-indigo-400">내일이 오기 전에 내일의 시나리오를 작성하십시오.</span>
            </h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              전문 트레이더는 장중의 빠른 본능으로만 정의되지 않습니다. 그들의 진정한 우위는 장 마감 후의 노력에서 나옵니다.
              ZISO AI는 매일 저녁 시장 데이터와 뉴스를 연결하여 구조화된 결정 시나리오로 변환합니다. 무분별한 예측이 아닌, 실행 가능한 경계를 정의합니다.
            </p>
            <ul className="space-y-4">
              {[
                'MA, RSI, MACD를 통한 다중 타임프레임 추세 일치 분석',
                '가격-거래량 이상 징후 추적 및 맥락적 설명 제공',
                '과거 적중률 로직에 기반한 신뢰도 점수 산출',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm font-bold text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <ChevronRight size={14} />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass-card aspect-square bg-[#0A0A10] rounded-[40px] overflow-hidden border border-white/5 relative">
            <Image src="/images/landing/prediction-card-detail.png" alt="상세 전술 브리핑" fill className="object-cover opacity-80 hover:opacity-100 transition-opacity duration-700" />
          </div>
        </section>

        <section className="pt-32 w-full grid md:grid-cols-2 gap-20 items-center text-left">
          <div className="order-2 md:order-1 glass-card aspect-square bg-[#0A0A10] rounded-[40px] overflow-hidden border border-white/5 relative">
            <Image src="/images/landing/circuit-breaker-logic.png" alt="리스크 서킷 브레이커 로직" fill sizes="(min-width: 768px) 45vw, 100vw" className="object-cover opacity-80 hover:opacity-100 transition-opacity duration-700" />
            <ShieldCheck size={120} className="absolute bottom-4 right-4 opacity-[0.1] text-red-500 pointer-events-none" />
          </div>
          <div className="order-1 md:order-2 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-[0.2em]">
              리스크 컨트롤 시스템
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              거친 변동성 속에서도,
              <br />
              <span className="text-red-400">75%의 게이트는 유지됩니다.</span>
            </h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              게임을 이해하는 것만으로는 부족합니다. 당신의 경계를 지켜야 합니다. 다음 세션에 대한 시스템의 신뢰도가 75% 미만으로 떨어지면,
              ZISO AI는 강력한 서킷 브레이커를 작동시켜 공격적인 행동을 차단합니다. 관찰이 우선입니다. 생존이 우선입니다.
              규율을 잃지 않는 것, 그것이 의미 있는 승리를 거둘 만큼 오랫동안 시장에 머무르는 첫 번째 규칙입니다.
            </p>
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
              <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                <span className="text-slate-500">AI 신뢰도 점수</span>
                <span className="text-red-400">서킷 브레이커 작동</span>
              </div>
              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full w-[64%] bg-red-500/50" />
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                현재 상태: 설정값 없음, 수비 모드 활성화
              </p>
            </div>
          </div>
        </section>

        <section className="pt-32 w-full">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              독립적인 트레이딩 시스템을 향한 <span className="text-indigo-400">3단계</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-12 text-left">
            {[
              {
                num: '01',
                title: '관심 종목을 등록하십시오',
                desc: '관심 있는 종목을 추가하십시오. 시스템이 즉시 약 250거래일의 이력을 동기화하고 모델링을 시작합니다.',
              },
              {
                num: '02',
                title: '매일 밤 브리핑을 받으십시오',
                desc: '장 마감 후 약 30분 이내에, 리서치 어시스턴트가 지지선, 저항선, 전술적 프레임 및 결정 로직이 포함된 브리핑을 전달합니다.',
              },
              {
                num: '03',
                title: '장중 규율을 실행하십시오',
                desc: '장중의 무작위한 움직임에 매매를 맡기지 마십시오. 가격이 전날 밤 설정한 시나리오에 도달하면, 위원회가 실행 규율을 회복하도록 돕습니다.',
              },
            ].map((step) => (
              <div key={step.num} className="space-y-6 relative group">
                <div className="text-7xl font-black text-white/[0.03] group-hover:text-indigo-500/10 transition-colors absolute -top-10 -left-4">
                  {step.num}
                </div>
                <h3 className="font-extrabold text-2xl relative z-10">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium relative z-10">{step.desc}</p>
                <div className="w-12 h-1 bg-white/5 rounded-full group-hover:w-20 group-hover:bg-indigo-500/30 transition-all duration-500" />
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="pt-40 pb-10 w-full max-w-4xl space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase mb-2"> 자주 묻는 질문 <span className="text-indigo-500 uppercase">FAQ</span> </h2>
            <p className="text-slate-400 font-medium italic text-lg">ZISO AI 방법론에 대한 깊은 이해</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">ZISO AI는 정확히 무엇인가요?</p>
              <p className="text-slate-400 text-sm leading-relaxed">번거로운 시장 분석 업무를 대신 수행하는 전문 리서치 데스크입니다. 심층적인 과거 데이터 모델링과 다중 에이전트 추론 위원회를 결합하여, 복잡한 시장의 소음을 구조화된 실행 가능 시나리오로 변환합니다.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">AI 추론은 어떻게 작동하나요?</p>
              <p className="text-slate-400 text-sm leading-relaxed">단순한 예측 봇과 달리, ZISO AI는 &apos;에이전트 위원회&apos; 아키텍처를 사용합니다. DeepSeek-R1의 깊은 논리적 추론과 Hunyuan의 맥락 파악 능력, 그리고 고정된 퀀트 규칙 엔진을 결합하여 모든 전술 브리핑이 데이터에 기반하고 설명 가능하도록 보장합니다.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">왜 75% 신뢰도 게이트를 유지하나요?</p>
              <p className="text-slate-400 text-sm leading-relaxed">우리는 매매 빈도보다 실행 규율을 우선시합니다. 시스템의 신뢰도가 75% 미만으로 떨어지면 강력한 서킷 브레이커가 작동합니다. 생존이 우선이며, 그 다음에 승리가 있습니다. 이 게이트는 감정적인 &apos;과잉 매매&apos;를 방지하는 보호막 역할을 합니다.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">과거 기록은 투명하게 공개되나요?</p>
              <p className="text-slate-400 text-sm leading-relaxed">투명성은 우리의 핵심 가치입니다. 모든 전술 브리핑과 그에 따른 결과는 각 종목별 아카이브에 기록되며 언제든 검증 가능합니다. 우리는 단순히 의견을 전달하는 것에 그치지 않고, 모든 세션에 대해 투명한 감사 추적(Audit Trail)을 유지합니다.</p>
            </div>
          </div>
        </section>

        <section className="w-full max-w-4xl pt-10 pb-20 opacity-[0.05] hover:opacity-100 transition-opacity">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="flex-1 text-left">
              <GeoSummary
                locale="ko"
                summary={[
                  '핵심 리서치: MA, RSI, MACD 다중 타임프레임 추세 공생 관계에 기반한 장 마감 후 분석.',
                  '의사결정 로직: 추론, 맥락 분석, 퀀트 구조적 제약을 분리한 다중 에이전트 시너지 아키텍처.',
                  '리스크 프로토콜: 의사결정 경계를 위한 75% 신뢰도 서킷 브레이커, 기관급 실행 규율 보장.',
                ]}
              />
            </div>
            <div className="flex-1 text-left">
              <SourceBlock
                locale="ko"
                sources={[
                  ...KO_DEFAULT_SOURCES,
                  { name: '제품 포지셔닝', url: 'https://ziso.cc/ko', accessedAt: '2026-03-20' },
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
