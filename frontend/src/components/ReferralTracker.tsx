'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

function ReferralTrackerContent() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const invite = searchParams.get('invite');
    if (invite) {
      // 保存到 sessionStorage，生命周期为当前会话，确保只在首次注册时有效
      // 也可以根据需求选 localStorage
      if (!localStorage.getItem('STOCKWISE_REFERRED_BY')) {
          localStorage.setItem('STOCKWISE_REFERRED_BY', invite);
          console.log('Referral caught:', invite);
      }
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
