'use client';

import { useState, useEffect } from 'react';
import { InviteWall } from '@/components/InviteWall';
import { getWatchlist } from '@/lib/storage';
import { getCurrentUser } from '@/lib/user';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { switches } = MEMBERSHIP_CONFIG;
      
      // 统一通过 getCurrentUser 获取/生成用户 ID
      const currentUser = await getCurrentUser();
      const uid = currentUser.userId;

      // 如果邀请墙关闭，直接放行（公测/正式期）
      if (!switches.requireInvite) {
        setIsAuthorized(true);
        return;
      }

      // 邀请墙开启时，检查用户权限
      let referredBy: string | null = null;
      
      // 只有当邀请奖励开关开启时，才处理邀请链接
      if (switches.enableReferralReward) {
        const urlParams = new URLSearchParams(window.location.search);
        const inviteFromUrl = urlParams.get('invite');
        
        // 优先使用 URL 参数，其次使用 localStorage 缓存
        referredBy = inviteFromUrl || localStorage.getItem('STOCKWISE_REFERRED_BY');
        
        // 如果是通过邀请链接进入，缓存邀请人 ID 并清理 URL 参数
        if (inviteFromUrl && inviteFromUrl !== uid) {
          localStorage.setItem('STOCKWISE_REFERRED_BY', inviteFromUrl);
          // 清理 URL 参数，避免分享时暴露
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      try {
        const res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid, watchlist: getWatchlist(), referredBy })
        });
        const data = await res.json();
        
        // 只要是 Pro 用户（包括通过邀请获得的试用 Pro），都可进入
        if (data.tier === 'pro') {
          setIsAuthorized(true);
          // 成功授权后清除缓存的邀请信息
          localStorage.removeItem('STOCKWISE_REFERRED_BY');
        } else {
          setIsAuthorized(false);
        }
      } catch (e) {
        console.error('Auth verification failed', e);
        setIsAuthorized(false);
      }
    };
    
    checkAuth();
  }, []);

  // 初始加载状态
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center text-slate-500 text-xs font-bold tracking-widest animate-pulse">
        系统验证中...
      </div>
    );
  }

  // 未授权则显示邀请墙（仅在 requireInvite 开启时生效）
  if (isAuthorized === false) {
    return <InviteWall onSuccess={() => setIsAuthorized(true)} />;
  }

  // 已授权则显示子页面
  return <>{children}</>;
}
