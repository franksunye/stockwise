'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Activity, Beaker, ChevronRight, FlaskConical } from 'lucide-react';
import { PageShell } from './EnLayout';
import { JsonLd } from '@/components/seo/JsonLd';
import { useAnalytics } from '@/hooks/useAnalytics';

const paperLabCases = [
  {
    ticker: 'NVDA',
    thesis: 'Track whether AI infrastructure demand can keep the trend intact after a post-earnings volatility reset.',
    entryDate: 'Lab entry: 2026-05-06',
    status: 'Thesis intact',
    risk: 'Invalidation if price loses the prior support shelf and volume expands on the breakdown.',
    cadence: 'Reviewed after each US close',
  },
  {
    ticker: 'MSFT',
    thesis: 'Observe whether cloud and AI margin strength can defend a slower but higher-quality compounder profile.',
    entryDate: 'Lab entry: 2026-05-07',
    status: 'Waiting for confirmation',
    risk: 'Risk rises if the stock fails to reclaim its tactical anchor after two review cycles.',
    cadence: 'Reviewed twice per week',
  },
  {
    ticker: 'TSLA',
    thesis: 'Use a simulated plan to separate narrative volatility from an actual structure recovery attempt.',
    entryDate: 'Lab entry: 2026-05-08',
    status: 'High-volatility watch',
    risk: 'No conviction increase until price action confirms above resistance with cleaner volume.',
    cadence: 'Reviewed after major signal changes',
  },
] as const;

const paperLabLogs = [
  {
    agent: 'ZISO Council',
    tag: 'Post-close review',
    time: 'Session 0.1 / 21:10 ET',
    message: 'NVDA thesis remains intact, but conviction is capped until support holds through the next review cycle.',
    ticker: 'NVDA',
  },
  {
    agent: 'Risk Desk',
    tag: 'Boundary check',
    time: 'Session 0.1 / 21:14 ET',
    message: 'MSFT stays in confirmation mode. No simulated size increase until price reclaims the tactical anchor.',
    ticker: 'MSFT',
  },
  {
    agent: 'Thesis Log',
    tag: 'Volatility note',
    time: 'Session 0.1 / 21:18 ET',
    message: 'TSLA remains high-volatility. The lab records the setup but does not treat narrative movement as confirmation.',
    ticker: 'TSLA',
  },
] as const;

