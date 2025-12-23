'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { RefreshCw, Settings, ChevronRight } from 'lucide-react';
import { DailyPrice, UserRule } from '@/lib/types';
import { getRule, getWatchlist } from '@/lib/storage';
import { getIndicatorReviews } from '@/lib/analysis';
import { BottomNav } from '@/components/BottomNav';
import { SettingsModal } from '@/components/SettingsModal';
import { useSearchParams, useRouter } from 'next/navigation';

const COLORS = { up: '#10b981', down: '#f43f5e', hold: '#f59e0b', muted: '#6b7280' };

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSymbol = searchParams.get('symbol');
  const symbol = urlSymbol || '02171';
  
  const [price, setPrice] = useState<DailyPrice | null>(null);
  const [rule, setRule] = useState<UserRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/stock?symbol=${symbol}`);
    const data = await res.json();
    if (data.price) setPrice(data.price);
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    loadData();
    setRule(getRule(symbol));
  }, [symbol, loadData]);

  const isUp = price ? price.change_percent >= 0 : false;
  const reviews = price ? getIndicatorReviews(price) : [];

  return (
    <div className="min-h-screen p-4 pb-28 text-[#f0f0f5]">
      {/* 1. Header: 极简状态栏 */}
      <header className="flex items-center justify-between mb-8 px-1">
        <div>
          <h1 className="text-sm font-bold tracking-widest text-[#6b7280] uppercase">StockWise HUD</h1>
          <p className="text-xs opacity-50 font-mono">{symbol}.HK</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setSettingsOpen(true)} className="text-[#6b7280] hover:text-white transition-colors">
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={loadData} className="text-[#6b7280] hover:text-white transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="card h-48 animate-pulse" />
      ) : price ? (
        <div className="space-y-6">
          {/* 2. 价格核心区 */}
          <section className="px-1">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-4xl font-bold tracking-tighter mono">
                {price.close.toFixed(2)}
              </span>
              <span className="text-sm font-semibold mono" style={{ color: isUp ? COLORS.up : COLORS.down }}>
                {isUp ? '+' : ''}{price.change_percent.toFixed(2)}%
              </span>
            </div>
            <div className="flex gap-4 text-xs font-mono text-[#6b7280]">
              <span>VOL {(price.volume / 10000).toFixed(0)}w</span>
              <span>RSI {price.rsi.toFixed(0)}</span>
            </div>
          </section>

          {/* 3. AI 核心建议 (The Answer) */}
          <section className="card border-l-4 border-l-[#f59e0b] shadow-2xl">
            <div className="mb-4">
              <span className="text-xs font-bold text-[#6b7280] uppercase tracking-tighter">AI 决策建议</span>
              <h2 className="text-lg font-bold mt-1" style={{ color: COLORS.hold }}>持仓观望，等待放量突破</h2>
            </div>
            
            <div className="space-y-3 pt-4 border-t border-[#1e1e2e]">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#6b7280]">风控阈值</span>
                <span className="font-mono text-[#f43f5e] font-bold">14.78</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#6b7280]">阶段压力</span>
                <span className="font-mono text-white">15.80</span>
              </div>
            </div>
          </section>

          {/* 4. 技术面辅助 (辅助了解) */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold text-[#6b7280] uppercase tracking-tighter px-1">运行状态映射</h3>
            <div className="grid grid-cols-1 gap-1">
              {reviews.map(review => (
                <div key={review.label} className="card flex items-center justify-between py-3 bg-transparent border-none px-1">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[review.status] }} />
                    <span className="text-sm font-medium w-12">{review.label}</span>
                  </div>
                  <span className="text-xs text-[#a0a0a5]">{review.desc}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      <SettingsModal symbol={symbol} isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={() => setRule(getRule(symbol))} />
      <BottomNav />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f] p-4 text-white">HUD 加载中...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
