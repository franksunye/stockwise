'use client';

import { memo } from 'react';
import { ShieldCheck, XCircle, TrendingUp, TrendingDown, Minus, Target, Clock } from 'lucide-react';
import { AIPrediction } from '@/lib/types';
import { getPredictionActionMeta } from '@/lib/layer1-ui';
import { formatModelName } from '@/lib/model-names';
import { formatHistoricalCardDate, getHistoricalCardSurface } from '@/lib/historical-card-surface';

/**
 * 历史预测卡片
 * 展示已验证的过往 AI 预测，用于回顾和复盘
 */
export const HistoricalCard = memo(function HistoricalCard({ data, onClick }: { data: AIPrediction; onClick?: (data: AIPrediction) => void }) {
  const isUp = data.signal === 'Long';
  const isDown = data.signal === 'Short';
  const actionMeta = getPredictionActionMeta(data);
  const { displayReason, basePrice, baseChange, validationData, validationStyle } = getHistoricalCardSurface(data);
  const ValidationIcon = validationStyle.iconName === 'correct'
    ? ShieldCheck
    : validationStyle.iconName === 'incorrect'
      ? XCircle
      : validationStyle.iconName === 'verifying'
        ? Clock
        : Minus;

  // 信号图标
  const SignalIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    // Layout Contract: each historical card must be a full snap page.
    // Do not switch back to h-full without an explicit parent height contract.
    <div className="h-[100dvh] min-h-[100dvh] shrink-0 w-full flex flex-col items-center justify-center px-6 snap-start snap-always">
      <div 
        onClick={() => onClick?.(data)}
        className="w-full max-w-md glass-card p-8 border-white/5 relative overflow-hidden active:scale-[0.99] transition-transform cursor-pointer group hover:bg-white/[0.04]"
      >
        
        {/* 顶部：日期 + 验证状态 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] font-black text-slate-400 tracking-widest mono">
              {formatHistoricalCardDate(data.target_date)}
              {data.model && (
                <span className="ml-2 text-[9px] text-indigo-500/50 italic opacity-80 uppercase tracking-tighter">
                   {formatModelName(data.model)}
                </span>
              )}
            </div>
            <div className="h-px w-8 bg-white/10" />
            <div className="hidden group-hover:block transition-all">
                <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">点击回顾</span>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${validationStyle.bg}`}>
            <ValidationIcon size={12} className={validationStyle.color} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${validationStyle.color}`}>
              {validationStyle.label}
            </span>
          </div>
        </div>

        {/* 中间：信号 + 摘要 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isUp ? 'bg-rose-500/10 border-rose-500/20' :
              isDown ? 'bg-emerald-500/10 border-emerald-500/20' :
              'bg-amber-500/10 border-amber-500/20'
            }`}>
              <SignalIcon size={18} className={actionMeta.textClass} />
            </div>
            <h3 className="text-2xl font-black italic tracking-tighter" style={{ 
              color: actionMeta.color
            }}>
              {actionMeta.headline}
            </h3>
            {/* Confidence Badge */}
            <div className="flex items-center gap-1 opacity-60 ml-1">
                 <Target size={12} className={isUp ? 'text-rose-500' : isDown ? 'text-emerald-500' : 'text-slate-500'} />
                 <span className="text-[10px] font-bold mono">
                    {((data.confidence || 0) * 100).toFixed(0)}%
                 </span>
            </div>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed italic font-medium pl-1 border-l-2 border-white/10">
            &quot;{displayReason.length > 60 ? displayReason.slice(0, 60) + '...' : displayReason}&quot;
          </p>
        </div>


        {/* 底部：客观股票数据 */}
        <div className="pt-6 border-t border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs text-slate-500 font-bold uppercase block mb-1 tracking-widest leading-tight">
                {formatHistoricalCardDate(data.target_date)} 收盘价
              </span>
              <p className="text-2xl font-black mono text-slate-100">
                {data.close_price ? data.close_price.toFixed(2) : '--'}
              </p>
            </div>
            
            <div className="text-right">
              <span className="text-xs text-slate-500 font-bold uppercase block mb-1 tracking-widest leading-tight">
                当日涨跌
              </span>
              <p className={`text-2xl font-black italic tracking-tighter ${
                (data.actual_change || 0) >= 0 ? 'text-rose-500' : 'text-emerald-500'
              }`}>
                {data.actual_change !== null && data.actual_change !== undefined
                  ? `${data.actual_change >= 0 ? '+' : ''}${data.actual_change.toFixed(2)}%`
                  : '--'}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <div className="space-y-2">
              {/* 基准日 (T+0 参考) - 极致美化版 */}
              <div className="flex items-center justify-between group/row relative">
                {/* 连接线：从基准日指向第1日 */}
                <div className="absolute left-[3px] top-[14px] bottom-[-2px] w-[1px] bg-gradient-to-b from-white/10 to-white/5" />
                
                <div className="flex items-center gap-3 relative">
                  {/* 锚点小圆点 */}
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40 border border-indigo-400/20" />
                  <span className="text-[10px] font-black text-indigo-400/40 uppercase tracking-[0.2em] w-12 mr-[-8px]">基准日</span>
                  <span className="text-[10px] font-bold text-slate-500 mono">
                    {formatHistoricalCardDate(data.date)}
                  </span>
                </div>
                
                <div className="flex items-center gap-6">
                  <span className="text-xs font-bold text-slate-500 mono w-12 text-right">
                    {basePrice ? basePrice.toFixed(2) : '--'}
                  </span>
                  <span className={`text-[10px] font-black mono w-14 text-right ${
                    baseChange >= 0 ? 'text-rose-500/30' : 'text-emerald-500/30'
                  }`}>
                    {baseChange !== undefined ? `${baseChange >= 0 ? '+' : ''}${baseChange.toFixed(2)}%` : '--'}
                  </span>
                </div>
              </div>

              {[0, 1, 2].map((dayOffset) => {
                const dayData = validationData?.trajectory?.[dayOffset];
                const dayLabel = `第 ${dayOffset + 1} 日`;
                
                return (
                  <div key={dayOffset} className="flex items-center justify-between group/row">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-600 mono w-12">{dayLabel}</span>
                      <span className="text-xs font-medium text-slate-400 mono">
                        {dayData ? formatHistoricalCardDate(dayData.date) : '--/--'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <span className="text-xs font-bold text-slate-300 mono w-12 text-right">
                        {dayData?.close ? dayData.close.toFixed(2) : '--'}
                      </span>
                      <span className={`text-xs font-black mono w-14 text-right ${
                        dayData ? (dayData.cum_change >= 0 ? 'text-rose-500/80' : 'text-emerald-500/80') : 'text-slate-700'
                      }`}>
                        {dayData ? `${dayData.cum_change >= 0 ? '+' : ''}${dayData.cum_change.toFixed(2)}%` : '--'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
