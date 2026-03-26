'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
import { InstallGuide } from '@/components/InstallGuide';
import { UserProfileProvider, useUserProfile, type Tier } from '@/hooks/useUserProfile';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { isIOS, isStandalone } from '@/lib/device-utils';
import {
  getOptimisticDashboardBootstrap as getOptimisticDashboardBootstrapState,
  markDashboardSplashSeen,
  readAuthCache,
  readBrowserBootstrapStorageState,
  shouldOptimisticallyEnterDashboard,
  writeAuthCache,
  writeProfileCache,
} from '@/lib/dashboard-bootstrap';

// P1: 用于桥接 Layout 的 profile 响应到 UserProfileProvider 的缓存
// 避免 Provider 再次发起重复的 /api/user/profile 请求
const PROFILE_SYNC_SESSION_KEY = 'last_profile_sync';
const PROFILE_SYNC_IN_FLIGHT_KEY = 'profile_sync_in_flight_v1';

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
    writeProfileCache(profileForCache);
    sessionStorage.setItem(PROFILE_SYNC_SESSION_KEY, String(Date.now()));
  } catch { /* non-critical */ }
}

function DashboardEntryGate({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useUserProfile();
  const [canOptimisticallyEnter, setCanOptimisticallyEnter] = useState(false);

  useLayoutEffect(() => {
    setCanOptimisticallyEnter(
      shouldOptimisticallyEnterDashboard(readBrowserBootstrapStorageState())
    );
  }, []);

  // Block app UI until onboarding status is known to avoid dashboard flash for new users.
  if (loading || !profile) {
    if (canOptimisticallyEnter) {
      return <>{children}</>;
    }

    return (
      <div data-dashboard-skeleton="true">
        <DashboardSkeleton />
      </div>
    );
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
  // 我们以 null 初始化展示 Skeleton，立刻在 useLayoutEffect 中读取缓存"秒开"
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [tier, setTier] = useState<Tier>('free');

  // 返回用户检测：如果 inline boot script 已设置 dashboard-boot-ready，
  // 表示有完整缓存，可以跳过 skeleton→content 的过渡动画。
  const canSkipTransition = useRef(false);

  const appBootstrap = (
    <>
      <SystemSync />
      <ReferralTracker />
      <BadgeManager />
      <InstallGuide />
    </>
  );

  useLayoutEffect(() => {
    // 检测返回用户标记（在 setIsAuthorized 之前设置，确保渲染时可用）
    canSkipTransition.current = document.documentElement.classList.contains('dashboard-boot-ready');

    // 客户端挂载后立即尝试从缓存恢复，实现"秒开"
    const optimisticBootstrap = getOptimisticDashboardBootstrapState(
      readBrowserBootstrapStorageState()
    );
    if (optimisticBootstrap) {
      setIsAuthorized(optimisticBootstrap.authorized);
      setTier(optimisticBootstrap.tier);
    }
  }, []);

  useEffect(() => {
    const cachedAuth = readAuthCache(readBrowserBootstrapStorageState().authCacheRaw);

    const checkAuth = async () => {
      const { switches } = MEMBERSHIP_CONFIG;
      const isReturningUser = !!cachedAuth?.authorized;
      
      // 回访用户已有 session cookie，后台同步即可。
      // 新用户先恢复本地 identity，再在 profile 401 时强制补齐 session。
      let uid = '';
      if (isReturningUser) {
        uid = localStorage.getItem('STOCKWISE_USER_ID') || '';
        getCurrentUser().catch(e => console.warn('Background user sync:', e));
      } else {
        const currentUser = await getCurrentUser({ waitForSessionSync: false });
        uid = currentUser.userId;
      }

      // 如果邀请墙关闭，直接放行（公测/正式期）
      if (!switches.requireInvite) {
        setIsAuthorized(true);
        writeAuthCache('free', true);
        try {
          try {
            sessionStorage.setItem(PROFILE_SYNC_IN_FLIGHT_KEY, '1');
          } catch {
            // 非关键路径，忽略存储异常
          }
          let res = await fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ watchlist: getWatchlist() }),
          });
          if (res.status === 401) {
            await getCurrentUser({ forceSessionSync: true });
            res = await fetch('/api/user/profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ watchlist: getWatchlist() }),
            });
          }
          if (res.ok) {
            const data = await res.json();
            const newTier = (data.tier || 'free') as Tier;
            populateUserProfileCache(data); // P1: 桥接到 UserProfileProvider 缓存
            setTier(newTier);
            writeAuthCache(newTier, true);
          }
        } catch (e) {
          console.warn('Tier warmup failed (invite disabled mode):', e);
        } finally {
          try {
            sessionStorage.removeItem(PROFILE_SYNC_IN_FLIGHT_KEY);
          } catch {
            // ignore
          }
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

        try {
          sessionStorage.setItem(PROFILE_SYNC_IN_FLIGHT_KEY, '1');
        } catch {
          // 非关键路径，忽略存储异常
        }

        let res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ watchlist: getWatchlist(), referredBy }),
          signal: controller.signal
        });
        if (res.status === 401) {
          await getCurrentUser({ forceSessionSync: true });
          res = await fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ watchlist: getWatchlist(), referredBy }),
            signal: controller.signal
          });
        }
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
          writeAuthCache(newTier, true);
          localStorage.removeItem('STOCKWISE_REFERRED_BY');
        } else {
          // 全新 free 用户，或从未成功完成 onboarding 的 free 用户：需要邀请码
          setIsAuthorized(false);
          writeAuthCache(newTier, false);
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
      } finally {
        try {
          sessionStorage.removeItem(PROFILE_SYNC_IN_FLIGHT_KEY);
        } catch {
          // ignore
        }
      }
    };
    
    checkAuth();
  }, []);

  // Dismiss the server-rendered splash once dashboard content is ready.
  // The splash stays visible while React hydrates & resolves auth from cache,
  // then fades out to reveal the actual content underneath.
  // NOTE: We only visually hide here (opacity + pointerEvents). The splash
  // DOM node stays in the tree so React's reconciliation doesn't break.
  // It's invisible and inert, so no UX impact.
  useEffect(() => {
    if (isAuthorized !== null) {
      const splash = document.getElementById('app-splash');
      if (splash) {
        splash.style.opacity = '0';
        splash.style.pointerEvents = 'none';
      }
      // Write a localStorage timestamp so the inline boot script can suppress
      // the splash on subsequent in-app navigations (e.g. sub-page → dashboard).
      // Uses localStorage (not sessionStorage) because iOS standalone WKWebView
      // can silently clear sessionStorage during background/resume cycles.
      // The boot script uses a 2-minute TTL to still show splash on true cold starts.
      try { markDashboardSplashSeen(); } catch { /* non-critical */ }
    }
  }, [isAuthorized]);

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
