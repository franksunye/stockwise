'use client';

import { ShieldCheck, XCircle, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { AIPrediction } from '@/lib/types';
import { COLORS } from './constants';

import { formatModelName } from '@/lib/model-names';

/**
 * 历史预测卡片
 * 展示已验证的过往 AI 预测，用于回顾和复盘
 */
export function HistoricalCard({ data, onClick }: { data: AIPrediction; onClick?: (data: AIPrediction) => void }) {
  const isUp = data.signal === 'Long';
  const isDown = data.signal === 'Short';
  
  // 尝试解析 JSON 理由
  let displayReason = data.ai_reasoning;
  try {
    const parsed = JSON.parse(data.ai_reasoning);
    displayReason = parsed.summary || data.ai_reasoning;
  } catch {
    // 如果不是 JSON，则保持原样
  }

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}`;
    }
    return dateStr;
  };

  // 验证结果样式
  const getValidationStyle = () => {
    switch (data.validation_status) {
      case 'Correct':
        return { icon: ShieldCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', label: '预测准确' };
      case 'Incorrect':
        return { icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20', label: '产生偏差' };
      default:
        return { icon: Minus, color: 'text-slate-500', bg: 'bg-slate-500/10 border-slate-500/20', label: '待验证' };
    }
  };

  const validation = getValidationStyle();
  const ValidationIcon = validation.icon;

  // 信号图标
  const SignalIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  // Helper to render indicator badge
  const renderIndicator = (name: string, value: number | undefined, type: 'up' | 'down' | 'neutral') => {
    if (value === undefined) return null;
    const isBullish = type === 'up';
    const colorClass = isBullish ? 'text-emerald-500' : type === 'down' ? 'text-rose-500' : 'text-slate-400';
    const bgClass = isBullish ? 'bg-emerald-500/10 border-emerald-500/20' : type === 'down' ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-500/10 border-slate-500/20';
    
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${bgClass}`}>
        <div className={`w-1 h-1 rounded-full ${isBullish ? 'bg-emerald-500' : type === 'down' ? 'bg-rose-500' : 'bg-slate-400'}`} />
        <span className="text-[9px] font-black text-slate-300 uppercase">{name}</span>
        <span className={`text-[9px] ${colorClass}`}>
           {isBullish ? '↗' : type === 'down' ? '↘' : '-'}
        </span>
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-6 snap-start">
      <div 
        onClick={() => onClick?.(data)}
        className="w-full max-w-md glass-card p-8 border-white/5 relative overflow-hidden active:scale-[0.99] transition-transform cursor-pointer group hover:bg-white/[0.04]"
      >
        
        {/* 顶部：日期 + 验证状态 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] font-black text-slate-400 tracking-widest mono">
              {formatDate(data.target_date)}
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
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${validation.bg}`}>
            <ValidationIcon size={12} className={validation.color} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${validation.color}`}>
              {validation.label}
            </span>
          </div>
        </div>

        {/* 中间：信号 + 摘要 */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isUp ? 'bg-emerald-500/10 border-emerald-500/20' :
              isDown ? 'bg-rose-500/10 border-rose-500/20' :
              'bg-amber-500/10 border-amber-500/20'
            }`}>
              <SignalIcon size={18} style={{ color: isUp ? COLORS.up : isDown ? COLORS.down : COLORS.hold }} />
            </div>
            <h3 className="text-2xl font-black italic tracking-tighter" style={{ 
              color: isUp ? COLORS.up : isDown ? COLORS.down : COLORS.hold 
            }}>
              {isUp ? '建议做多' : isDown ? '建议避险' : '建议观望'}
            </h3>
            {/* Confidence Badge */}
            <div className="flex items-center gap-1 opacity-60 ml-1">
                 <Target size={12} className={isUp ? 'text-emerald-500' : isDown ? 'text-rose-500' : 'text-slate-500'} />
                 <span className="text-[10px] font-bold mono">
                    {((data.confidence || 0) * 100).toFixed(0)}%
                 </span>
            </div>
          </div>
          
          <p className="text-sm text-slate-300 leading-relaxed italic font-medium pl-1 border-l-2 border-white/10">
            &quot;{displayReason.length > 60 ? displayReason.slice(0, 60) + '...' : displayReason}&quot;
          </p>
        </div>

        {/* 技术状态自检 (新增) */}
        {(data.kdj_k !== undefined || data.rsi !== undefined || data.macd !== undefined) && (
             <div className="mb-6">
                 <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-3 rounded-full bg-indigo-500/50" />
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">技术状态自检</span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                     {/* KDJ: K > D Bullish */}
                     {renderIndicator('KDJ', data.kdj_k, (data.kdj_k && data.kdj_d && data.kdj_k > data.kdj_d) ? 'up' : 'down')}
                     {/* RSI: <30 Oversold(Up), >70 Overbought(Down) - Simplified logic here or just based on trend? 
                         Let's align with common usage: RSI rising is good? No, usually RSI Level. 
                         Let's use: > 50 Up, < 50 Down for trend direction proxy if no previous data. 
                     */}
                     {renderIndicator('RSI', data.rsi, (data.rsi && data.rsi > 50) ? 'down' : 'up')} {/* Usually RSI > 70 is sell signal (down), but strong trend is up. Let's stick to simple: High=Red, Low=Green or just trend? 
                     User image had RSI ↘ (Red).
                     Let's Assume RSI > 50 is 'Strong/High' -> maybe Red/Risk?, RSI < 50 Green/Opportunity? 
                     Actually standard: RSI > 70 Overbought (Risk/Short), RSI < 30 Oversold (Buy/Long). 
                     */}
                     
                     {/* MACD: Hist > 0 Bullish */}
                     {renderIndicator('MACD', data.macd_hist, (data.macd_hist && data.macd_hist > 0) ? 'up' : 'down')}
                     
                     {/* BOLL: Trend based on Price position relative to Mid Band */}
                     {renderIndicator('BOLL', data.boll_mid, (data.close_price && data.boll_mid && data.close_price > data.boll_mid) ? 'up' : 'down')}
                 </div>
             </div>
        )}

        {/* 底部：客观股票数据 */}
        <div className="pt-6 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1 tracking-widest">
                {formatDate(data.target_date)} 价格
              </span>
              <p className="text-2xl font-black mono text-slate-100">
                {data.close_price ? data.close_price.toFixed(2) : '--'}
              </p>
            </div>
            
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1 tracking-widest">实际涨跌</span>
              <p className={`text-2xl font-black mono ${
                (data.actual_change || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {data.actual_change !== null && data.actual_change !== undefined
                  ? `${data.actual_change >= 0 ? '+' : ''}${data.actual_change.toFixed(2)}%`
                  : '--'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
