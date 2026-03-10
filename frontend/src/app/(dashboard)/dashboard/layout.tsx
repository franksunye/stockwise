'use client';

import { useState, useEffect, useLayoutEffect } from 'react';
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
import { UserProfileProvider, useUserProfile, type Tier } from '@/hooks/useUserProfile';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { isIOS, isStandalone } from '@/lib/device-utils';

// ── 本地 Auth 缓存 ──
// 已验证的 Pro 用户信息缓存在 localStorage 中，
// 实现"打开即用"：不等待网络，先用缓存展示内容。
const AUTH_CACHE_KEY = 'ZISO_AUTH_CACHE_V1';

// P1: 用于桥接 Layout 的 profile 响应到 UserProfileProvider 的缓存
// 避免 Provider 再次发起重复的 /api/user/profile 请求
const USER_PROFILE_CACHE_KEY = 'stockwise_user_profile_v1';
const PROFILE_SYNC_SESSION_KEY = 'last_profile_sync';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function populateUserProfileCache(apiData: any): void {
  try {
    const profileForCache = {
      userId: apiData.userId,
      tier: apiData.tier || 'free',
      expiresAt: apiData.expiresAt,
      watchlistCount: apiData.watchlistCount,
      email: apiData.email,
      referralBalance: apiData.referralBalance,
      totalEarned: apiData.totalEarned,
      commissionRate: apiData.commissionRate,
      hasOnboarded: apiData.hasOnboarded,
      hasStripeCustomer: apiData.hasStripeCustomer,
      isChannel: apiData.isChannel,
      referralAlias: apiData.referralAlias,
      referralCount: apiData.referralCount,
      recentTransactions: apiData.recentTransactions,
    };
    localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(profileForCache));
    sessionStorage.setItem(PROFILE_SYNC_SESSION_KEY, String(Date.now()));
  } catch { /* non-critical */ }
}

function DashboardEntryGate({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useUserProfile();

  // Block app UI until onboarding status is known to avoid dashboard flash for new users.
  if (loading || !profile) {
    return <DashboardSkeleton />;
  }

  if (!profile.hasOnboarded) {
    return <OnboardingOverlay />;
  }

  return (
    <>
      {children}
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── 乐观初始化 ──
  // 避免 React Hydration Mismatch (Error #418)：服务端和客户端初次渲染必须一致
  // 我们以 null 初始化展示 Skeleton，立刻在 useEffect 中读取缓存"秒开"
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [tier, setTier] = useState<Tier>('free');

  const appBootstrap = (
    <>
      <SystemSync />
      <ReferralTracker />
      <BadgeManager />
      <ServiceWorkerRegistrar />
      <InstallGuide />
    </>
  );

  useLayoutEffect(() => {
    // 1. 客户端挂载后立即尝试从缓存恢复，实现"秒开"
    const cachedAuth = getAuthCache();
    if (cachedAuth) {
      setIsAuthorized(cachedAuth.authorized);
      setTier(cachedAuth.tier);
    }
  }, []);

  useEffect(() => {
    const cachedAuth = getAuthCache();

    const checkAuth = async () => {
      const { switches } = MEMBERSHIP_CONFIG;
      const isReturningUser = !!cachedAuth?.authorized;
      
      // P1: 回访用户已有 session cookie，getCurrentUser 可以后台执行不阻塞
      // 新用户必须等待 register 建立 session cookie 后才能调用 profile
      let uid = '';
      if (isReturningUser) {
        uid = localStorage.getItem('STOCKWISE_USER_ID') || '';
        getCurrentUser().catch(e => console.warn('Background user sync:', e));
      } else {
        const currentUser = await getCurrentUser();
        uid = currentUser.userId;
      }

      // 如果邀请墙关闭，直接放行（公测/正式期）
      if (!switches.requireInvite) {
        setIsAuthorized(true);
        setAuthCache('free', true);
        try {
          const res = await fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ watchlist: getWatchlist() }),
          });
          if (res.ok) {
            const data = await res.json();
            const newTier = (data.tier || 'free') as Tier;
            populateUserProfileCache(data); // P1: 桥接到 UserProfileProvider 缓存
            setTier(newTier);
            setAuthCache(newTier, true);
          }
        } catch (e) {
          console.warn('Tier warmup failed (invite disabled mode):', e);
        }
        return;
      }

      // ── 邀请墙开启时 ──
      const hasOptimisticAuth = cachedAuth?.authorized === true;

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
                // iOS Safari -> A2HS 时，桌面容器与浏览器容器可能隔离存储。
                // 保留 invite 参数可让桌面首次打开仍能拿到邀请上下文，避免回到邀请墙。
                if (!isIOS() || isStandalone()) {
                  window.history.replaceState({}, '', window.location.pathname);
                }
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
          body: JSON.stringify({ watchlist: getWatchlist(), referredBy }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        const newTier = (data.tier || 'free') as Tier;
        
        // P1: 桥接到 UserProfileProvider 缓存，消除重复 API 调用
        // 防御性检查：仅在 API 成功时写入，避免错误响应污染缓存
        if (res.ok && data.userId) {
          populateUserProfileCache(data);
        }
        setTier(newTier);
        
        // ── 准入判断 (Gate Check) ──
        // 准入控制 ≠ 会员等级。邀请墙的职责是"第一次进门"的门槛。
        // 未完成 Onboarding 的 Free 用户视为未授权（即从未成功通过门槛）
        // 如果是 Pro（通过邀请/兑换）或已完成 Onboarding（老用户），直接放行
        const isUnauthorizedFreeUser = data.tier === 'free' && !data.hasOnboarded;
        
        if (!isUnauthorizedFreeUser) {
          // 已注册且授权用户（无论是 pro 或者老 free）：放行
          setIsAuthorized(true);
          setAuthCache(newTier, true);
          localStorage.removeItem('STOCKWISE_REFERRED_BY');
        } else {
          // 全新 free 用户，或从未成功完成 onboarding 的 free 用户：需要邀请码
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
  }, []);

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
              // 关键修复：当邀请码成功时，立即更新 tier 并授权进入
              if (newTier) setTier(newTier as Tier);
              setIsAuthorized(true);
            }} />
          </motion.div>
        )}

        {/* 3. 已授权状态 (显示正式内容) */}
        {isAuthorized === true && (
          <motion.div 
            key="dashboard-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
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
