'use client';

import { useCallback, useLayoutEffect, useState } from 'react';
import { InviteWall } from '@/components/InviteWall';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { SystemSync } from '@/components/SystemSync';
import { ReferralTracker } from '@/components/ReferralTracker';
import { BadgeManager } from '@/components/BadgeManager';
import { useDashboardAuthorization } from '@/hooks/useDashboardAuthorization';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { AppEntryLoading } from '@/components/dashboard/AppEntryLoading';
import {
    installLegacyProfileCacheWriteGuard,
    LEGACY_DASHBOARD_CACHE_PREFIX,
    purgeLegacyDashboardCache,
    purgeLegacyUserProfileCache,
    LEGACY_PROFILE_CACHE_KEY,
    getAppEntryControllerSnapshot,
    readBrowserBootstrapStorageState,
} from '@/lib/dashboard-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [appEntryController, setAppEntryController] = useState(() =>
    getAppEntryControllerSnapshot({}, ''),
  );
  const { isAuthorized, setIsAuthorized, userSession, refreshProfile, canSkipTransition } =
    useDashboardAuthorization();

  const updateAppEntryController = useCallback(() => {
    setAppEntryController(
      getAppEntryControllerSnapshot(readBrowserBootstrapStorageState(), window.location.search),
    );
  }, []);

  useLayoutEffect(() => {
    installLegacyProfileCacheWriteGuard();
    purgeLegacyDashboardCache();
    purgeLegacyUserProfileCache();
    const onPageShow = () => {
      purgeLegacyDashboardCache();
      purgeLegacyUserProfileCache();
      updateAppEntryController();
    };
    const onStorage = (ev: StorageEvent) => {
      if ((ev.key && ev.key.startsWith(LEGACY_DASHBOARD_CACHE_PREFIX)) || (ev.key === LEGACY_PROFILE_CACHE_KEY && ev.newValue)) {
        purgeLegacyDashboardCache();
      }
      if (ev.key === LEGACY_PROFILE_CACHE_KEY && ev.newValue) {
        purgeLegacyUserProfileCache();
      }
      updateAppEntryController();
    };
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('storage', onStorage);
    window.addEventListener('stockwise-onboarding-complete', updateAppEntryController);
    updateAppEntryController();
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('stockwise-onboarding-complete', updateAppEntryController);
    };
  }, [updateAppEntryController]);

  const appBootstrap = (
    <>
      <SystemSync />
      <ReferralTracker />
      <BadgeManager />
    </>
  );

  return (
    <div className="bg-[#050508] min-h-screen overflow-hidden">
      {appBootstrap}
      
      <AnimatePresence initial={false}>
        {/* 1. 初始加载状态 或 验证状态 (显示骨架屏) */}
        {isAuthorized === null && (
          <motion.div 
            key="skeleton"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            data-dashboard-skeleton="true"
          >
            {appEntryController.loadingRoute === 'onboarding' ? (
              <AppEntryLoading route="onboarding" />
            ) : (
              <DashboardSkeleton />
            )}
          </motion.div>
        )}

        {/* 2. 未授权状态 (显示邀请墙) */}
        {isAuthorized === false && (
          <motion.div 
            key="invite-wall"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <InviteWall
              onSuccess={() => {
                setIsAuthorized(true);
                void refreshProfile({ force: true });
              }}
            />
          </motion.div>
        )}

        {/* 3. 已授权状态 (显示正式内容)
             返回用户 (canSkipTransition): 跳过 fade-in 动画，内容直接可见。
             Splash 在上层遮罩并渐隐，提供流畅品牌过渡。 */}
        {isAuthorized === true && (
          <motion.div 
            key="dashboard-content"
            data-dashboard-content="true"
            initial={canSkipTransition.current ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: canSkipTransition.current ? 0 : 0.4 }}
          >
            <DashboardShell
              userSession={userSession}
              appEntryController={appEntryController}
              isAuthorized={isAuthorized}
            >
              {children}
            </DashboardShell>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
