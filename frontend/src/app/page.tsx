'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { RefreshCw, Settings, Target, ShieldCheck, Zap } from 'lucide-react';
import { DailyPrice, UserRule, AIPrediction } from '@/lib/types';
import { getRule } from '@/lib/storage';
import { getIndicatorReviews } from '@/lib/analysis';
import { BottomNav } from '@/components/BottomNav';
import { SettingsModal } from '@/components/SettingsModal';
import { useSearchParams } from 'next/navigation';

const COLORS = { 
  up: '#10b981', 
  down: '#f43f5e', 
  hold: '#f59e0b', 
  muted: '#64748b' 
};

function DashboardContent() {
  const searchParams = useSearchParams();
  const urlSymbol = searchParams.get('symbol');
  const symbol = urlSymbol || '02171';
  
  const [price, setPrice] = useState<DailyPrice | null>(null);
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [rule, setRule] = useState<UserRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock?symbol=${symbol}`);
      const data = await res.json();
      if (data.price) setPrice(data.price);
      if (data.prediction) setPrediction(data.prediction);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    loadData();
    setRule(getRule(symbol));
  }, [symbol, loadData]);

  const reviews = price ? getIndicatorReviews(price) : [];
  const signalGlow = prediction?.signal === 'Long' ? 'glow-up' : 
                     prediction?.signal === 'Short' ? 'glow-down' : 'glow-hold';

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center">
      {/* 动态背景辉光 */}
      <div className={`hero-glow ${signalGlow}`} />

      <div className="w-full max-w-md px-6 pt-8 pb-32 z-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">智能决策核心</span>
            <h1 className="text-xl font-black italic tracking-tighter">STOCKWISE <span className="text-indigo-500 underline decoration-2 underline-offset-4">X</span></h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSettingsOpen(true)} className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-90">
              <Settings className="w-4 h-4 text-slate-400" />
            </button>
            <button onClick={loadData} className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-90">
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="space-y-6">
            <div className="glass-card h-64 animate-pulse" />
            <div className="glass-card h-32 animate-pulse" />
          </div>
        ) : price ? (
          <div className="space-y-8">
            {/* 1. AI 顶层核心结论 */}
            <section className="text-center space-y-2 py-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                <span className="text-[10px] font-bold text-slate-400 tracking-wider">AI 代理实时在线</span>
              </div>
              <h2 className="text-5xl font-black tracking-tighter" style={{ 
                color: prediction?.signal === 'Long' ? COLORS.up : 
                       prediction?.signal === 'Short' ? COLORS.down : COLORS.hold 
              }}>
                {prediction?.signal === 'Long' ? '强烈看多' : 
                 prediction?.signal === 'Short' ? '建议避灾' : '持仓观望'}
              </h2>
              <div className="flex items-center justify-center gap-4 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1 uppercase tracking-widest"><Target className="w-3 h-3" /> 置信度 {((prediction?.confidence || 0) * 100).toFixed(0)}%</span>
                <span className="w-1 h-1 rounded-full bg-slate-700" />
                <span className="uppercase tracking-widest italic">{symbol}.HK</span>
              </div>
            </section>

            {/* 2. 当前价格与 AI 理由 (Glass Card) */}
            <section className="glass-card relative overflow-hidden group">
               {/* 理由 */}
              <div className="relative z-10">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 flex items-center justify-center shrink-0 border border-indigo-500/30 ai-pulse">
                    <Zap className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-tight mb-1">AI 深度洞察</h3>
                    <p className="text-sm leading-relaxed text-slate-200 font-medium">
                      &quot;{prediction?.ai_reasoning || '正在评估当下市场波动与技术面共振程度...'}&quot;
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-t border-white/5">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-1">当前成交价</span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black mono">{price.close.toFixed(2)}</span>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-white/5" style={{ color: price.change_percent >= 0 ? COLORS.up : COLORS.down }}>
                        {price.change_percent >= 0 ? '+' : ''}{price.change_percent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest block mb-1">昨日验证</span>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      {prediction?.validation_status === 'Correct' ? (
                        <span className="text-emerald-500 flex items-center gap-1 text-sm font-bold"><ShieldCheck className="w-4 h-4" /> 结果准确</span>
                      ) : prediction?.validation_status === 'Incorrect' ? (
                        <span className="text-rose-500 text-sm font-bold">❌ 偏差回顾</span>
                      ) : (
                        <span className="text-slate-500 text-sm font-bold italic">待验证</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. 辅助决策信息 */}
            <section className="grid grid-cols-2 gap-4">
               <div className="glass-card p-4 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">
                    {rule?.position === 'holding' ? '卖出预警线' : 
                     rule?.position === 'empty' ? '入场观察位' : '建议止损/支撑'}
                  </span>
                  <p className="text-xl font-black mono text-rose-500 mt-2">
                    {prediction?.support_price?.toFixed(2) || rule?.support_price?.toFixed(2) || '--'}
                  </p>
               </div>
               <div className="glass-card p-4 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">市场情绪 (RSI)</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <p className="text-xl font-black mono">{price.rsi.toFixed(0)}</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400">
                      {price.rsi > 70 ? '超买' : price.rsi < 30 ? '超卖' : '运行稳健'}
                    </span>
                  </div>
               </div>
            </section>

            {/* 4. 技术状态微型列表 */}
            <section className="space-y-3 px-2">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-1 bg-indigo-500 rounded-full" /> 技术状态自检
              </h4>
              <div className="flex flex-wrap gap-2">
                {reviews.slice(0, 4).map(review => (
                  <div key={review.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[review.status as keyof typeof COLORS] || COLORS.hold }} />
                    <span className="text-slate-300">{review.label}</span>
                    <span className="text-slate-600">{review.status === 'up' ? '↗' : review.status === 'down' ? '↘' : '→'}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Zap className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm font-medium">未能捕获到行情数据</p>
            <button onClick={loadData} className="mt-4 text-xs font-bold underline">重试抓取</button>
          </div>
        )}

        <SettingsModal symbol={symbol} isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onSave={() => {
          setRule(getRule(symbol));
          loadData();
        }} />
        <BottomNav />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050508] flex items-center justify-center text-slate-500 text-xs font-bold tracking-widest">正在初始化核心系统...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
