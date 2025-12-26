'use client';

import { ShieldCheck, TrendingDown } from 'lucide-react';
import { AIPrediction } from '@/lib/types';
import { COLORS } from './constants';

interface HistoricalCardProps {
  data: AIPrediction;
}

export function HistoricalCard({ data }: HistoricalCardProps) {
  const isUp = data.signal === 'Long';
  const isDown = data.signal === 'Short';
  
  // 尝试解析 JSON 理由
  let displayReason = data.ai_reasoning;
  try {
    const parsed = JSON.parse(data.ai_reasoning);
    displayReason = parsed.summary || data.ai_reasoning;
  } catch (e) {
    // 如果不是 JSON，则保持原样
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-6 snap-start">
      <div className="w-full max-w-md glass-card p-8 border-white/5 relative overflow-hidden active:scale-[0.99] transition-transform">
        <div className="flex items-center gap-3 mb-8">
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-slate-500 tracking-widest mono uppercase">
            {data.date}
          </div>
          <div className="h-px flex-1 bg-white/5" />
          <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${
            data.validation_status === 'Correct' ? 'text-emerald-500' : 'text-rose-500'
          }`}>
            {data.validation_status === 'Correct' ? <><ShieldCheck size={12} /> 准确</> : <><TrendingDown size={12} /> 偏离回顾</>}
          </div>
        </div>

        <h3 className="text-3xl font-black italic mb-6 tracking-tighter" style={{ color: isUp ? COLORS.up : isDown ? COLORS.down : COLORS.hold }}>
          {isUp ? '建议做多' : isDown ? '建议避险' : '建议观望'}
        </h3>
        
        <p className="text-base text-slate-300 leading-relaxed italic mb-10 font-medium">
          &quot;{displayReason.length > 80 ? displayReason.slice(0, 80) + '...' : displayReason}&quot;
        </p>

        <div className="grid grid-cols-2 pt-8 border-t border-white/5">
           <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1 tracking-widest">建议参考价</span>
              <p className="text-2xl font-black mono text-white">{data.support_price?.toFixed(2) || '--'}</p>
           </div>
           <div className="text-right">
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1 tracking-widest">实盘变动</span>
              <p className={`text-xl font-black mono ${data.actual_change && data.actual_change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {data.actual_change ? (data.actual_change >= 0 ? '+' : '') + data.actual_change.toFixed(2) + '%' : '已结算'}
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
