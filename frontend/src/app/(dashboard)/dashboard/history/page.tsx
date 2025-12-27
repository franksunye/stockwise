'use client';

import { Suspense, useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Check, X, Minus } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { useSearchParams } from 'next/navigation';

const COLORS = { 
  up: '#10b981', 
  down: '#f43f5e', 
  hold: '#f59e0b', 
  muted: '#64748b' 
};

interface Item {
  date: string;
  target_date: string;
  signal: 'Long' | 'Short' | 'Side';
  result: 'Correct' | 'Incorrect' | 'Neutral' | 'Pending';
  actual_change: number | null;
  confidence: number;
}

function HistoryContent() {
  const searchParams = useSearchParams();
  const urlSymbol = searchParams.get('symbol');
  const SYMBOL = urlSymbol || '02171';

  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState({ winRate: 0, returns: 0 });

  useEffect(() => {
    fetch(`/api/predictions?symbol=${SYMBOL}&limit=30`)
      .then(r => r.json())
      .then(data => {
        if (!data.predictions) return;
        const list: Item[] = data.predictions.map((p: {
          date: string;
          target_date: string;
          signal: 'Long' | 'Short' | 'Side';
          validation_status: 'Correct' | 'Incorrect' | 'Neutral' | 'Pending';
          actual_change: number | null;
          confidence: number;
        }) => ({
          date: p.date,
          target_date: p.target_date,
          signal: p.signal,
          result: p.validation_status,
          actual_change: p.actual_change,
          confidence: p.confidence
        }));
        setItems(list);

        const validated = list.filter(i => i.result !== 'Pending' && i.result !== 'Neutral');
        const correct = validated.filter(i => i.result === 'Correct').length;
        
        setStats({
          winRate: validated.length ? (correct / validated.length * 100) : 0,
          returns: list.reduce((acc, i) => acc + (i.actual_change || 0), 0)
        });
      });
  }, [SYMBOL]);

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center">
      {/* 动态背景辉光 */}
      <div className="hero-glow bg-indigo-500 opacity-10" />

      <div className="w-full max-w-md px-6 pt-10 pb-32 z-10">
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500 font-bold">深度复盘分析</span>
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter">AGENT <span className="text-indigo-500">HISTORY</span></h1>
          <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-widest">{SYMBOL} · 最近 30 条记录</p>
        </header>

        {/* 统计看板 - 恢复大气设计 */}
        <section className="grid grid-cols-2 gap-4 mb-8">
          <div className="glass-card flex flex-col items-center py-6 text-center">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">预测准确率</span>
            <p className="text-4xl font-black mono" style={{ color: stats.winRate >= 50 ? COLORS.up : COLORS.down }}>
              {stats.winRate.toFixed(0)}%
            </p>
          </div>
          <div className="glass-card flex flex-col items-center py-6 text-center">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">累计超额收益</span>
            <p className="text-4xl font-black mono" style={{ color: stats.returns >= 0 ? COLORS.up : COLORS.down }}>
              {stats.returns >= 0 ? '+' : ''}{stats.returns.toFixed(1)}%
            </p>
          </div>
        </section>

        {/* 列表 - 恢复圆角卡片，但体积更紧凑 */}
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.date} className="glass-card p-4 flex items-center justify-between group hover:bg-white/[0.08] transition-all border-white/5">
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                  item.signal === 'Long' ? 'bg-emerald-500/10 border-emerald-500/20' : 
                  item.signal === 'Short' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-amber-500/10 border-amber-500/20'
                }`}>
                  {item.signal === 'Long' ? <TrendingUp size={14} style={{ color: COLORS.up }} /> :
                   item.signal === 'Short' ? <TrendingDown size={14} style={{ color: COLORS.down }} /> :
                   <Minus size={14} style={{ color: COLORS.hold }} />}
                </div>
                <div>
                  <p className="text-xs font-black mono text-slate-300">{item.target_date.split('-').slice(1).join('.')}</p>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ 
                    color: item.signal === 'Long' ? COLORS.up : item.signal === 'Short' ? COLORS.down : COLORS.hold 
                  }}>
                    {item.signal === 'Long' ? '建议做多' : item.signal === 'Short' ? '建议避险' : '建议观望'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-right">
                {item.result === 'Pending' ? (
                   <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-500 uppercase">验证中</span>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black mono" style={{ color: (item.actual_change || 0) >= 0 ? COLORS.up : COLORS.down }}>
                      {(item.actual_change || 0) >= 0 ? '+' : ''}{(item.actual_change || 0).toFixed(2)}%
                    </span>
                    <div className={item.result === 'Correct' ? 'text-emerald-500' : 'text-rose-500'}>
                      {item.result === 'Correct' ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {items.length === 0 && (
            <div className="text-center py-20 text-slate-500 text-xs font-black uppercase tracking-widest">
              暂无记录
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryContent />
    </Suspense>
  );
}
