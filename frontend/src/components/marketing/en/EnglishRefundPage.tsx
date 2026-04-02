'use client';

import { RefreshCcw, PartyPopper } from 'lucide-react';
import { LegalShell, EN_BOUNDARY_NOTICE, EN_DEFAULT_SOURCES } from './EnLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';

export function EnglishRefundPage() {
  return (
    <LegalShell icon={RefreshCcw} eyebrow="Refund Policy" title="Refund Policy" updatedAt="January 27, 2026">
      <div className="grid md:grid-cols-2 gap-6 text-left">
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
        <p className="text-slate-400 leading-relaxed text-sm text-left">
          The full refund guarantee applies only to first-time subscribers and only when the request is submitted within
          48 hours of purchase.
        </p>
      </section>

      <section className="pt-6 opacity-[0.05] hover:opacity-100 transition-opacity text-left">
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
