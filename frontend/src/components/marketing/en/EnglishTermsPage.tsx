'use client';

import { FileText, ShieldCheck } from 'lucide-react';
import { LegalShell, EN_BOUNDARY_NOTICE, EN_DEFAULT_SOURCES } from './EnLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';

export function EnglishTermsPage() {
  return (
    <LegalShell icon={FileText} eyebrow="Terms of Service" title="Terms of Service" updatedAt="January 27, 2026">
      <div className="glass-card p-6 border-amber-500/20 bg-amber-500/[0.02] flex gap-4 items-start text-left">
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

      <section className="pt-8 opacity-[0.05] hover:opacity-100 transition-opacity text-left">
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
