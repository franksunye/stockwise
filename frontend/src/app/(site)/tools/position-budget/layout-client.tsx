'use client';

import type { ReactNode } from 'react';

import { LocaleProvider } from '@/context/LocaleContext';
import type { AppLocale } from '@/lib/i18n';

export function PositionBudgetToolLayoutClient({
  children,
  serverInitialLocale,
}: {
  children: ReactNode;
  serverInitialLocale: AppLocale;
}) {
  return (
    <LocaleProvider profileLocale={null} serverInitialLocale={serverInitialLocale}>
      {children}
    </LocaleProvider>
  );
}
