'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { PageShell, EN_BOUNDARY_NOTICE, EN_DEFAULT_SOURCES } from './EnLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';

export function EnglishHomePage() {
  return (
    <PageShell currentPage="home">
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40 flex flex-col items-center text-center">
        <div className="space-y-6 max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-black uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            ZISO AI | Post-close market research for serious retail investors
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight">
            AI does the research.
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
              You keep the decision.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            ZISO AI turns post-close market data into a disciplined briefing with key levels, action states, context,
            and risk boundaries, so retail investors can prepare for the next session instead of reacting inside it.
          </p>
          <div className="pt-10 flex flex-col md:flex-row items-center justify-center gap-4">
            <Link
              href="https://app.ziso.cc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-5 rounded-3xl bg-indigo-500 text-white font-black text-lg shadow-[0_20px_40px_rgba(99,102,241,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              Open the App <ChevronRight size={20} />
            </Link>
            <Link href="/pricing" className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-white font-black text-lg hover:bg-white/10 transition-all">
              View Pricing
            </Link>
          </div>
        </div>

        <div className="w-full max-w-5xl relative mt-20">
          <div className="relative h-[500px] md:h-[700px] w-full flex items-center justify-center">
            <div className="absolute left-[5%] md:left-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 -rotate-12 origin-bottom-right hidden sm:flex items-center justify-center p-2 transition-transform hover:-translate-x-2">
              <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                <Image src="/images/landing/analysis-depth.png" alt="AI analysis detail" fill sizes="(min-width: 768px) 25vw, 45vw" className="object-cover" />
              </div>
            </div>

            <div className="absolute right-[5%] md:right-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 rotate-12 origin-bottom-left hidden sm:flex items-center justify-center p-2 transition-transform hover:translate-x-2">
              <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                <Image src="/images/landing/alert-popup.png" alt="Realtime discipline alert" fill sizes="(min-width: 768px) 25vw, 45vw" className="object-cover" />
              </div>
            </div>

            <div className="relative w-[70%] sm:w-[50%] md:w-[32%] aspect-[9/19] bg-[#1A1A25] rounded-[40px] border border-white/20 shadow-[0_0_100px_rgba(99,102,241,0.2)] z-30 flex items-center justify-center p-2 md:p-3 transition-transform hover:scale-[1.02]">
              <div className="w-full h-full bg-[#050508] rounded-[30px] border border-white/10 overflow-hidden relative">
                <Image src="/images/landing/main-dashboard.png" alt="Main dashboard preview" fill priority sizes="(min-width: 1024px) 32vw, (min-width: 640px) 50vw, 70vw" className="object-cover" />
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full border border-white/5 z-20" />
              </div>
            </div>
          </div>

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] -z-10 rounded-full" />
        </div>

        <section id="features" className="pt-48 w-full grid md:grid-cols-2 gap-20 items-center text-left">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em]">
              Build tomorrow&apos;s plan
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              Review when the market is calm.
              <br />
              <span className="text-indigo-400">Write tomorrow&apos;s script before tomorrow arrives.</span>
            </h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              Professional traders are not defined by fast intraday instinct alone. Their real edge comes from the work
              they do after the close. ZISO AI connects market data and news each evening, then turns that into a
              structured decision script. It does not manufacture random predictions. It defines executable boundaries.
            </p>
            <ul className="space-y-4">
              {[
                'Multi-timeframe trend resonance across MA, RSI, and MACD',
                'Price-volume anomaly tracing with contextual explanation',
                'Confidence scoring grounded in historical hit-rate logic',
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
            <Image src="/images/landing/prediction-card-detail.png" alt="Detailed tactical brief" fill className="object-cover opacity-80 hover:opacity-100 transition-opacity duration-700" />
          </div>
        </section>

        <section className="pt-32 w-full grid md:grid-cols-2 gap-20 items-center text-left">
          <div className="order-2 md:order-1 glass-card aspect-square bg-[#0A0A10] rounded-[40px] overflow-hidden border border-white/5 relative">
            <Image src="/images/landing/circuit-breaker-logic.png" alt="Risk circuit breaker logic" fill sizes="(min-width: 768px) 45vw, 100vw" className="object-cover opacity-80 hover:opacity-100 transition-opacity duration-700" />
            <ShieldCheck size={120} className="absolute bottom-4 right-4 opacity-[0.1] text-red-500 pointer-events-none" />
          </div>
          <div className="order-1 md:order-2 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-[0.2em]">
              Risk control system
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              Even in the wildest tape,
              <br />
              <span className="text-red-400">the 75% gate still holds.</span>
            </h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              Understanding the game is not enough. You also need to defend your boundaries. If the system&apos;s confidence
              in the next session falls below 75%, ZISO AI triggers a hard circuit breaker and blocks aggressive action.
              Observe first. Survive first. Not losing discipline is the first rule of staying in the market long enough
              to win anything meaningful.
            </p>
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
              <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                <span className="text-slate-500">AI confidence score</span>
                <span className="text-red-400">Circuit breaker triggered</span>
              </div>
              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full w-[64%] bg-red-500/50" />
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                Current state: no setup, defense mode active
              </p>
            </div>
          </div>
        </section>

        <section className="pt-32 w-full">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              <span className="text-indigo-400">3 steps</span> to a more independent trading system
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-12 text-left">
            {[
              {
                num: '01',
                title: 'Lock your watchlist',
                desc: 'Add the names you care about. The system immediately starts syncing and modeling roughly 250 trading days of history.',
              },
              {
                num: '02',
                title: 'Receive the nightly brief',
                desc: 'Within about 30 minutes after the close, the research assistant delivers a briefing with support, resistance, tactical framing, and decision logic.',
              },
              {
                num: '03',
                title: 'Execute with intraday discipline',
                desc: 'Stop letting random intraday movement dictate the trade. When price reaches the script set the night before, the council helps restore execution discipline.',
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
            <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase mb-2"> Common Questions <span className="text-indigo-500 uppercase">FAQ</span> </h2>
            <p className="text-slate-400 font-medium italic">Deepening your understanding of the ZISO AI methodology</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">What exactly is ZISO AI?</p>
              <p className="text-slate-400 text-sm leading-relaxed">It is a professional research desk that takes over the exhausting market homework. By combining deep historical modeling with a multi-agent reasoning council, it transforms complex market noise into a structured, executable decision script.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">How does the AI reasoning work?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Unlike simple prediction bots, ZISO AI uses a &quot;Council of Agents&quot; architecture. It combines the deep logical reasoning of DeepSeek-R1 with the linguistic nuance of Hunyuan and fixed quant rule engines to ensure every tactical briefing is explainable and grounded in data.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">Why the 75% confidence gate?</p>
              <p className="text-slate-400 text-sm leading-relaxed">We prioritize execution discipline over frequency. If the system&apos;s confidence in a session&apos;s structural setups falls below 75%, it triggers a hard circuit breaker. Survive first, then win. This gate prevents the emotional &quot;over-trading&quot; that traps most retail investors.</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">Are the historical records authentic?</p>
              <p className="text-slate-400 text-sm leading-relaxed">Transparency is our core currency. All nightly briefings and their subsequent outcomes are archived and verifiable within the individual stock files. We don&apos;t just deliver advice; we maintain a full, transparent audit trail for every tactical session.</p>
            </div>
          </div>
        </section>

        <section className="w-full max-w-4xl pt-10 pb-20 opacity-[0.05] hover:opacity-100 transition-opacity text-left">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="flex-1 text-left">
              <GeoSummary
                locale="en"
                summary={[
                  'Core Research: Post-close review focusing on multi-timeframe trend resonance (MA, RSI, MACD).',
                  'Decision Logic: Multi-agent synergy architecture separating reasoning, context analysis, and quant structural constraints.',
                  'Risk Protocol: 75% confidence circuit breaker for decision boundaries, ensuring institutional-grade execution discipline.',
                ]}
              />
            </div>
            <div className="flex-1 text-left">
              <SourceBlock
                locale="en"
                sources={[
                  ...EN_DEFAULT_SOURCES,
                  { name: 'Product Positioning', url: 'https://ziso.cc', accessedAt: '2026-03-15' },
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

// Sub-components like ShieldCheck would need to be imported or redefined.
function ShieldCheck({ size, className }: { size: number; className: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
