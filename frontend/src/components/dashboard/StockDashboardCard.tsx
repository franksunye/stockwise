'use client';

import { Zap, Target, ShieldCheck, ChevronDown } from 'lucide-react';
import { StockData, TacticalData } from '@/lib/types';
import { getMarketScene, formatStockSymbol } from '@/lib/date-utils';
import { COLORS } from './constants';

interface StockDashboardCardProps {
  data: StockData;
  onShowTactics: () => void;
}

export function StockDashboardCard({ data, onShowTactics }: StockDashboardCardProps) {
  if (data.loading || !data.price) return (
    <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
      <div className="w-20 h-20 rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center">
        <Zap className="w-8 h-8 text-indigo-500 animate-pulse fill-indigo-500/20" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-black italic tracking-tighter text-white">{data.name}</h2>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">核心数据同步中...</p>
      </div>
    </div>
  );

  const scene = getMarketScene();
  const isPostMarket = scene === 'post_market';
  const isPreMarket = scene === 'pre_market';
  
  // 核心预测数据
  const displayPrediction = data.prediction;
  const isTriggered = displayPrediction?.support_price && data.price.close < displayPrediction.support_price;

  // 1. 标题文案逻辑
  const mainTitle = isPostMarket ? '明日建议' : '今日建议';
  
  // 2. 信号文案简化展示
  const getSignalText = (signal?: string) => {
    switch(signal) {
      case 'Long': return '建议做多';
      case 'Short': return '建议避险';
      case 'Side': return '建议观望';
      default: return '持仓观望';
    }
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-6 snap-start pt-32 pb-32">
      <div className="w-full max-w-md space-y-5">
        {/* 1. AI 顶层核心结论 */}
        <section className="text-center space-y-1 py-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
            <span className="text-[9px] font-bold text-slate-500 tracking-wider uppercase">{mainTitle} ({data.lastUpdated})</span>
          </div>
          <h2 className="text-4xl font-black tracking-tighter" style={{ 
            color: displayPrediction?.signal === 'Long' ? COLORS.up : displayPrediction?.signal === 'Short' ? COLORS.down : COLORS.hold 
          }}>
            {getSignalText(displayPrediction?.signal)}
          </h2>
          <div className="flex items-center justify-center gap-3 text-[10px] font-bold text-slate-600">
            <span className="flex items-center gap-1 uppercase tracking-widest"><Target className="w-3 h-3" /> 置信度 {((displayPrediction?.confidence || 0) * 100).toFixed(0)}%</span>
            <span className="w-0.5 h-0.5 rounded-full bg-slate-800" />
            <span className="uppercase tracking-widest italic">{formatStockSymbol(data.symbol)}</span>
          </div>
        </section>

        {/* 2. AI 理由与动态价格区块 */}
        <section 
          onClick={onShowTactics}
          className={`glass-card relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all hover:bg-white/[0.04] ${isTriggered ? 'warning-pulse' : ''}`}
        >
          <div className="relative z-10 p-5">
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-md bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30 ai-pulse">
                  <Zap className="w-2.5 h-2.5 text-indigo-400 fill-indigo-400/20" />
                </div>
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AI 深度洞察</h3>
              </div>
              
              <div className="space-y-4">
                {(() => {
                  try {
                    const tData = JSON.parse(displayPrediction?.ai_reasoning || '') as TacticalData;
                    const userPos = data.rule?.position === 'holding' ? 'holding' : 'empty';
                    const p1 = tData.tactics?.[userPos]?.[0];
                    return (
                      <>
                        <p className="text-sm leading-relaxed text-slate-300 font-medium italic pl-1 border-l-2 border-indigo-500/20">
                          &quot;{tData.summary || displayPrediction?.ai_reasoning}&quot;
                        </p>
                        {p1 && <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 w-full overflow-hidden">
                          <span className="text-[9px] font-black bg-indigo-500 text-white px-1 py-0.5 rounded italic shrink-0">{p1.priority}</span>
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[10px] font-bold text-indigo-400 shrink-0">{p1.action}:</span>
                            <span className="text-[10px] text-slate-400 font-medium truncate">{p1.trigger}</span>
                          </div>
                        </div>}
                      </>
                    );
                  } catch {
                    return <p className="text-sm leading-relaxed text-slate-300 font-medium italic pl-1 border-l-2 border-indigo-500/20">&quot;{displayPrediction?.ai_reasoning || '正在评估行情...'}&quot;</p>;
                  }
                })()}
              </div>
            </div>

            {/* 动态价格与验证区块：开市前留白 */}
            {!isPreMarket && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div>
                  <span className="text-[10px] text-slate-600 uppercase font-black tracking-widest block mb-0.5">
                    {isPostMarket ? '今日收盘价' : '当前成交价'}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black mono tracking-tight">{data.price.close.toFixed(2)}</span>
                    <span className="text-[10px] font-bold" style={{ color: data.price.change_percent >= 0 ? COLORS.up : COLORS.down }}>
                      {data.price.change_percent >= 0 ? '+' : ''}{data.price.change_percent.toFixed(2)}%
                    </span>
                  </div>
                </div>
                
                {/* 仅在收市后显示今日验证结果 */}
                {isPostMarket && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-600 uppercase font-black tracking-widest block mb-1">今日验证</span>
                    <div className="flex items-center justify-end gap-1.5 font-bold text-[11px]">
                      {data.previousPrediction?.validation_status === 'Correct' ? <span className="text-emerald-500/80 flex items-center gap-1"><ShieldCheck size={12} /> 结果准确</span> :
                       data.previousPrediction?.validation_status === 'Incorrect' ? <span className="text-rose-500/80">❌ 偏差回顾</span> : <span className="text-slate-600 italic">待验证</span>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 3. 底部建议价与市场情绪 */}
        <section className="grid grid-cols-2 gap-4 pb-2">
           <div className="glass-card p-4 flex flex-col justify-between">
              <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">{data.rule?.position === 'holding' ? '止损预警' : '策略支撑'}</span>
              <p className="text-xl font-black mono text-rose-500/90 mt-1">{displayPrediction?.support_price?.toFixed(2) || '--'}</p>
           </div>
           
           {/* RSI 仅在有价格数据时（非开市前）显示 */}
           {!isPreMarket ? (
             <div className="glass-card p-4 flex flex-col justify-between">
                <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">市场情绪 (RSI)</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-xl font-black mono">{data.price.rsi.toFixed(0)}</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-slate-600 whitespace-nowrap">{data.price.rsi > 70 ? '超买' : data.price.rsi < 30 ? '超卖' : '运行稳健'}</span>
                </div>
             </div>
           ) : (
             <div className="glass-card p-4 flex items-center justify-center opacity-30 border-dashed">
                <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest italic">盘中开启监控</span>
             </div>
           )}
        </section>

        {data.history.length > 1 && (
          <div className="flex flex-col items-center gap-1.5 pt-2 opacity-20">
            <span className="text-[8px] font-black tracking-[0.2em] text-slate-500 uppercase">上划追溯历史轨迹</span>
            <ChevronDown size={14} className="animate-bounce" />
          </div>
        )}
      </div>
    </div>
  );
}
