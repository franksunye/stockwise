'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import { Plus, Trash2, ArrowLeft, TrendingUp, TrendingDown, Minus, LayoutGrid, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/user';
import { getMarketScene } from '@/lib/date-utils';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useStocks } from '@/context/StockContext';

interface StockSnapshot {
  symbol: string;
  name: string;
  price: number;
  change: number;
  aiSignal: 'Long' | 'Short' | 'Side';
  updateTag?: string;
}

const getSignalMeta = (signal: string) => {
  switch(signal) {
    case 'Long': return { text: '建议做多', color: 'bg-rose-500', iconColor: 'text-rose-500', bgColor: 'bg-rose-500/10 border-rose-500/20' };
    case 'Short': return { text: '建议避险', color: 'bg-emerald-500', iconColor: 'text-emerald-500', bgColor: 'bg-emerald-500/10 border-emerald-500/20' };
    default: return { text: '建议观望', color: 'bg-amber-500', iconColor: 'text-amber-500', bgColor: 'bg-amber-500/10 border-amber-500/20' };
  }
};

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
  const meta = getSignalMeta(stock.aiSignal);
  return (
    <div className="animate-in fade-in scale-95 duration-200">
      <Link 
        href={`/dashboard?symbol=${stock.symbol}`}
        onClick={() => setNavigatingTo(stock.symbol)}
        className={`glass-card p-5 group transition-all relative block active:scale-95 touch-optimized ${navigatingTo === stock.symbol ? 'bg-white/10 border-indigo-500/30' : 'hover:bg-white/[0.04]'}`}
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
                 <p className={`text-[10px] font-black mono ${stock.change > 0 ? 'text-rose-500' : stock.change < 0 ? 'text-emerald-500' : 'text-slate-500'}`}>
                   {stock.price > 0 ? `${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%` : '同步中...'}
                 </p>
               </>
             ) : (
               <p className="text-[10px] text-slate-600 font-black italic uppercase tracking-widest">静默期</p>
             )}
           </div>
           <button 
             onClick={(e) => { e.preventDefault(); onRemove(e, stock); }}
             className="p-3 opacity-60 hover:opacity-100 text-slate-500 hover:text-rose-500 active:scale-75 z-20 relative rounded-full hover:bg-white/5"
           >
             <Trash2 size={20} />
           </button>
         </div>
         {navigatingTo === stock.symbol && (
           <div className="absolute right-4 top-1/2 -translate-y-1/2">
             <Loader2 size={16} className="text-indigo-500 animate-spin" />
           </div>
         )}
       </div>
      </Link>
    </div>
  );
});
StockItem.displayName = 'StockItem';

export default function StockPoolPage() {
  const router = useRouter();
  const { stocks: globalStocks, loadingPool, watchlist, addStock, removeStock, loadingList } = useStocks();
  
  const stocks = useMemo(() => globalStocks.map(s => ({
    symbol: s.symbol,
    name: s.name,
    price: s.price?.close || 0,
    change: s.price?.change_percent || 0,
    aiSignal: s.prediction?.signal || 'Side' as const,
    updateTag: s.lastUpdated
  })), [globalStocks]);

  const loading = loadingList || loadingPool;
  const [newSymbol, setNewSymbol] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [searchResults, setSearchResults] = useState<{symbol: string; name: string; market?: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [stockToDelete, setStockToDelete] = useState<StockSnapshot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);
  const { tier } = useUserProfile();

  const isPreMarket = getMarketScene() === 'pre_market';

  useEffect(() => {
    getCurrentUser();
    router.prefetch('/dashboard');
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (newSymbol.trim()) {
        try {
          const res = await fetch(`/api/stock/search?q=${newSymbol}`);
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowSuggestions(true);
        } catch (e) { console.error(e); }
      } else {
        setShowSuggestions(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newSymbol]);

  const handleAdd = (symbol: string, name: string) => {
    const limit = tier === 'pro' ? 10 : 3;
    if (watchlist.length >= limit) {
      setLimitMsg(tier === 'pro' ? '已达到 10 只上限' : '已达到 3 只上限');
      setTimeout(() => setLimitMsg(null), 3000);
      return;
    }
    addStock(symbol, name);
    setNewSymbol('');
    setShowAdd(false);
    setShowSuggestions(false);
  };

  const confirmDelete = async () => {
    if (!stockToDelete) return;
    setIsDeleting(true);
    removeStock(stockToDelete.symbol);
    setStockToDelete(null);
    setIsDeleting(false);
  };

  return (
    <div className="fixed inset-0 bg-[#050508] text-white overflow-hidden flex flex-col font-sans">
      <header className="shrink-0 z-20 p-8 flex items-center justify-between bg-[#050508] border-b border-white/5">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div>
            <span className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-bold block">自选监控</span>
            <h1 className="text-2xl font-black italic tracking-tighter text-white">监控池 <span className="text-indigo-500">POOL</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">15M REFRESH</span>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className={`p-3 rounded-2xl border transition-all ${showAdd ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-indigo-400'}`}>
             <Plus className={`w-5 h-5 transition-transform duration-300 ${showAdd ? 'rotate-45' : ''}`} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
        {showAdd && (
          <div className="mb-8 glass-card p-4 border-indigo-500/20 bg-indigo-500/5 animate-in slide-in-from-top-4 duration-300">
            <input autoFocus placeholder="输入代码或名称" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white focus:border-indigo-500/50 outline-none" />
            {limitMsg && <p className="mt-3 text-rose-400 text-[10px] font-bold text-center uppercase">{limitMsg}</p>}
            {showSuggestions && searchResults.length > 0 && (
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map(item => (
                  <button key={item.symbol} onClick={() => handleAdd(item.symbol, item.name)} className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                    <div className="text-left">
                       <p className="text-sm font-bold text-white">{item.name}</p>
                       <p className="text-[10px] text-slate-500 uppercase font-mono">{item.symbol}</p>
                    </div>
                    <Plus size={16} className="text-slate-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2 mb-4">监控标的 ({stocks.length})</h2>
          {loading && !stocks.length ? (
            [1, 2, 3].map(i => <div key={i} className="glass-card h-24 bg-white/5 animate-pulse" />)
          ) : stocks.length === 0 ? (
            <div className="py-20 flex flex-col items-center opacity-20 text-center">
              <LayoutGrid size={48} className="mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">暂无资产</p>
            </div>
          ) : (
            stocks.map(stock => (
              <StockItem key={stock.symbol} stock={stock} navigatingTo={navigatingTo} isPreMarket={isPreMarket} onRemove={(e) => { e.preventDefault(); setStockToDelete(stock); }} setNavigatingTo={setNavigatingTo} />
            ))
          )}
        </div>
      </div>

      {stockToDelete && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center px-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm glass-card p-8 border-rose-500/20 bg-[#0a0a0f] text-center animate-in zoom-in-95 duration-200">
            <Trash2 className="text-rose-500 w-12 h-12 mx-auto mb-6" />
            <h3 className="text-xl font-black italic text-white mb-2">确认移除？</h3>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">确定要从监控池中移除 <span className="text-white font-bold">{stockToDelete.name}</span> 吗？</p>
            <div className="flex gap-3">
              <button onClick={() => setStockToDelete(null)} className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-xs font-black uppercase">取消</button>
              <button onClick={confirmDelete} disabled={isDeleting} className="flex-1 py-4 rounded-2xl bg-rose-500 text-white text-xs font-black uppercase flex items-center justify-center gap-2">
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : '确认移除'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .glass-card { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 32px; }
        .touch-optimized { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
}
