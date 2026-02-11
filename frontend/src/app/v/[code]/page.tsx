
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
      try {
        console.log(`🚀 ZISO Attribution Gateway: Resolving ${code}...`);
        
        // 1. Is it a direct ID? (Fallback support)
        if (code.startsWith('user_')) {
            localStorage.setItem('STOCKWISE_REFERRED_BY', code);
        } else {
            // 2. Resolve Vanity Alias
            const data = await resolveReferralCode(code);
            if (data?.success && data.userId) {
                localStorage.setItem('STOCKWISE_REFERRED_BY', data.userId);
                console.log('✅ Referral attributed:', data.userId);
            }
        }
      } catch (err) {
        console.error('Attribution error:', err);
      } finally {
        // 3. Silent Redirect to Dashboard
        // We use replace to keep the history clean
        router.replace('/dashboard');
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
