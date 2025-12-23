'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const COLORS = { 
  up: '#10b981', 
  down: '#f43f5e', 
  hold: '#f59e0b', 
  muted: '#64748b' 
};

interface StockSnapshot {
  symbol: string;
  name: string;
  price: number;
  change: number;
  aiSignal: 'Long' | 'Short' | 'Side';
}

export default function StockPoolPage() {
  const router = useRouter();
  const [stocks, setStocks] = useState<StockSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const fetchStockData = async () => {
    setLoading(true);
    try {
      // 1. 从数据库读取股票池列表
      const poolRes = await fetch('/api/stock-pool');
      const poolData = await poolRes.json();
      const watchlist = poolData.stocks || [];
      
      const results: StockSnapshot[] = [];

      // 2. 循环获取每只票的最新行情和 AI 信号
      for (const item of watchlist) {
        const symbol = item.symbol;
        const dbName = item.name;
        
        try {
          const res = await fetch(`/api/stock?symbol=${symbol}`);
          const data = await res.json();
          
          if (data.price) {
            let signal: 'Long' | 'Short' | 'Side' = 'Side';
            if (data.prediction?.signal) {
              signal = data.prediction.signal;
            } else {
              if (data.price.macd_hist > 0.05) signal = 'Long';
              else if (data.price.macd_hist < -0.05) signal = 'Short';
            }

            results.push({
              symbol,
              name: dbName || `股票 ${symbol}`,
              price: data.price.close,
              change: data.price.change_percent,
              aiSignal: signal
            });
          }
        } catch (e) {
          console.error(`Failed to fetch ${symbol}`, e);
        }
      }
      setStocks(results);
    } catch (err) {
      console.error('Failed to load pool from database', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  const handleAdd = async () => {
    if (newSymbol.trim()) {
      setLoading(true);
      try {
        await fetch('/api/stock-pool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: newSymbol.trim() })
        });
        setNewSymbol('');
        setShowAdd(false);
        await fetchStockData();
      } catch (e) {
        console.error('Add failed', e);
      }
      setLoading(false);
    }
  };

  const handleRemove = async (e: React.MouseEvent, symbol: string) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      await fetch(`/api/stock-pool?symbol=${symbol}`, { method: 'DELETE' });
      await fetchStockData();
    } catch (e) {
      console.error('Delete failed', e);
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center">
      {/* 动态背景辉光 */}
      <div className="hero-glow bg-slate-500 opacity-10" />

      <div className="w-full max-w-md px-6 pt-8 pb-32 z-10">
        <header className="flex items-center gap-4 mb-10">
          <button onClick={() => router.back()} className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-90">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">资产注册列表</span>
            <h1 className="text-2xl font-black italic tracking-tighter">WATCHLIST <span className="text-indigo-500">POOL</span></h1>
          </div>
        </header>

        {/* 搜索/添加区域 */}
        <div className="mb-8">
          {showAdd ? (
            <div className="glass-card flex gap-2 p-3 animate-in fade-in zoom-in duration-300">
              <input 
                autoFocus
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="输入股票代码 (如 02171)"
                className="flex-1 bg-black/20 border border-white/5 rounded-2xl px-5 py-3 mono text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
              />
              <button 
                onClick={handleAdd}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black italic text-sm transition-all active:scale-95"
              >
                添加
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowAdd(true)}
              className="w-full glass-card flex items-center justify-center gap-2 py-6 border-dashed border-white/10 bg-white/[0.02] text-slate-500 hover:text-slate-200 hover:border-white/20 transition-all group"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              <span className="text-xs font-black uppercase tracking-widest">关注新资产</span>
            </button>
          )}
        </div>

        {/* 列表 */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">监控中的资产</h4>
          {loading && !stocks.length ? (
            [1, 2].map(i => <div key={i} className="glass-card h-24 animate-pulse" />)
          ) : stocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600">
              <Search className="w-12 h-12 mb-4 opacity-10" />
              <p className="text-[10px] font-black uppercase tracking-widest text-center">暂无活跃资产<br/>(已根据数据库同步)</p>
            </div>
          ) : (
            stocks.map(stock => (
              <Link 
                key={stock.symbol} 
                href={`/?symbol=${stock.symbol}`}
                className="glass-card flex items-center justify-between py-5 group hover:bg-white/[0.08] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                    stock.aiSignal === 'Long' ? 'bg-emerald-500/10 border-emerald-500/20' : 
                    stock.aiSignal === 'Short' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-amber-500/10 border-amber-500/20'
                  }`}>
                    {stock.aiSignal === 'Long' ? <TrendingUp className="w-6 h-6" style={{ color: COLORS.up }} /> :
                     stock.aiSignal === 'Short' ? <TrendingDown className="w-6 h-6" style={{ color: COLORS.down }} /> :
                     <Minus className="w-6 h-6" style={{ color: COLORS.hold }} />}
                  </div>
                  <div>
                    <h3 className="font-black text-base italic tracking-tight">{stock.name}</h3>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">AI 信号: {stock.aiSignal === 'Long' ? '看多' : stock.aiSignal === 'Short' ? '看空' : '观望'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-black mono">{stock.price.toFixed(2)}</p>
                    <p className="text-[10px] font-bold mono" style={{ color: stock.change >= 0 ? COLORS.up : COLORS.down }}>
                      {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                    </p>
                  </div>
                  <button 
                    onClick={(e) => handleRemove(e, stock.symbol)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-rose-500 transition-all active:scale-90"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
