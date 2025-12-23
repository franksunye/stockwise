'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, ArrowLeft } from 'lucide-react';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '@/lib/storage';
import { BottomNav } from '@/components/BottomNav';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const COLORS = { up: '#10b981', down: '#f43f5e', hold: '#f59e0b', muted: '#6b7280' };

const NAME_MAP: Record<string, string> = {
  '02171': '科济药业-B',
  '02269': '药明生物',
  '01801': '信达生物',
};

interface StockSnapshot {
  symbol: string;
  name: string;
  price: number;
  change: number;
  aiSignal: string;
  aiColor: string;
}

export default function StockPoolPage() {
  const router = useRouter();
  const [stocks, setStocks] = useState<StockSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSymbol, setNewSymbol] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const fetchStockData = async () => {
    setLoading(true);
    const watchlist = getWatchlist();
    const results: StockSnapshot[] = [];

    for (const symbol of watchlist) {
      try {
        const res = await fetch(`/api/stock?symbol=${symbol}`);
        const data = await res.json();
        
        if (data.price) {
          let signal = '观望';
          let color = COLORS.hold;
          
          if (data.price.macd_hist > 0.05) {
            signal = '试错';
            color = COLORS.up;
          } else if (data.price.macd_hist < -0.05) {
            signal = '止损';
            color = COLORS.down;
          }

          results.push({
            symbol,
            name: NAME_MAP[symbol] || `股票 ${symbol}`,
            price: data.price.close,
            change: data.price.change_percent,
            aiSignal: signal,
            aiColor: color
          });
        }
      } catch (e) {
        console.error(`Failed to fetch ${symbol}`, e);
      }
    }
    setStocks(results);
    setLoading(false);
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  const handleAdd = () => {
    if (newSymbol.trim()) {
      addToWatchlist(newSymbol.trim());
      setNewSymbol('');
      setShowAdd(false);
      fetchStockData();
    }
  };

  const handleRemove = (e: React.MouseEvent, symbol: string) => {
    e.preventDefault();
    e.stopPropagation();
    removeFromWatchlist(symbol);
    fetchStockData();
  };

  return (
    <div className="min-h-screen p-4 pb-24 text-white">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="p-1 hover:bg-[#1e1e2e] rounded-full">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold tracking-tight text-center flex-1 pr-10">我的股票池</h1>
      </header>

      {/* 搜索/添加区域 */}
      <div className="mb-6">
        {showAdd ? (
          <div className="card flex gap-2 animate-in slide-in-from-top-2 duration-200">
            <input 
              autoFocus
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="输入代码 (如 02269)"
              className="flex-1 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-2 mono focus:outline-none"
            />
            <button 
              onClick={handleAdd}
              className="px-4 py-2 bg-white text-black rounded-lg font-medium"
            >
              确认
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setShowAdd(true)}
            className="w-full card flex items-center justify-center gap-2 py-4 border-dashed border-2 border-[#1e1e2e] text-[#6b7280] hover:text-white transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>添加新股票</span>
          </button>
        )}
      </div>

      {/* 列表 */}
      <div className="space-y-1">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="card h-20 animate-pulse mb-4" />)
        ) : stocks.length === 0 ? (
          <div className="text-center py-20 text-[#6b7280]">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>还没有关注的股票</p>
          </div>
        ) : (
          stocks.map(stock => (
            <Link 
              key={stock.symbol} 
              href={`/?symbol=${stock.symbol}`}
              className="flex items-center justify-between p-4 border-b border-[#1e1e2e] group hover:bg-[#12121a] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stock.aiColor }} />
                <div>
                  <h3 className="font-semibold text-[15px]">{stock.name}</h3>
                  <p className="text-xs mono" style={{ color: COLORS.muted }}>{stock.symbol}.HK</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right pr-2">
                  <p className="font-medium" style={{ color: stock.aiColor }}>{stock.aiSignal}</p>
                </div>
                <button 
                  onClick={(e) => handleRemove(e, stock.symbol)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-[#6b7280] hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Link>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
