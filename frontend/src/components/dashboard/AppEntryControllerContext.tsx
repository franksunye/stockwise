'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export type AppEntryLoadingRoute = 'onboarding' | 'invite-wall' | 'shell';

export interface AppEntryControllerValue {
  canOptimisticallyEnter: boolean;
  hasOptimisticOnboardingCompletion: boolean;
  preferInviteOnboardingLoading: boolean;
  preferInviteWallLoading: boolean;
  loadingRoute: AppEntryLoadingRoute;
}

const AppEntryControllerContext = createContext<AppEntryControllerValue | undefined>(undefined);

export function AppEntryControllerProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AppEntryControllerValue;
}) {
  return (
    <AppEntryControllerContext.Provider value={value}>
      {children}
    </AppEntryControllerContext.Provider>
  );
}

export function useAppEntryController() {
  const context = useContext(AppEntryControllerContext);
  if (!context) {
    throw new Error('useAppEntryController must be used within AppEntryControllerProvider');
  }
  return context;
}
