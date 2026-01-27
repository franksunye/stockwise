'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Crown, Zap, ShieldCheck, Loader2, ArrowRight, Share2, Check, RefreshCw, Key, Bell, ChevronDown, ArrowLeftRight, Sun, Trophy, FileText, Star, ChevronRight, Mail, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getWatchlist } from '@/lib/storage';
import { getCurrentUser, restoreUserIdentity } from '@/lib/user';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
import { isPushSupported, subscribeUserToPush } from '@/lib/notifications';
import { shouldEnableHighPerformance } from '@/lib/device-utils';
import { IdentityPassport } from '@/components/IdentityPassport';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStock?: (symbol: string) => void;
}

export function UserCenterDrawer({ isOpen, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>('');
  const [tier, setTier] = useState<'free' | 'pro'>('free');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [watchlistCount, setWatchlistCount] = useState(0);
  
  // Referral Stats
  const [referralBalance, setReferralBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [commissionRate, setCommissionRate] = useState(0.1);
  
  // Redeem State
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Restore State
  const [restoreId, setRestoreId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Push State
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [isHighPerformance, setIsHighPerformance] = useState(false);

  // Identity & Recovery Stats
  const [showIdentityCenter, setShowIdentityCenter] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
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
      loadUserData();
      checkPushStatus();
    }
  }, [isOpen]);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      setUserId(user.userId);
      
      const watchlist = getWatchlist();
      
      const referredBy = localStorage.getItem('STOCKWISE_REFERRED_BY');
      
      const res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              userId: user.userId, 
              watchlist,
              referredBy: referredBy 
          })
      });
      
      if (res.ok) {
          const data = await res.json();
          if (data.tier) {
              setTier(data.tier);
              setExpiresAt(data.expiresAt);
              if (typeof data.watchlistCount === 'number') {
                  setWatchlistCount(data.watchlistCount);
              }
              if (data.email) {
                  setUserEmail(data.email);
              }
              if (typeof data.referralBalance === 'number') {
                  setReferralBalance(data.referralBalance);
                  setTotalEarned(data.totalEarned || 0);
                  setCommissionRate(data.commissionRate || 0.1);
              }
          }
      }
    } catch (err) {
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  const checkPushStatus = async () => {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (supported) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);

      // Load remote settings if subscribed
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
      // Use environment variable directly (original working approach)
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setRedeemMsg({ type: 'error', text: 'VAPID Key 未配置' });
        return;
      }
      
      const subscription = await subscribeUserToPush(vapidKey);
      
      if (subscription) {
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, subscription }),
        });
        setIsSubscribed(true);
        setRedeemMsg({ type: 'success', text: '推送通知已开启' });
        setTimeout(() => setRedeemMsg(null), 3000);
      }
    } catch (error) {
      console.error('Failed to enable push:', error);
      setRedeemMsg({ type: 'error', text: '开启失败，请检查浏览器权限' });
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
      console.error('Failed to disable push:', error);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleTestPush = async () => {
    if (testingPush) return;
    setTestingPush(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration) return;
      
      await registration.showNotification('🔔 测试通知 - StockWise AI', {
        body: `测试成功！当前时间: ${new Date().toLocaleTimeString('zh-CN')}`,
        icon: '/logo.png',
        badge: '/logo.png',
        data: { url: '/dashboard' }
      });
    } catch (e) {
      console.error('Local test notification failed', e);
    } finally {
      setTestingPush(false);
    }
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
              setTier('pro');
              setExpiresAt(data.expiresAt);
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
            setUserEmail(tempEmail);
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
        <div className={`fixed inset-0 z-[200] flex items-end justify-center bg-black/60 pointer-events-auto overflow-hidden ${!isHighPerformance ? 'backdrop-blur-sm' : ''}`}>
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 150) onClose();
            }}
            transition={isHighPerformance 
              ? { type: 'tween', ease: 'easeOut', duration: 0.25 }
              : { type: 'spring', damping: 25, stiffness: 200 }
            }
            className="w-full max-w-md bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto"
          >
            {/* 视觉拉手 */}
            <div className="w-full flex justify-center pt-3 pb-1">
               <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>

            <div className="p-8 pt-4 flex flex-col min-h-[60vh]">
              <header className="flex items-center justify-between mb-8">
                <div className="space-y-1.5">
                   <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1] animate-pulse" />
                    <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-bold">{showIdentityCenter ? 'Security Center' : 'Member Center'}</span>
                   </div>
                   <h2 className="text-3xl font-black italic tracking-tighter text-white">
                    {showIdentityCenter ? '安全核心' : '个人中心'} <span className="text-indigo-500 underline decoration-4 underline-offset-4" data-en={showIdentityCenter ? 'SECURE' : 'USER'}>{showIdentityCenter ? 'SECURE' : 'USER'}</span>
                   </h2>
                </div>
                <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </header>

              {showIdentityCenter ? (
                /* --- IDENTITY CENTER VIEW --- */
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <button 
                        onClick={() => setShowIdentityCenter(false)}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-bold"
                    >
                        <ArrowLeftRight className="w-4 h-4 rotate-180" /> 返回个人中心
                    </button>

                    <IdentityPassport 
                        userId={userId}
                        tier={tier}
                        emailLinked={userEmail}
                        onLinkEmail={() => setIsLinkingEmail(true)}
                    />

                    {isLinkingEmail && !userEmail && (
                        <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Mail size={14} className="text-indigo-400" />
                                    <span className="text-xs font-bold text-indigo-200">绑定支付/恢复邮箱</span>
                                </div>
                                <button onClick={() => setIsLinkingEmail(false)} className="text-slate-600 hover:text-slate-400"><X size={12} /></button>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                                绑定邮箱后，即使更换设备、重装应用或清空缓存，只要通过验证该邮箱，即可找回所有付费权益。
                            </p>
                            <div className="flex gap-2">
                                <input 
                                    type="email"
                                    value={tempEmail}
                                    onChange={(e) => setTempEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                                />
                                <button 
                                    onClick={handleLinkEmail}
                                    disabled={!tempEmail || isLinkingEmail}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                                >
                                    {isLinkingEmail ? '...' : '确定'}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                         <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <RefreshCw size={14} className="text-slate-500" />
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">手动恢复身份</span>
                            </div>
                         </div>
                         <p className="text-[10px] text-slate-500 mb-4 font-medium italic">如果您在其他设备上有 PRO 权益，或由于系统重装导致状态丢失，请在此输入备份的 User ID。</p>
                         <div className="flex gap-2">
                             <input 
                                type="text" 
                                value={restoreId}
                                onChange={(e) => setRestoreId(e.target.value.toLowerCase())}
                                placeholder="user_xxxxxxxxx"
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                             />
                             <button 
                                onClick={async () => {
                                    if (!restoreId || restoring) return;
                                    setRestoring(true);
                                    setRestoreMsg(null);
                                    const result = await restoreUserIdentity(restoreId);
                                    setRestoreMsg({ type: result.success ? 'success' : 'error', text: result.message });
                                    setRestoring(false);
                                    if (result.success) {
                                        setTimeout(() => window.location.reload(), 1500);
                                    }
                                }}
                                disabled={!restoreId || restoring}
                                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center"
                             >
                                {restoring ? <Loader2 className="animate-spin w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                             </button>
                         </div>
                         {restoreMsg && (
                            <p className={`text-[10px] mt-2 ${restoreMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {restoreMsg.text}
                            </p>
                         )}
                    </div>
                </div>
              ) : (
                /* --- MAIN MEMBER CENTER VIEW --- */
                <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                    {/* 用户卡片 */}
                    <div className="mb-5 p-1 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 relative overflow-hidden">
                        {tier === 'pro' && (
                            <div className="absolute top-0 right-0 p-3">
                                <Crown className="text-amber-400 w-6 h-6 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
                            </div>
                        )}
                        <div className="bg-[#0f0f16]/90 backdrop-blur rounded-[22px] p-6 flex items-center gap-5">
                        <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center relative ${tier === 'pro' ? 'border-amber-500/50 bg-amber-500/10' : 'bg-white/5 border-white/10'}`}>
                            {loading ? <Loader2 className="w-8 h-8 text-slate-400 animate-spin" /> : <User className={`w-8 h-8 ${tier === 'pro' ? 'text-amber-200' : 'text-slate-400'}`} />}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-black italic text-white">
                                {tier === 'pro' ? 'Pro Member' : 'Guest User'}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase ${
                                tier === 'pro' 
                                ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' 
                                : 'bg-slate-700/50 border-white/5 text-slate-300'
                            }`}>
                                {tier === 'pro' ? 'Pro Plan' : 'Free Plan'}
                            </span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                                    ID: {userId ? (userId.slice(0, 8) + '...' + userId.slice(-4)) : '...'}
                                </p>
                                {expiresAt && tier === 'pro' && (
                                    <p className="text-[10px] text-emerald-500/80 font-bold flex items-center gap-1.5">
                                        <ShieldCheck size={10} /> 有效期至: {expiresAt.split('T')[0]}
                                    </p>
                                )}
                            </div>
                        </div>
                        </div>
                    </div>

                    {/* 资源用量 */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="glass-card p-5 flex flex-col justify-between h-24">
                        <div className="flex items-center gap-2 text-slate-400">
                            <ShieldCheck size={16} />
                            <span className="text-xs font-bold uppercase">监控配额</span>
                        </div>
                        <div className="flex items-end gap-1.5">
                            <span className="text-2xl font-black text-white">{watchlistCount}</span>
                            <span className="text-sm font-bold text-slate-600 mb-1">/ {tier === 'pro' ? '10' : '3'}</span>
                        </div>
                        </div>

                        <div className={`glass-card p-5 flex flex-col justify-between h-24 ${tier === 'pro' ? 'border-amber-500/20 bg-amber-500/5' : 'opacity-60'}`}>
                        <div className={`flex items-center gap-2 ${tier === 'pro' ? 'text-amber-200' : 'text-slate-400'}`}>
                            <Zap size={16} />
                            <span className="text-xs font-bold uppercase">AI 分析</span>
                        </div>
                        <div className="flex items-end gap-1.5">
                            <span className={`text-[10px] font-black uppercase tracking-tighter ${tier === 'pro' ? 'text-amber-100' : 'text-slate-500'}`}>
                                {tier === 'pro' ? '混合架构推理链路' : '基础技术指标'}
                            </span>
                        </div>
                        </div>
                    </div>

                    {/* Action Grouping */}
                    <div className="space-y-3 mb-6">
                        <button 
                            onClick={() => setShowIdentityCenter(true)}
                            className={`w-full py-4 px-5 rounded-[24px] border transition-all flex items-center justify-between group ${
                                tier === 'pro' 
                                ? 'bg-amber-500/[0.03] border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/[0.06]' 
                                : 'bg-white/5 border-white/5 hover:border-white/10'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <ShieldCheck size={18} className={tier === 'pro' ? 'text-amber-400' : 'text-indigo-400'} />
                                <div className="text-left">
                                    <div className="flex items-center gap-2">
                                        <span className={`block text-sm font-bold ${tier === 'pro' ? 'text-amber-100' : 'text-white'}`}>身份备份与资产恢复</span>
                                        {userEmail && (
                                            <span className="flex items-center gap-1 text-[8px] px-1.5 py-0.25 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                <Mail size={8} /> 已挂载
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Digital ID & Recovery</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {!userEmail && tier === 'pro' && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                )}
                                <ChevronRight size={14} className="text-slate-600" />
                            </div>
                        </button>

                        <Link 
                            href="/pricing"
                            className={`w-full py-4 px-5 rounded-[24px] border transition-all flex items-center justify-between group ${
                                tier === 'pro' 
                                ? 'bg-white/[0.02] border-white/5 hover:border-indigo-500/20' 
                                : 'bg-indigo-500/5 border-indigo-500/10 hover:border-indigo-500/20'
                            }`}
                            onClick={() => onClose()}
                        >
                            <div className="flex items-center gap-3">
                                <Star size={18} className={tier === 'pro' ? 'text-indigo-400/50' : 'text-amber-400'} />
                                <div className="text-left">
                                    <span className="block text-sm font-bold text-white">
                                        {tier === 'pro' ? '查看价格权益计划' : '解锁专业投研权益'}
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase">Pricing & Strategy</span>
                                </div>
                            </div>
                            <ChevronRight size={14} className="text-slate-600" />
                        </Link>
                    </div>

                    {/* Notification Switch */}
                    {pushSupported && (
                        <div className="glass-card p-4 mb-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isSubscribed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>
                                        <Bell size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white">推送通知</h4>
                                    <div className="flex items-center gap-2">
                                        <Info size={12} className="text-slate-600" />
                                        <p className="text-[10px] text-slate-500 font-medium">信号与日报提醒</p>
                                    </div>
                                    </div>
                                </div>
                                <div>
                                    {isSubscribed ? (
                                        <button onClick={handleDisableNotifications} disabled={isSubscribing} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all">
                                            {isSubscribing ? '...' : '已开启'}
                                        </button>
                                    ) : (
                                        <button onClick={handleEnableNotifications} disabled={isSubscribing} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50">
                                            {isSubscribing ? '...' : '开启'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {isSubscribed && (
                            <div className="mt-3 pt-3 border-t border-white/5">
                                <button
                                onClick={() => setShowNotificationSettings(!showNotificationSettings)}
                                className="w-full flex items-center justify-between text-[10px] text-slate-500 hover:text-indigo-400 transition-colors py-1"
                                >
                                <span className="font-bold uppercase tracking-widest">高级通知偏好</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={handleTestPush} disabled={testingPush} className="text-[9px] text-indigo-400/60 hover:text-indigo-400 font-black uppercase tracking-widest">
                                        {testingPush ? 'Sending...' : 'Test Device'}
                                    </button>
                                    <ChevronDown className={`w-3 h-3 transition-transform ${showNotificationSettings ? 'rotate-180' : ''}`} />
                                </div>
                                </button>
                                
                                <AnimatePresence>
                                {showNotificationSettings && (
                                    <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                    >
                                    <div className="mt-3 space-y-1.5 pb-2">
                                        {[
                                        { key: 'signal_flip', icon: ArrowLeftRight, label: '信号翻转', badge: '重要' },
                                        { key: 'morning_call', icon: Sun, label: '每日早报', badge: '08:30' },
                                        { key: 'validation_glory', icon: Trophy, label: '验证战报', badge: '胜率' },
                                        { key: 'prediction_updated', icon: Zap, label: '预测更新', badge: '分析完成' },
                                        { key: 'daily_brief', icon: FileText, label: tier === 'pro' ? 'Pro 深度复盘' : '简报生成', badge: tier === 'pro' ? '⭐ 专属' : '17:30', isPro: tier === 'pro' },
                                        { key: 'price_update', icon: Info, label: '实时行情', badge: '盘中推送' },
                                        ].map((type) => {
                                        const isEnabled = notificationSettings.types[type.key as keyof typeof notificationSettings.types]?.enabled ?? true;
                                        const IconComponent = type.icon;
                                        const isPro = 'isPro' in type && type.isPro;
                                        return (
                                            <div key={type.key} className={`flex items-center justify-between py-1.5 ${isPro ? 'bg-amber-500/5 -mx-1 px-1 rounded-lg' : ''}`}>
                                            <div className="flex items-center gap-2.5 flex-1">
                                                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isPro ? 'bg-amber-500/20' : 'bg-white/5'}`}>
                                                <IconComponent className={`w-3.5 h-3.5 ${isPro ? 'text-amber-400' : 'text-indigo-400'}`} />
                                                </div>
                                                <span className={`text-[11px] font-medium ${isPro ? 'text-amber-200' : 'text-slate-200'}`}>{type.label}</span>
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded ${isPro ? 'bg-amber-500/20 text-amber-400 font-black' : 'bg-slate-800/60 text-slate-500 font-bold'}`}>{type.badge}</span>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                const newSettings = {
                                                    ...notificationSettings,
                                                    types: {
                                                    ...notificationSettings.types,
                                                    [type.key]: { enabled: !isEnabled },
                                                    },
                                                };
                                                setNotificationSettings(newSettings);
                                                try {
                                                    await fetch('/api/user/notification-settings', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ userId, settings: newSettings }),
                                                    });
                                                } catch (e) { console.error(e); }
                                                }}
                                                className={`w-9 h-5 rounded-full transition-all flex items-center px-0.5 ${isEnabled ? 'bg-indigo-600 justify-end' : 'bg-slate-700 justify-start'}`}
                                            >
                                                <motion.div className="w-4 h-4 bg-white rounded-full shadow" layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                                            </button>
                                            </div>
                                        );
                                        })}
                                    </div>
                                    </motion.div>
                                )}
                                </AnimatePresence>
                            </div>
                            )}
                        </div>
                    )}

                    {/* 激活码兑换区域 (Beta) */}
                    {MEMBERSHIP_CONFIG.switches.enableRedemption && tier === 'free' && (
                        <div className="mt-8 border-t border-white/5 pt-8">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Key size={14} className="text-slate-500" />
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">拥有激活码?</span>
                                </div>
                                {redeemMsg && (
                                    <span className={`text-[10px] font-bold ${redeemMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {redeemMsg.text}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={redeemCode}
                                    onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                                    placeholder="输入 PRO-XXXXXX"
                                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors uppercase font-mono"
                                />
                                <button 
                                    onClick={handleRedeem}
                                    disabled={!redeemCode || redeeming}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center"
                                >
                                    {redeeming ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 邀请好友区域 (Loot Logic) */}
                    {MEMBERSHIP_CONFIG.switches.enableReferralReward && (
                    <div className="mt-8">
                        <div className="p-4 rounded-[24px] bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5 relative overflow-hidden group">
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-black italic text-white flex items-center gap-2">
                                        邀请好友领 Pro
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-[8px] font-black uppercase not-italic">+{MEMBERSHIP_CONFIG.referral.referrerDays} Days</span>
                                    </h4>
                                    <Share2 className="w-4 h-4 text-indigo-400 opacity-50" />
                                </div>
                                <p className="text-[10px] text-slate-500 leading-tight mb-4 font-medium">
                                    每邀请 1 位新用户入池，你与好友均可自动获得 {MEMBERSHIP_CONFIG.referral.refereeDays} 天 Pro 会员权益。
                                </p>

                                {/* 收益看板 */}
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                        <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">可提现余额</div>
                                        <div className="text-lg font-black text-emerald-400">¥{referralBalance.toFixed(2)}</div>
                                    </div>
                                    <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                                        <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">累计收益 ({commissionRate * 100}%)</div>
                                        <div className="text-lg font-black text-white">¥{totalEarned.toFixed(2)}</div>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => {
                                        const url = `${window.location.origin}/dashboard?invite=${userId}`;
                                        navigator.clipboard.writeText(url);
                                        setRedeemMsg({ type: 'success', text: '邀请链接已复制！' });
                                        setTimeout(() => setRedeemMsg(null), 2000);
                                    }}
                                    className="w-full py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs font-bold text-indigo-300"
                                >
                                    {(redeemMsg?.text === '邀请链接已复制！') ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                                    {(redeemMsg?.text === '邀请链接已复制！') ? '已复制' : '复制分享链接'}
                                </button>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Demo/Reset Tools - Very Minimal */}
                    <div className="mt-12 text-center">
                        <button 
                            onClick={async () => {
                                localStorage.removeItem('STOCKWISE_HAS_ONBOARDED');
                                try {
                                    await fetch('/api/user/onboarding/reset', {
                                        method: 'POST',
                                        body: JSON.stringify({ userId })
                                    });
                                } catch (err) {
                                    console.error('Reset onboarding failed', err);
                                }
                                window.location.reload();
                            }}
                            className="text-[9px] text-slate-700 hover:text-slate-500 font-bold uppercase tracking-[0.2em] transition-colors"
                        >
                            Reset System Context & Onboarding
                        </button>
                    </div>  
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
