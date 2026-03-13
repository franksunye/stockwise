import Link from 'next/link';
import { ArrowLeft, ChevronRight, Check, FileText, RefreshCcw, Shield, Sparkles, Target, Users } from 'lucide-react';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingHeader from '@/components/MarketingHeader';
import { pricingPlans } from '@/lib/pricing-data';

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
    </div>
  );
}

export function EnglishHomePage() {
  return (
    <PageShell currentPage="home">
      <main className="relative z-10 mx-auto flex max-w-6xl flex-col gap-24 px-8 pb-32 pt-10">
        <section className="grid gap-12 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
              <Sparkles size={12} />
              Public English Rollout
            </div>
            <h1 className="text-5xl font-black tracking-tight md:text-7xl">
              AI does the research.
              <br />
              <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">
                You keep the decision.
              </span>
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              ZISO AI is a post-close research workflow for serious retail investors. It turns market noise into a
              disciplined briefing with key levels, context, risk boundaries, and execution language.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="https://app.ziso.cc"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-3xl bg-indigo-500 px-8 py-4 text-lg font-black text-white shadow-[0_20px_40px_rgba(99,102,241,0.3)] transition-all hover:scale-[1.02]"
              >
                Open the App
                <ChevronRight size={20} />
              </Link>
              <Link
                href="/en/learn"
                className="inline-flex items-center justify-center rounded-3xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-black text-white transition-all hover:bg-white/10"
              >
                Explore Learn
              </Link>
            </div>
          </div>

          <div className="rounded-[40px] border border-white/10 bg-white/[0.03] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-300">What you actually get</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-white">A trading briefing, not a hype feed</h2>
              </div>
              <ul className="space-y-4 text-sm leading-7 text-slate-300">
                <li className="flex gap-3"><Check size={16} className="mt-1 text-emerald-400" /> Post-close tactical brief with support, resistance, and invalidation levels</li>
                <li className="flex gap-3"><Check size={16} className="mt-1 text-emerald-400" /> AI council view for cross-model agreement and disagreement</li>
                <li className="flex gap-3"><Check size={16} className="mt-1 text-emerald-400" /> Risk-first execution language: enter, observe, defend, or no setup</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="features" className="grid gap-8 md:grid-cols-3">
          {[
            {
              icon: Target,
              title: 'Daily tactical brief',
              desc: 'A concise after-hours plan with key levels, tactical scenarios, and invalidation boundaries.',
            },
            {
              icon: Users,
              title: 'Council-style review',
              desc: 'Multiple analytical seats surface agreement, disagreement, and the dominant action bias.',
            },
            {
              icon: Shield,
              title: 'Risk-first discipline',
              desc: 'If confidence is weak, the system defaults to observe or no setup instead of forcing action.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-[32px] border border-white/5 bg-white/[0.02] p-8">
              <item.icon className="text-indigo-400" size={28} />
              <h3 className="mt-6 text-2xl font-black tracking-tight">{item.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-400">{item.desc}</p>
            </div>
          ))}
        </section>

        <section id="faq" className="rounded-[40px] border border-white/5 bg-white/[0.02] p-8 md:p-12">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">FAQ</p>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-xl font-black">Is this an automated trading product?</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                No. ZISO AI is a research and decision-support workflow. It helps you prepare and execute with more
                structure, but the trade remains your responsibility.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-black">Which markets does it cover today?</h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                Today the product is optimized for China and Hong Kong equities. This English surface exists to prepare
                international SEO/GEO infrastructure ahead of future market expansion.
              </p>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}

export function EnglishAboutPage() {
  return (
    <PageShell currentPage="about">
      <main className="relative z-10 mx-auto max-w-5xl px-8 pb-32 pt-16">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
            <Sparkles size={12} />
            About ZISO AI
          </div>
          <h1 className="text-4xl font-black tracking-tight md:text-6xl">
            Institutional research discipline,
            <br />
            <span className="text-indigo-400">adapted for serious retail investors.</span>
          </h1>
          <p className="max-w-3xl text-lg leading-8 text-slate-300">
            ZISO AI was built around one principle: ordinary investors should have access to structured post-close
            research, not just intraday noise, chat-room sentiment, and improvised decision-making.
          </p>
        </div>

        <section className="mt-20 grid gap-8 md:grid-cols-3">
          {[
            {
              title: 'Mission',
              desc: 'Replace impulsive trading habits with a repeatable research routine that improves consistency.',
            },
            {
              title: 'Method',
              desc: 'Blend analysis models, quant rules, and execution discipline into a single user-facing workflow.',
            },
            {
              title: 'Boundary',
              desc: 'We do not sell certainty. We build structured judgment, risk boundaries, and better preparation.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-[32px] border border-white/5 bg-white/[0.02] p-8">
              <h2 className="text-2xl font-black tracking-tight">{item.title}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-20 rounded-[40px] border border-white/5 bg-white/[0.02] p-8 md:p-12">
          <h2 className="text-3xl font-black tracking-tight">How the product is structured</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-300">Research lead</p>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                The product direction is governed as a research workflow first, not as an engagement-first media app.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-300">Analytical layer</p>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                AI-generated interpretation provides readable reasoning, but quant logic remains the structural base.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-300">Execution boundary</p>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                Final actions are framed as disciplined states: enter, observe, defend, or no setup.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-20 text-center">
          <Link
            href="https://app.ziso.cc"
            className="inline-flex items-center gap-2 rounded-3xl bg-indigo-500 px-8 py-4 text-lg font-black text-white transition-all hover:scale-[1.02]"
          >
            Open App
            <ChevronRight size={20} />
          </Link>
        </section>
      </main>
    </PageShell>
  );
}

export function EnglishPricingPage() {
  const englishPlans = [
    {
      enName: 'Free',
      price: '0',
      period: 'forever',
      description: 'For investors exploring AI-assisted market review for the first time.',
      features: [
        'Rule-based market signal layer',
        'Daily market recap',
        'Market almanac and macro mood card',
        '3 AI stock checks per day',
        'Community access',
      ],
    },
    {
      enName: 'Pro',
      price: '29.9',
      period: 'per month / ¥299 yearly',
      description: 'For investors who want deeper nightly research and a more disciplined execution layer.',
      features: [
        'DeepSeek reasoning layer',
        'Coach-style tactical briefs',
        '10 fully monitored watchlist names',
        'Key level and sentiment unlocks',
        'Realtime discipline alerts on major setup changes',
        'Pro identity badge',
      ],
    },
    {
      enName: 'Alpha',
      price: '1,999',
      period: 'per year',
      description: 'For advanced workflows that need higher-touch support and deeper monitoring.',
      features: [
        'Intraday event analysis',
        'Dedicated strategy dashboard',
        'Automated deep-dive reports',
        'API-level raw data access',
        'Priority support',
      ],
    },
  ] as const;

  const englishComparison = [
    { label: 'AI reasoning depth', free: 'Rule engine + basic AI', pro: 'Deep reasoning layer', highlight: true },
    { label: 'Briefing style', free: 'Basic recap', pro: 'Coach-style narrative and attribution', highlight: true },
    { label: 'Watchlist capacity', free: '3 names', pro: '10 names', highlight: true },
    { label: 'Market coverage', free: 'China + Hong Kong equities', pro: 'China + Hong Kong equities', highlight: false },
    { label: 'Realtime discipline alerts', free: 'No', pro: 'Yes, for major setup changes', highlight: true },
    { label: 'Data rhythm', free: 'Post-close', pro: 'Post-close + selective realtime alerts', highlight: false },
  ] as const;

  return (
    <PageShell currentPage="pricing">
      <main className="relative z-10 mx-auto max-w-6xl px-8 pb-32 pt-12">
        <div className="text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-300">Pricing</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">Hire a research workflow, not just another app.</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-slate-300">
            The subscription pays for research depth, coverage, and execution discipline. It is designed for investors
            who want a stable nightly routine instead of reactive decision-making.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {pricingPlans.map((plan, index) => (
            <div
              key={plan.enName}
              className={`rounded-[36px] border p-8 ${
                plan.highlight ? 'border-indigo-500/30 bg-indigo-500/10' : 'border-white/5 bg-white/[0.02]'
              }`}
            >
              <plan.icon className={plan.highlight ? 'text-indigo-300' : 'text-slate-300'} size={28} />
              <h2 className="mt-6 text-3xl font-black tracking-tight">{plan.enName}</h2>
              <p className="mt-2 text-sm text-slate-400">{englishPlans[index].description}</p>
              <div className="mt-8 flex items-end gap-2">
                <span className="text-sm font-bold">¥</span>
                <span className="text-5xl font-black">{englishPlans[index].price}</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">{englishPlans[index].period}</p>
              <ul className="mt-8 space-y-3 text-sm leading-7 text-slate-300">
                {englishPlans[index].features.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <Check size={16} className="mt-1 text-emerald-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href || 'https://app.ziso.cc'}
                target={plan.href?.startsWith('mailto:') ? undefined : '_blank'}
                rel={plan.href?.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black ${
                  plan.highlight ? 'bg-indigo-500 text-white' : 'border border-white/10 bg-white/5 text-white'
                }`}
              >
                {plan.cta || 'Open App'}
                <ChevronRight size={16} />
              </Link>
            </div>
          ))}
        </div>

        <section className="mt-20 rounded-[40px] border border-white/5 bg-white/[0.02] p-8 md:p-12">
          <h2 className="text-3xl font-black tracking-tight">Feature depth</h2>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="py-4 text-slate-500">Capability</th>
                  <th className="py-4 text-slate-300">Free</th>
                  <th className="py-4 text-indigo-300">Pro</th>
                </tr>
              </thead>
              <tbody>
                {englishComparison.map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.03]">
                    <td className="py-4 text-slate-400">{row.label}</td>
                    <td className="py-4 text-slate-500">{row.free}</td>
                    <td className={`py-4 ${row.highlight ? 'font-black text-indigo-100' : 'text-slate-300'}`}>{row.pro}</td>
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
      <main className="relative z-10 mx-auto max-w-3xl px-8 pb-28 pt-16">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-300">
            <Icon size={12} />
            {eyebrow}
          </div>
          <h1 className="text-4xl font-black tracking-tight md:text-5xl">{title}</h1>
          <p className="text-sm text-slate-500">Last updated: {updatedAt}</p>
        </div>

        <div className="mt-10 rounded-[36px] border border-white/5 bg-white/[0.02] p-8 md:p-12">{children}</div>

        <div className="mt-10">
          <Link href="/en" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white">
            <ArrowLeft size={16} />
            Back to English home
          </Link>
        </div>
      </main>
    </PageShell>
  );
}

export function EnglishPrivacyPage() {
  return (
    <LegalShell icon={Shield} eyebrow="Privacy Policy" title="Privacy Policy" updatedAt="January 27, 2026">
      <div className="space-y-8 text-sm leading-7 text-slate-300">
        <section>
          <h2 className="text-xl font-black text-white">1. What we collect</h2>
          <p className="mt-3">We only collect the information required to provide the service: account identity, watchlist preferences, notification settings, and billing state handled through Stripe.</p>
        </section>
        <section>
          <h2 className="text-xl font-black text-white">2. How we use it</h2>
          <p className="mt-3">The data is used to maintain your account, personalize research delivery, support subscription flows, and improve system reliability.</p>
        </section>
        <section>
          <h2 className="text-xl font-black text-white">3. Payment boundary</h2>
          <p className="mt-3">ZISO AI does not store raw card details. Payment processing is handled through Stripe.</p>
        </section>
        <section>
          <h2 className="text-xl font-black text-white">4. Contact</h2>
          <p className="mt-3">For privacy-related questions, contact <span className="font-black text-indigo-300">support@ziso.cc</span>.</p>
        </section>
      </div>
    </LegalShell>
  );
}

export function EnglishTermsPage() {
  return (
    <LegalShell icon={FileText} eyebrow="Terms of Service" title="Terms of Service" updatedAt="January 27, 2026">
      <div className="space-y-8 text-sm leading-7 text-slate-300">
        <section>
          <h2 className="text-xl font-black text-white">1. Service scope</h2>
          <p className="mt-3">ZISO AI provides AI-assisted market analysis, briefings, and research workflows. It does not provide individualized investment advice.</p>
        </section>
        <section>
          <h2 className="text-xl font-black text-white">2. User responsibility</h2>
          <p className="mt-3">You remain fully responsible for your own trading decisions, account activity, and any market actions taken based on the service.</p>
        </section>
        <section>
          <h2 className="text-xl font-black text-white">3. Subscription</h2>
          <p className="mt-3">Paid plans renew automatically unless canceled before the billing cycle ends, subject to the applicable billing provider terms.</p>
        </section>
        <section>
          <h2 className="text-xl font-black text-white">4. Liability boundary</h2>
          <p className="mt-3">To the maximum extent permitted by law, ZISO AI is not liable for profits or losses resulting from trades made using the service content.</p>
        </section>
      </div>
    </LegalShell>
  );
}

export function EnglishRefundPage() {
  return (
    <LegalShell icon={RefreshCcw} eyebrow="Refund Policy" title="Refund Policy" updatedAt="January 27, 2026">
      <div className="space-y-8 text-sm leading-7 text-slate-300">
        <section>
          <h2 className="text-xl font-black text-white">1. Cooling-off window</h2>
          <p className="mt-3">First-time Pro subscribers may request a full refund within 48 hours of the initial purchase if the service is not a fit.</p>
        </section>
        <section>
          <h2 className="text-xl font-black text-white">2. How to request</h2>
          <p className="mt-3">Email <span className="font-black text-indigo-300">support@ziso.cc</span> with the subject line <span className="font-black text-white">[Refund Request]</span> plus your account email.</p>
        </section>
        <section>
          <h2 className="text-xl font-black text-white">3. Processing time</h2>
          <p className="mt-3">Approved refunds are returned through Stripe to the original payment method. Banking timelines vary by provider.</p>
        </section>
      </div>
    </LegalShell>
  );
}
