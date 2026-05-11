import type { ReactNode } from 'react';

import { DEFAULT_APP_LOCALE } from '@/lib/i18n';

import { PositionBudgetToolLayoutClient } from './layout-client';

export default function PositionBudgetToolLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#050508]">
      <PositionBudgetToolLayoutClient serverInitialLocale={DEFAULT_APP_LOCALE}>
        {children}
      </PositionBudgetToolLayoutClient>
    </div>
  );
}
