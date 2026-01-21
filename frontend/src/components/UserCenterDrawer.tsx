'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Crown, Zap, ShieldCheck, Loader2, ArrowRight, Share2, Check, RefreshCw, Key, Bell, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getWatchlist } from '@/lib/storage';
import { getCurrentUser, restoreUserIdentity } from '@/lib/user';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
import { isPushSupported, subscribeUserToPush } from '@/lib/notifications';
import { shouldEnableHighPerformance } from '@/lib/device-utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function UserCenterDrawer({ isOpen, onClose }: Props) {
  const isHighPerformance = shouldEnableHighPerformance();
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [userId, setUserId] = useState<string>('');
  const [tier, setTier] = useState<'free' | 'pro'>('free');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Redemption State
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  
  // Identity Restore State (for iOS PWA)
  const [showRestoreInput, setShowRestoreInput] = useState(false);
  const [restoreId, setRestoreId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<{type: 'success'|'error', text: string} | null>(null);
  const [redeemMsg, setRedeemMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  // Notification State
  const [_pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Notification Settings State
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<{
    enabled: boolean;
    types: Record<string, { enabled: boolean; priority: string }>;
  }>({
    enabled: true,
    types: {
      signal_flip: { enabled: true, priority: 'high' },
      morning_call: { enabled: true, priority: 'medium' },
      validation_glory: { enabled: true, priority: 'medium' },
      prediction_updated: { enabled: true, priority: 'low' },
      daily_brief: { enabled: true, priority: 'low' },
    },
  });

  // 测试推送通知
  const handleTestPush = async () => {
    if (testingPush) return;
    setTestingPush(true);
    setRedeemMsg(null);
    
    try {
      // 检查 Service Worker 是否就绪
      const registration = await navigator.serviceWorker.ready;
      if (!registration) {
        setRedeemMsg({ type: 'error', text: 'Service Worker 未就绪' });
        return;
      }
      
      // 通过 Service Worker 发送本地测试通知
      await registration.showNotification('🔔 测试通知 - StockWise', {
        body: `测试成功！当前时间: ${new Date().toLocaleTimeString('zh-CN')}`,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'test-notification',
        data: { url: '/dashboard' }
      });
      
      setRedeemMsg({ type: 'success', text: '测试通知已发送！' });
      setTimeout(() => setRedeemMsg(null), 3000);
    } catch (e) {
      console.error('Test push failed:', e);
      setRedeemMsg({ type: 'error', text: '测试失败: ' + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setTestingPush(false);
    }
  };

  useEffect(() => {
    const initUser = async () => {
      if (!isOpen) return;
      
      // 1. 统一通过 getCurrentUser 获取/生成用户 ID
      const user = await getCurrentUser();
      setUserId(user.userId);

      // 2. 获取本地监控数据
      const list = getWatchlist();
      setWatchlistCount(list.length);

      // 3. 获取服务端会员状态
      const referredBy = localStorage.getItem('STOCKWISE_REFERRED_BY');
      fetchProfile(user.userId, referredBy);
    };
    initUser();
  }, [isOpen]);

  useEffect(() => {
    const checkPushState = async () => {
        if (typeof window !== 'undefined' && isOpen) {
            setPushSupported(isPushSupported());
            if ('Notification' in window) {
                setPushPermission(Notification.permission);
            }
            // 检查是否已有订阅
            if ('serviceWorker' in navigator && Notification.permission === 'granted') {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    const subscription = await registration.pushManager.getSubscription();
                    setIsSubscribed(!!subscription);
                } catch (e) {
                    console.error('Error checking subscription:', e);
                }
            }
        }
        
        // Load notification settings if subscribed
        if (isSubscribed && userId) {
          try {
            const res = await fetch(`/api/user/notification-settings?userId=${userId}`);
            const data = await res.json();
            if (data.settings) {
              setNotificationSettings(data.settings);
            }
          } catch (e) {
            console.error('Failed to load notification settings:', e);
          }
        }
    };
    checkPushState();
  }, [isOpen, isSubscribed, userId]);

  const handleEnableNotifications = async () => {
    setIsSubscribing(true);
    setRedeemMsg(null);
    
    try {
        // 0. 准备身份
        let currentUserId = userId;
        if (!currentUserId) {
            const user = await getCurrentUser();
            currentUserId = user.userId;
            setUserId(currentUserId);
        }
        
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
             setRedeemMsg({ type: 'error', text: 'VAPID Key 未配置' });
             setIsSubscribing(false);
             return;
        }
        
        // 1. 注册/更新 Service Worker
        const { registerServiceWorker } = await import('@/lib/notifications');
        const registration = await registerServiceWorker();
        if (!registration) {
            setRedeemMsg({ type: 'error', text: 'Service Worker 注册失败' });
            setIsSubscribing(false);
            return;
        }
        
        // 2. 请求通知权限
        let perm = Notification.permission;
        if (perm !== 'granted') {
             perm = await Notification.requestPermission();
             setPushPermission(perm);
        }

        if (perm === 'granted') {
            // 3. 获取/创建订阅
            const swRegistration = await navigator.serviceWorker.ready;
            let subscription = await swRegistration.pushManager.getSubscription();
            
            if (!subscription) {
                subscription = await subscribeUserToPush(vapidKey);
            }
            
            if (subscription) {
                // 4. 保存到后端
                const response = await fetch('/api/notifications/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUserId, subscription: subscription.toJSON() })
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
        console.error('🔔 [Push] Error:', e);
        setRedeemMsg({ type: 'error', text: '开启失败，请重试' });
    } finally {
        setIsSubscribing(false);
    }
  };

  // 取消订阅推送通知
  const handleDisableNotifications = async () => {
    setIsSubscribing(true);
    console.log('🔔 [Push] Starting unsubscribe flow...');
    
    try {
        // 确保 userId 已加载
        let currentUserId = userId;
        if (!currentUserId) {
            const user = await getCurrentUser();
            currentUserId = user.userId;
        }
        
        // 1. 获取当前订阅
        const swRegistration = await navigator.serviceWorker.ready;
        const subscription = await swRegistration.pushManager.getSubscription();
        
        if (subscription) {
            const endpoint = subscription.endpoint;
            
            // 2. 取消浏览器订阅
            await subscription.unsubscribe();
            console.log('🔔 [Push] Browser subscription removed');
            
            // 3. 通知后端删除订阅记录
            const response = await fetch('/api/notifications/unsubscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, endpoint })
            });
            
            if (response.ok) {
                console.log('🔔 [Push] ✅ Subscription removed from backend');
                setIsSubscribed(false);
                setPushPermission('default'); // 重置权限状态显示
                setRedeemMsg({ type: 'success', text: '已关闭通知' });
                setTimeout(() => setRedeemMsg(null), 3000);
            } else {
                console.error('🔔 [Push] ❌ Backend unsubscribe failed');
                setRedeemMsg({ type: 'error', text: '后端取消失败' });
            }
        } else {
            console.log('🔔 [Push] No subscription to remove');
            setIsSubscribed(false);
            setRedeemMsg({ type: 'success', text: '已关闭通知' });
            setTimeout(() => setRedeemMsg(null), 3000);
        }
    } catch (e) {
        console.error('🔔 [Push] ❌ Unsubscribe error:', e);
        setRedeemMsg({ type: 'error', text: '关闭失败: ' + (e instanceof Error ? e.message : String(e)) });
    } finally {
        setIsSubscribing(false);
    }
  };

  const fetchProfile = async (uid: string, referredBy: string | null = null) => {
      setLoading(true);
      try {
          // 获取本地 watchlist
          const localWatchlist = getWatchlist();
          
          // 使用 POST 请求同步数据并获取资料
          const res = await fetch('/api/user/profile', {
              method: 'POST',
              body: JSON.stringify({
                  userId: uid,
                  watchlist: localWatchlist,
                  referredBy: referredBy
              })
          });
          const data = await res.json();
          if (data.tier) {
              setTier(data.tier);
              setExpiresAt(data.expiresAt);
              
              // 使用云端返回的 watchlistCount (source of truth)
              if (typeof data.watchlistCount === 'number') {
                  setWatchlistCount(data.watchlistCount);
              }
              
              // 同步成功后，如果记录了 invite，可以清除以防重复提交（可选）
              // localStorage.removeItem('STOCKWISE_REFERRED_BY');
          }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
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
                    <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-bold">Member Center</span>
                   </div>
                   <h2 className="text-3xl font-black italic tracking-tighter text-white">
                    个人中心 <span className="text-indigo-500 underline decoration-4 underline-offset-4" data-en="USER">USER</span>
                   </h2>
                </div>
                <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </header>

              {/* 用户卡片 */}
              <div className="mb-8 p-1 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 relative overflow-hidden">
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
                      <p className="text-xs text-slate-500 mono flex items-center gap-2">
                        ID: {userId.slice(0, 12)}...
                        <button 
                          onClick={() => setShowRestoreInput(!showRestoreInput)}
                          className="text-slate-600 hover:text-indigo-400 transition-colors p-0.5"
                          title="恢复身份"
                        >
                          <Key size={10} />
                        </button>
                      </p>
                     {expiresAt && tier === 'pro' && (
                         <p className="text-[10px] text-emerald-500/80 mt-1">
                             有效期至: {expiresAt.split('T')[0]}
                         </p>
                     )}
                   </div>
                </div>
              </div>

              {/* 资源用量 */}
              <div className="grid grid-cols-2 gap-4 mb-8">
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
                     <span className={`text-sm font-bold ${tier === 'pro' ? 'text-amber-100' : 'text-white'}`}>
                         {tier === 'pro' ? '深度推理链' : '基础版'}
                     </span>
                   </div>
                </div>
              </div>

              {/* Notification Switch (PWA Only) - Upgraded with Type Settings */}
              {pushSupported && (
                 <div className="glass-card p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isSubscribed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-400'}`}>
                                <Bell size={18} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-white">推送通知</h4>
                                <div className="flex items-center gap-2">
                                    <p className="text-[10px] text-slate-500">AI 信号与日报提醒</p>
                                    {isSubscribed && (
                                        <button onClick={handleTestPush} disabled={testingPush} className="text-[10px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 disabled:opacity-50">
                                            {testingPush ? '...' : '测试'}
                                        </button>
                                    )}
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
                    
                    {/* Expandable Notification Type Settings */}
                    {isSubscribed && (
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <button
                          onClick={() => setShowNotificationSettings(!showNotificationSettings)}
                          className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-indigo-400 transition-colors py-1"
                        >
                          <span className="font-bold">通知类型设置</span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${showNotificationSettings ? 'rotate-180' : ''}`} />
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
                              <div className="mt-3 space-y-2">
                                {[
                                  { key: 'signal_flip', icon: '🚨', label: '信号翻转', desc: 'AI观点重大转变' },
                                  { key: 'morning_call', icon: '☕', label: '每日早报', desc: '08:30 开盘提醒' },
                                  { key: 'validation_glory', icon: '🏅', label: '验证战报', desc: '预测成功反馈' },
                                  { key: 'prediction_updated', icon: '🤖', label: '预测更新', desc: '分析完成通知' },
                                  { key: 'daily_brief', icon: '📊', label: '简报生成', desc: '个性化简报就绪' },
                                ].map((type) => {
                                  const isEnabled = notificationSettings.types[type.key]?.enabled ?? true;
                                  return (
                                    <div key={type.key} className="flex items-center justify-between py-1">
                                      <div className="flex items-center gap-2 flex-1">
                                        <span className="text-base">{type.icon}</span>
                                        <div className="flex-1">
                                          <p className="text-[11px] font-bold text-white">{type.label}</p>
                                          <p className="text-[9px] text-slate-600">{type.desc}</p>
                                        </div>
                                      </div>
                                      <button
                                        onClick={async () => {
                                          const newSettings = {
                                            ...notificationSettings,
                                            types: {
                                              ...notificationSettings.types,
                                              [type.key]: { ...notificationSettings.types[type.key], enabled: !isEnabled },
                                            },
                                          };
                                          setNotificationSettings(newSettings);
                                          try {
                                            await fetch('/api/user/notification-settings', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ userId, settings: newSettings }),
                                            });
                                            setRedeemMsg({ type: 'success', text: '设置已保存' });
                                            setTimeout(() => setRedeemMsg(null), 1500);
                                          } catch (e) {
                                            console.error('Failed to save settings:', e);
                                            setRedeemMsg({ type: 'error', text: '保存失败' });
                                          }
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

              {/* 激活码兑换区域 (Beta) - 仅在开关开启时显示 */}
              {MEMBERSHIP_CONFIG.switches.enableRedemption && tier === 'free' && (
                  <div className="mt-8">
                      <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">拥有激活码?</span>
                          {redeemMsg && (
                              <span className={`text-xs ${redeemMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
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

              {/* 邀请好友区域 (Loot Logic) - 仅在开关开启时显示 */}
              {MEMBERSHIP_CONFIG.switches.enableReferralReward && (
              <div className="mt-auto pt-8">
                  <div className="p-5 rounded-[24px] bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/5 relative overflow-hidden group">
                      <div className="relative z-10">
                          <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-black italic text-white flex items-center gap-2">
                                  邀请好友领 Pro
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-[8px] font-black uppercase not-italic">+{MEMBERSHIP_CONFIG.referral.referrerDays} Days</span>
                              </h4>
                              <Share2 className="w-4 h-4 text-indigo-400 opacity-50" />
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight mb-4">
                              每邀请 1 位新用户入池，你与好友均可自动获得 {MEMBERSHIP_CONFIG.referral.refereeDays} 天 Pro 会员权益。
                          </p>
                          <button 
                            onClick={() => {
                                const url = `${window.location.origin}/dashboard?invite=${userId}`;
                                navigator.clipboard.writeText(url);
                                // Simple toast equivalent
                                setRedeemMsg({ type: 'success', text: '邀请链接已复制！' });
                                setTimeout(() => setRedeemMsg(null), 2000);
                            }}
                            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-xs font-bold text-indigo-300"
                          >
                              {redeemMsg?.text === '邀请链接已复制！' ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                              {redeemMsg?.text === '邀请链接已复制！' ? '已复制' : '复制分享链接'}
                          </button>
                      </div>
                      <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-indigo-500/5 blur-[40px] rounded-full group-hover:bg-indigo-500/10 transition-colors" />
                  </div>
              </div>
              )}

              {/* 身份恢复区域 */}
              {showRestoreInput && (
                <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                        <RefreshCw size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">恢复身份</span>
                    </div>
                    {restoreMsg && (
                        <p className={`text-xs mb-2 ${restoreMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {restoreMsg.text}
                        </p>
                    )}
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
                </div>
              )}
              
              <div className="mt-4 pb-4 border-t border-white/5 pt-4">
                 <button 
                    onClick={async () => {
                        // Reset both localStorage and database
                        localStorage.removeItem('STOCKWISE_HAS_ONBOARDED');
                        try {
                            await fetch('/api/user/onboarding/reset', {
                                method: 'POST',
                                body: JSON.stringify({ userId })
                            });
                        } catch (e) {
                            console.error('Reset onboarding failed', e);
                        }
                        window.location.reload();
                    }}
                    className="w-full py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-slate-500 font-bold flex items-center justify-center gap-2"
                 >
                    <Zap size={14} /> 重播引导流程 (演示用)
                 </button>
              </div>  
              
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
