'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Crown, Zap, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getWatchlist } from '@/lib/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function UserCenterDrawer({ isOpen, onClose }: Props) {
  const [watchlistCount, setWatchlistCount] = useState(0);
  const [userId, setUserId] = useState<string>('');
  const [tier, setTier] = useState<'free' | 'pro'>('free');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Redemption State
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  useEffect(() => {
    if (isOpen) {
      // 1. 获取/生成 UserID
      let uid = localStorage.getItem('STOCKWISE_USER_ID');
      if (!uid) {
          uid = 'user_' + Math.random().toString(36).substr(2, 9);
          localStorage.setItem('STOCKWISE_USER_ID', uid);
      }
      setUserId(uid);

      // 2. 获取本地监控数据
      const list = getWatchlist();
      setWatchlistCount(list.length);

      // 3. 获取服务端会员状态
      fetchProfile(uid);
    }
  }, [isOpen]);

  const fetchProfile = async (uid: string) => {
      setLoading(true);
      try {
          // 获取本地 watchlist
          const localWatchlist = getWatchlist();
          
          // 使用 POST 请求同步数据并获取资料
          const res = await fetch('/api/user/profile', {
              method: 'POST',
              body: JSON.stringify({
                  userId: uid,
                  watchlist: localWatchlist
              })
          });
          const data = await res.json();
          if (data.tier) {
              setTier(data.tier);
              setExpiresAt(data.expiresAt);
          }
        } catch (_e) {
            console.error(_e);
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
        } catch (_e) {
            setRedeemMsg({ type: 'error', text: '网络请求失败' });
        } finally {
            setRedeeming(false);
        }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm pointer-events-auto overflow-hidden">
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
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-md bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto"
          >
            {/* 视觉拉手 */}
            <div className="w-full flex justify-center pt-3 pb-1">
               <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>

            <div className="p-8 pt-4 flex flex-col min-h-[60vh]">
              <header className="flex items-center justify-between mb-8">
                <div>
                   <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">MEMBER CENTER</span>
                   <h2 className="text-xl font-black italic tracking-tighter text-white">个人中心</h2>
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
                     <p className="text-xs text-slate-500 mono">ID: {userId.slice(0, 12)}...</p>
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
                <div className="glass-card p-5">
                   <div className="flex items-center gap-2 mb-3 text-slate-400">
                     <ShieldCheck size={16} />
                     <span className="text-xs font-bold uppercase">监控配额</span>
                   </div>
                   <div className="flex items-end gap-1.5">
                     <span className="text-2xl font-black text-white">{watchlistCount}</span>
                     <span className="text-sm font-bold text-slate-600 mb-1">/ {tier === 'pro' ? '10' : '3'}</span>
                   </div>
                   <div className="w-full h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
                     <div className={`h-full ${tier === 'pro' ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min((watchlistCount / (tier === 'pro' ? 10 : 3)) * 100, 100)}%` }} />
                   </div>
                </div>

                <div className={`glass-card p-5 ${tier === 'pro' ? 'border-amber-500/20 bg-amber-500/5' : 'opacity-60'}`}>
                   <div className={`flex items-center gap-2 mb-3 ${tier === 'pro' ? 'text-amber-200' : 'text-slate-400'}`}>
                     <Zap size={16} />
                     <span className="text-xs font-bold uppercase">AI 分析</span>
                   </div>
                   <div className="flex items-end gap-1.5">
                     <span className={`text-sm font-bold ${tier === 'pro' ? 'text-amber-100' : 'text-white'}`}>
                         {tier === 'pro' ? '深度推理链' : '基础版'}
                     </span>
                   </div>
                   <p className={`text-[10px] mt-2 leading-tight ${tier === 'pro' ? 'text-amber-500/70' : 'text-slate-500'}`}>
                       {tier === 'pro' ? '已解锁 Gemini Pro 完整能力' : '升级 Pro 解锁深度推理链'}
                   </p>
                </div>
              </div>

              {/* 激活码兑换区域 (Beta) */}
              {tier === 'free' && (
                  <div className="mt-auto">
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
              
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
