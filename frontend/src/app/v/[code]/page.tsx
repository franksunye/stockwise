
'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { resolveReferralCode } from '@/lib/referral-resolver';

/**
 * ZISO Referral Gateway (/v/[code])
 * A premium, clean URL handler for invitations.
 * Example: ziso.cc/v/QUANT_CLUB
 */
export default function ReferralGateway() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  useEffect(() => {
    if (!code) {
      router.replace('/');
      return;
    }

    async function handleAttribution() {
      let inviteId: string | null = null;
      try {
        console.log(`🚀 ZISO Attribution Gateway: Resolving ${code}...`);
        
        // 1. Is it a direct ID? (Fallback support)
        if (code.startsWith('user_')) {
            inviteId = code;
        } else {
            // 2. Resolve Vanity Alias
            const data = await resolveReferralCode(code);
            if (data?.success && data.userId) {
                inviteId = data.userId;
                console.log('✅ Referral attributed:', inviteId);
            }
        }
      } catch (err) {
        console.error('Attribution error:', err);
      } finally {
        // 3. Jump to the App Subdomain with the resolved ID
        const base = window.location.hostname.includes('ziso.cc') 
            ? 'https://app.ziso.cc' 
            : window.location.origin;
        
        // Redirect to / instead of /dashboard to keep the URL clean
        const target = inviteId 
            ? `${base}/?invite=${inviteId}` 
            : `${base}/`;
            
        window.location.href = target;
      }
    }

    handleAttribution();
  }, [code, router]);

  // A ultra-minimal, premium loading state
  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Simple elegant pulse loader */}
        <div className="w-12 h-12 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
        <p className="text-slate-500 text-xs font-medium tracking-[0.2em] uppercase animate-pulse">
          Connecting to ZISO...
        </p>
      </div>
    </div>
  );
}
