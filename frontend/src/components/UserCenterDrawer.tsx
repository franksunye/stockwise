'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Crown, Zap, ShieldCheck, Loader2, ArrowRight, Share2, 
  Check, RefreshCw, Key, Bell, ChevronDown, ArrowLeftRight, Sun, 
  Trophy, ChevronRight, Mail, HelpCircle, BookOpen, Info, Activity
} from 'lucide-react';
import { useState } from 'react';
import { restoreUserIdentity } from '@/lib/user';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
import { getRiskBandLabel } from '@/lib/investment-mode';
import { IdentityPassport } from '@/components/IdentityPassport';
import { InvestmentModeCard } from '@/components/InvestmentModeCard';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserCenterData } from '@/hooks/useUserCenterData';
import { UserPricingView } from './UserPricingView';
import { SupportCenterView } from './SupportCenterView';
import { LearnCenterView } from './LearnCenterView';
import { useT, useGlobalT, useLocale } from '@/context/LocaleContext';
import type { MessageKey } from '@/lib/i18n';
import pkg from '../../package.json';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStock?: (symbol: string) => void;
}

export function UserCenterDrawer({ isOpen, onClose }: Props) {
  const t = useT('user');
  const tCommon = useT('common');
  const tGlobal = useGlobalT();
  const { locale, setLocale } = useLocale();
  const { profile, tier, userId, refreshProfile, loading } = useUserProfile();
  const canAccessInvestmentMode = tier === 'pro' || tier === 'alpha';
  const isPremiumTier = tier !== 'free';
  const tierDisplayName: Record<typeof tier, string> = {
    free: t('tier.free'),
    go: t('tier.go'),
    plus: t('tier.plus'),
    pro: t('tier.pro'),
    alpha: t('tier.alpha'),
  };
  const tierWatchlistLimit = tier === 'free' ? 3 : 10;

  const resetDrawerState = () => {
    setShowPricing(false);
    setShowIdentityCenter(false);
    setShowInvestmentMode(false);
    setShowSupport(false);
    setShowLearn(false);
    setShowNotificationSettings(false);
    setShowReferralDetails(false);
    setShowInvestmentModeDetails(false);
    setShowEmailForm(false);
    setIsLinkingEmail(false);
    setTempEmail('');
    setEmailMsg(null);
  };

  // Local sync/display states (derived from profile)
  const expiresAt = profile?.expiresAt || null;
  const watchlistCount = profile?.watchlistCount || 0;
  const referralBalance = profile?.referralBalance || 0;
  const totalEarned = profile?.totalEarned || 0;
  const commissionRate = profile?.commissionRate || 0.1;
  const userEmail = profile?.email || null;
  const isChannel = profile?.isChannel || false;
  const referralAlias = profile?.referralAlias || null;
  const referralCount = profile?.referralCount || 0;
  const recentTransactions = profile?.recentTransactions || [];
  const hasStripeCustomer = profile?.hasStripeCustomer || false;
  
  // UI States
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [restoreId, setRestoreId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showReferralDetails, setShowReferralDetails] = useState(false);
  const [showInvestmentModeDetails, setShowInvestmentModeDetails] = useState(false);
  const [showIdentityCenter, setShowIdentityCenter] = useState(false);
  const [showInvestmentMode, setShowInvestmentMode] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showLearn, setShowLearn] = useState(false);

  // Fix: Separate visibility state from loading state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isLinkingEmail, setIsLinkingEmail] = useState(false);
  const [tempEmail, setTempEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const {
    currentMode,
    handleDisableNotifications,
    handleEnableNotifications,
    handleTestPush,
    isAndroid,
    isHighPerformance,
    isSubscribed,
    isSubscribing,
    notificationSettings,
    pushSupported,
    testingPush,
    updateNotificationSetting,
  } = useUserCenterData({ isOpen, refreshProfile });

  const handleRedeem = async () => {
    if (!redeemCode || redeeming) return;
    setRedeeming(true);
    setRedeemMsg(null);
    try {
      const res = await fetch('/api/user/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: redeemCode.trim().toUpperCase() })
      });
      const data = await res.json();
      if (data.success) {
        setRedeemMsg({ type: 'success', text: t('successRedeem') });
        await refreshProfile({ force: true });
        setRedeemCode('');
        setTimeout(() => setRedeemMsg(null), 3000);
      } else {
        setRedeemMsg({ type: 'error', text: data.error || t('failRedeem') });
      }
    } catch {
      setRedeemMsg({ type: 'error', text: t('networkFail') });
    } finally {
      setRedeeming(false);
    }
  };

  const handleLinkEmail = async () => {
    if (!tempEmail || isLinkingEmail) return;
    const normalizedEmail = tempEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      setEmailMsg({ type: 'error', text: tCommon('errorRetry') });
      return;
    }

    setIsLinkingEmail(true);
    setEmailMsg(null);
    try {
      const res = await fetch('/api/user/recovery/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setEmailMsg({ type: 'error', text: data.error || `${tCommon('error')} (${res.status})` });
        return;
      }

      const refreshed = await refreshProfile({ force: true });
      const linkedEmail = refreshed?.email || data.email || normalizedEmail;
      setEmailMsg({ type: 'success', text: `${t('successRedeem')}: ${linkedEmail}` });
      setTempEmail('');
      setTimeout(() => {
        setEmailMsg(null);
        setShowEmailForm(false);
      }, 1200);
    } catch {
      setEmailMsg({ type: 'error', text: t('networkFail') });
    } finally {
      setIsLinkingEmail(false);
    }
  };

  const handleSwitchLocale = async (nextLocale: 'cn' | 'en') => {
    if (locale === nextLocale) return;
    setLocale(nextLocale);
    await refreshProfile({ force: true });
  };
  return (
    <AnimatePresence onExitComplete={resetDrawerState}>
      {isOpen && (
        <div data-user-center-drawer="true" className="fixed inset-0 z-[200] flex flex-col items-center justify-end bg-black/80 pointer-events-auto overflow-hidden">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 will-change-opacity"
          />

          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            drag={!showPricing && !showIdentityCenter && !showInvestmentMode && !showSupport && !showLearn ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 150) onClose(); }}
            transition={isHighPerformance 
              ? { type: 'tween', ease: 'easeOut', duration: 0.25 }
              : { type: 'spring', damping: 25, stiffness: 200 }
            }
            className="w-full max-w-md h-[85vh] flex flex-col bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-10 transform-gpu will-change-transform"
          >
            {/* Visual Handle */}
            <div className="w-full flex justify-center pt-3 pb-1 shrink-0"><div className="w-12 h-1 rounded-full bg-white/20" /></div>

            {/* Navigation Header */}
            <header className="shrink-0 z-20 px-5 py-4 flex items-center justify-between border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
              <div className="w-10">
                {(showIdentityCenter || (showInvestmentMode && canAccessInvestmentMode) || showPricing || showSupport || showLearn) && (
                  <button onClick={() => { setShowPricing(false); setShowIdentityCenter(false); setShowInvestmentMode(false); setShowSupport(false); setShowLearn(false); }} className="p-2 rounded-full hover:bg-white/5 active:scale-90 transition-all text-slate-400">
                    <ArrowLeftRight className="w-5 h-5 rotate-180" />
                  </button>
                )}
              </div>
              <div className="flex-1 text-center">
                <h2 className="text-xl font-black italic tracking-tighter text-white uppercase mt-1">
                  {showPricing ? tCommon('save') : showIdentityCenter ? t('identity') : (showInvestmentMode && canAccessInvestmentMode) ? t('investmentMode') : showSupport ? t('support') : showLearn ? t('learn') : t('center')}
                </h2>
              </div>
              <div className="w-10 flex justify-end">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 active:scale-90 transition-all text-slate-400"><X className="w-5 h-5" /></button>
              </div>
            </header>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-8 py-6 scrollbar-hide">
              <AnimatePresence mode="wait">
                {showPricing ? (
                  <motion.div key="pricing" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                    <UserPricingView 
                      currentTier={tier} 
                      hasStripeCustomer={hasStripeCustomer} 
                      expiresAt={expiresAt}
                    />
                  </motion.div>
                ) : showIdentityCenter ? (
                  <motion.div key="identity" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-6">
                    <IdentityPassport userId={userId} tier={tier} emailLinked={userEmail} onLinkEmail={() => setShowEmailForm(true)} />
                    {showEmailForm && !userEmail && (
                      <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Mail size={14} className="text-indigo-400" />
                                <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest">{t('linkEmail')}</span>
                            </div>
                            <button onClick={() => setShowEmailForm(false)} className="text-slate-600 hover:text-slate-400"><X size={12} /></button>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed text-left">
                            {t('linkEmailDesc')}
                        </p>
                        <div className="flex gap-2">
                          <input 
                            type="email" 
                            value={tempEmail} 
                            onChange={(e) => setTempEmail(e.target.value)} 
                            placeholder={t('placeholderEmail')} 
                            disabled={isLinkingEmail}
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50" 
                          />
                          <button 
                            onClick={handleLinkEmail} 
                            disabled={!tempEmail || isLinkingEmail} 
                            className="bg-indigo-600 text-white min-w-[70px] px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
                          >
                            {isLinkingEmail ? <Loader2 size={14} className="animate-spin" /> : t('confirm')}
                          </button>
                        </div>
                        {emailMsg && <p className={`text-[10px] font-bold mt-1 ${emailMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>{emailMsg.text}</p>}
                      </div>
                    )}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3 text-left">
                          <div className="flex items-center gap-2">
                              <RefreshCw size={14} className="text-slate-500" />
                              <span className="text-xs font-bold text-slate-400">{t('restoreAccount')}</span>
                          </div>
                      </div>
                      <div className="flex gap-2">
                        <input type="text" value={restoreId} onChange={(e) => setRestoreId(e.target.value.toLowerCase())} placeholder={t('placeholderUserId')} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500" />
                        <button onClick={async () => {
                          if (!restoreId || restoring) return;
                          setRestoring(true);
                          setRestoreMsg(null);
                          const res = await restoreUserIdentity(restoreId);
                          setRestoreMsg({ type: res.success ? 'success' : 'error', text: res.message });
                          if (res.success) setTimeout(() => window.location.reload(), 1500);
                          setRestoring(false);
                        }} disabled={!restoreId || restoring} className="bg-indigo-600 text-white px-4 rounded-xl active:scale-95 transition-all">
                          {restoring ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                        </button>
                      </div>
                      {restoreMsg && <p className={`text-[10px] mt-2 text-left ${restoreMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>{restoreMsg.text}</p>}
                    </div>
                  </motion.div>
                ) : showInvestmentMode && canAccessInvestmentMode ? (
                  <motion.div key="investment-mode" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                    <InvestmentModeCard currentTier={tier} onUpgrade={() => setShowPricing(true)} />
                  </motion.div>
                ) : showSupport ? (
                  <motion.div key="support" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                    <SupportCenterView />
                  </motion.div>
                ) : showLearn ? (
                  <motion.div key="learn" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                    <LearnCenterView />
                  </motion.div>
                ) : (
                  /* MAIN MAIN VIEW */
                  <motion.div key="main" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }} className="space-y-6 pb-12">
                    {/* User Card */}
                    <div className="p-1 rounded-[24px] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 overflow-hidden relative">
                      {isPremiumTier && <div className="absolute top-0 right-0 p-3"><Crown className="text-amber-400 w-6 h-6 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" /></div>}
                      <div className="bg-[#0f0f16]/90 backdrop-blur rounded-[22px] p-4 flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center relative ${isPremiumTier ? 'border-amber-500/50 bg-amber-500/10' : 'bg-white/5 border-white/10'}`}>
                           {loading ? <Loader2 className="w-7 h-7 text-slate-400 animate-spin" /> : <User className={`w-7 h-7 ${isPremiumTier ? 'text-amber-200' : 'text-slate-400'}`} />}
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="text-base font-black italic text-white uppercase">{tierDisplayName[tier]}</h3>
                          {expiresAt && isPremiumTier && (
                            <p className="text-[10px] text-emerald-500/80 font-bold flex items-center gap-1.5 mt-0.5">
                                <ShieldCheck size={10} /> {t('expiresAt', { date: expiresAt.split('T')[0] })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quota Section */}
                    <div className="glass-card !p-0 rounded-[24px] overflow-hidden border-white/5 bg-white/[0.02]">
                      <div className="px-5 py-4 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">{t('watchlistUsage')}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-base font-black ${watchlistCount >= tierWatchlistLimit ? 'text-amber-400' : 'text-white'}`}>{watchlistCount}</span>
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">/ {tierWatchlistLimit}</span>
                        </div>
                      </div>
                    </div>

                    {/* Nav Buttons */}
                    <div className="space-y-3">
                      <button onClick={() => setShowIdentityCenter(true)} className={`w-full py-4 px-5 rounded-[24px] border transition-all flex items-center justify-between group ${isPremiumTier ? 'bg-amber-500/[0.03] border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/[0.06]' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                        <span className={`text-sm font-bold ${isPremiumTier ? 'text-amber-100' : 'text-white'} uppercase`}>{t('settings')}</span>
                        <div className="flex items-center gap-3">
                            {userEmail && <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20"><ShieldCheck size={12} /> {t('protected')}</span>}
                            {!userEmail && isPremiumTier && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                            <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                        </div>
                      </button>
                      {canAccessInvestmentMode && (
                      <div className="glass-card !p-0 rounded-[24px] overflow-hidden border-white/5 bg-white/[0.02]">
                          <div 
                              className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                              onClick={() => {
                                  setShowInvestmentModeDetails(!showInvestmentModeDetails);
                                  if (!showInvestmentModeDetails) {
                                      setShowNotificationSettings(false);
                                      setShowReferralDetails(false);
                                  }
                              }}
                          >
                              <div className="flex items-center gap-3">
                                  <h4 className="text-sm font-bold text-white">
                                      {t('investmentMode')}
                                  </h4>
                                  <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-[10px] font-bold text-indigo-400 border border-indigo-500/20">
                                      <span data-user-center-current-mode="true">
                                      {currentMode ? currentMode.name : tCommon('loading')}
                                      </span>
                                  </span>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${showInvestmentModeDetails ? 'rotate-180' : ''}`} />
                          </div>

                          <AnimatePresence>
                              {showInvestmentModeDetails && (
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                      <div className="bg-white/[0.02] border-t border-white/5 px-5 py-4">
                                          <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-left">
                                              <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">评估周期</div>
                                              <div className="text-base font-black text-white">{currentMode?.default_horizon ? currentMode.default_horizon.replace('d', '') : '--'} <span className="text-[10px] font-bold text-slate-500">自然日</span></div>
                                            </div>
                                            <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-left">
                                              <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">风险评级</div>
                                              <div className="text-base font-black text-amber-400">{getRiskBandLabel((currentMode?.risk_band as 'low' | 'medium' | 'high') || 'medium')}</div>
                                            </div>
                                          </div>
                                          
                                          <div className="mb-4">
                                              <p className="text-[10px] text-slate-500 leading-relaxed text-left">
                                                {currentMode?.tagline || '模式数据加载中...'}
                                              </p>
                                          </div>

                                          <button 
                                              onClick={() => setShowInvestmentMode(true)} 
                                              className="w-full py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-between px-4 group"
                                          >
                                              <div className="flex flex-col items-start gap-0.5">
                                                  <span className="text-xs font-bold text-indigo-300">切换投资模式</span>
                                                  <span className="text-[9px] text-indigo-400/70 font-medium">解锁高频交易等更多策略系统</span>
                                              </div>
                                              <ChevronRight size={14} className="text-indigo-400 group-hover:text-white transition-colors" />
                                          </button>
                                      </div>
                                  </motion.div>
                              )}
                          </AnimatePresence>
                      </div>
                      )}
                    </div>

                    {/* Push Switch */}
                    {pushSupported && (
                      <div className="glass-card !p-0 rounded-[24px] overflow-hidden border-white/5 bg-white/[0.02]">
                        <div className="px-5 py-4 pb-2 flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white uppercase">{t('push.title')}</h4>
                            {isSubscribed ? (
                                <button onClick={async () => {
                                  const ok = await handleDisableNotifications();
                                  if (!ok) {
                                    setRedeemMsg({ type: 'error', text: t('push.disableFailed') });
                                  }
                                }} disabled={isSubscribing} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all uppercase">{isSubscribing ? '...' : t('push.enabled')}</button>
                            ) : (
                                <button onClick={async () => {
                                  const result = await handleEnableNotifications();
                                  setRedeemMsg({ type: result.success ? 'success' : 'error', text: result.message });
                                  if (result.success) {
                                    setTimeout(() => setRedeemMsg(null), 3000);
                                  }
                                }} disabled={isSubscribing} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50 uppercase">{isSubscribing ? '...' : t('push.enable')}</button>
                            )}
                        </div>
                        {isSubscribed && (
                          <div className="bg-white/[0.02] border-t border-white/5 px-5 py-2">
                            {isAndroid && (
                              <div className="mt-2 mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-left">
                                <p className="text-[10px] text-amber-200/90 font-bold">
                                  ⚠️ {t('push.androidLimited')}
                                </p>
                              </div>
                            )}
                            <button onClick={() => {
                                setShowNotificationSettings(!showNotificationSettings);
                                if (!showNotificationSettings) setShowReferralDetails(false);
                            }} data-user-center-notification-settings-button="true" className="w-full flex items-center justify-between text-[10px] text-slate-500 hover:text-indigo-400 transition-colors uppercase font-bold tracking-widest">
                                {t('push.advancedSettings')}
                                <ChevronDown className={`w-3 h-3 transition-transform ${showNotificationSettings ? 'rotate-180' : ''}`} />
                            </button>
                            <AnimatePresence>
                              {showNotificationSettings && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                  <div className="mt-3 space-y-1.5 pb-2">
                                    {([
                                      { key: 'signal_flip', icon: ArrowLeftRight },
                                      { key: 'morning_call', icon: Sun },
                                      { key: 'validation_glory', icon: Trophy },
                                      { key: 'prediction_updated', icon: Zap },
                                      { key: 'ai_radar_alert', icon: Activity, isPro: tier === 'pro' },
                                      // { key: 'daily_brief', icon: FileText, isDailyBrief: true as const, isPro: tier === 'pro' },
                                      { key: 'price_update', icon: Info },
                                      // { key: 'market_almanac', icon: Sun },
                                    ] as const).map((type) => {
                                      const isEnabled = notificationSettings.types[type.key as keyof typeof notificationSettings.types]?.enabled ?? true;
                                      const isPro = 'isPro' in type && type.isPro;
                                      const IconComponent = type.icon;
                                      const label =
                                        'isDailyBrief' in type && type.isDailyBrief
                                          ? tier === 'pro'
                                            ? t('push.types.daily_brief.labelPro' as MessageKey<'user'>)
                                            : t('push.types.daily_brief.labelStandard' as MessageKey<'user'>)
                                          : t(`push.types.${type.key}.label` as MessageKey<'user'>);
                                      const badge =
                                        'isDailyBrief' in type && type.isDailyBrief
                                          ? tier === 'pro'
                                            ? t('push.types.daily_brief.badgePro' as MessageKey<'user'>)
                                            : t('push.types.daily_brief.badgeStandard' as MessageKey<'user'>)
                                          : t(`push.types.${type.key}.badge` as MessageKey<'user'>);
                                      return (
                                        <div key={type.key} className={`flex items-center justify-between py-1.5 ${isPro ? 'bg-amber-500/5 -mx-1 px-1 rounded-lg' : ''}`}>
                                          <div className="flex items-center gap-2.5 flex-1">
                                            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isPro ? 'bg-amber-500/20' : 'bg-white/5'}`}>
                                                <IconComponent className={`w-3.5 h-3.5 ${isPro ? 'text-amber-400' : 'text-indigo-400'}`} />
                                            </div>
                                            <span className={`text-[11px] font-medium ${isPro ? 'text-amber-200' : 'text-slate-200'}`}>{label}</span>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${isPro ? 'bg-amber-500/20 text-amber-400 font-black' : 'bg-slate-800/60 text-slate-500 font-bold'}`}>{badge}</span>
                                          </div>
                                          <button onClick={() => {
                                            void updateNotificationSetting(type.key as keyof typeof notificationSettings.types, !isEnabled);
                                          }} data-user-center-notification-toggle={type.key} className={`w-9 h-5 rounded-full transition-all flex items-center px-0.5 ${isEnabled ? 'bg-indigo-600 justify-end' : 'bg-slate-700 justify-start'}`}>
                                            <motion.div className="w-4 h-4 bg-white rounded-full shadow" layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                                          </button>
                                        </div>
                                      );
                                    })}
                                    <div className="pt-1.5 mt-1.5 border-t border-white/5 flex justify-center">
                                        <button onClick={handleTestPush} disabled={testingPush} className="flex items-center gap-2 py-1.5 px-4 rounded-xl hover:bg-white/5 transition-colors text-[10px] text-slate-500 hover:text-indigo-400 font-bold uppercase tracking-wider disabled:opacity-50">
                                            <Bell size={12} /> {testingPush ? t('push.testPushSending') : t('push.testPush')}
                                        </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Referral Section (Loot Logic UI) */}
                    {MEMBERSHIP_CONFIG.switches.enableReferralReward && (
                      <div className="mt-3">
                        <div className="glass-card !p-0 rounded-[24px] overflow-hidden relative group border-white/5 bg-white/[0.02]">
                          <div className="relative z-10 px-5 py-4 pb-2">
                             <div className="flex items-center justify-between mb-3">
                 <h4 className="text-sm font-black italic text-white flex items-center gap-2">
                                     {isChannel ? (referralAlias || t('referral.partner')) : t('referral.title')}
                                     {isChannel ? (
                                         <span className="px-1.5 py-0.5 rounded bg-amber-500 text-[8px] font-black uppercase not-italic text-black">C</span>
                                     ) : (
                                         <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-[8px] font-black uppercase not-italic">{t('referral.rewardDays', { days: MEMBERSHIP_CONFIG.referral.referrerDays })}</span>
                                     )}
                                 </h4>
                                 {referralCount > 0 && (
                                     <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-[10px] font-black text-indigo-300">
                                         {t('referral.successCount', { count: referralCount })}
                                     </span>
                                 )}
                                <Share2 className="w-8 h-8 text-indigo-500/10 absolute top-4 right-4" />
                             </div>

                             <button 
                                onClick={async () => {
                                    const base = window.location.hostname.includes('ziso.cc') 
                                        ? 'https://ziso.cc' 
                                        : window.location.origin;
                                    const url = referralAlias 
                                        ? `${base}/v/${referralAlias}` 
                                        : `${base}/v/${userId}`;
                                    
                                    try {
                                        await navigator.clipboard.writeText(url);
                                        setRedeemMsg({ type: 'success', text: t('referral.copied') });
                                    } catch (err) {
                                        console.error('Copy failed', err);
                                        setRedeemMsg({ type: 'error', text: t('referral.copyFail') });
                                    }
                                    setTimeout(() => setRedeemMsg(null), 2000);
                                }}
                                className="w-full py-2.5 mb-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs font-bold text-indigo-300"
                             >
                                {(redeemMsg?.text === t('referral.copied')) ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                                {(redeemMsg?.text === t('referral.copied')) ? t('referral.copied') : t('referral.inviteLink')}
                             </button>
                          </div>

                          <div className="bg-white/[0.02] border-t border-white/5 px-5 py-2 relative z-10">
                            <button onClick={() => {
                                setShowReferralDetails(!showReferralDetails);
                                if (!showReferralDetails) setShowNotificationSettings(false);
                            }} className="w-full flex items-center justify-between text-[10px] text-slate-500 hover:text-indigo-400 transition-colors uppercase font-bold tracking-widest">
                                {isChannel ? t('referral.revenue') : t('referral.rules')}
                                <ChevronDown className={`w-3 h-3 transition-transform ${showReferralDetails ? 'rotate-180' : ''}`} />
                            </button>
                            <AnimatePresence>
                              {showReferralDetails && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                  {/* Rules for general users */}
                                  {!isChannel && (
                                    <>
                                      <div className="grid grid-cols-2 gap-2 mt-2 mb-2">
                                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-left">
                                          <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">{t('referral.inviteCountLabel')}</div>
                                          <div className="text-lg font-black text-indigo-300">{referralCount} <span className="text-xs font-bold text-slate-500">{t('referral.unitPeople')}</span></div>
                                        </div>
                                        <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-left">
                                          <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">{t('referral.earnedProDaysLabel')}</div>
                                          <div className="text-lg font-black text-emerald-400">{referralCount * MEMBERSHIP_CONFIG.referral.referrerDays} <span className="text-xs font-bold text-slate-500">{t('referral.unitDays')}</span></div>
                                        </div>
                                      </div>
                                      <div className="px-1 mb-3">
                                          <p className="text-[10px] text-slate-500 leading-relaxed text-left">
                                            {t('referral.rulesExplainerBefore')}
                                            <span className="text-emerald-400 font-bold">
                                              {t('referral.rulesExplainerHighlight', { days: MEMBERSHIP_CONFIG.referral.refereeDays })}
                                            </span>
                                            {t('referral.rulesExplainerAfter')}
                                          </p>
                                      </div>
                                    </>
                                  )}

                                  {/* Earnings Dashboard (shown for channels only) */}
                                  {isChannel && (
                                    <div className="grid grid-cols-2 gap-2 mt-2 mb-1">
                                      <div className="rounded-2xl p-3 border text-left bg-amber-500/5 border-amber-500/10">
                                        <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">{t('referral.partnerBalanceLabel')}</div>
                                        <div className="text-lg font-black text-amber-400">¥{referralBalance.toFixed(2)}</div>
                                      </div>
                                      <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-left">
                                        <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">
                                          {t('referral.partnerTotalEarnedLabel', { percent: (commissionRate * 100).toFixed(0) })}
                                        </div>
                                        <div className="text-lg font-black text-white">¥{totalEarned.toFixed(2)}</div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Channel-specific: Transaction History */}
                                  {isChannel && recentTransactions.length > 0 && (
                                    <div className="mt-3 mb-1">
                                      <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2 px-1">{t('referral.partnerRecentTx')}</div>
                                      <div className="space-y-1 max-h-[160px] overflow-y-auto">
                                        {recentTransactions.map((tx, i) => (
                                          <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/[0.02]">
                                            <div className="flex items-center gap-2">
                                              <div className={`w-5 h-5 rounded-md flex items-center justify-center ${tx.type === 'commission' ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
                                                {tx.type === 'commission' ? <Zap className="w-3 h-3 text-amber-400" /> : <Check className="w-3 h-3 text-emerald-400" />}
                                              </div>
                                              <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{tx.note || tx.type}</span>
                                            </div>
                                            <span className={`text-[11px] font-bold ${tx.type === 'commission' ? 'text-amber-400' : 'text-emerald-400'}`}>+¥{tx.amount.toFixed(2)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Channel stats summary */}
                                  {isChannel && (
                                    <div className="mt-2 mb-1 px-1">
                                      <p className="text-[10px] text-slate-600 leading-relaxed text-left">
                                        {t('referral.channelCommissionWord')}{' '}
                                        <span className="text-amber-400 font-bold">{(commissionRate * 100).toFixed(0)}%</span>
                                        {' · '}
                                        {t('referral.successCount', { count: referralCount })}
                                      </p>
                                    </div>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Support & Links */}
                    <div className="space-y-3">
                      <button onClick={() => setShowSupport(true)} className="w-full py-4 px-5 rounded-[24px] bg-white/5 border border-white/5 flex items-center justify-between group">
                          <div className="flex items-center gap-3"><HelpCircle className="text-emerald-400" size={18} /><span className="text-sm font-bold text-white uppercase tracking-tight">{t('support')}</span></div>
                          <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                      </button>
                      
                      <button onClick={() => setShowLearn(true)} className="w-full py-4 px-5 rounded-[24px] border border-white/5 bg-white/[0.02] hover:border-indigo-500/20 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <BookOpen className="w-5 h-5 text-indigo-400" />
                          <div className="text-left">
                            <span className="block text-sm font-bold text-white">{t('learn')}</span>
                            <span className="block text-[10px] text-slate-500 font-medium">{t('learnSubtitle')}</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                      </button>

                      <button onClick={() => setShowPricing(true)} className={`w-full py-4 px-5 rounded-[24px] border transition-all flex items-center justify-between group ${isPremiumTier ? 'bg-white/[0.02] border-white/5 hover:border-indigo-500/20' : 'bg-indigo-500/5 border-indigo-500/10 hover:border-indigo-500/20'}`}>
                        <div className="flex items-center gap-3">
                          <Crown className={`w-5 h-5 ${isPremiumTier ? 'text-slate-400' : 'text-amber-400'}`} />
                          <span className="text-sm font-bold text-white uppercase text-left">{isPremiumTier ? tGlobal('pricing.title') : t('unlockGoBenefits')}</span>
                        </div>
                        <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                      </button>
                    </div>

                    {/* Footer Tools */}
                    <div className="pt-8 border-t border-white/5 text-center">
                        <div className="mb-8">
                          <div className="flex items-center justify-between mb-3 px-1 text-left">
                            <div className="flex items-center gap-2">
                              <ArrowLeftRight size={14} className="text-slate-500" />
                              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('language.title')}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => { void handleSwitchLocale('cn'); }}
                              className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                                locale === 'cn'
                                  ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-200'
                                  : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              {t('language.cn')}
                            </button>
                            <button
                              onClick={() => { void handleSwitchLocale('en'); }}
                              className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                                locale === 'en'
                                  ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-200'
                                  : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              {t('language.en')}
                            </button>
                          </div>
                        </div>

                        {/* 激活码兑换区域 (Beta) */}
                        {MEMBERSHIP_CONFIG.switches.enableRedemption && tier === 'free' && (
                          <div className="mb-10">
                            <div className="flex items-center justify-between mb-3 px-1 text-left">
                               <div className="flex items-center gap-2">
                                 <Key size={14} className="text-slate-500" />
                                 <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{t('redeem')}</span>
                               </div>
                               {redeemMsg && <span className={`text-[10px] font-black uppercase ${redeemMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>{redeemMsg.text}</span>}
                            </div>
                            <div className="flex gap-2">
                               <input type="text" value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase())} placeholder={t('redeemPlaceholder')} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white uppercase font-mono focus:border-indigo-500 transition-colors" />
                               <button onClick={handleRedeem} disabled={!redeemCode || redeeming} className="bg-indigo-600 px-5 rounded-xl text-white active:scale-95 transition-all">
                                  {redeeming ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                               </button>
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-4">
                          <button 
                            onClick={async () => { 
                                localStorage.removeItem('STOCKWISE_HAS_ONBOARDED'); 
                                try {
                                    await fetch('/api/user/onboarding/reset', {
                                        method: 'POST',
                                    });
                                } catch (err) { console.error('Reset onboarding failed', err); }
                                window.location.reload(); 
                            }} 
                            className="text-[9px] text-slate-700 hover:text-slate-500 font-bold uppercase tracking-[0.3em] transition-colors"
                          >
                            {t('onboardingReset')}
                          </button>
                          <div className="mt-4 opacity-60 text-[8px] text-slate-400 uppercase tracking-widest font-medium">ZISO AI v{pkg.version}</div>
                        </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default UserCenterDrawer;
