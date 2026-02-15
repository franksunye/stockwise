'use client';

import { createContext, useContext } from 'react';
import type { Tier } from '@/hooks/useUserProfile';

interface DashboardAuthContextType {
  tier: Tier;
}

const DashboardAuthContext = createContext<DashboardAuthContextType>({ tier: 'free' });

export function DashboardAuthProvider({
  tier,
  children,
}: {
  tier: Tier;
  children: React.ReactNode;
}) {
  return (
    <DashboardAuthContext.Provider value={{ tier }}>
      {children}
    </DashboardAuthContext.Provider>
  );
}

export function useDashboardAuth() {
  return useContext(DashboardAuthContext);
}

