'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ArrowLeft, TrendingUp, TrendingDown, Minus, LayoutGrid } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, type User } from '@/lib/user';
import { motion, AnimatePresence } from 'framer-motion';
import { getMarketScene } from '@/lib/date-utils';

interface StockSnapshot {
  symbol: string;
  name: string;
  price: number;
  change: number;
  aiSignal: 'Long' | 'Short' | 'Side';
}

export default function StockPoolPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stocks, setStocks] = useState<StockSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [searchResults, setSearchResults] = useState<{symbol: string; name: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [stockToDelete, setStockToDelete] = useState<StockSnapshot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const scene = getMarketScene();
  const isPreMarket = scene === 'pre_market';

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  const fetchStockData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const poolRes = await fetch(`/api/stock-pool?userId=${user.userId}`, { cache: 'no-store' });
      const poolData = await poolRes.json();
      const watchlist = poolData.stocks || [];
      const stockDataPromises = watchlist.map(async (item: { symbol: string, name: string }) => {
        try {
          const res = await fetch(`/api/stock?symbol=${item.symbol}`, { cache: 'no-store' });
          const data = await res.json();
          return {
            symbol: item.symbol,
            name: item.name || `股票 ${item.symbol}`,
            price: data.price?.close || 0,
            change: data.price?.change_percent || 0,
            aiSignal: data.prediction?.signal || 'Side'
          } as StockSnapshot;
        } catch (e) {
          console.error(`Failed to fetch ${item.symbol}`, e);
          return null;
        }
      });

      const results = (await Promise.all(stockDataPromises)).filter((s): s is StockSnapshot => s !== null);
      setStocks(results);
    } catch (err) {
      console.error('Failed to load pool', err);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { if (user) fetchStockData(); }, [user, fetchStockData]);

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
    setLoading(true);
    try {
      const response = await fetch('/api/stock-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, symbol: targetSymbol, name: nameOverride })
      });
      if (response.ok) {
        setNewSymbol('');
        setShowAdd(false);
        setShowSuggestions(false);
        await fetchStockData();
      }
    } catch (e) { console.error('Add failed', e); }
    setLoading(false);
  };

  const handleRemoveClick = (e: React.MouseEvent, stock: StockSnapshot) => {
    e.preventDefault(); e.stopPropagation();
    setStockToDelete(stock);
  };

  const confirmDelete = async () => {
    if (!stockToDelete || !user) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/stock-pool?userId=${user.userId}&symbol=${stockToDelete.symbol}`, { 
        method: 'DELETE',
        cache: 'no-store'
      });
      if (res.ok) {
        await fetchStockData();
        setStockToDelete(null);
      }
    } catch (e) { console.error('Delete failed', e); }
    setIsDeleting(false);
  };

  const getSignalMeta = (signal: string) => {
    switch(signal) {
      case 'Long': return { text: '建议做多', color: 'bg-emerald-500', iconColor: 'text-emerald-500', bgColor: 'bg-emerald-500/10 border-emerald-500/20' };
      case 'Short': return { text: '建议避险', color: 'bg-rose-500', iconColor: 'text-rose-500', bgColor: 'bg-rose-500/10 border-rose-500/20' };
      default: return { text: '建议观望', color: 'bg-amber-500', iconColor: 'text-amber-500', bgColor: 'bg-amber-500/10 border-amber-500/20' };
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050508] text-white overflow-hidden flex flex-col font-sans">
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none bg-indigo-500 blur-[120px] scale-150" />

      <header className="fixed top-0 left-0 right-0 z-[100] p-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/')} className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-600 font-black">自选监控池</span>
            <h1 className="text-xl font-black italic tracking-tighter">STOCK <span className="text-indigo-500 underline decoration-2 underline-offset-4">POOL</span></h1>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className={`p-3 rounded-2xl border transition-all active:scale-95 ${showAdd ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-indigo-400'}`}>
           <Plus className={`w-5 h-5 transition-transform duration-300 ${showAdd ? 'rotate-45' : ''}`} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pt-32 pb-12 scrollbar-hide">
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
                  placeholder="搜索代码或名称..."
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 mono text-sm focus:outline-none focus:border-indigo-500/50"
                />
                {showSuggestions && searchResults.length > 0 && (
                  <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map(item => (
                      <button key={item.symbol} onClick={() => handleAdd(item.symbol, item.name)} className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-[10px] font-black italic text-indigo-400">{item.symbol.slice(-2)}</div>
                          <div className="text-left">
                             <p className="text-sm font-bold">{item.name}</p>
                             <p className="text-[10px] text-slate-500 mono uppercase">{item.symbol}.HK</p>
                          </div>
                        </div>
                        <Plus size={16} className="text-slate-500" />
                      </button>
                    ))}
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
                  onClick={() => router.push(`/?symbol=${stock.symbol}`)}
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
                               {stock.price > 0 ? `${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%` : '数据中'}
                             </p>
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
