'use client';

import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { Plus, Trash2, ArrowLeft, TrendingUp, TrendingDown, Minus, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getMarketScene } from '@/lib/date-utils';

import { useStocks } from '@/context/StockContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { getPredictionActionMeta } from '@/lib/layer1-ui';
import type { AIPrediction } from '@/lib/types';
import { writeDashboardNavIntentSymbol } from '@/lib/dashboard-symbol-navigation';
import { useT, useLocale } from '@/context/LocaleContext';
import { getLocalizedStockName } from '@/lib/stock-name';

interface StockSnapshot {
  symbol: string;
  name: string;
  name_en?: string | null;
  price: number;
  change: number;
  aiSignal: 'Long' | 'Short' | 'Side';
  layer1Status?: AIPrediction['layer1_status'];
  updateTag?: string;
}

const StockItem = memo(({ 
  stock, 
  navigatingTo, 
  isPreMarket, 
  onRemove,
  setNavigatingTo 
}: { 
  stock: StockSnapshot, 
  navigatingTo: string | null, 
  isPreMarket: boolean, 
  onRemove: (e: React.MouseEvent, stock: StockSnapshot) => void,
  setNavigatingTo: (symbol: string) => void
}) => {
  const { locale } = useLocale();
  const stockLocale = locale === 'en' ? 'en' : 'cn';
  const listName = getLocalizedStockName(stock, stockLocale);
  const meta = getPredictionActionMeta({ signal: stock.aiSignal, layer1_status: stock.layer1Status });
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="transform-gpu"
    >
      <Link 
        href="/dashboard"
        data-stock-pool-symbol={stock.symbol}
        onClick={() => {
          try {
            writeDashboardNavIntentSymbol(stock.symbol);
          } catch {
            // non-critical
          }
          setNavigatingTo(stock.symbol);
        }}
        className={`glass-card p-5 group transition-all relative block active:scale-95 touch-optimized ${navigatingTo === stock.symbol ? 'bg-white/10 border-indigo-500/30 ring-1 ring-indigo-500/20' : 'hover:bg-white/[0.04]'}`}
      >
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-4">
           <div className={`w-14 h-14 rounded-[22px] flex items-center justify-center border-2 ${meta.bgClass}`}>
              {meta.iconTone === 'up' ? <TrendingUp className={meta.textClass} /> :
               meta.iconTone === 'down' ? <TrendingDown className={meta.textClass} /> : <Minus className={meta.textClass} />}
           </div>
           <div>
             <h3 className="text-base font-black italic tracking-tighter text-white">{listName}</h3>
             <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
               <span className={`w-1 h-1 rounded-full ${meta.dotClass}`} />
               {meta.headline}
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
                   <p className={`text-[10px] font-black mono ${stock.change > 0 ? 'text-rose-500' : stock.change < 0 ? 'text-emerald-500' : 'text-slate-500'}`}>
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
             onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(e, stock); }}
             className="p-3 opacity-60 hover:opacity-100 transition-all text-slate-500 hover:text-rose-500 active:scale-75 z-20 relative rounded-full hover:bg-white/5 touch-optimized"
           >
             <Trash2 size={20} />
           </button>
         </div>
          
          {navigatingTo === stock.symbol && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          )}
       </div>
      </Link>
    </motion.div>
  );
});
StockItem.displayName = 'StockItem';

