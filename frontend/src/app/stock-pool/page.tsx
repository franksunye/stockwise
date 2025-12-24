'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentUser, type User } from '@/lib/user';

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
  const [user, setUser] = useState<User | null>(null);
  const [stocks, setStocks] = useState<StockSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // 初始化用户
  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);


  // fetchStockData 函数移到下面使用 useCallback 定义


  // 使用 useCallback 避免无限循环
  const fetchStockData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // 1. 从数据库读取用户的股票池列表
      const poolRes = await fetch(`/api/stock-pool?userId=${user.userId}`);
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
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchStockData();
    }
  }, [user, fetchStockData]);

  const [searchResults, setSearchResults] = useState<{symbol: string; name: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 快捷推荐列表
  const SUGGESTIONS = [
    { symbol: '02171', name: '科济药业-B' },
    { symbol: '01167', name: '加科思-B' },
    { symbol: '00700', name: '腾讯控股' },
    { symbol: '09988', name: '阿里巴巴-SW' }
  ];

  // 搜索逻辑
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (newSymbol.trim()) {
        try {
          const res = await fetch(`/api/stock/search?q=${newSymbol}`);
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowSuggestions(true);
        } catch (e) {
          console.error('Search failed', e);
        }
      } else {
        setSearchResults([]);
        setShowSuggestions(false);
      }
    }, 300); // 防抖处理

    return () => clearTimeout(timer);
  }, [newSymbol]);

  const handleAdd = async (symbolOverride?: string, nameOverride?: string) => {
    const targetSymbol = symbolOverride || newSymbol.trim();
    if (!targetSymbol) return;
    
    const activeUser = user || await getCurrentUser();
    if (!user) setUser(activeUser);
    
    setLoading(true);
    try {
      const response = await fetch('/api/stock-pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: activeUser.userId,
          symbol: targetSymbol,
          name: nameOverride // 如果知道名称，传给后端
        })
      });
      
      if (response.ok) {
        setNewSymbol('');
        setShowAdd(false);
        setShowSuggestions(false);
        await fetchStockData();
      } else {
        const result = await response.json();
        console.error('Add failed:', result.error);
      }
    } catch (e) {
      console.error('Add error:', e);
    }
    setLoading(false);
  };

  const handleRemove = async (e: React.MouseEvent, symbol: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    
    setLoading(true);
    try {
      await fetch(`/api/stock-pool?userId=${user.userId}&symbol=${symbol}`, { method: 'DELETE' });
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
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500 font-bold">自选监控池</span>
            <h1 className="text-2xl font-black italic tracking-tighter">MONITOR <span className="text-indigo-500">POOL</span></h1>
          </div>
        </header>

        {/* 搜索/添加区域 */}
        <div className="mb-8 relative">
          {showAdd ? (
            <div className="glass-card flex flex-col p-3 animate-in fade-in zoom-in duration-300 gap-3">
              <div className="flex gap-2">
                <input 
                  autoFocus
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="输入代码或名称 (如 科济)"
                  className="flex-1 bg-black/20 border border-white/5 rounded-2xl px-5 py-3 mono text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                />
                <button 
                  onClick={() => handleAdd()}
                  disabled={loading}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black italic text-sm transition-all active:scale-95"
                >
                  {loading ? '...' : '添加'}
                </button>
              </div>

              {/* 实时搜索建议 */}
              {showSuggestions && searchResults.length > 0 && (
                <div className="flex flex-col border-t border-white/5 pt-2 max-h-48 overflow-y-auto">
                  {searchResults.map((item) => (
                    <button
                      key={item.symbol}
                      onClick={() => handleAdd(item.symbol, item.name)}
                      className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors text-left group"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">{item.name}</span>
                        <span className="text-xs text-slate-500 mono">{item.symbol}</span>
                      </div>
                      <Plus className="w-4 h-4 text-slate-600 group-hover:text-indigo-500 transition-colors" />
                    </button>
                  ))}
                </div>
              )}

              {/* 快捷推荐 */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-[10px] text-slate-600 font-bold uppercase w-full">推荐关注</span>
                {SUGGESTIONS.filter(s => !stocks.some(existing => existing.symbol === s.symbol)).map((s) => (
                  <button
                    key={s.symbol}
                    onClick={() => handleAdd(s.symbol, s.name)}
                    className="px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold text-slate-500 hover:bg-indigo-500/20 hover:text-indigo-400 hover:border-indigo-500/30 transition-all"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowAdd(true)}
              className="w-full glass-card flex items-center justify-center gap-2 py-6 border-dashed border-white/10 bg-white/[0.02] text-slate-500 hover:text-slate-200 hover:border-white/20 transition-all group"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
              <span className="text-sm font-black uppercase tracking-widest">关注新资产</span>
            </button>
          )}
        </div>

        {/* 列表 */}
        <div className="space-y-4">
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2">监控中的资产</h4>
          {loading && !stocks.length ? (
            [1, 2].map(i => <div key={i} className="glass-card h-24 animate-pulse" />)
          ) : stocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600">
              <Search className="w-12 h-12 mb-4 opacity-10" />
              <p className="text-xs font-black uppercase tracking-widest text-center">暂无活跃资产<br/>(已根据数据库同步)</p>
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
                    <h3 className="font-black text-sm italic tracking-tight">{stock.name}</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">AI 信号: {stock.aiSignal === 'Long' ? '看多' : stock.aiSignal === 'Short' ? '看空' : '观望'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-base font-black mono">{stock.price.toFixed(2)}</p>
                    <p className="text-xs font-bold mono" style={{ color: stock.change >= 0 ? COLORS.up : COLORS.down }}>
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