export function EnglishPaperPortfolioLabPage() {
  const { trackEvent } = useAnalytics();
  const [selectedPaperCase, setSelectedPaperCase] = useState<(typeof paperLabCases)[number]['ticker']>('NVDA');
  const viewTrackedRef = useRef(false);
  const activePaperCase = paperLabCases.find((item) => item.ticker === selectedPaperCase) ?? paperLabCases[0];

  useEffect(() => {
    if (viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    trackEvent('paper_lab_view', {
      surface: 'paper_portfolio_lab_page',
      phase: 'phase_0_1',
    });
  }, [trackEvent]);

  const handlePaperCaseOpen = (ticker: (typeof paperLabCases)[number]['ticker']) => {
    setSelectedPaperCase(ticker);
    trackEvent('paper_lab_case_open', {
      ticker,
      surface: 'paper_portfolio_lab_page',
      phase: 'phase_0_1',
    });
  };

  const handlePaperLabCta = (cta: 'join_beta' | 'follow_experiment') => {
    trackEvent('paper_lab_cta_click', {
      cta,
      surface: 'paper_portfolio_lab_page',
      phase: 'phase_0_1',
    });
  };

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Paper Portfolio Lab',
    description:
      'A simulated paper portfolio lab for tracking AI-generated investment theses, risk boundaries, and review notes before real capital is involved.',
  };

  return (
    <PageShell currentPage="home">
      <JsonLd data={schema} />
      <main className="relative z-10 mx-auto flex max-w-7xl flex-col px-6 pb-28 pt-14 md:px-8 md:pt-20">
        <section className="grid gap-10 text-left lg:grid-cols-[0.72fr_1fr] lg:items-end">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-cyan-300">
              <FlaskConical size={13} />
              Season 0 / Simulated only
            </div>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-tighter md:text-7xl">
                Paper Portfolio Lab
                <br />
                <span className="text-cyan-300">for AI thesis tracking.</span>
              </h1>
              <p className="max-w-2xl text-lg font-medium leading-relaxed text-slate-400">
                Follow a public, simulated lab for AI-generated investment theses. The goal is to observe entries, risk boundaries, thesis changes, and review notes before real capital is involved.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="mailto:hi@ziso.cc?subject=Paper%20Portfolio%20Lab%20Beta"
                onClick={() => handlePaperLabCta('join_beta')}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-7 py-4 text-sm font-black text-black transition-all hover:bg-cyan-400 active:scale-95"
              >
                Join the paper trading beta <ChevronRight size={18} />
              </Link>
              <Link
                href="mailto:hi@ziso.cc?subject=Follow%20Paper%20Portfolio%20Lab"
                onClick={() => handlePaperLabCta('follow_experiment')}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-7 py-4 text-sm font-black text-white transition-all hover:bg-white/[0.06] active:scale-95"
              >
                Follow the experiment
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['3', 'active theses'],
              ['0', 'real orders'],
              ['weekly', 'review loop'],
              ['No P&L', 'shown in phase 0.1'],
            ].map(([value, label]) => (
              <div key={label} className="border border-white/10 bg-black/20 p-4">
                <div className="text-2xl font-black text-white">{value}</div>
                <div className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 border-y border-white/10 bg-white/[0.015]" aria-labelledby="paper-lab-console-heading">
          <div className="grid grid-cols-2 border-b border-white/10 text-xs font-black uppercase tracking-[0.16em] text-slate-300 md:grid-cols-[1.1fr_repeat(5,minmax(92px,0.35fr))]">
            <div className="col-span-2 flex items-center gap-2 border-b border-white/10 px-4 py-3 text-cyan-300 md:col-span-1 md:border-b-0 md:border-r">
              <Beaker size={14} />
              Paper Portfolio Lab
            </div>
            {['Season 0', 'Simulated', 'No P&L', 'NVDA', 'MSFT'].map((item) => (
              <div key={item} className="border-r border-white/10 px-4 py-3 last:border-r-0">
                {item}
              </div>
            ))}
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.08fr_0.9fr]">
            <div className="border-b border-white/10 p-5 md:p-7 lg:border-b-0 lg:border-r">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Thesis Board</p>
                  <h2 id="paper-lab-console-heading" className="mt-2 text-2xl font-black tracking-normal text-white md:text-3xl">
                    Thesis discipline without execution.
                  </h2>
                </div>
              </div>

              <div className="grid gap-3">
                {paperLabCases.map((item) => (
                  <button
                    key={item.ticker}
                    type="button"
                    onClick={() => handlePaperCaseOpen(item.ticker)}
                    className={`grid gap-3 border p-4 text-left transition-all md:grid-cols-[96px_1fr] ${
                      selectedPaperCase === item.ticker
                        ? 'border-cyan-400/40 bg-cyan-400/10 text-white'
                        : 'border-white/5 bg-black/20 text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <div>
                      <span className="block text-xl font-black tracking-tight">{item.ticker}</span>
                      <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.16em] opacity-60">{item.status}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-snug text-slate-100 md:text-base">{item.thesis}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        <span>{item.entryDate}</span>
                        <span>{item.cadence}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 border-t border-white/10 pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
                    Selected: {activePaperCase.ticker}
                  </span>
                  <span className="bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                    {activePaperCase.status}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  <span className="font-black uppercase tracking-[0.14em] text-rose-300">Risk boundary: </span>
                  {activePaperCase.risk}
                </p>
              </div>
            </div>

            <div className="p-5 md:p-7">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">AI Thesis Log</p>
                  <h2 className="mt-2 text-2xl font-black tracking-normal text-white md:text-3xl">Model notes, never trade calls.</h2>
                </div>
                <Activity className="text-cyan-300" size={26} />
              </div>
              <div className="space-y-3">
                {paperLabLogs.map((log) => (
                  <div key={`${log.agent}-${log.time}`} className="border border-white/5 bg-black/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-black uppercase tracking-tight text-white">{log.agent}</div>
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">{log.ticker}</div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                      <span>{log.tag}</span>
                      <span>{log.time}</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{log.message}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-amber-500/10 pt-4 text-xs font-medium leading-relaxed text-amber-100/60">
                Paper trading is simulated and for education only. It does not reflect actual investment results and does not guarantee future outcomes. ZISO AI is not financial advice.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 border-b border-white/10 py-12 text-left md:grid-cols-3">
          {[
            ['What this is', 'A public experiment for observing how AI-generated investment theses evolve through review cycles.'],
            ['What this is not', 'It is not a brokerage connection, copy-trading product, managed account, or promised return engine.'],
            ['Why now', 'It lets us test demand for trade planning and thesis tracking before committing to user-level trade management.'],
          ].map(([title, body]) => (
            <div key={title} className="border border-white/5 bg-white/[0.02] p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.14em] text-cyan-300">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </PageShell>
  );
}
