'use client';

import { useState, useEffect } from 'react';
import { InviteWall } from '@/components/InviteWall';
import { OnboardingOverlay } from '@/components/onboarding/OnboardingOverlay';
import { getWatchlist } from '@/lib/storage';
import { getCurrentUser } from '@/lib/user';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
import { StockProvider } from '@/context/StockContext';
import { DashboardAuthProvider } from '@/context/DashboardAuthContext';
import { resolveReferralCode } from '@/lib/referral-resolver';
import { SystemSync } from '@/components/SystemSync';
import { PerformanceOptimizer } from '@/components/PerformanceOptimizer';
import { ReferralTracker } from '@/components/ReferralTracker';
import { BadgeManager } from '@/components/BadgeManager';
import { UserProfileProvider, type Tier } from '@/hooks/useUserProfile';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [tier, setTier] = useState<Tier>('free');
  const appBootstrap = (
    <>
      <SystemSync />
      <PerformanceOptimizer />
      <ReferralTracker />
      <BadgeManager />
    </>
  );

  useEffect(() => {
    const checkAuth = async () => {
      const { switches } = MEMBERSHIP_CONFIG;
      
      // 统一通过 getCurrentUser 获取/生成用户 ID
      const currentUser = await getCurrentUser();
      const uid = currentUser.userId;

      // 如果邀请墙关闭，直接放行（公测/正式期）
      if (!switches.requireInvite) {
        setIsAuthorized(true);
        try {
          const res = await fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid, watchlist: getWatchlist() }),
          });
          if (res.ok) {
            const data = await res.json();
            setTier((data.tier || 'free') as Tier);
          }
        } catch (e) {
          console.warn('Tier warmup failed (invite disabled mode):', e);
        }
        return;
      }

      // 邀请墙开启时，检查用户权限
      let referredBy: string | null = null;
      
      // 只有当邀请奖励开关开启时，才处理邀请链接
      if (switches.enableReferralReward) {
        const urlParams = new URLSearchParams(window.location.search);
        let inviteCode = urlParams.get('invite');
        
        // 如果 URL 中有邀请码，优先处理
        if (inviteCode) {
            // A. 如果是别名（不以 user_ 开头），需要先解析
            if (!inviteCode.startsWith('user_')) {
                const resolveData = await resolveReferralCode(inviteCode);
                if (resolveData?.success && resolveData.userId) {
                    inviteCode = resolveData.userId;
                } else {
                    inviteCode = null; // 解析失败，视为无效
                }
            }

            // B. 经过解析或本身是 ID，且不是自己邀请自己
            if (inviteCode && inviteCode !== uid && inviteCode.startsWith('user_')) {
                referredBy = inviteCode;
                localStorage.setItem('STOCKWISE_REFERRED_BY', inviteCode);
                // 清理 URL 参数
                window.history.replaceState({}, '', window.location.pathname);
            }
        } 
        
        // 如果 URL 没有（或解析失败），尝试读取缓存
        if (!referredBy) {
            referredBy = localStorage.getItem('STOCKWISE_REFERRED_BY');
        }
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid, watchlist: getWatchlist(), referredBy }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        setTier((data.tier || 'free') as Tier);
        
        // 只要是 Pro 用户（包括通过邀请获得的试用 Pro），都可进入
        if (data.tier === 'pro') {
          setIsAuthorized(true);
          // 成功授权后清除缓存的邀请信息
          localStorage.removeItem('STOCKWISE_REFERRED_BY');
        } else {
          setIsAuthorized(false);
        }
      } catch (e) {
        console.error('Auth verification failed or timed out', e);
        // 安全降级：如果验证失败或超时，默认不放行（显示邀请墙），确保系统封闭性
        setIsAuthorized(false);
      }
    };
    
    checkAuth();
  }, []);

  // 初始加载状态
  if (isAuthorized === null) {
    return (
      <>
        {appBootstrap}
        <div className="min-h-screen bg-[#050508] flex items-center justify-center text-slate-500 text-xs font-bold tracking-widest animate-pulse">
          系统验证中...
        </div>
      </>
    );
  }

  // 未授权则显示邀请墙（仅在 requireInvite 开启时生效）
  if (isAuthorized === false) {
    return (
      <>
        {appBootstrap}
        <InviteWall onSuccess={() => setIsAuthorized(true)} />
      </>
    );
  }

  // 已授权 → 显示 Onboarding（仅新用户）+ 子页面
  return (
    <>
      {appBootstrap}
      <DashboardAuthProvider tier={tier}>
        <UserProfileProvider>
          <StockProvider>
            <OnboardingOverlay />
            {children}
          </StockProvider>
        </UserProfileProvider>
      </DashboardAuthProvider>
    </>
  );
}