export default function StockPoolPage() {
  const t = useT('dashboard');
  const { locale } = useLocale();
  const stockLocale = locale === 'en' ? 'en' : 'cn';
  const { 
    stocks: globalStocks, 
    loadingPool, 
    watchlist, 
    addStock, 
    removeStock, 
    loadingList 
  } = useStocks();
  
  // Derived State for UI - Map global StockData to local StockSnapshot
  const stocks = useMemo(() => globalStocks.map(s => ({
    symbol: s.symbol,
    name: s.name,
    name_en: s.name_en,
    price: s.price?.close || 0,
    change: s.price?.change_percent || 0,
    aiSignal: s.prediction?.signal || 'Side' as const,
    layer1Status: s.prediction?.layer1_status,
    updateTag: s.lastUpdated
  })), [globalStocks]);

  // Compounded loading state
  const loading = loadingList || loadingPool;
  
  const [newSymbol, setNewSymbol] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [searchResults, setSearchResults] = useState<{symbol: string; name: string; name_en?: string | null; market?: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [stockToDelete, setStockToDelete] = useState<StockSnapshot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  const scene = getMarketScene();
  const isPreMarket = scene === 'pre_market';

  const { tier } = useUserProfile();
  const router = useRouter();

  useEffect(() => {
    router.prefetch('/dashboard');
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const query = newSymbol.trim();
      if (query) {
        try {
          searchAbortRef.current?.abort();
          const controller = new AbortController();
          searchAbortRef.current = controller;

          const res = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`, {
            signal: controller.signal
          });
          if (!res.ok) throw new Error('Search request failed');
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowSuggestions(true);
        } catch (e) {
          if ((e as Error).name !== 'AbortError') {
            console.error('Search failed', e);
          }
        }
      } else {
        searchAbortRef.current?.abort();
        setSearchResults([]);
        setShowSuggestions(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      searchAbortRef.current?.abort();
    };
  }, [newSymbol]);

  const handleAdd = async (symbolOverride?: string, nameOverride?: string, nameEnOverride?: string | null) => {
    const targetSymbol = symbolOverride || newSymbol.trim();
    if (!targetSymbol) return;
    
    const limit = tier === 'pro' ? 10 : 3;
    if (watchlist.length >= limit) {
      setLimitMsg(tier === 'pro' ? '已达到 10 只自选上限' : '升级 Pro 可添加更多自选 (上限 3 只)');
      setTimeout(() => setLimitMsg(null), 3000);
      return;
    }

    const ok = await addStock(targetSymbol, nameOverride || targetSymbol, nameEnOverride);
    if (!ok) {
      setLimitMsg('添加失败，请稍后重试');
      setTimeout(() => setLimitMsg(null), 3000);
      return;
    }
    
    // Instant UI Feedback
    setNewSymbol('');
    setShowAdd(false);
    setShowSuggestions(false);
    // Prices will naturally update due to useEffect dependency on watchlist
  };

  const handleRemoveClick = useCallback((e: React.MouseEvent, stock: StockSnapshot) => {
    e.preventDefault(); e.stopPropagation();
    setStockToDelete(stock);
  }, []);

  const confirmDelete = async () => {
    if (!stockToDelete) return;
    setIsDeleting(true);
    
    const ok = await removeStock(stockToDelete.symbol);
    setIsDeleting(false);
    if (ok) {
      setStockToDelete(null);
    } else {
      setLimitMsg('移除失败，请重试');
      setTimeout(() => setLimitMsg(null), 3000);
    }
  };


  // Main Content
  return (
    <div 
      className="fixed top-0 left-0 right-0 bottom-0 h-[100dvh] w-full bg-[#050508] text-white overflow-hidden flex flex-col font-sans overscroll-none"
    >
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none bg-indigo-500 blur-[120px] scale-150" />

      {/* Solid/Stable Header Structure (Centered Title) */}
      <header className="shrink-0 z-20 px-6 py-4 flex items-center justify-between bg-[#050508] border-b border-white/5">
        <div className="w-12">
          <Link href="/dashboard" className="p-2 rounded-full hover:bg-white/5 active:scale-90 transition-all text-slate-400 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </div>
        
        <div className="flex-1 text-center">
          <h1 className="text-xl font-black italic tracking-tighter text-white uppercase">
            {t('stockPool')}{' '}
            <span className="text-indigo-500 underline decoration-2 underline-offset-4" data-en="POOL">
              {t('stockPoolWordmark')}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3 min-w-[3rem] justify-end">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <div className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </div>
            <span className="text-[10px] font-medium text-slate-500 tracking-wide uppercase">实时同步</span>
          </div>
          <button 
            onClick={() => setShowAdd(!showAdd)} 
            className={`p-2.5 rounded-xl border transition-all active:scale-95 ${showAdd ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-indigo-400'}`}
          >
             <Plus className={`w-5 h-5 transition-transform duration-300 ${showAdd ? 'rotate-45' : ''}`} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide shrink min-h-0 overscroll-y-auto [-webkit-overflow-scrolling:touch]">
        <AnimatePresence>
          {limitMsg && !showAdd && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 text-rose-400 text-[10px] font-bold text-center uppercase tracking-widest"
            >
              {limitMsg}
            </motion.p>
          )}
        </AnimatePresence>
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
                        <button key={item.symbol} onClick={() => handleAdd(item.symbol, item.name, item.name_en)} className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black ${isHK ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {isHK ? '港' : 'A'}
                            </div>
                            <div className="text-left">
                               <p className="text-sm font-bold">{getLocalizedStockName(item, stockLocale)}</p>
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
          <h2 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] px-2 mb-4">
            {t('stockPoolAssetsHeading', { count: stocks.length })}
          </h2>
          {loading && !stocks.length ? (
            [1, 2, 3].map(i => <div key={i} className="glass-card h-24 animate-pulse" />)
          ) : stocks.length === 0 ? (
            <div className="py-20 flex flex-col items-center opacity-20 text-center">
              <LayoutGrid size={48} className="mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">暂无资产</p>
            </div>
          ) : (
            stocks.map(stock => (
              <StockItem
                key={stock.symbol}
                stock={stock}
                navigatingTo={navigatingTo}
                isPreMarket={isPreMarket}
                onRemove={handleRemoveClick}
                setNavigatingTo={setNavigatingTo}
              />
            ))
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
                  确定要从自选池中移除 <span className="text-white font-bold">{getLocalizedStockName(stockToDelete, stockLocale)} ({stockToDelete.symbol})</span> 吗？
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
        .touch-optimized {
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          user-select: none !important;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
}
