'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { getCurrentUser } from '@/lib/user';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useEffect } from 'react';
import { LOCALE_COOKIE_KEY, type AppLocale } from '@/lib/i18n';

interface Props {
  onSuccess: (tier: string, expiresAt: string | null) => void;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() ?? null;
  return null;
}

function resolveInviteWallLocale(): AppLocale {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('stockwise_locale')?.trim().toLowerCase();
    if (stored === 'en') return 'en';
    if (stored === 'cn' || stored === 'zh' || stored?.startsWith('zh-')) return 'cn';
  }

  const cookieLocale = getCookie(LOCALE_COOKIE_KEY)?.trim().toLowerCase();
  if (cookieLocale === 'en' || cookieLocale === 'es' || cookieLocale === 'ko') return 'en';
  if (cookieLocale === 'cn' || cookieLocale === 'zh' || cookieLocale?.startsWith('zh-')) return 'cn';

  if (typeof navigator !== 'undefined') {
    const browserLang = navigator.language?.toLowerCase() ?? '';
    if (browserLang.startsWith('zh')) return 'cn';
  }

  return 'en';
}

export function InviteWall({ onSuccess }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { trackEvent } = useAnalytics();
  const locale = useMemo(resolveInviteWallLocale, []);
  const isEnglish = locale === 'en';

  const copy = {
    titleAccent: 'BETA',
    description: isEnglish
      ? 'We are currently in invitation-only beta. Enter your access code to unlock the AI decision workspace.'
      : '目前处于邀请制内测阶段。请输入您的专属激活码以解锁 AI 决策系统。',
    label: isEnglish ? 'Enter access code' : '输入邀请码',
    invalidCode: isEnglish ? 'Invalid access code' : '无效的激活码',
    networkFailure: isEnglish ? 'Network request failed. Please try again shortly.' : '网络请求失败，请稍后重试',
    verifyIdentity: isEnglish ? 'Identity Check' : '验证身份',
    unlockFeatures: isEnglish ? 'Unlock Access' : '解锁功能',
    footer: isEnglish
      ? 'Need an access code? Follow @franksunye on X for beta access updates and launch announcements.'
      : '没有邀请码？关注官方公众号“知守AI”获取',
  };

  useEffect(() => {
    trackEvent('view_invite_wall');
  }, [trackEvent]);

  const handleRedeem = async () => {
    if (!code || loading) return;
    setLoading(true);
    setError(null);

    // Ensure user session is initialized before redemption.
    await getCurrentUser();

    try {
      trackEvent('invite_redeem_attempt', { code_length: code.length });
      const res = await fetch('/api/user/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      const data = await res.json();

      if (data.success) {
        trackEvent('invite_redeem_success', { tier: data.tier });
        onSuccess(data.tier, data.expiresAt);
      } else {
        const errorMsg = data.error || copy.invalidCode;
        trackEvent('invite_redeem_error', { reason: errorMsg });
        setError(errorMsg);
      }
    } catch {
      trackEvent('invite_redeem_error', { reason: 'network_failure' });
      setError(copy.networkFailure);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-dashboard-invite-wall="true"
      className="fixed inset-0 z-[500] bg-[#050508] flex items-center justify-center p-6 text-white overflow-hidden font-sans"
    >
      {/* 动态背景 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md z-10"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[32px] bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_20px_40px_rgba(99,102,241,0.3)] mb-8">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter mb-4">
            ZISO AI <span className="text-indigo-500">{copy.titleAccent}</span>
          </h1>
          <p className="text-slate-400 font-medium leading-relaxed px-4">
            {copy.description}
          </p>
        </div>

        <div className="glass-card p-10 border-white/10 bg-white/[0.02] backdrop-blur-2xl rounded-[40px]">
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">
                {copy.label}
              </label>
              <div className="relative group">
                <input 
                  type="text" 
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="PRO-XXXXXX"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-xl font-mono tracking-widest text-white placeholder-slate-700 focus:outline-none focus:border-indigo-500/50 transition-all group-hover:bg-white/[0.07]"
                />
                <button 
                  onClick={handleRedeem}
                  disabled={!code || loading}
                  className="absolute right-2 top-2 bottom-2 aspect-square rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-90"
                >
                  {loading ? <Loader2 className="animate-spin w-6 h-6" /> : <ArrowRight className="w-6 h-6" />}
                </button>
              </div>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-rose-500 text-xs font-bold mt-4 text-center"
                >
                  {error}
                </motion.p>
              )}
            </div>

            <div className="pt-4 grid grid-cols-2 gap-4">
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                  <ShieldCheck size={14} className="text-indigo-400" />
                  {copy.verifyIdentity}
               </div>
               <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                  <Zap size={14} className="text-purple-400" />
                  {copy.unlockFeatures}
               </div>
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-xs font-bold text-slate-600 uppercase tracking-widest">
          {isEnglish ? (
            <a
              href="https://x.com/franksunye"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-slate-400"
            >
              {copy.footer}
            </a>
          ) : (
            copy.footer
          )}
        </p>
      </motion.div>

      <style jsx global>{`
        .glass-card { 
          border: 1px solid rgba(255, 255, 255, 0.05); 
          box-shadow: 0 40px 100px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
}
