'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { resolveReferralCode } from '@/lib/referral-resolver';

function ReferralTrackerContent() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const invite = searchParams.get('invite');
    if (invite) {
      // 归因逻辑
      const handleAttribution = async () => {
        // Check if we already have a referrer stored (First-click attribution)
        if (!localStorage.getItem('STOCKWISE_REFERRED_BY')) {
            // Case 1: Standard User ID
            if (invite.startsWith('user_')) {
                localStorage.setItem('STOCKWISE_REFERRED_BY', invite);
                console.log('Referral caught (ID):', invite);
            } 
            // Case 2: Vanity Alias (e.g. "VIP888")
            else {
                if (invite.length > 50) return;
                const data = await resolveReferralCode(invite);
                if (data?.success && data.userId) {
                    localStorage.setItem('STOCKWISE_REFERRED_BY', data.userId);
                    console.log('Referral resolved (Alias):', invite, '->', data.userId);
                }
            }
        }
        
        // 关键逻辑：如果是官网主域名，立即清理 URL
        // 如果是 App 子域名，我们交给 DashboardLayout 逻辑去清理，
        // 确保 Auth 流程能读到参数
        const isAppSubdomain = window.location.hostname.startsWith('app.');
        if (!isAppSubdomain) {
            const url = new URL(window.location.href);
            url.searchParams.delete('invite');
            window.history.replaceState({}, '', url.pathname + url.search);
        }
      };

      handleAttribution();
    }
  }, [searchParams]);

  return null;
}

export function ReferralTracker() {
  return (
    <Suspense fallback={null}>
      <ReferralTrackerContent />
    </Suspense>
  );
}
