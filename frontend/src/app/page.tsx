'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { RefreshCw, Settings } from 'lucide-react';
import { DailyPrice, UserRule } from '@/lib/types';
import { getRule } from '@/lib/storage';
import { SignalBadge } from '@/components/SignalBadge';
import { BottomNav } from '@/components/BottomNav';
import { SettingsModal } from '@/components/SettingsModal';
import { useSearchParams } from 'next/navigation';

const COLORS = { up: '#10b981', down: '#f43f5e', hold: '#f59e0b', muted: '#6b7280' };

function DashboardContent() {
  const searchParams = useSearchParams();
  const urlSymbol = searchParams.get('symbol');
  const SYMBOL = urlSymbol || '02171';
  
  const [price, setPrice] = useState<DailyPrice | null>(null);
  const [rule, setRule] = useState<UserRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/stock?symbol=${SYMBOL}`);
    const data = await res.json();
    if (data.price) setPrice(data.price);
    setLoading(false);
  }, [SYMBOL]);

  const loadRule = useCallback(() => setRule(getRule(SYMBOL)), [SYMBOL]);

  useEffect(() => {
    loadData();
    loadRule();
  }, [loadData, loadRule]);

  const isUp = price ? price.change_percent >= 0 : false;
  const priceColor = isUp ? COLORS.up : COLORS.down;

  return (
    <div className="min-h-screen p-4 pb-24 text-white">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">AI 决策看板</h1>
          <p className="text-xs" style={{ color: COLORS.muted }}>{SYMBOL}</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setSettingsOpen(true)} className="p-2 rounded-lg hover:bg-[#12121a]">
            <Settings className="w-5 h-5" style={{ color: COLORS.muted }} />
          </button>
          <button onClick={loadData} className="p-2 rounded-lg hover:bg-[#12121a]">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} style={{ color: COLORS.muted }} />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="card h-32 animate-pulse" />
      ) : price ? (
        <div className="space-y-4">
          {/* Price */}
          <div className="card">
            <p className="text-xs mb-1" style={{ color: COLORS.muted }}>收盘价</p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold mono" style={{ color: priceColor }}>
                {price.close.toFixed(2)}
              </span>
              <span className="text-sm mono" style={{ color: priceColor }}>
                {isUp ? '+' : ''}{price.change_percent.toFixed(2)}%
              </span>
            </div>
            <p className="text-xs mt-2" style={{ color: COLORS.muted }}>{price.date}</p>
          </div>

          {/* Signal */}
          <SignalBadge price={price} rule={rule} onOpenSettings={() => setSettingsOpen(true)} />

          {/* Indicators */}
          <div className="card grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs" style={{ color: COLORS.muted }}>RSI</p>
              <p className="text-lg mono">{price.rsi.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: COLORS.muted }}>MACD</p>
              <p className="text-lg mono" style={{ color: price.macd_hist > 0 ? COLORS.up : COLORS.down }}>
                {price.macd_hist > 0 ? '+' : ''}{price.macd_hist.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs" style={{ color: COLORS.muted }}>MA20</p>
              <p className="text-lg mono">{price.ma20.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: COLORS.muted }}>KDJ</p>
              <p className="text-lg mono">{price.kdj_k.toFixed(0)}</p>
            </div>
          </div>
        </div>
      ) : null}

      <SettingsModal symbol={SYMBOL} isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={loadRule} />
      <BottomNav />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f] p-4 text-white">加载中...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
