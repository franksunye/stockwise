'use client';

import { X, User, Crown, ShieldCheck, Loader2, ArrowRight, ChevronDown, ArrowLeftRight, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getCurrentUser, restoreUserIdentity } from '@/lib/user';
import { isPushSupported, subscribeUserToPush } from '@/lib/notifications';
import { IdentityPassport } from '@/components/IdentityPassport';
import { useUserProfile } from '@/hooks/useUserProfile';
import { UserPricingView } from './UserPricingView';
import pkg from '../../package.json';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function UserCenterDrawer({ isOpen, onClose }: Props) {
  const { profile, tier, userId, refreshProfile, loading } = useUserProfile();

  const expiresAt = profile?.expiresAt || null;
  const watchlistCount = profile?.watchlistCount || 0;
  const userEmail = profile?.email || null;
  

  const [restoreId, setRestoreId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  const [showIdentityCenter, setShowIdentityCenter] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [isLinkingEmail, setIsLinkingEmail] = useState(false);
  const [tempEmail, setTempEmail] = useState('');

  const [notificationSettings, setNotificationSettings] = useState({
    types: {
      signal_flip: { enabled: true },
      morning_call: { enabled: true },
      validation_glory: { enabled: true },
      prediction_updated: { enabled: true },
      daily_brief: { enabled: true },
      price_update: { enabled: true }
    },
  });

  useEffect(() => {
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

      if (!!subscription) {
          try {
              const user = await getCurrentUser();
              const res = await fetch(`/api/user/notification-settings?userId=${user.userId}`);
              if (res.ok) {
                  const data = await res.json();
                  if (data.settings) setNotificationSettings(data.settings);
              }
          } catch (e) {
              console.error('Failed to load settings', e);
          }
      }
    }
  };

  const handleEnableNotifications = async () => {
    setIsSubscribing(true);
    try {
      const currentUserId = userId;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;

      const { registerServiceWorker } = await import('@/lib/notifications');
      const registration = await registerServiceWorker();
      if (!registration) return;

      let perm = Notification.permission;
      if (perm !== 'granted') perm = await Notification.requestPermission();

      if (perm === 'granted') {
        const swRegistration = await navigator.serviceWorker.ready;
        let subscription = await swRegistration.pushManager.getSubscription();
        if (!subscription) subscription = await subscribeUserToPush(vapidKey);

        if (subscription) {
          const response = await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId, subscription: subscription.toJSON() })
          });
          if (response.ok) {
            setIsSubscribed(true);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDisableNotifications = async () => {
    setIsSubscribing(true);
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
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubscribing(false);
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
    } catch {
      console.error('Email link failed');
    } finally {
      setIsLinkingEmail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 pointer-events-auto overflow-hidden">
      <div 
        className="relative w-full max-w-[500px] h-[92vh] bg-slate-950 border-x border-t border-white/10 rounded-t-[32px] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 ease-out"
      >
        {/* Grabber Area */}
        <div className="w-full h-8 flex items-center justify-center cursor-pointer shrink-0" onClick={onClose}>
          <div className="w-12 h-1 bg-white/10 rounded-full" />
        </div>

        <div className={`px-8 pt-4 pb-4 flex flex-col h-full overflow-y-auto ${showPricing ? 'overflow-hidden' : ''}`}>
          {!showPricing && (
            <header className="flex items-center justify-between mb-8 shrink-0">
              <div className="space-y-1.5">
                 <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">
                    {showIdentityCenter ? 'Account' : 'Member Center'}
                  </span>
                 </div>
                 <h2 className="text-xl font-bold text-white mt-1">
                  {showIdentityCenter ? '账号信息' : '个人中心'}
                 </h2>
              </div>
              <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </header>
          )}

          {showPricing ? (
             <UserPricingView onBack={() => setShowPricing(false)} currentTier={tier} />
          ) : showIdentityCenter ? (
            /* --- IDENTITY CENTER VIEW --- */
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setShowIdentityCenter(false)} className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider">
                      <ArrowLeftRight className="w-4 h-4 rotate-180" /> 返回
                  </button>
                  <span className="text-white font-black italic flex-1 text-right text-lg">账号信息</span>
              </div>

              <IdentityPassport userId={userId} tier={tier} emailLinked={userEmail} onLinkEmail={() => setIsLinkingEmail(true)} />

              {isLinkingEmail && !userEmail && (
                  <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-4">
                      <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-200">绑定支付/恢复邮箱</span>
                          <button onClick={() => setIsLinkingEmail(false)} className="text-slate-600 hover:text-slate-400"><X size={12} /></button>
                      </div>
                      <div className="flex gap-2">
                          <input type="email" value={tempEmail} onChange={(e) => setTempEmail(e.target.value)} placeholder="your@email.com" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white" />
                          <button onClick={handleLinkEmail} disabled={!tempEmail || isLinkingEmail} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold">确定</button>
                      </div>
                  </div>
              )}

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                   <span className="text-xs font-bold text-slate-400 block mb-3">找回旧账号</span>
                   <div className="flex gap-2">
                       <input type="text" value={restoreId} onChange={(e) => setRestoreId(e.target.value.toLowerCase())} placeholder="user_xxxxxxxxx" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono" />
                       <button onClick={async () => {
                              if (!restoreId || restoring) return;
                              setRestoring(true);
                              const result = await restoreUserIdentity(restoreId);
                              setRestoreMsg({ type: result.success ? 'success' : 'error', text: result.message });
                              setRestoring(false);
                              if (result.success) setTimeout(() => window.location.reload(), 1500);
                          }} disabled={!restoreId || restoring} className="bg-indigo-600 text-white px-4 rounded-xl font-bold flex items-center justify-center">
                          {restoring ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                       </button>
                   </div>
                   {restoreMsg && <p className={`text-[10px] mt-2 ${restoreMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>{restoreMsg.text}</p>}
              </div>
            </div>
          ) : (
            /* --- MAIN MEMBER CENTER VIEW --- */
            <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-3">
                {/* User Card */}
                <div className="mb-3 p-1 rounded-[24px] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 relative overflow-hidden">
                    {tier === 'pro' && (
                        <div className="absolute top-0 right-0 p-3">
                            <Crown className="text-amber-400 w-6 h-6" />
                        </div>
                    )}
                    <div className="bg-[#0f0f16]/90 backdrop-blur rounded-[22px] p-6 flex items-center gap-5">
                        <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center relative ${tier === 'pro' ? 'border-amber-500/50 bg-amber-500/10' : 'bg-white/5 border-white/10'}`}>
                            {loading ? <Loader2 className="w-8 h-8 text-slate-400 animate-spin" /> : <User className={`w-8 h-8 ${tier === 'pro' ? 'text-amber-200' : 'text-slate-400'}`} />}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-black italic text-white leading-tight">
                                {tier === 'pro' ? 'Pro 会员' : '普通用户'}
                            </h3>
                            {expiresAt && tier === 'pro' && (
                                <p className="text-[10px] text-emerald-500/80 font-bold flex items-center gap-1.5 mt-1">
                                    <ShieldCheck size={10} /> 有效期至: {expiresAt.split('T')[0]}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Resource Status */}
                <div className="glass-card px-5 py-4 rounded-[24px] border border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">监控名额</span>
                    <div className="flex items-center gap-2">
                        <span className="text-base font-black text-white">{watchlistCount}</span>
                        <span className="text-[10px] font-bold text-slate-600">/ {tier === 'pro' ? '10' : '3'}</span>
                    </div>
                </div>

                {/* Main Actions */}
                <div className="space-y-3">
                    <button onClick={() => setShowIdentityCenter(true)} className="w-full py-4 px-5 rounded-[24px] border border-white/5 bg-white/5 flex items-center justify-between">
                        <span className="text-sm font-bold text-white">账号信息</span>
                        <ChevronRight size={14} className="text-slate-600" />
                    </button>
                    <button onClick={() => setShowPricing(true)} className="w-full py-4 px-5 rounded-[24px] border border-indigo-500/10 bg-indigo-500/5 flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{tier === 'pro' ? '升级/续费' : '解锁专业权益'}</span>
                        <ChevronRight size={14} className="text-slate-600" />
                    </button>
                    <Link href="/learn" onClick={onClose} className="w-full py-4 px-5 rounded-[24px] border border-white/5 bg-white/5 flex items-center justify-between">
                        <span className="text-sm font-bold text-white">投研手册</span>
                        <ChevronRight size={14} className="text-slate-600" />
                    </Link>
                </div>

                {/* Notifications */}
                {pushSupported && (
                    <div className="glass-card rounded-[24px] border border-white/5 bg-white/[0.02] overflow-hidden">
                        <div className="px-5 py-4 flex items-center justify-between">
                            <span className="text-sm font-bold text-white">推送通知</span>
                            {isSubscribed ? (
                                <button onClick={handleDisableNotifications} disabled={isSubscribing} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20">已开启</button>
                            ) : (
                                <button onClick={handleEnableNotifications} disabled={isSubscribing} className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg">开启</button>
                            )}
                        </div>
                        {isSubscribed && (
                           <div className="px-5 pb-4 border-t border-white/5 pt-2">
                               <button onClick={() => setShowNotificationSettings(!showNotificationSettings)} className="w-full flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                   高级通知设置
                                   <ChevronDown className={`w-3 h-3 transition-transform ${showNotificationSettings ? 'rotate-180' : ''}`} />
                               </button>
                               {showNotificationSettings && (
                                   <div className="mt-3 space-y-2">
                                       {[
                                           { key: 'signal_flip', label: '趋势反转' },
                                           { key: 'morning_call', label: '每日早报' },
                                           { key: 'prediction_updated', label: '分析完成' }
                                       ].map(type => {
                                           const isEnabled = notificationSettings.types[type.key as keyof typeof notificationSettings.types]?.enabled ?? true;
                                           return (
                                               <div key={type.key} className="flex items-center justify-between">
                                                   <span className="text-xs text-slate-300">{type.label}</span>
                                                   <button 
                                                       onClick={() => {
                                                           const newS = {...notificationSettings, types: {...notificationSettings.types, [type.key]: {enabled: !isEnabled}}};
                                                           setNotificationSettings(newS);
                                                       }}
                                                       className={`w-8 h-4 rounded-full flex items-center px-0.5 transition-colors ${isEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
                                                   >
                                                       <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                                   </button>
                                               </div>
                                           );
                                       })}
                                   </div>
                               )}
                           </div>
                        )}
                    </div>
                )}

                {/* Reset Onboarding & Version */}
                <div className="pt-8 text-center space-y-4">
                    <button onClick={async () => {
                        localStorage.removeItem('STOCKWISE_HAS_ONBOARDED');
                        window.location.reload();
                    }} className="text-[9px] text-slate-700 font-bold uppercase tracking-widest">重新激活引导</button>
                    <div className="text-[8px] text-slate-500 opacity-30 uppercase tracking-[0.3em]">
                        ZISO AI v{pkg.version}
                    </div>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserCenterDrawer;
