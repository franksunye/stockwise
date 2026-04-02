'use client';

import { Sparkles, Target, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Multiavatar from '@/components/Multiavatar';
import { PageShell, EN_FOUNDERS, EN_AGENT_TEAM, EN_BOUNDARY_NOTICE, EN_DEFAULT_SOURCES } from './EnLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';

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
              href="/"
              className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-slate-400 font-black hover:text-white transition-all flex items-center gap-2"
            >
              <ArrowLeft size={18} /> Back to Home
            </Link>
          </div>
        </section>

        <section className="w-full pt-10 pb-20 opacity-[0.05] hover:opacity-100 transition-opacity text-left">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="flex-1 text-left">
              <GeoSummary
                locale="en"
                summary={[
                  'Mission: Democratize institutional-grade market research for retail investors via a multi-agent AI council.',
                  'Roles: DeepSeek-R1 (Tactical reasoning), Hunyuan (Contextual mapping), Quant Engine (Structural rules), Verifier (Outcome auditing).',
                  'Methodology: Separation of concerns ensures that analysis, risk oversight, and historical auditing remain independent and accountable.',
                ]}
              />
            </div>
            <div className="flex-1 text-left">
              <SourceBlock
                locale="en"
                sources={[
                  ...EN_DEFAULT_SOURCES,
                  { name: 'Mission & Team', url: 'https://ziso.cc/about', accessedAt: '2026-03-15' },
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
