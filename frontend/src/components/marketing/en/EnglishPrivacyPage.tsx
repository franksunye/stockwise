'use client';

import { Shield } from 'lucide-react';
import { LegalShell, EN_BOUNDARY_NOTICE, EN_DEFAULT_SOURCES } from './EnLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';

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

      <section className="pt-6 opacity-30 hover:opacity-100 transition-opacity text-left">
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
