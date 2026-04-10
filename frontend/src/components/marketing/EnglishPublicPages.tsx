'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  PartyPopper,
  RefreshCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingHeader from '@/components/MarketingHeader';
import Multiavatar from '@/components/Multiavatar';
import { BoundaryNotice, GeoSummary, SourceBlock } from '@/components/seo/GeoBlocks';
import { FocusedImageSlider } from './FocusedImageSlider';

const EN_FOUNDERS = [
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

const EN_AGENT_TEAM = [
  {
    name: 'Gu Shen (DeepSeek)',
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

const EN_TACTICAL_SLIDES = [
  { src: '/images/landing/4-tactical-protocols.en.png', alt: 'Tactical protocols detail', objectPosition: 'center 60%' },
  { src: '/images/landing/4-tactical-protocols-2.en.png', alt: 'Tactical protocols detail 2', objectPosition: 'center 60%' },
  { src: '/images/landing/4-tactical-protocols-3.en.png', alt: 'Tactical protocols detail 3', objectPosition: 'center 60%' },
  { src: '/images/landing/4-tactical-protocols-4.en.png', alt: 'Tactical protocols detail 4', objectPosition: 'center 60%' },
  { src: '/images/landing/2-main-dashboard.en.png', alt: 'Main dashboard panel', objectPosition: 'center 40%' },
] as const;

const EN_TRANSPARENCY_SLIDES = [
  { src: '/images/landing/5-transparency.en.png', alt: 'Risk circuit breaker logic', objectPosition: 'center bottom' },
  { src: '/images/landing/1-logical-trace.en.png', alt: 'Logical trace panel', objectPosition: 'center 20%' },
] as const;

const EN_DEFAULT_SOURCES = [
  { name: 'ZISO AI Research Center', url: 'https://ziso.cc/learn' },
  { name: 'ZISO AI Help Center', url: 'https://ziso.cc/support' },
] as const;

const EN_BOUNDARY_NOTICE =
  'All content is provided for research and informational purposes only. Nothing on this site constitutes investment advice or a promise of returns.';

function PageShell({
  currentPage,
  children,
}: {
  currentPage: 'home' | 'about' | 'pricing';
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

const EN_PRICING_PLANS = [
  {
    name: 'Free',
    eyebrow: 'Starter access',
    price: '0',
    period: 'Forever',
    description: 'For investors exploring AI-assisted market review for the first time.',
    features: [
      'Rule-based trend signal layer',
      'Daily market recap',
      'Market almanac and macro mood card',
      '3 AI stock checks per day',
      'Community access',
    ],
    cta: 'Start Free',
    href: 'https://app.ziso.cc',
    highlight: false,
    accent: 'text-slate-300',
  },
  {
    name: 'Pro',
    eyebrow: 'Core product',
    price: '29.9',
    period: 'Per month / ¥299 yearly',
    description: 'For investors who want deeper nightly research and stronger execution discipline.',
    features: [
      'DeepSeek reasoning layer',
      'Coach-style tactical briefs',
      '10 fully monitored watchlist names',
      'Key levels and sentiment unlocks',
      'Realtime discipline alerts on major setup changes',
      'Pro identity badge',
    ],
    cta: 'Open App',
    href: 'https://app.ziso.cc',
    highlight: true,
    accent: 'text-indigo-300',
  },
  {
    name: 'Alpha',
    eyebrow: 'High-touch workflow',
    price: '1,999',
    period: 'Per year',
    description: 'For advanced users who need deeper monitoring and priority support.',
    features: [
      'Intraday event analysis',
      'Dedicated strategy dashboard',
      'Automated deep-dive reports',
      'API-level raw data access',
      'Priority support',
    ],
    cta: 'Contact Support',
    href: 'mailto:hi@ziso.cc',
    highlight: false,
    accent: 'text-emerald-300',
  },
] as const;

const EN_FEATURE_COMPARISON = [
  { label: 'AI reasoning depth', free: 'Rule engine + basic AI', pro: 'Deep reasoning layer', highlight: true },
  { label: 'Briefing style', free: 'Basic recap', pro: 'Coach-style narrative and attribution', highlight: true },
  { label: 'Watchlist capacity', free: '3 names', pro: '10 names', highlight: true },
  { label: 'Market coverage', free: 'China + Hong Kong equities', pro: 'China + Hong Kong equities', highlight: false },
  { label: 'Realtime discipline alerts', free: 'No', pro: 'Yes, for major setup changes', highlight: true },
  { label: 'Data rhythm', free: 'Post-close', pro: 'Post-close + selective realtime alerts', highlight: false },
] as const;

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
            <Link href="/en/pricing" className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-white font-black text-lg hover:bg-white/10 transition-all">
              View Pricing
            </Link>
          </div>
        </div>

        <div className="w-full max-w-5xl relative mt-20">
          <div className="relative h-[500px] md:h-[700px] w-full flex items-center justify-center">
            <div className="absolute left-[5%] md:left-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 -rotate-12 origin-bottom-right hidden sm:flex items-center justify-center p-2 transition-transform hover:-translate-x-2">
              <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                <Image src="/images/landing/1-logical-trace.en.png" alt="AI analysis detail" fill sizes="(min-width: 768px) 25vw, 45vw" className="object-cover" />
              </div>
            </div>

            <div className="absolute right-[5%] md:right-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 rotate-12 origin-bottom-left hidden sm:flex items-center justify-center p-2 transition-transform hover:translate-x-2">
              <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                <Image src="/images/landing/3-user-center.en.png" alt="Realtime discipline alert" fill sizes="(min-width: 768px) 25vw, 45vw" className="object-cover" />
              </div>
            </div>

            <div className="relative w-[70%] sm:w-[50%] md:w-[32%] aspect-[9/19] bg-[#1A1A25] rounded-[40px] border border-white/20 shadow-[0_0_100px_rgba(99,102,241,0.2)] z-30 flex items-center justify-center p-2 md:p-3 transition-transform hover:scale-[1.02]">
              <div className="w-full h-full bg-[#050508] rounded-[30px] border border-white/10 overflow-hidden relative">
                <Image src="/images/landing/2-main-dashboard.en.png" alt="Main dashboard preview" fill priority sizes="(min-width: 1024px) 32vw, (min-width: 640px) 50vw, 70vw" className="object-cover" />
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
          <FocusedImageSlider slides={[...EN_TACTICAL_SLIDES]} />
        </section>

        <section className="pt-32 w-full grid md:grid-cols-2 gap-20 items-center text-left">
          <div className="order-2 md:order-1 relative">
            <FocusedImageSlider slides={[...EN_TRANSPARENCY_SLIDES]} />
            <ShieldCheck size={120} className="absolute bottom-4 right-4 opacity-[0.1] text-red-500 pointer-events-none" />
          </div>
          <div className="order-1 md:order-2 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em]">
              Transparency Protocol
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              Transparency is the
              <br />
              <span className="text-indigo-400">ultimate trading discipline.</span>
            </h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              Remove emotional interference by understanding the &quot;how&quot; and &quot;why&quot; behind each signal. ZISO
              Go provides a <strong>Logical Trace</strong>, a <strong>Rationale Audit</strong>, and <strong>Intervention Protocols</strong> for every
              setup, ensuring your execution is rooted in objective reasoning.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {[
                { title: 'Logical Trace', desc: 'Step-by-step reasoning chain' },
                { title: 'Rationale Audit', desc: 'Critical risk reflection & audit' },
                { title: 'Intervention Protocols', desc: 'Conflict resolution & decision scripts' },
              ].map((pillar) => (
                <div key={pillar.title} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">{pillar.title}</div>
                    <div className="text-xs text-slate-500 font-medium">{pillar.desc}</div>
                  </div>
                  <div className="px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-bold text-indigo-400 uppercase tracking-tighter">
                    Unlocked in Go
                  </div>
                </div>
              ))}
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

        <section className="pt-32 w-full grid md:grid-cols-3 gap-8 text-left">
          {[
            {
              icon: Target,
              title: 'Daily tactical brief',
              desc: 'A post-close plan with key levels, tactical scenarios, and invalidation boundaries.',
            },
            {
              icon: Users,
              title: 'Council-style review',
              desc: 'Multiple analytical seats surface agreement, disagreement, and the dominant action bias.',
            },
            {
              icon: ShieldCheck,
              title: 'Risk-first discipline',
              desc: 'If confidence is weak, the system defaults to observe or no setup instead of forcing action.',
            },
          ].map((item) => (
            <div key={item.title} className="glass-card p-10 space-y-6 border-white/5">
              <item.icon className="text-indigo-400 w-8 h-8" />
              <h3 className="text-xl font-black">{item.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="pt-32 w-full space-y-16">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
              The operating team
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              Guided by founders,
              <br />
              <span className="text-indigo-400">delivered like a research desk.</span>
            </h2>
            <p className="text-slate-500 font-medium max-w-3xl mx-auto">
              Two founders define the boundary and research direction. The visible analyst seats explain the setup,
              the quant layer maintains structural judgment, and the workflow automation keeps the nightly routine
              consistent.
            </p>
            <Link
              href="/en/about"
              className="inline-flex items-center gap-2 text-sm font-bold text-indigo-300 hover:text-indigo-200 transition-colors"
            >
              Meet the team and operating model <ChevronRight size={16} />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {EN_FOUNDERS.map((founder) => (
              <div key={founder.name} className="glass-card p-8 border-white/10 bg-white/[0.02] space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">{founder.label}</p>
                <h3 className="text-2xl font-black">{founder.name}</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">{founder.description}</p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {EN_AGENT_TEAM.map((agent) => (
              <div
                key={agent.name}
                className={`glass-card p-6 border ${agent.borderColor} ${agent.bgColor} relative overflow-hidden group lg:min-h-[360px]`}
              >
                <div className="flex flex-col items-center text-center space-y-4 relative z-10">
                  <div className="w-20 h-20 rounded-full bg-white/5 ring-1 ring-white/10 overflow-hidden relative mb-2 grayscale group-hover:grayscale-0 transition-all duration-500">
                    <Multiavatar
                      name={agent.avatarSeed}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div>
                    <h3 className={`font-black text-lg ${agent.textColor}`}>{agent.name}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">{agent.role}</p>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed font-bold">{agent.description}</p>
                </div>
                <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-[40px] opacity-20 transition-opacity group-hover:opacity-40 ${agent.glowColor}`} />
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-600 font-bold">
            On the surface, users interact with a research team. Underneath, analysis models, quant models, and
            automation are doing the heavy lifting.
          </p>
        </section>

        <section id="faq" className="pt-24 w-full max-w-4xl text-left">
          <div className="text-center mb-12">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">FAQ</p>
            <h2 className="mt-4 text-3xl md:text-5xl font-black tracking-tighter">What the product is, and what it is not.</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                q: 'Is this an automated trading product?',
                a: 'No. ZISO AI is a research and decision-support workflow. It helps you prepare and execute with more structure, but the trade remains your responsibility.',
              },
              {
                q: 'Which markets does it cover today?',
                a: 'Today the product is optimized for China and Hong Kong equities. The English website exists so search engines and AI systems can understand the product, positioning, and public-facing policies.',
              },
              {
                q: 'Why focus on post-close research?',
                a: 'Because most retail mistakes happen inside intraday noise. A calmer review cycle produces better preparation and more consistent execution.',
              },
              {
                q: 'Does the product promise returns?',
                a: 'No. The system is built to improve research discipline, not to guarantee outcomes or remove market risk.',
              },
            ].map((item) => (
              <div key={item.q} className="rounded-[32px] border border-white/5 bg-white/[0.02] p-8">
                <h3 className="text-xl font-black">{item.q}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-400">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-20 w-full max-w-4xl text-center space-y-10 border-b border-white/5">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight">
            Ready to let <span className="text-indigo-400">ZISO AI</span>
            <br className="hidden md:block" />
            do the market homework with you?
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <Link
              href="https://app.ziso.cc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-12 py-6 rounded-3xl bg-indigo-500 text-white font-black text-xl shadow-[0_20px_40px_rgba(99,102,241,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
              Open the App <ChevronRight size={24} />
            </Link>
          </div>
        </section>

        <section className="w-full max-w-4xl pt-10 pb-20 opacity-[0.25] hover:opacity-100 transition-opacity">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="flex-1 text-left">
              <GeoSummary
                locale="en"
                summary={[
                  'ZISO AI is focused on post-close research and next-session preparation for China and Hong Kong equities.',
                  'The workflow centers on tactical briefs, key levels, council-style review, and explicit risk boundaries.',
                  'The product is presented as research support, not as a promise of profits or automated trading.',
                ]}
              />
            </div>
            <div className="flex-1 text-left">
              <SourceBlock
                locale="en"
                sources={[
                  ...EN_DEFAULT_SOURCES,
                  { name: 'Product Positioning', url: 'https://ziso.cc', accessedAt: '2026-03-13' },
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

export function EnglishAboutPage() {
  return (
    <PageShell currentPage="about">
      <main className="relative z-10 max-w-5xl mx-auto px-8 pt-20 pb-32">
        <div className="space-y-8 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest">
            <Sparkles size={12} /> About ZISO AI
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
            Institutional research discipline,
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
              adapted for serious retail investors.
            </span>
          </h1>
          <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-3xl">
            ZISO AI is a pocket research partner and a practical execution coach. It takes over the exhausting market
            homework and helps investors see the deeper logic behind each decision.
          </p>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 max-w-3xl">
            Front-stage service by a research team, back-stage powered by analysis models, quant models, and automated workflow.
          </p>
        </div>

        <section className="pt-24 grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <Target className="text-indigo-400" />
            </div>
            <h2 className="text-3xl font-black tracking-tighter">Our mission</h2>
            <p className="text-slate-400 leading-relaxed font-bold">
              ZISO AI was built around a direct goal: <span className="text-white">help ordinary investors operate with institutional-grade research discipline.</span>
            </p>
            <p className="text-slate-500 text-sm leading-relaxed">
              Retail investors are usually trapped by fragmented information, time-poor review habits, and reactive
              decision-making. ZISO AI uses multiple cooperating agents to process daily market inputs, structure the
              review cycle, and help users leave behind gut-feel trading in favor of calmer, more defensible decisions.
            </p>
          </div>
          <div className="glass-card p-1 relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 rounded-[38px] blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="bg-[#0a0a0f] rounded-[38px] p-8 relative z-10 space-y-4">
              <div className="text-indigo-300 font-black text-xl leading-tight">
                &ldquo;See what is visible. Guard what must remain disciplined.&rdquo;
              </div>
              <p className="text-slate-500 text-sm text-justify leading-relaxed">
                That is the spirit behind the name ZISO. The first part is the deep research work that helps investors
                see market structure more clearly. The second part is the enduring discipline that protects capital when
                certainty is weak. Understand the game, but hold the line. That is what makes rational execution possible.
              </p>
            </div>
          </div>
        </section>

        <section className="pt-24 space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-black tracking-tighter">Team and operating structure</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-sm">
              We separate research direction, analysis expression, quant engineering, context intelligence, and result
              auditing into clear roles, then deliver the experience as if a research desk were working alongside the user.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {EN_FOUNDERS.map((founder) => (
              <div key={founder.name} className="glass-card p-8 space-y-4 border-white/10 bg-white/[0.02]">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">{founder.label}</div>
                <h3 className="text-2xl font-black">{founder.name}</h3>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">{founder.description}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {EN_AGENT_TEAM.map((member) => (
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

          <div className="grid md:grid-cols-3 gap-4 text-left">
            <div className="glass-card p-6 space-y-3 border-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Research direction</p>
              <p className="text-sm text-slate-400 leading-relaxed">The product is governed as a research workflow first, with clear boundary-setting around what is signal, what is noise, and what should remain uncertain.</p>
            </div>
            <div className="glass-card p-6 space-y-3 border-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Analysis layer</p>
              <p className="text-sm text-slate-400 leading-relaxed">Readable AI interpretation sits above the quant base, so investors can understand the structure before they decide how to act.</p>
            </div>
            <div className="glass-card p-6 space-y-3 border-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Execution discipline</p>
              <p className="text-sm text-slate-400 leading-relaxed">The system expresses decisions in explicit states such as enter, observe, defend, or no setup, to reduce ambiguity at execution time.</p>
            </div>
          </div>
        </section>

        <section className="pt-20 grid md:grid-cols-3 gap-8">
          {[
            {
              icon: ShieldCheck,
              title: 'Deep review assistant',
              desc: 'The system scans broad market inputs and turns noisy chart behavior into a structured nightly research workflow.',
            },
            {
              icon: Users,
              title: 'Execution decision partner',
              desc: 'The product does not just list signals. It interprets the setup, explains the logic, and helps users act with more clarity.',
            },
            {
              icon: Sparkles,
              title: 'Rational risk guardrail',
              desc: 'In moments of excitement or confusion, the system keeps a colder line. It does not promise miracles. It protects discipline.',
            },
          ].map((value) => (
            <div key={value.title} className="glass-card p-10 space-y-6 border-white/5">
              <value.icon className="text-indigo-400 w-8 h-8" />
              <h3 className="text-xl font-black">{value.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{value.desc}</p>
            </div>
          ))}
        </section>

        <section className="pt-32 text-center space-y-12 border-b border-white/5 pb-32">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight">
            Stop trading alone.
            <br />
            <span className="text-indigo-400">Turn on AI-enhanced decision support.</span>
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="https://app.ziso.cc"
              className="px-10 py-5 rounded-3xl bg-indigo-500 text-white font-black shadow-lg hover:scale-105 transition-all"
            >
              Open the App
            </Link>
            <Link
              href="/en"
              className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-slate-400 font-black hover:text-white transition-all flex items-center gap-2"
            >
              <ArrowLeft size={18} /> Back to Home
            </Link>
          </div>
        </section>
      </main>
    </PageShell>
  );
}

export function EnglishPricingPage() {
  return (
    <PageShell currentPage="pricing">
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40">
        <div className="text-center space-y-4 mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            Structured pricing for disciplined investors
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
            Appoint your own
            <br />
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">ZISO research council.</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium max-w-3xl mx-auto leading-relaxed mt-6">
            A subscription here is not just buying features. It is closer to hiring a round-the-clock research council.
            The product is designed to reduce emotional interference, strengthen your nightly review habit, and make
            decision-making calmer, cleaner, and more consistent.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-20">
          {EN_PRICING_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`glass-card p-8 flex flex-col relative overflow-hidden ${
                plan.highlight ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-white/5'
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-5 right-[-35px] rotate-45 bg-indigo-600 text-white text-[10px] font-black px-10 py-1 uppercase tracking-tighter">
                  Core plan
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
            <h2 className="text-3xl font-black tracking-tighter">Feature depth comparison</h2>
            <p className="text-slate-500 text-sm mt-2">A clearer view of what changes when you move from exploration to disciplined daily use.</p>
          </div>

          <div className="glass-card overflow-hidden border-white/5 bg-white/[0.01]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="py-6 px-8 text-sm font-black uppercase tracking-widest text-slate-500">Capability</th>
                  <th className="py-6 px-8 text-sm font-black text-slate-300">Free</th>
                  <th className="py-6 px-8 text-sm font-black text-indigo-300">Pro</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {EN_FEATURE_COMPARISON.map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                    <td className="py-5 px-8 text-slate-400 font-bold">{row.label}</td>
                    <td className="py-5 px-8 text-slate-500">{row.free}</td>
                    <td className={`py-5 px-8 ${row.highlight ? 'text-indigo-100 font-black' : 'text-slate-300'}`}>{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-24">
          <div className="glass-card p-1 border-white/10 bg-gradient-to-r from-indigo-500/20 via-cyan-500/10 to-transparent">
            <div className="bg-[#0a0a0e] rounded-[38px] p-8 md:p-12 flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4">
                  <Zap size={12} className="fill-current" />
                  <span>Manual support channel</span>
                </div>
                <h2 className="text-3xl font-black tracking-tighter mb-4 text-white">
                  Payment problem?
                  <br className="md:hidden" />
                  <span className="text-slate-500">Talk to support directly.</span>
                </h2>
                <p className="text-slate-400 font-medium leading-relaxed max-w-lg mb-6">
                  If Stripe is unavailable, your card is unsupported, or you need manual onboarding, contact support
                  directly and we will help you activate access.
                </p>
                <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
                  <span className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /> Fast response</span>
                  <span className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /> Manual onboarding</span>
                  <span className="flex items-center gap-2"><Check size={14} className="text-emerald-500" /> Business support</span>
                </div>
              </div>

              <div className="relative group">
                <div className="absolute inset-0 bg-indigo-500 blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity rounded-full" />
                <div className="relative z-10 p-4 bg-white rounded-3xl shadow-2xl shadow-indigo-500/20 transform group-hover:scale-105 transition-transform duration-300">
                  <Image src="/support-qr.png" alt="Support QR code" width={180} height={180} className="rounded-xl" />
                  <div className="mt-3 text-center">
                    <p className="text-[#050508] font-black text-xs tracking-widest uppercase">SCAN TO CHAT</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="text-center">
          <h2 className="text-3xl font-black tracking-tighter mb-12">Why ZISO AI?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6">
              <h4 className="text-white font-bold mb-3">Knows equities better than generic AI</h4>
              <p className="text-slate-500 text-sm font-medium">The workflow is tuned for China and Hong Kong equity logic instead of broad, generic finance prompts.</p>
            </div>
            <div className="p-6">
              <h4 className="text-white font-bold mb-3">Explains narrative, not just numbers</h4>
              <p className="text-slate-500 text-sm font-medium">The product does not dump cold indicators. It translates price behavior into reasoning that ordinary investors can actually follow.</p>
            </div>
            <div className="p-6">
              <h4 className="text-white font-bold mb-3">Aggressive value for depth delivered</h4>
              <p className="text-slate-500 text-sm font-medium">The pricing is intentionally kept far below traditional research terminals so serious retail investors can realistically use it every day.</p>
            </div>
          </div>
        </section>

        <section className="py-20 w-full max-w-4xl text-center space-y-10 border-b border-white/5 mx-auto">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight">
            Ready to bring more structure
            <br className="hidden md:block" />
            into your nightly research routine?
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <Link
              href="https://app.ziso.cc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-12 py-6 rounded-3xl bg-indigo-500 text-white font-black text-xl shadow-[0_20px_40px_rgba(99,102,241,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
              Open the App <ChevronRight size={24} />
            </Link>
          </div>
        </section>

        <section className="w-full max-w-4xl pt-10 pb-20 opacity-[0.25] hover:opacity-100 transition-opacity mx-auto">
          <div className="flex flex-col md:flex-row gap-8 mb-6">
            <div className="flex-1 text-left">
              <GeoSummary
                locale="en"
                summary={[
                  'The pricing structure is designed around research depth, watchlist coverage, and execution discipline.',
                  'Free is intended for exploration, while Pro unlocks the fuller reasoning and monitoring workflow.',
                  'Pricing content is explanatory only and does not create any guarantee of returns.',
                ]}
              />
            </div>
            <div className="flex-1 text-left">
              <SourceBlock
                locale="en"
                sources={[
                  ...EN_DEFAULT_SOURCES,
                  { name: 'Pricing Policy', url: 'https://ziso.cc/pricing', accessedAt: '2026-03-13' },
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

function LegalShell({
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

        <div className="glass-card p-8 md:p-12 space-y-8 border-white/5 bg-white/[0.01] mt-10">
          {children}
        </div>

        <div className="mt-10">
          <Link href="/en" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={16} /> Back to English home
          </Link>
        </div>
      </main>
    </PageShell>
  );
}

export function EnglishPrivacyPage() {
  return (
    <LegalShell icon={Shield} eyebrow="Privacy Policy" title="Privacy Policy" updatedAt="January 27, 2026">
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">1. Information we collect</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          We only collect the information required to provide the service:
        </p>
        <ul className="list-disc list-inside ml-2 space-y-2 text-sm text-slate-400 leading-relaxed">
          <li>Account information, including the email address used to register and sign in.</li>
          <li>Preference settings such as your watchlist and notification choices.</li>
          <li>Payment state needed for subscription access. Stripe handles the payment transaction itself, and ZISO AI does not store raw card numbers or card security codes.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">2. How we use it</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          The information is used to maintain your account, deliver personalized research briefs, provide customer
          support, and improve product reliability. We do not sell or rent personal data to third parties.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">3. Data security</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          We apply industry-standard encryption and security controls to protect user data. No internet transmission can
          be guaranteed to be completely risk-free, so users should also protect their own login credentials.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">4. Cookies and session state</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          We use necessary cookies and session storage to maintain sign-in state and basic website performance.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">5. Contact</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          For privacy-related questions, contact <span className="text-indigo-300 font-bold">support@ziso.cc</span>.
        </p>
      </section>

      <section className="pt-6 opacity-30 hover:opacity-100 transition-opacity">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1 text-left">
            <GeoSummary
              locale="en"
              summary={[
                'ZISO AI collects only the operational data required to run accounts, watchlists, billing, and notification settings.',
                'Stripe handles raw payment processing, while ZISO AI avoids storing sensitive card information.',
                'The privacy boundary is centered on service delivery rather than behavioral data resale.',
              ]}
            />
          </div>
          <div className="flex-1 text-left">
            <SourceBlock
              locale="en"
              sources={[
                ...EN_DEFAULT_SOURCES,
                { name: 'Privacy Compliance', url: 'https://ziso.cc/privacy', accessedAt: '2026-03-13' },
              ]}
            />
          </div>
        </div>
        <BoundaryNotice locale="en" text={EN_BOUNDARY_NOTICE} />
      </section>
    </LegalShell>
  );
}

export function EnglishTermsPage() {
  return (
    <LegalShell icon={FileText} eyebrow="Terms of Service" title="Terms of Service" updatedAt="January 27, 2026">
      <div className="glass-card p-6 border-amber-500/20 bg-amber-500/[0.02] flex gap-4 items-start">
        <ShieldCheck className="text-amber-400 shrink-0 mt-1" size={20} />
        <div className="text-sm text-amber-100/80 leading-relaxed font-medium">
          Important notice: all forecasts, analysis, and reports provided by ZISO AI are generated with AI assistance
          for informational reference only. Nothing on this site constitutes investment advice, financial
          advice, or legal advice. Market risk remains your own responsibility.
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">1. Service scope</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          ZISO AI provides AI-assisted market analysis, briefing summaries, and alert workflows. Users acknowledge the
          limitations of AI-generated content and the uncertainty inherent in market forecasts.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">2. User responsibility</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          You are responsible for activity conducted through your account. If you discover unauthorized use, you should
          notify us promptly.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">3. Subscription</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          Pro access is subscription-based. Unless canceled before the billing cycle ends, the subscription renews
          automatically in accordance with the applicable payment provider terms.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">4. Prohibited use</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          You may not scrape the service, misuse platform information for unlawful securities activity, or engage in
          insider trading or other prohibited conduct using the site.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">5. Liability boundary</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          To the maximum extent permitted by law, ZISO AI is not liable for profits or losses resulting from trades made
          using the service content.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">6. Contact</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          For legal and terms-related questions, contact <span className="text-indigo-300 font-bold">support@ziso.cc</span>.
        </p>
      </section>

      <section className="pt-6 opacity-30 hover:opacity-100 transition-opacity">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1 text-left">
            <GeoSummary
              locale="en"
              summary={[
                'ZISO AI provides AI-assisted market analysis for informational and research-support purposes only.',
                'Users remain fully responsible for trading decisions and the legal consequences of market actions.',
                'The service emphasizes transparent analysis boundaries rather than individualized investment advice.',
              ]}
            />
          </div>
          <div className="flex-1 text-left">
            <SourceBlock
              locale="en"
              sources={[
                ...EN_DEFAULT_SOURCES,
                { name: 'Legal & Terms', url: 'https://ziso.cc/terms', accessedAt: '2026-03-13' },
              ]}
            />
          </div>
        </div>
        <BoundaryNotice locale="en" text={EN_BOUNDARY_NOTICE} />
      </section>
    </LegalShell>
  );
}

export function EnglishRefundPage() {
  return (
    <LegalShell icon={RefreshCcw} eyebrow="Refund Policy" title="Refund Policy" updatedAt="January 27, 2026">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-6 border-indigo-500/20 bg-indigo-500/[0.05] space-y-3">
          <PartyPopper className="text-indigo-300" size={24} />
          <h3 className="font-bold text-white">48-hour cooling-off window</h3>
          <p className="text-slate-400 text-xs leading-relaxed">First-time Pro subscribers may request a full refund within 48 hours of the initial purchase if the service is not a fit.</p>
        </div>
        <div className="glass-card p-6 border-white/5 bg-white/[0.02] space-y-3">
          <RefreshCcw className="text-slate-400" size={24} />
          <h3 className="font-bold text-white">Cancel anytime</h3>
          <p className="text-slate-400 text-xs leading-relaxed">You may cancel renewal at any time. Access remains active until the end of the current billing period.</p>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">1. Eligibility</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          The full refund guarantee applies only to first-time subscribers and only when the request is submitted within
          48 hours of purchase.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">2. How to request</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          To request a refund, email <span className="text-indigo-300 font-bold">support@ziso.cc</span> with the subject line
          <span className="text-white font-bold"> [Refund Request]</span> and include your account email. Requests are
          typically reviewed within 1 to 3 business days.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">3. Processing time</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          Approved refunds are returned through Stripe to the original payment method. Final arrival time depends on the
          banking provider and usually takes several business days to settle.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">4. Exceptions</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          Accounts suspended for abuse or misuse of the service are not eligible for refunds.
        </p>
      </section>

      <section className="pt-6 opacity-30 hover:opacity-100 transition-opacity">
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-1 text-left">
            <GeoSummary
              locale="en"
              summary={[
                'ZISO AI offers a 48-hour refund window for first-time Pro subscribers only.',
                'Approved refunds are processed back through Stripe to the original payment method.',
                'Refund policy does not apply to accounts suspended for abuse or misuse of the service.',
              ]}
            />
          </div>
          <div className="flex-1 text-left">
            <SourceBlock
              locale="en"
              sources={[
                ...EN_DEFAULT_SOURCES,
                { name: 'Refund Policy', url: 'https://ziso.cc/refund', accessedAt: '2026-03-13' },
              ]}
            />
          </div>
        </div>
        <BoundaryNotice locale="en" text={EN_BOUNDARY_NOTICE} />
      </section>
    </LegalShell>
  );
}
