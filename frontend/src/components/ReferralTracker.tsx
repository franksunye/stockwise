'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import { resolveReferralCode } from '@/lib/referral-resolver';

function ReferralTrackerContent() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const invite = searchParams.get('invite');
    if (invite) {
      // Check if we already have a referrer stored (First-click attribution)
      if (!localStorage.getItem('STOCKWISE_REFERRED_BY')) {
          // Case 1: Standard User ID
          if (invite.startsWith('user_')) {
              localStorage.setItem('STOCKWISE_REFERRED_BY', invite);
              console.log('Referral caught (ID):', invite);
          } 
          // Case 2: Vanity Alias (e.g. "VIP888")
          else {
              // Valid aliases should be reasonably short to avoid DOS
              if (invite.length > 50) return;
              
              resolveReferralCode(invite).then(data => {
                  if (data?.success && data.userId) {
                      localStorage.setItem('STOCKWISE_REFERRED_BY', data.userId);
                      console.log('Referral resolved (Alias):', invite, '->', data.userId);
                  }
              });
          }
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
