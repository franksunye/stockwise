'use client';

import { InviteWall } from '@/components/InviteWall';
import { DashboardEntryGate } from '@/components/dashboard/DashboardEntryGate';
import { StockProvider } from '@/context/StockContext';
import { DashboardAuthProvider } from '@/context/DashboardAuthContext';
import { SystemSync } from '@/components/SystemSync';
import { ReferralTracker } from '@/components/ReferralTracker';
import { BadgeManager } from '@/components/BadgeManager';
import { InstallGuide } from '@/components/InstallGuide';
import { UserProfileProvider, type Tier } from '@/hooks/useUserProfile';
import { useDashboardAuthorization } from '@/hooks/useDashboardAuthorization';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthorized, setIsAuthorized, tier, setTier, canSkipTransition } = useDashboardAuthorization();

  const appBootstrap = (
    <>
      <SystemSync />
      <ReferralTracker />
      <BadgeManager />
      <InstallGuide />
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
            <DashboardSkeleton />
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
            <InviteWall onSuccess={(newTier) => {
              if (newTier) setTier(newTier as Tier);
              setIsAuthorized(true);
            }} />
          </motion.div>
        )}

        {/* 3. 已授权状态 (显示正式内容)
             返回用户 (canSkipTransition): 跳过 fade-in 动画，内容直接可见。
             Splash 在上层遮罩并渐隐，提供流畅品牌过渡。 */}
        {isAuthorized === true && (
          <motion.div 
            key="dashboard-content"
            initial={canSkipTransition.current ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: canSkipTransition.current ? 0 : 0.4 }}
          >
            <DashboardAuthProvider tier={tier}>
              <UserProfileProvider>
                <StockProvider>
                  <DashboardEntryGate>
                    {children}
                  </DashboardEntryGate>
                </StockProvider>
              </UserProfileProvider>
            </DashboardAuthProvider>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
