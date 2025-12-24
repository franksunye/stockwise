'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { RefreshCw, Settings, Target, ShieldCheck, Zap } from 'lucide-react';
import { DailyPrice, UserRule, AIPrediction } from '@/lib/types';
import { getRule } from '@/lib/storage';
import { getIndicatorReviews } from '@/lib/analysis';
import { BottomNav } from '@/components/BottomNav';
import { SettingsModal } from '@/components/SettingsModal';
import { useSearchParams } from 'next/navigation';

import { ChevronRight, X as CloseIcon, Info } from 'lucide-react';

const COLORS = { 
  up: '#10b981', 
  down: '#f43f5e', 
  hold: '#f59e0b', 
  muted: '#64748b' 
};

interface Tactic {
  p: string;
  a: string;
  c: string;
  r: string;
}

interface TacticalData {
  summary: string;
  tactics: {
    holding: Tactic[];
    empty: Tactic[];
  };
  conflict: string;
}

// --- Tactical Brief Drawer Component ---
function TacticalBriefDrawer({ 
  isOpen, 
  onClose, 
  data, 
  userPos 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  data: TacticalData;
  userPos: 'holding' | 'empty' | 'none';
}) {
  if (!isOpen || !data) return null;

  const tactics = data.tactics?.[userPos === 'none' ? 'empty' : userPos] || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />
      <div className="w-full max-w-md bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] p-8 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-20 duration-500 relative z-10">
        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
        
        <header className="flex items-center justify-between mb-8">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500 font-bold">智能决策核心</span>
            <h2 className="text-xl font-black italic tracking-tighter text-white">TACTICAL <span className="text-indigo-500">BRIEF</span></h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 border border-white/10 text-slate-400">
            <CloseIcon size={20} />
          </button>
        </header>

        <div className="space-y-8">
          <section>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 
              当前场景建议 ({userPos === 'holding' ? '已持仓' : '未建仓'})
            </h3>
            <div className="space-y-3">
              {(tactics as Tactic[]).map((t, idx) => (
                <div key={idx} className="glass-card p-4 border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-black px-1.5 py-0.5 rounded italic ${
                      t.p === 'P1' ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'
                    }`}>{t.p}</span>
                    <span className="text-sm font-bold text-white content-start">{t.a}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-1">触发: <span className="text-slate-200">{t.c}</span></p>
                  <p className="text-xs text-slate-500 font-medium italic">理由: {t.r}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Info size={12} /> 核心冲突处理原则
            </h3>
            <p className="text-sm text-indigo-300/70 leading-relaxed italic">
              {data.conflict || "遵循趋势优先原则，在信号矛盾时以核心支撑位为准。"}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const urlSymbol = searchParams.get('symbol');
  const symbol = urlSymbol || '02171';
  
  const [price, setPrice] = useState<DailyPrice | null>(null);
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [previousPrediction, setPreviousPrediction] = useState<AIPrediction | null>(null);
  const [rule, setRule] = useState<UserRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTactics, setShowTactics] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('--:--');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stock?symbol=${symbol}`);
      const data = await res.json();
      if (data.price) setPrice(data.price);
      if (data.prediction) setPrediction(data.prediction);
      if (data.previousPrediction) setPreviousPrediction(data.previousPrediction);
      if (data.last_update_time) setLastUpdated(data.last_update_time);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [symbol]);

  useEffect(() => {
    loadData();
    setRule(getRule(symbol));

    // 每 10 分钟自动刷新一次 (600,000 ms)
    const interval = setInterval(() => {
      loadData();
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [symbol, loadData]);

  const reviews = price ? getIndicatorReviews(price) : [];
  const signalGlow = prediction?.signal === 'Long' ? 'glow-up' : 
                     prediction?.signal === 'Short' ? 'glow-down' : 'glow-hold';

  // 计算是否跌破预警线
  const isTriggered = price && prediction?.support_price && price.close < prediction.support_price;

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center">
      {/* 动态背景辉光 */}
      <div className={`hero-glow ${signalGlow}`} />

      <div className="w-full max-w-md px-6 pt-8 pb-32 z-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500 font-bold">智能决策核心</span>
            <h1 className="text-2xl font-black italic tracking-tighter">STOCKWISE <span className="text-indigo-500 underline decoration-2 underline-offset-4">X</span></h1>
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
                <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-indigo-400 animate-spin' : 'bg-indigo-500 animate-ping'}`} />
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                  {loading ? '同步中...' : `AI 实时监控 (最后更新: ${lastUpdated})`}
                </span>
              </div>
              <h2 className="text-4xl font-black tracking-tighter" style={{ 
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
            <section 
              onClick={() => setShowTactics(true)}
              className={`glass-card relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all hover:bg-white/[0.04] ${isTriggered ? 'warning-pulse' : ''}`}
            >
               {/* 理由 */}
              <div className="relative z-10">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 flex items-center justify-center shrink-0 border border-indigo-500/30 ai-pulse">
                    <Zap className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-tight mb-1">AI 深度洞察</h3>
                    <div className="space-y-3">
                      {(() => {
                        try {
                          const data = JSON.parse(prediction?.ai_reasoning || '') as TacticalData;
                          const userPos = rule?.position === 'holding' ? 'holding' : 'empty';
                          const p1 = data.tactics?.[userPos]?.[0];
                          
                          return (
                            <>
                              <p className="text-sm leading-relaxed text-slate-200 font-medium">
                                &quot;{data.summary || prediction?.ai_reasoning}&quot;
                              </p>
                              {p1 && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                  <span className="text-xs font-black bg-indigo-500 text-white px-1.5 py-0.5 rounded italic">P1</span>
                                  <span className="text-xs font-bold text-indigo-400">{p1.a}:</span>
                                  <span className="text-xs text-slate-300 font-medium">{p1.c}</span>
                                </div>
                              )}
                            </>
                          );
                        } catch {
                          return (
                            <p className="text-sm leading-relaxed text-slate-200 font-medium">
                              &quot;{prediction?.ai_reasoning || '正在评估当下市场波动与技术面共振程度...'}&quot;
                            </p>
                          );
                        }
                      })()}
                    </div>
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-4 border-t border-white/5">
                  <div>
                    <span className="text-xs text-slate-500 uppercase font-black tracking-widest block mb-1">当前成交价</span>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black mono">{price.close.toFixed(2)}</span>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-white/5" style={{ color: price.change_percent >= 0 ? COLORS.up : COLORS.down }}>
                        {price.change_percent >= 0 ? '+' : ''}{price.change_percent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 uppercase font-black tracking-widest block mb-1">昨日验证</span>
                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      {previousPrediction?.validation_status === 'Correct' ? (
                        <span className="text-emerald-500 flex items-center gap-1 text-sm font-bold"><ShieldCheck className="w-4 h-4" /> 结果准确</span>
                      ) : previousPrediction?.validation_status === 'Incorrect' ? (
                        <span className="text-rose-500 text-sm font-bold">❌ 偏差回顾</span>
                      ) : previousPrediction?.validation_status === 'Neutral' ? (
                        <span className="text-amber-500 text-sm font-bold">观望中性</span>
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
                  <span className="text-xs text-slate-500 font-bold uppercase">
                    {rule?.position === 'holding' ? '卖出预警线' : 
                     rule?.position === 'empty' ? '入场观察位' : '建议止损/支撑'}
                  </span>
                  <p className="text-2xl font-black mono text-rose-500 mt-2">
                    {prediction?.support_price?.toFixed(2) || rule?.support_price?.toFixed(2) || '--'}
                  </p>
               </div>
               <div className="glass-card p-4 flex flex-col justify-between">
                  <span className="text-xs text-slate-500 font-bold uppercase">市场情绪 (RSI)</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <p className="text-2xl font-black mono">{price.rsi.toFixed(0)}</p>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-slate-400">
                      {price.rsi > 70 ? '超买' : price.rsi < 30 ? '超卖' : '运行稳健'}
                    </span>
                  </div>
               </div>
            </section>

            {/* 4. 技术状态微型列表 */}
            <section className="space-y-3 px-2">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <div className="w-2 h-1 bg-indigo-500 rounded-full" /> 技术状态自检
              </h4>
              <div className="flex flex-wrap gap-2">
                {reviews.slice(0, 4).map(review => (
                  <div key={review.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs font-bold">
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

        {(() => {
          try {
            const data = JSON.parse(prediction?.ai_reasoning || '') as TacticalData;
            return (
              <TacticalBriefDrawer 
                isOpen={showTactics} 
                onClose={() => setShowTactics(false)} 
                data={data}
                userPos={rule?.position || 'none'}
              />
            );
          } catch {
            return null;
          }
        })()}

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
