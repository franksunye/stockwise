'use client';

import { useState, useEffect } from 'react';
import { InviteWall } from '@/components/InviteWall';
import { getWatchlist } from '@/lib/storage';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      let uid = localStorage.getItem('STOCKWISE_USER_ID');
      
      // 注意：ReferralTracker 可能在根布局正在运行
      // 如果没有 UID，尝试等一小会儿，或者直接进入未授权状态
      if (!uid) {
        setIsAuthorized(false);
        return;
      }

      try {
        const referredBy = localStorage.getItem('STOCKWISE_REFERRED_BY');
        const res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid, watchlist: getWatchlist(), referredBy })
        });
        const data = await res.json();
        
        if (data.tier === 'pro') {
          setIsAuthorized(true);
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

  // 未授权则显示邀请墙
  if (isAuthorized === false) {
    return <InviteWall onSuccess={() => setIsAuthorized(true)} />;
  }

  // 已授权则显示子页面
  return <>{children}</>;
}
