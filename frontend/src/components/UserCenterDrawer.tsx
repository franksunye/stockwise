'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Crown, Zap, ShieldCheck, Loader2, ArrowRight, Share2, 
  Check, RefreshCw, Key, Bell, ChevronDown, ArrowLeftRight, Sun, 
  Trophy, FileText, ChevronRight, Mail, HelpCircle, BookOpen, Info 
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getCurrentUser, restoreUserIdentity } from '@/lib/user';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
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
  const { profile, tier, userId, refreshProfile, loading } = useUserProfile();

  // Local sync/display states (derived from profile)
  const expiresAt = profile?.expiresAt || null;
  const watchlistCount = profile?.watchlistCount || 0;
  const referralBalance = profile?.referralBalance || 0;
  const totalEarned = profile?.totalEarned || 0;
  const commissionRate = profile?.commissionRate || 0.1;
  const userEmail = profile?.email || null;
  
  // UI States
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [restoreId, setRestoreId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showReferralDetails, setShowReferralDetails] = useState(false);
  
  const [isHighPerformance, setIsHighPerformance] = useState(false);
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
    setIsHighPerformance(shouldEnableHighPerformance());
    if (isOpen) {
      refreshProfile();
      checkPushStatus();
    } else {
      setShowPricing(false);
      setShowIdentityCenter(false);
      setShowNotificationSettings(false);
      setShowReferralDetails(false);
    }
  }, [isOpen, refreshProfile]);

  const checkPushStatus = async () => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (supported) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);

      if (subscription) {
        try {
          const user = await getCurrentUser();
          const res = await fetch(`/api/user/notification-settings?userId=${user.userId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.settings) setNotificationSettings(data.settings);
          }
        } catch (e) { console.error('Failed to load settings', e); }
      }
    }
  };

  const handleEnableNotifications = async () => {
    setIsSubscribing(true);
    setRedeemMsg(null);
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setRedeemMsg({ type: 'error', text: 'VAPID Key 未配置' });
        return;
      }
      const { registerServiceWorker } = await import('@/lib/notifications');
      const registration = await registerServiceWorker();
      if (!registration) {
        setRedeemMsg({ type: 'error', text: 'Service Worker 注册失败' });
        return;
      }
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
            body: JSON.stringify({ userId, subscription: subscription.toJSON() })
          });
          if (response.ok) {
            setIsSubscribed(true);
            setRedeemMsg({ type: 'success', text: '通知开启成功' });
            setTimeout(() => setRedeemMsg(null), 3000);
          } else {
            const data = await response.json().catch(() => ({}));
            setRedeemMsg({ type: 'error', text: '保存失败: ' + (data.error || response.status) });
          }
        } else {
          setRedeemMsg({ type: 'error', text: '无法获取推送权限' });
        }
      } else {
        setRedeemMsg({ type: 'error', text: '请允许通知权限' });
      }
    } catch (e) {
      console.error(e);
      setRedeemMsg({ type: 'error', text: '开启失败，请重试' });
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
    } catch (e) { console.error(e); }
    finally { setIsSubscribing(false); }
  };

  const handleTestPush = async () => {
    if (testingPush) return;
    setTestingPush(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration) return;
      await registration.showNotification('🔔 测试通知 - ZISO AI', {
        body: `测试成功！当前时间: ${new Date().toLocaleTimeString('zh-CN')}`,
        icon: '/logo.png',
        badge: '/logo.png',
        data: { url: '/dashboard' }
      });
    } catch (e) { console.error(e); }
    finally { setTestingPush(false); }
  };

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
        setRedeemMsg({ type: 'success', text: '激活成功！欢迎成为 Pro 会员' });
        refreshProfile();
        setRedeemCode('');
        setTimeout(() => setRedeemMsg(null), 3000);
      } else {
        setRedeemMsg({ type: 'error', text: data.error || '激活失败' });
      }
    } catch {
      setRedeemMsg({ type: 'error', text: '网络请求失败' });
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
        setRedeemMsg({ type: 'success', text: '恢复邮箱绑定成功' });
        setTimeout(() => setRedeemMsg(null), 3000);
        setIsLinkingEmail(false);
      } else {
        setRedeemMsg({ type: 'error', text: data.error || '绑定失败' });
      }
    } catch {
      setRedeemMsg({ type: 'error', text: '网络请求失败' });
    } finally {
      setIsLinkingEmail(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-end bg-black/80 pointer-events-auto overflow-hidden">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0"
          />

          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            drag={!showPricing ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 150) onClose(); }}
            transition={isHighPerformance 
              ? { type: 'tween', ease: 'easeOut', duration: 0.25 }
              : { type: 'spring', damping: 25, stiffness: 200 }
            }
            className="w-full max-w-md h-[85vh] flex flex-col bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-10"
          >
            {/* Visual Handle */}
            <div className="w-full flex justify-center pt-3 pb-1 shrink-0"><div className="w-12 h-1 rounded-full bg-white/20" /></div>

            {/* Navigation Header */}
            <header className="shrink-0 z-20 px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
              <div className="w-10">
                {(showIdentityCenter || showPricing) && (
                  <button onClick={() => { setShowPricing(false); setShowIdentityCenter(false); }} className="p-2 rounded-full hover:bg-white/5 active:scale-90 transition-all text-slate-400">
                    <ArrowLeftRight className="w-5 h-5 rotate-180" />
                  </button>
                )}
              </div>
              <div className="flex-1 text-center">
                <h2 className="text-xl font-black italic tracking-tighter text-white uppercase mt-1">
                  {showPricing ? '权限升级' : showIdentityCenter ? '账号信息' : '个人中心'}
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
                    <UserPricingView currentTier={tier} />
                  </motion.div>
                ) : showIdentityCenter ? (
                  <motion.div key="identity" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-6">
                    <IdentityPassport userId={userId} tier={tier} emailLinked={userEmail} onLinkEmail={() => setIsLinkingEmail(true)} />
                    {isLinkingEmail && !userEmail && (
                      <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Mail size={14} className="text-indigo-400" />
                                <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest">绑定支付/恢复邮箱</span>
                            </div>
                            <button onClick={() => setIsLinkingEmail(false)} className="text-slate-600 hover:text-slate-400"><X size={12} /></button>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed text-left">
                            绑定邮箱后，即使更换设备、重装应用或清空缓存，只要通过验证该邮箱，即可找回所有付费权益。
                        </p>
                        <div className="flex gap-2">
                          <input type="email" value={tempEmail} onChange={(e) => setTempEmail(e.target.value)} placeholder="your@email.com" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500" />
                          <button onClick={handleLinkEmail} disabled={!tempEmail || isLinkingEmail} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all">确定</button>
                        </div>
                      </div>
                    )}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3 text-left">
                          <div className="flex items-center gap-2">
                              <RefreshCw size={14} className="text-slate-500" />
                              <span className="text-xs font-bold text-slate-400">找回旧账号</span>
                          </div>
                      </div>
                      <div className="flex gap-2">
                        <input type="text" value={restoreId} onChange={(e) => setRestoreId(e.target.value.toLowerCase())} placeholder="user_xxxx" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500" />
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
                ) : (
                  /* MAIN MAIN VIEW */
                  <motion.div key="main" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }} className="space-y-6 pb-12">
                    {/* User Card */}
                    <div className="p-1 rounded-[24px] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 overflow-hidden relative">
                      {tier === 'pro' && <div className="absolute top-0 right-0 p-3"><Crown className="text-amber-400 w-6 h-6 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" /></div>}
                      <div className="bg-[#0f0f16]/90 backdrop-blur rounded-[22px] p-6 flex items-center gap-5">
                        <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center relative ${tier === 'pro' ? 'border-amber-500/50 bg-amber-500/10' : 'bg-white/5 border-white/10'}`}>
                           {loading ? <Loader2 className="w-8 h-8 text-slate-400 animate-spin" /> : <User className={`w-8 h-8 ${tier === 'pro' ? 'text-amber-200' : 'text-slate-400'}`} />}
                        </div>
                        <div className="flex-1 text-left">
                          <h3 className="text-lg font-black italic text-white uppercase">{tier === 'pro' ? 'Pro 会员' : '普通用户'}</h3>
                          {expiresAt && tier === 'pro' && (
                            <p className="text-[10px] text-emerald-500/80 font-bold flex items-center gap-1.5 mt-1">
                                <ShieldCheck size={10} /> 有效期至: {expiresAt.split('T')[0]}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quota Section */}
                    <div className="glass-card !p-0 rounded-[24px] overflow-hidden border-white/5 bg-white/[0.02]">
                      <div className="px-5 py-4 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">监控配额使用情况</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-base font-black ${watchlistCount >= (tier === 'pro' ? 10 : 3) ? 'text-amber-400' : 'text-white'}`}>{watchlistCount}</span>
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">/ {tier === 'pro' ? '10' : '3'} 名额</span>
                        </div>
                      </div>
                    </div>

                    {/* Nav Buttons */}
                    <div className="space-y-3">
                      <button onClick={() => setShowIdentityCenter(true)} className={`w-full py-4 px-5 rounded-[24px] border transition-all flex items-center justify-between group ${tier === 'pro' ? 'bg-amber-500/[0.03] border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/[0.06]' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                        <span className={`text-sm font-bold ${tier === 'pro' ? 'text-amber-100' : 'text-white'} uppercase`}>账号信息</span>
                        <div className="flex items-center gap-3">
                            {userEmail && <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20"><ShieldCheck size={12} /> 已保护</span>}
                            {!userEmail && tier === 'pro' && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                            <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                        </div>
                      </button>
                      <button onClick={() => setShowPricing(true)} className={`w-full py-4 px-5 rounded-[24px] border transition-all flex items-center justify-between group ${tier === 'pro' ? 'bg-white/[0.02] border-white/5 hover:border-indigo-500/20' : 'bg-indigo-500/5 border-indigo-500/10 hover:border-indigo-500/20'}`}>
                        <span className="text-sm font-bold text-white uppercase text-left">{tier === 'pro' ? '查看全球定价计划' : '解锁专业研发权益'}</span>
                        <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                      </button>
                      <Link href="/learn" onClick={onClose} className="w-full py-4 px-5 rounded-[24px] border border-white/5 bg-white/[0.02] hover:border-indigo-500/20 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                          <BookOpen className="w-5 h-5 text-indigo-400" />
                          <div className="text-left">
                            <span className="block text-sm font-bold text-white">101 手册</span>
                            <span className="block text-[10px] text-slate-500 font-medium">散户避坑与生存指南</span>
                          </div>
                        </div>
                        <ChevronRight size={14} className="text-slate-600" />
                      </Link>
                    </div>

                    {/* Push Switch */}
                    {pushSupported && (
                      <div className="glass-card !p-0 rounded-[24px] overflow-hidden border-white/5 bg-white/[0.02]">
                        <div className="px-5 py-4 pb-2 flex items-center justify-between">
                            <h4 className="text-sm font-bold text-white uppercase">推送通知</h4>
                            {isSubscribed ? (
                                <button onClick={handleDisableNotifications} disabled={isSubscribing} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all uppercase">{isSubscribing ? '...' : '已开启'}</button>
                            ) : (
                                <button onClick={handleEnableNotifications} disabled={isSubscribing} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50 uppercase">{isSubscribing ? '...' : '开启'}</button>
                            )}
                        </div>
                        {isSubscribed && (
                          <div className="bg-white/[0.02] border-t border-white/5 px-5 py-2">
                            <button onClick={() => setShowNotificationSettings(!showNotificationSettings)} className="w-full flex items-center justify-between text-[10px] text-slate-500 hover:text-indigo-400 transition-colors uppercase font-bold tracking-widest">
                                高级通知偏好
                                <ChevronDown className={`w-3 h-3 transition-transform ${showNotificationSettings ? 'rotate-180' : ''}`} />
                            </button>
                            <AnimatePresence>
                              {showNotificationSettings && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                  <div className="mt-3 space-y-1.5 pb-2">
                                    {[
                                      { key: 'signal_flip', icon: ArrowLeftRight, label: '趋势反转', badge: '重要' },
                                      { key: 'morning_call', icon: Sun, label: '每日早报', badge: '08:30' },
                                      { key: 'validation_glory', icon: Trophy, label: '验证战报', badge: '胜率' },
                                      { key: 'prediction_updated', icon: Zap, label: '预测更新', badge: '分析完成' },
                                      { key: 'daily_brief', icon: FileText, label: tier === 'pro' ? 'Pro 深度复盘' : '简报生成', badge: tier === 'pro' ? '★ 专属' : '17:30' },
                                      { key: 'price_update', icon: Info, label: '实时行情', badge: '盘中推送' },
                                    ].map((type) => {
                                      const isEnabled = notificationSettings.types[type.key as keyof typeof notificationSettings.types]?.enabled ?? true;
                                      return (
                                        <div key={type.key} className="flex items-center justify-between py-1.5">
                                          <div className="flex items-center gap-2.5 flex-1">
                                            <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center"><type.icon className="w-3.5 h-3.5 text-indigo-400" /></div>
                                            <span className="text-[11px] font-medium text-slate-200">{type.label}</span>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-500 font-bold">{type.badge}</span>
                                          </div>
                                          <button onClick={async () => {
                                            const newSettings = { ...notificationSettings, types: { ...notificationSettings.types, [type.key]: { enabled: !isEnabled } } };
                                            setNotificationSettings(newSettings);
                                            try { await fetch('/api/user/notification-settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, settings: newSettings }) }); } catch (e) { console.error(e); }
                                          }} className={`w-9 h-5 rounded-full transition-all flex items-center px-0.5 ${isEnabled ? 'bg-indigo-600 justify-end' : 'bg-slate-700 justify-start'}`}>
                                            <motion.div className="w-4 h-4 bg-white rounded-full shadow" layout />
                                          </button>
                                        </div>
                                      );
                                    })}
                                    <div className="pt-1.5 mt-1.5 border-t border-white/5 flex justify-center">
                                        <button onClick={handleTestPush} disabled={testingPush} className="flex items-center gap-2 py-1.5 px-4 rounded-xl hover:bg-white/5 transition-colors text-[10px] text-slate-500 hover:text-indigo-400 font-bold uppercase tracking-wider disabled:opacity-50">
                                            <Bell size={12} /> {testingPush ? '发送中...' : '测试当前设备推送'}
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

                    {/* Referral Section */}
                    {MEMBERSHIP_CONFIG.switches.enableReferralReward && (
                      <div className="glass-card !bg-indigo-500/5 !border-indigo-500/10 p-5 rounded-[24px] overflow-hidden relative">
                        <Share2 className="w-12 h-12 text-indigo-500/10 absolute -top-2 -right-2 rotate-12" />
                        <div className="flex items-center justify-between mb-4 relative z-10">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center"><Share2 size={18} className="text-indigo-400" /></div>
                            <div className="text-left">
                              <p className="text-sm font-bold text-white italic">邀请好友领 Pro</p>
                              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">+{MEMBERSHIP_CONFIG.referral.referrerDays} Days / 提成 {commissionRate * 100}%</p>
                            </div>
                          </div>
                          <button onClick={() => setShowReferralDetails(!showReferralDetails)} className="p-2 text-slate-500"><ChevronRight className={`transition-transform ${showReferralDetails ? 'rotate-90' : ''}`} /></button>
                        </div>
                        <AnimatePresence>
                          {showReferralDetails && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="pt-4 border-t border-white/5 space-y-4">
                                <div className="space-y-2 text-left">
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">每邀请 1 位新用户入池，你与好友均可获 <span className="text-emerald-400 font-black">{MEMBERSHIP_CONFIG.referral.refereeDays} 天</span> Pro 会员。</p>
                                    <div className="bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-xs text-indigo-300 font-mono flex items-center justify-between">
                                        ZISO-{userId?.slice(-6).toUpperCase()}
                                        <button onClick={() => {
                                            navigator.clipboard.writeText(`https://app.ziso.cc?invite=${userId}`);
                                            setRedeemMsg({ type: 'success', text: '邀请链接已复制' });
                                            setTimeout(() => setRedeemMsg(null), 2000);
                                        }} className="text-indigo-500 font-black uppercase tracking-tighter hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                                          {redeemMsg?.text === '邀请链接已复制' ? <Check size={12} className="text-emerald-400" /> : null}
                                          复制分享链接
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-left">
                                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">提现余额</p>
                                    <p className="text-xl font-black text-emerald-400">¥{referralBalance.toFixed(2)}</p>
                                  </div>
                                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">累计收益</p>
                                    <p className="text-xl font-black text-white">¥{totalEarned.toFixed(2)}</p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Support & Links */}
                    <Link href="/support" onClick={onClose} className="w-full py-4 px-5 rounded-[24px] bg-white/5 border border-white/5 flex items-center justify-between group">
                        <div className="flex items-center gap-3"><HelpCircle className="text-emerald-400" size={18} /><span className="text-sm font-bold text-white uppercase tracking-tight">常见问题与支持</span></div>
                        <ChevronRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                    </Link>

                    {/* Footer Tools */}
                    <div className="pt-8 border-t border-white/5 text-center">
                        <div className="flex items-center justify-between mb-3 px-1 text-left">
                           <div className="flex items-center gap-2">
                             <Key size={14} className="text-slate-500" />
                             <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">使用激活码</span>
                           </div>
                           {redeemMsg && <span className={`text-[10px] font-black uppercase ${redeemMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>{redeemMsg.text}</span>}
                        </div>
                        <div className="flex gap-2">
                           <input type="text" value={redeemCode} onChange={(e) => setRedeemCode(e.target.value.toUpperCase())} placeholder="PRO-XXXX" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white uppercase font-mono focus:border-indigo-500 transition-colors" />
                           <button onClick={handleRedeem} disabled={!redeemCode || redeeming} className="bg-indigo-600 px-5 rounded-xl text-white active:scale-95 transition-all">
                              {redeeming ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                           </button>
                        </div>
                        
                        <div className="mt-10">
                          <button onClick={() => { localStorage.removeItem('STOCKWISE_HAS_ONBOARDED'); window.location.reload(); }} className="text-[9px] text-slate-700 hover:text-slate-500 font-bold uppercase tracking-[0.3em] transition-colors">重新进入激活引导</button>
                          <div className="mt-4 opacity-30 text-[8px] text-slate-500 uppercase tracking-widest font-medium">ZISO AI v{pkg.version}</div>
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
