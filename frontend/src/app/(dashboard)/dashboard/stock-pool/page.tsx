'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ArrowLeft, TrendingUp, TrendingDown, Minus, LayoutGrid } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, type User } from '@/lib/user';
import { motion, AnimatePresence } from 'framer-motion';
import { getMarketScene } from '@/lib/date-utils';

import { useWatchlist } from '@/hooks/useWatchlist';
import { useUserProfile } from '@/hooks/useUserProfile';

interface StockSnapshot {
  symbol: string;
  name: string;
  price: number;
  change: number;
  aiSignal: 'Long' | 'Short' | 'Side';
  updateTag?: string;
}

const POOL_CACHE_KEY = 'stockwise_pool_prices_v1';

export default function StockPoolPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  
  // New Hook Usage
  const { watchlist, addStock, removeStock, loading: loadingList } = useWatchlist();
  const [prices, setPrices] = useState<Record<string, Partial<StockSnapshot>>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);

  // 1. 初始化：尝试从本地缓存读取行情，实现【秒开】
  useEffect(() => {
    try {
        const cached = localStorage.getItem(POOL_CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object') {
                console.log('🚀 Loading pool prices from local cache');
                setPrices(parsed);
            }
        }
    } catch (e) {
        console.error('Failed to load pool cache', e);
    }
  }, []);

  // Derived State for UI
  const stocks: StockSnapshot[] = watchlist.map(item => ({
    symbol: item.symbol,
    name: item.name,
    price: prices[item.symbol]?.price || 0,
    change: prices[item.symbol]?.change || 0,
    aiSignal: prices[item.symbol]?.aiSignal || 'Side',
    updateTag: prices[item.symbol]?.updateTag
  }));

  // Compounded loading state
  const loading = loadingList || (loadingPrices && Object.keys(prices).length === 0);
  
  const [newSymbol, setNewSymbol] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [searchResults, setSearchResults] = useState<{symbol: string; name: string; market?: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [stockToDelete, setStockToDelete] = useState<StockSnapshot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const scene = getMarketScene();
  const isPreMarket = scene === 'pre_market';

  const { tier } = useUserProfile();

  useEffect(() => {
    const init = async () => {
        const u = await getCurrentUser();
        setUser(u);
    };
    init();
  }, []);

  // Hydrate Prices (Data Fetching)
  const fetchPrices = useCallback(async (silent = false) => {
    if (watchlist.length === 0) return;
    if (!silent) setLoadingPrices(true);
    
    try {
      const symbols = watchlist.map(w => w.symbol).join(',');
      // 只有非静默刷新（手动进入或添加）时刺穿缓存，后台轮询依然走 CDN
      const url = `/api/stock/batch?symbols=${symbols}${!silent ? `&t=${Date.now()}` : ''}`;
      const batchRes = await fetch(url);
      const batchData = await batchRes.json();
      
      const newPrices: Record<string, Partial<StockSnapshot>> = {};
      (batchData.stocks || []).forEach((detail: { 
          symbol: string; 
          price?: { close: number; change_percent: number }; 
          prediction?: { signal: 'Long' | 'Short' | 'Side' };
          lastUpdated?: string;
      }) => {
          newPrices[detail.symbol] = {
              price: detail.price?.close || 0,
              change: detail.price?.change_percent || 0,
              aiSignal: detail.prediction?.signal || 'Side',
              updateTag: detail.lastUpdated
          };
      });
      setPrices(newPrices);
      
      // 2. 写入缓存：确保下次进入页面能瞬间看到最后一次行情
      try {
        localStorage.setItem(POOL_CACHE_KEY, JSON.stringify(newPrices));
      } catch (e) { console.error('Cache save error', e); }
      
    } catch (err) {
      console.error('Failed to hydrate prices', err);
    } finally {
      if (!silent) setLoadingPrices(false);
    }
  }, [watchlist]);

  useEffect(() => {
      fetchPrices();
      // 后台自动轮询设置 silent = true，这样会命中 CDN 缓存，保护服务器
      const interval = setInterval(() => fetchPrices(true), 30000); 
      return () => clearInterval(interval);
  }, [fetchPrices]);


  useEffect(() => {
    const timer = setTimeout(async () => {
      if (newSymbol.trim()) {
        try {
          const res = await fetch(`/api/stock/search?q=${newSymbol}`);
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowSuggestions(true);
        } catch (e) { console.error('Search failed', e); }
      } else {
        setSearchResults([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newSymbol]);

  const handleAdd = async (symbolOverride?: string, nameOverride?: string) => {
    const targetSymbol = symbolOverride || newSymbol.trim();
    if (!targetSymbol || !user) return;
    
    const limit = tier === 'pro' ? 10 : 3;
    if (watchlist.length >= limit) {
      setLimitMsg(tier === 'pro' ? '已达到 Pro 版 10 只监控上限' : '已达到免费版 3 只上限，升级 Pro 可扩展至 10 只');
      setTimeout(() => setLimitMsg(null), 3000);
      return;
    }

    // Call Hook (Optimistic)
    const success = await addStock(targetSymbol, nameOverride || targetSymbol);
    
    if (success) {
        setNewSymbol('');
        setShowAdd(false);
        setShowSuggestions(false);
        // Prices will naturally update due to useEffect dependency on watchlist
    }
  };

  const handleRemoveClick = (e: React.MouseEvent, stock: StockSnapshot) => {
    e.preventDefault(); e.stopPropagation();
    setStockToDelete(stock);
  };

  const confirmDelete = async () => {
    if (!stockToDelete || !user) return;
    setIsDeleting(true);
    
    // Call Hook (Optimistic)
    await removeStock(stockToDelete.symbol);
    
    setStockToDelete(null);
    setIsDeleting(false);
  };

  const getSignalMeta = (signal: string) => {
    switch(signal) {
      case 'Long': return { text: '建议做多', color: 'bg-emerald-500', iconColor: 'text-emerald-500', bgColor: 'bg-emerald-500/10 border-emerald-500/20' };
      case 'Short': return { text: '建议避险', color: 'bg-rose-500', iconColor: 'text-rose-500', bgColor: 'bg-rose-500/10 border-rose-500/20' };
      default: return { text: '建议观望', color: 'bg-amber-500', iconColor: 'text-amber-500', bgColor: 'bg-amber-500/10 border-amber-500/20' };
    }
  };

  // Main Content
  return (
    <div 
      className="fixed inset-0 bg-[#050508] text-white overflow-hidden flex flex-col font-sans"
      onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX === null) return;
        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchEndX - touchStartX;
        
        // Swipe Left (Right to Left) -> Go back to Dashboard
        if (deltaX < -100) router.push('/dashboard');
        setTouchStartX(null);
      }}
    >
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none bg-indigo-500 blur-[120px] scale-150" />

      {/* Solid/Stable Header Structure (Like Brief Page) */}
      <header className="shrink-0 z-20 p-8 flex items-center justify-between bg-[#050508] border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_#6366f1] animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-bold">自选监控</span>
            </div>
            <h1 className="text-2xl font-black italic tracking-tighter text-white">
              监控池 <span className="text-indigo-500 underline decoration-2 underline-offset-4" data-en="POOL">POOL</span>
            </h1>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className={`p-3 rounded-2xl border transition-all active:scale-95 ${showAdd ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-indigo-400'}`}>
           <Plus className={`w-5 h-5 transition-transform duration-300 ${showAdd ? 'rotate-45' : ''}`} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
        <AnimatePresence>
          {showAdd && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="mb-8 glass-card p-4 border-indigo-500/20 bg-indigo-500/5"
            >
              <div className="relative">
                <input 
                  autoFocus
                  placeholder="输入代码、名称或拼音首字母 (如: GZMT)"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 mono text-sm focus:outline-none focus:border-indigo-500/50"
                />
                <AnimatePresence>
                  {limitMsg && (
                    <motion.p 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-3 text-rose-400 text-[10px] font-bold text-center uppercase tracking-widest"
                    >
                      {limitMsg}
                    </motion.p>
                  )}
                </AnimatePresence>
                {showSuggestions && searchResults.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map(item => {
                      const isHK = item.market === 'HK';
                      const suffix = isHK ? '.HK' : '';
                      return (
                        <button key={item.symbol} onClick={() => handleAdd(item.symbol, item.name)} className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black ${isHK ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {isHK ? '港' : 'A'}
                            </div>
                            <div className="text-left">
                               <p className="text-sm font-bold">{item.name}</p>
                               <p className="text-[10px] text-slate-500 mono uppercase">{item.symbol}{suffix}</p>
                            </div>
                          </div>
                          <Plus size={16} className="text-slate-500" />
                        </button>
                      );
                    })}
                  </div>
                )}
                {showSuggestions && searchResults.length === 0 && newSymbol.trim().length > 0 && (
                  <div className="mt-4 py-8 text-center text-slate-500 text-xs">
                    <p className="mb-1">未找到匹配的股票</p>
                    <p className="text-[10px] text-slate-600">试试输入完整代码或拼音首字母</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] px-2 mb-4">监控标的 ({stocks.length})</h2>
          {loading && !stocks.length ? (
            [1, 2, 3].map(i => <div key={i} className="glass-card h-24 animate-pulse" />)
          ) : stocks.length === 0 ? (
            <div className="py-20 flex flex-col items-center opacity-20 text-center">
              <LayoutGrid size={48} className="mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">暂无资产</p>
            </div>
          ) : (
            stocks.map(stock => {
              const meta = getSignalMeta(stock.aiSignal);
              return (
                <motion.div 
                  key={stock.symbol}
                  layout
                  onClick={() => router.push(`/dashboard?symbol=${stock.symbol}`)}
                  className="glass-card p-5 group hover:bg-white/[0.04] transition-all cursor-pointer relative"
                >
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-4">
                       <div className={`w-14 h-14 rounded-[22px] flex items-center justify-center border-2 ${meta.bgColor}`}>
                          {stock.aiSignal === 'Long' ? <TrendingUp className={meta.iconColor} /> :
                           stock.aiSignal === 'Short' ? <TrendingDown className={meta.iconColor} /> : <Minus className={meta.iconColor} />}
                       </div>
                       <div>
                         <h3 className="text-base font-black italic tracking-tighter text-white">{stock.name}</h3>
                         <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                           <span className={`w-1 h-1 rounded-full ${meta.color}`} />
                           {meta.text}
                         </p>
                       </div>
                     </div>
                     
                     <div className="flex items-center gap-6">
                       <div className="text-right">
                         {!isPreMarket ? (
                           <>
                             <p className="text-xl font-black mono tracking-tighter text-white">
                               {stock.price > 0 ? stock.price.toFixed(2) : '--.--'}
                             </p>
                               <p className={`text-[10px] font-black mono ${stock.change > 0 ? 'text-emerald-500' : stock.change < 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                                 {stock.price > 0 ? `${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%` : '同步中...'}
                               </p>
                               {stock.updateTag && (
                                 <p className="text-[8px] text-slate-500 mono mt-1 font-bold">
                                   {stock.updateTag}
                                 </p>
                               )}
                             </>
                           ) : (
                           <p className="text-[10px] text-slate-600 font-black italic uppercase tracking-widest">盘前静默</p>
                         )}
                       </div>
                       <button 
                         onClick={(e) => { e.stopPropagation(); handleRemoveClick(e, stock); }}
                         className="p-3 opacity-60 hover:opacity-100 transition-all text-slate-500 hover:text-rose-500 active:scale-75 z-20 relative"
                       >
                         <Trash2 size={20} />
                       </button>
                     </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {stockToDelete && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDeleting && setStockToDelete(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm glass-card p-8 border-rose-500/20 bg-[#0a0a0f] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6">
                  <Trash2 className="text-rose-500" size={28} />
                </div>
                <h3 className="text-xl font-black italic tracking-tighter mb-2 text-white">确认移除？</h3>
                <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                  确定要从监控池中移除 <span className="text-white font-bold">{stockToDelete.name} ({stockToDelete.symbol})</span> 吗？此操作不可撤销。
                </p>
                <div className="flex gap-3 w-full">
                  <button 
                    disabled={isDeleting}
                    onClick={() => setStockToDelete(null)}
                    className="flex-1 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button 
                    disabled={isDeleting}
                    onClick={confirmDelete}
                    className="flex-1 px-6 py-4 rounded-2xl bg-rose-500 text-white text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_10px_20px_rgba(244,63,94,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isDeleting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '确认移除'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .glass-card { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 32px; }
      `}</style>
    </div>
  );
}
