'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Loader2, ArrowRight, Share2, ArrowLeftRight, ChevronRight, BookOpen, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { restoreUserIdentity } from '@/lib/user';
import { isPushSupported, subscribeUserToPush } from '@/lib/notifications';
import { shouldEnableHighPerformance } from '@/lib/device-utils';
import { IdentityPassport } from '@/components/IdentityPassport';
import { useUserProfile } from '@/hooks/useUserProfile';
import { UserPricingView } from './UserPricingView';
import pkg from '../../package.json';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStock?: (symbol: string) => void;
}

export function UserCenterDrawer({ isOpen, onClose }: Props) {
  const { profile, tier, userId, refreshProfile } = useUserProfile();

  // Local sync/display states (derived from profile)
  const expiresAt = profile?.expiresAt || null;
  const watchlistCount = profile?.watchlistCount || 0;
  const referralBalance = profile?.referralBalance || 0;
  const totalEarned = profile?.totalEarned || 0;
  const commissionRate = profile?.commissionRate || 0.1;
  const userEmail = profile?.email || null;
  
  // States
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [restoreId, setRestoreId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [showReferralDetails, setShowReferralDetails] = useState(false);
  const [isHighPerformance, setIsHighPerformance] = useState(false);
  const [showIdentityCenter, setShowIdentityCenter] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [isLinkingEmail, setIsLinkingEmail] = useState(false);
  const [tempEmail, setTempEmail] = useState('');

  useEffect(() => {
    setIsHighPerformance(shouldEnableHighPerformance());
    if (isOpen) {
      refreshProfile();
      checkPushStatus();
    } else {
      setShowPricing(false);
      setShowIdentityCenter(false);
    }
  }, [isOpen, refreshProfile]);

  const checkPushStatus = async () => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (supported) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      
      const { registerServiceWorker } = await import('@/lib/notifications');
      await registerServiceWorker();
      
      let perm = Notification.permission;
      if (perm !== 'granted') perm = await Notification.requestPermission();

      if (perm === 'granted') {
        const subscription = await subscribeUserToPush(vapidKey);
        if (subscription) {
          const response = await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, subscription: subscription.toJSON() })
          });
          if (response.ok) setIsSubscribed(true);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisableNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, endpoint: subscription.endpoint }),
        });
        setIsSubscribed(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const [redeemMsg, setRedeemMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleRedeem = async () => {
    if (!redeemCode || redeeming) return;
    setRedeeming(true);
    setRedeemMsg(null);
    try {
      const res = await fetch('/api/user/redeem', {
        method: 'POST',
        body: JSON.stringify({ userId, code: redeemCode })
      });
      const data = await res.json();
      if (data.success) {
        setRedeemMsg({ type: 'success', text: '激活成功！' });
        refreshProfile();
        setRedeemCode('');
        setTimeout(() => setRedeemMsg(null), 3000);
      } else {
        setRedeemMsg({ type: 'error', text: data.error || '激活失败' });
      }
    } catch {
      setRedeemMsg({ type: 'error', text: '网络失败' });
    } finally {
      setRedeeming(false);
    }
  };

  const handleLinkEmail = async () => {
    if (!tempEmail || isLinkingEmail) return;
    setIsLinkingEmail(true);
    try {
      const res = await fetch('/api/user/recovery/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email: tempEmail })
      });
      const data = await res.json();
      if (data.success) {
        refreshProfile();
        setIsLinkingEmail(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLinkingEmail(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-end bg-black/80 pointer-events-auto overflow-hidden">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
          />

          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            drag={!showPricing ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 150) onClose();
            }}
            transition={isHighPerformance 
              ? { type: 'tween', ease: 'easeOut', duration: 0.25 }
              : { type: 'spring', damping: 25, stiffness: 200 }
            }
            className="w-full max-w-md h-[85vh] flex flex-col bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-10"
          >
            <div className="w-full flex justify-center pt-3 pb-1 shrink-0">
               <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>

            <header className="shrink-0 z-20 px-6 py-4 flex items-center justify-between border-b border-white/5">
              <div className="w-10">
                {(showIdentityCenter || showPricing) && (
                  <button 
                    onClick={() => {
                      setShowPricing(false);
                      setShowIdentityCenter(false);
                    }}
                    className="p-2 rounded-full hover:bg-white/5 active:scale-90 transition-all text-slate-400"
                  >
                    <ArrowLeftRight className="w-5 h-5 rotate-180" />
                  </button>
                )}
              </div>
              <div className="flex-1 text-center">
                <h2 className="text-xl font-black italic tracking-tighter text-white uppercase">
                  {showPricing ? '权益升级' : showIdentityCenter ? '账号信息' : '个人中心'}
                </h2>
              </div>
              <div className="w-10 flex justify-end">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 active:scale-90 transition-all text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto overscroll-contain px-8 py-6 scrollbar-hide">
              <AnimatePresence mode="wait">
                {showPricing ? (
                  <motion.div
                    key="pricing"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <UserPricingView currentTier={tier} />
                  </motion.div>
                ) : showIdentityCenter ? (
                  <motion.div
                    key="identity"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-6"
                   >
                    <IdentityPassport userId={userId} tier={tier} emailLinked={userEmail} onLinkEmail={() => setIsLinkingEmail(true)} />
                    
                    {isLinkingEmail && (
                      <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-4">
                        <div className="flex gap-2">
                          <input type="email" value={tempEmail} onChange={(e) => setTempEmail(e.target.value)} placeholder="your@email.com" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white" />
                          <button onClick={handleLinkEmail} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold">确定</button>
                        </div>
                      </div>
                    )}

                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                      <div className="flex gap-2">
                        <input type="text" value={restoreId} onChange={(e) => setRestoreId(e.target.value)} placeholder="user_xxxx" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono" />
                        <button onClick={async () => {
                          setRestoring(true);
                          const res = await restoreUserIdentity(restoreId);
                          if (res.success) window.location.reload();
                          setRestoring(false);
                        }} className="bg-indigo-600 text-white px-4 rounded-xl">
                          {restoring ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="main"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-6 pb-12"
                  >
                    <div className="p-1 rounded-[24px] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 relative overflow-hidden">
                      <div className="bg-[#0f0f16]/90 backdrop-blur rounded-[22px] p-6 flex items-center gap-5">
                        <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center ${tier === 'pro' ? 'border-amber-500/50 bg-amber-500/10' : 'bg-white/5 border-white/10'}`}>
                          <User className={`w-8 h-8 ${tier === 'pro' ? 'text-amber-200' : 'text-slate-400'}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-black italic text-white uppercase">{tier === 'pro' ? 'Pro 会员' : '普通用户'}</h3>
                          {expiresAt && tier === 'pro' && <p className="text-[10px] text-emerald-500/80 font-bold mt-1">有效期至: {expiresAt.split('T')[0]}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="glass-card !p-0 rounded-[24px] overflow-hidden border-white/5 bg-white/[0.02]">
                      <div className="px-5 py-4 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-400 uppercase">监控配额</span>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-white">{watchlistCount}</span>
                          <span className="text-[10px] font-bold text-slate-600 uppercase">/ {tier === 'pro' ? '10' : '3'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button onClick={() => setShowIdentityCenter(true)} className="w-full py-4 px-5 rounded-[24px] bg-white/5 border border-white/5 flex items-center justify-between">
                        <span className="text-sm font-bold text-white uppercase">账号信息</span>
                        <ChevronRight size={14} className="text-slate-600" />
                      </button>
                      <button onClick={() => setShowPricing(true)} className="w-full py-4 px-5 rounded-[24px] bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-between">
                        <span className="text-sm font-bold text-white uppercase">{tier === 'pro' ? '价格权益' : '解锁专业权益'}</span>
                        <ChevronRight size={14} className="text-slate-600" />
                      </button>
                    </div>

                    {pushSupported && (
                      <div className="glass-card !p-0 rounded-[24px] overflow-hidden bg-white/[0.02] border-white/5">
                        <div className="px-5 py-4 flex items-center justify-between">
                          <h4 className="text-sm font-bold text-white uppercase">推送通知</h4>
                          <button onClick={isSubscribed ? handleDisableNotifications : handleEnableNotifications} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${isSubscribed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-indigo-600 text-white'}`}>
                            {isSubscribed ? '已开启' : '开启'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="pt-6 border-t border-white/5">
                      <div className="glass-card !bg-indigo-500/5 !border-indigo-500/10 p-5 rounded-[24px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center"><Share2 size={18} className="text-indigo-400" /></div>
                            <div>
                              <p className="text-sm font-bold text-white">邀请奖励</p>
                              <p className="text-[10px] text-emerald-400 font-bold">收益比例 {commissionRate * 100}%</p>
                            </div>
                          </div>
                          <button onClick={() => setShowReferralDetails(!showReferralDetails)}><ChevronRight className={`transition-transform ${showReferralDetails ? 'rotate-90' : ''}`} /></button>
                        </div>
                        <AnimatePresence>
                          {showReferralDetails && (
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                              <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                                <div className="bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-indigo-300 font-mono">ZISO-{userId?.slice(-6).toUpperCase()}</div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-white/5 rounded-2xl p-3"><p className="text-[9px] text-slate-500 uppercase">余额</p><p className="text-lg font-black text-emerald-400">¥{referralBalance.toFixed(2)}</p></div>
                                  <div className="bg-white/5 rounded-2xl p-3"><p className="text-[9px] text-slate-500 uppercase">累计</p><p className="text-lg font-black text-white">¥{totalEarned.toFixed(2)}</p></div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Link href="/learn" onClick={onClose} className="w-full py-4 px-5 rounded-[24px] bg-white/5 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3"><BookOpen className="text-indigo-400" /><span className="text-sm font-bold text-white uppercase">101 手册</span></div>
                        <ChevronRight size={14} className="text-slate-600" />
                      </Link>
                      <Link href="/support" onClick={onClose} className="w-full py-4 px-5 rounded-[24px] bg-white/5 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3"><HelpCircle className="text-emerald-400" /><span className="text-sm font-bold text-white uppercase">支持中心</span></div>
                        <ChevronRight size={14} className="text-slate-600" />
                      </Link>
                    </div>

                    <div className="pt-6 border-t border-white/5 text-center">
                      <div className="mb-8 text-left">
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">拥有激活码?</span>
                           {redeemMsg && <span className={`text-[10px] font-bold ${redeemMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>{redeemMsg.text}</span>}
                        </div>
                        <div className="flex gap-2">
                           <input type="text" value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase())} placeholder="PRO-XXXX" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white uppercase font-mono" />
                           <button onClick={handleRedeem} disabled={!redeemCode || redeeming} className="bg-indigo-600 px-4 rounded-xl text-white">
                              {redeeming ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                           </button>
                        </div>
                      </div>

                      <button onClick={() => { localStorage.removeItem('STOCKWISE_HAS_ONBOARDED'); window.location.reload(); }} className="text-[9px] text-slate-700 font-bold uppercase tracking-widest">重新激活引导</button>
                      <div className="mt-4 opacity-30 text-[8px] text-slate-500 uppercase tracking-widest">ZISO AI v{pkg.version}</div>
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
