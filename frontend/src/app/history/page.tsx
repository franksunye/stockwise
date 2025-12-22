'use client';

import { Suspense, useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Check, X, Minus } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { useSearchParams } from 'next/navigation';

const COLORS = { up: '#10b981', down: '#f43f5e', hold: '#f59e0b', muted: '#6b7280' };

interface Item {
  date: string;
  close: number;
  change: number;
  signal: 'up' | 'down' | 'flat';
  result: 'win' | 'loss' | 'neutral' | null;
}

function HistoryContent() {
  const searchParams = useSearchParams();
  const urlSymbol = searchParams.get('symbol');
  const SYMBOL = urlSymbol || '02171';

  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState({ winRate: 0, returns: 0 });

  useEffect(() => {
    fetch(`/api/stock?symbol=${SYMBOL}&history=30`)
      .then(r => r.json())
      .then(data => {
        if (!data.prices) return;
        const list: Item[] = data.prices.map((p: any, i: number) => {
          const next = data.prices[i - 1];
          const signal: 'up' | 'down' | 'flat' = p.macd_hist > 0.05 ? 'up' : p.macd_hist < -0.05 ? 'down' : 'flat';
          const nextChange = next ? ((next.close - p.close) / p.close * 100) : null;
          let result: 'win' | 'loss' | 'neutral' | null = null;
          if (nextChange !== null) {
            if ((signal === 'up' && nextChange > 0) || (signal === 'down' && nextChange < 0)) result = 'win';
            else if ((signal === 'up' && nextChange < 0) || (signal === 'down' && nextChange > 0)) result = 'loss';
            else result = 'neutral';
          }
          return { date: p.date, close: p.close, change: p.change_percent, signal, result };
        });
        setItems(list);

        const rated = list.filter(i => i.result);
        const wins = rated.filter(i => i.result === 'win').length;
        setStats({
          winRate: rated.length ? (wins / rated.length * 100) : 0,
          returns: list.reduce((acc, i) => acc + (i.result === 'win' ? 1 : i.result === 'loss' ? -1 : 0) * Math.abs(i.change), 0)
        });
      });
  }, [SYMBOL]);

  return (
    <div className="min-h-screen p-4 pb-24 text-white">
      <h1 className="text-lg font-semibold mb-1">历史复盘</h1>
      <p className="text-xs mb-6" style={{ color: COLORS.muted }}>{SYMBOL} · 最近30天</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-xs" style={{ color: COLORS.muted }}>胜率</p>
          <p className="text-2xl mono" style={{ color: stats.winRate >= 50 ? COLORS.up : COLORS.down }}>
            {stats.winRate.toFixed(0)}%
          </p>
        </div>
        <div className="card text-center">
          <p className="text-xs" style={{ color: COLORS.muted }}>预计收益</p>
          <p className="text-2xl mono" style={{ color: stats.returns >= 0 ? COLORS.up : COLORS.down }}>
            {stats.returns >= 0 ? '+' : ''}{stats.returns.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.date} className="card flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              {item.signal === 'up' ? <TrendingUp className="w-4 h-4" style={{ color: COLORS.up }} /> :
               item.signal === 'down' ? <TrendingDown className="w-4 h-4" style={{ color: COLORS.down }} /> :
               <Minus className="w-4 h-4" style={{ color: COLORS.muted }} />}
              <div>
                <p className="text-sm">{item.date}</p>
                <p className="text-xs mono" style={{ color: COLORS.muted }}>{item.close.toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm mono" style={{ color: item.change >= 0 ? COLORS.up : COLORS.down }}>
                {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
              </span>
              {item.result === 'win' && <Check className="w-5 h-5" style={{ color: COLORS.up }} />}
              {item.result === 'loss' && <X className="w-5 h-5" style={{ color: COLORS.down }} />}
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f] p-4 text-white">加载中...</div>}>
      <HistoryContent />
    </Suspense>
  );
}
