'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Search, ChevronRight, LayoutGrid, Target } from 'lucide-react';
import { getCurrentUser } from '@/lib/user';
import { useRouter } from 'next/navigation';

interface AddStockDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToStockPool?: () => void;  // 继续右滑进入监控池
  onStockAdded?: () => void;     // 添加股票成功后的回调
}

export function AddStockDrawer({ isOpen, onClose, onGoToStockPool, onStockAdded }: AddStockDrawerProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{symbol: string; name: string; market?: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [tier, setTier] = useState<'free' | 'pro'>('free');
  const [stockCount, setStockCount] = useState(0);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // 手势检测
  const [touchStartX, setTouchStartX] = useState(0);

  // 获取用户信息和股票数量
  useEffect(() => {
    if (!isOpen) return;
    const init = async () => {
      const user = await getCurrentUser();
      if (!user) return;
      try {
        // 获取 tier
        const profileRes = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.userId, watchlist: [] })
        });
        const profileData = await profileRes.json();
        setTier(profileData.tier || 'free');
        
        // 获取当前股票数量
        const poolRes = await fetch(`/api/stock-pool?userId=${user.userId}`, { cache: 'no-store' });
        const poolData = await poolRes.json();
        setStockCount(poolData.stocks?.length || 0);
      } catch (e) { console.error(e); }
    };
    init();
  }, [isOpen]);

  // 搜索防抖
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stock/search?q=${searchQuery}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch (e) { console.error('Search failed', e); }
      setIsSearching(false);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 添加股票
  const handleAdd = useCallback(async (symbol: string, name: string) => {
    const user = await getCurrentUser();
    if (!user) return;
    
    const limit = tier === 'pro' ? 10 : 3;
    if (stockCount >= limit) {
      setLimitMsg(`容量已满 (${stockCount}/${limit})`);
      setTimeout(() => setLimitMsg(null), 3000);
      return;
    }
    
    setIsAdding(true);
    try {
      const response = await fetch('/api/stock-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, symbol, name })
      });
      if (response.ok) {
        setSuccessMsg(`"${name}" 已加入监控`);
        setStockCount(prev => prev + 1);
        setSearchQuery('');
        setSearchResults([]);
        setTimeout(() => {
          setSuccessMsg(null);
          onStockAdded?.();
        }, 1500);
      }
    } catch (e) { console.error('Add failed', e); }
    setIsAdding(false);
  }, [tier, stockCount, onStockAdded]);

  // 处理触摸手势 - 继续右滑进入监控池
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    // 右滑超过 100px 进入监控池
    if (deltaX > 100 && onGoToStockPool) {
      onClose();
      onGoToStockPool();
    }
    // 左滑超过 80px 关闭抽屉
    if (deltaX < -80) {
      onClose();
    }
  };

  // 重置状态
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setLimitMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const limit = tier === 'pro' ? 10 : 3;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200]"
          />
          
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="fixed left-0 top-0 bottom-0 w-full bg-[#050508] z-[201] flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)]"
          >
            {/* Header Area */}
            <div className="pt-12 px-8 pb-6 space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1] animate-pulse" />
                    <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-bold">Quick Engine</span>
                  </div>
                  <h2 className="text-3xl font-black italic tracking-tighter text-white">
                    ADD <span className="text-indigo-500 underline decoration-4 underline-offset-4">STOCK</span>
                  </h2>
                </div>
                <button 
                  onClick={onClose}
                  className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center active:scale-90 transition-all hover:bg-white/10"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/10 to-transparent rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 transition-colors group-focus-within:text-indigo-400" />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="代码 / 名称 / 拼音首字母"
                    className="w-full bg-[#0a0a0f] border border-white/10 rounded-2xl pl-12 pr-4 py-4.5 text-base font-medium focus:outline-none focus:border-indigo-500/40 transition-all placeholder:text-slate-700 shadow-inner"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                  <span className="text-slate-500">
                    <span className="text-white">{stockCount}</span> / {limit} 已使用
                  </span>
                  <span className={`${tier === 'pro' ? 'text-indigo-400' : 'text-slate-600'}`}>
                    {tier} Plan
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(stockCount / limit) * 100}%` }}
                    className={`h-full rounded-full relative ${stockCount >= limit ? 'bg-rose-500' : 'bg-gradient-to-r from-indigo-600 to-indigo-400'}`}
                  >
                    <div className="absolute top-0 right-0 bottom-0 w-12 bg-white/10 blur-md" />
                  </motion.div>
                </div>
              </div>
            </div>
            
            <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3.5 scrollbar-hide">
              <AnimatePresence mode="wait">
                {limitMsg && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-4.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center"
                  >
                    <p className="text-rose-400 text-xs font-black uppercase tracking-tight">{limitMsg}</p>
                  </motion.div>
                )}
                
                {successMsg && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-4.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center"
                  >
                    <p className="text-emerald-400 text-xs font-black uppercase tracking-tight">{successMsg}</p>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {isSearching ? (
                <div className="py-24 flex flex-col items-center gap-5 opacity-40">
                  <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Connecting to Market...</span>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((item, idx) => {
                  const isHK = item.market === 'HK';
                  const suffix = isHK ? '.HK' : (item.symbol.startsWith('6') ? '.SH' : '.SZ');
                  return (
                    <motion.button
                      key={item.symbol}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      onClick={() => handleAdd(item.symbol, item.name)}
                      disabled={isAdding}
                      className="w-full flex items-center justify-between p-5 bg-white/5 border border-white/[0.03] rounded-3xl hover:bg-white/10 active:scale-[0.98] transition-all group"
                    >
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[11px] font-black border ${isHK ? 'bg-blue-500/5 border-blue-500/10 text-blue-400' : 'bg-rose-500/5 border-rose-500/10 text-rose-400'}`}>
                          {isHK ? 'HK' : 'CN'}
                        </div>
                        <div className="text-left">
                          <p className="text-[16px] font-black tracking-tight text-white group-hover:text-indigo-400 transition-colors leading-tight">{item.name}</p>
                          <p className="text-[11px] text-slate-500 font-bold mono uppercase tracking-widest mt-0.5">{item.symbol}{suffix}</p>
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-lg shadow-black/20">
                        <Plus size={18} />
                      </div>
                    </motion.button>
                  );
                })
              ) : searchQuery.trim() ? (
                <div className="py-24 text-center space-y-3 opacity-30">
                  <Target size={40} className="mx-auto text-slate-500" />
                  <p className="text-xs font-black uppercase tracking-widest">Target Lost</p>
                </div>
              ) : (
                <div className="py-32 flex flex-col items-center opacity-15 text-center gap-6">
                  <div className="relative">
                    <Search size={56} className="text-slate-400" />
                    <motion.div 
                      animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="absolute -inset-6 bg-indigo-500/30 blur-2xl rounded-full"
                    />
                  </div>
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-500">Awaiting Signal</p>
                </div>
              )}
            </div>

            {/* Bottom Insight Area */}
            <div className="px-6 pb-10 pt-4">
              <button
                onClick={() => {
                  onClose();
                  router.push('/dashboard/stock-pool');
                }}
                className="w-full relative group p-6 rounded-[28px] overflow-hidden transition-all active:scale-[0.97]"
              >
                <div className="absolute inset-0 bg-white/5 border border-white/10 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/40 transition-all shadow-xl" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-[1.25rem] bg-indigo-500/15 flex items-center justify-center border border-indigo-500/20">
                      <LayoutGrid className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="text-left flex flex-col justify-center">
                      <p className="text-sm font-black text-white italic tracking-tight leading-none mb-1.5 flex items-center gap-2">
                        MONITORING POOL
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">管理自选监控资产</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 text-slate-600 group-hover:text-indigo-400 transition-colors">
                    <span className="text-[8px] font-black uppercase tracking-tighter opacity-60">Swipe</span>
                    <ChevronRight className="w-4 h-4 animate-bounce-x" />
                  </div>
                </div>
              </button>
            </div>
          </motion.div>

          <style jsx>{`
            .scrollbar-hide::-webkit-scrollbar { display: none; }
            .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            @keyframes bounce-x {
              0%, 100% { transform: translateX(0); }
              50% { transform: translateX(4px); }
            }
            .animate-bounce-x {
              animation: bounce-x 1.5s infinite;
            }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
}
