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
import { ReferralTracker } from '@/components/ReferralTracker';
import { BadgeManager } from '@/components/BadgeManager';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import { InstallGuide } from '@/components/InstallGuide';
import { UserProfileProvider, type Tier } from '@/hooks/useUserProfile';

// ── 本地 Auth 缓存 ──
// 已验证的 Pro 用户信息缓存在 localStorage 中，
// 实现"打开即用"：不等待网络，先用缓存展示内容。
const AUTH_CACHE_KEY = 'ZISO_AUTH_CACHE_V1';
interface AuthCache {
  tier: Tier;
  authorized: boolean;
  timestamp: number;
}

function getAuthCache(): AuthCache | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const cache: AuthCache = JSON.parse(raw);
    // 缓存有效期 7 天（足够长以保证离线体验，足够短以限制安全风险）
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - cache.timestamp > MAX_AGE) {
      localStorage.removeItem(AUTH_CACHE_KEY);
      return null;
    }
    return cache;
  } catch {
    return null;
  }
}

function setAuthCache(tier: Tier, authorized: boolean): void {
  try {
    const cache: AuthCache = { tier, authorized, timestamp: Date.now() };
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage may be full — non-critical
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── 乐观初始化 ──
  // 如果本地有 auth 缓存，直接用缓存值启动（秒开）。
  // 如果没有缓存，才显示"验证中"加载状态。
  const cachedAuth = typeof window !== 'undefined' ? getAuthCache() : null;

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(
    cachedAuth?.authorized ?? null
  );
  const [tier, setTier] = useState<Tier>(cachedAuth?.tier ?? 'free');

  const appBootstrap = (
    <>
      <SystemSync />
      <ReferralTracker />
      <BadgeManager />
      <ServiceWorkerRegistrar />
      <InstallGuide />
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
        setAuthCache('free', true);
        try {
          const res = await fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid, watchlist: getWatchlist() }),
          });
          if (res.ok) {
            const data = await res.json();
            const newTier = (data.tier || 'free') as Tier;
            setTier(newTier);
            setAuthCache(newTier, true);
          }
        } catch (e) {
          console.warn('Tier warmup failed (invite disabled mode):', e);
        }
        return;
      }

      // ── 邀请墙开启时 ──
      // 即使开着邀请墙，如果本地有可信的缓存（已通过验证），
      // 也先展示内容（用缓存的 tier），然后后台静默验证。
      // 这消除了"系统验证中"的加载闪屏。
      const hasOptimisticAuth = cachedAuth?.authorized === true;
      if (hasOptimisticAuth && isAuthorized === null) {
        // 已由 useState 初始化处理
      }

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
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid, watchlist: getWatchlist(), referredBy }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        const newTier = (data.tier || 'free') as Tier;
        setTier(newTier);
        
        // 只要是 Pro 用户（包括通过邀请获得的试用 Pro），都可进入
        if (data.tier === 'pro') {
          setIsAuthorized(true);
          setAuthCache(newTier, true);
          // 成功授权后清除缓存的邀请信息
          localStorage.removeItem('STOCKWISE_REFERRED_BY');
        } else {
          setIsAuthorized(false);
          setAuthCache(newTier, false);
        }
      } catch (e) {
        console.error('Auth verification failed or timed out', e);
        // ── 优雅降级 ──
        // 如果有本地 auth 缓存（之前验证过的 Pro 用户），网络失败时继续使用
        // 只有从未验证过的用户才会被阻塞
        if (hasOptimisticAuth) {
          console.log('Auth network failed, using cached authorization');
          // isAuthorized 和 tier 已经由初始化设置好了，无需额外操作
        } else {
          setIsAuthorized(false);
        }
      }
    };
    
    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 初始加载状态 — 仅在没有缓存时显示
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
