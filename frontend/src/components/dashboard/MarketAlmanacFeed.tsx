import { memo } from 'react';
import { Share2, Copy, Shield, Sparkles, ChevronDown, Waves, Thermometer, Target, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface MarketAlmanacFeedProps {
  index: number;
  data?: {
    target_date?: string;
    mood_tag?: string;
    action_strategy?: string;
    meteorology?: string;
    ai_insight?: string;
    market_entropy?: {
      score: number;
      label: string;
      breadth: string;
      volume_status: string;
    };
    sector_currents?: {
      main: Array<{name: string, flow: string}>;
      inverse?: Array<{name: string, flow: string}>;
    };
  } | null;
  onVerticalScroll?: (top: number, index: number) => void;
}

export const MarketAlmanacFeed = memo(function MarketAlmanacFeed({ 
  index,
  data,
  onVerticalScroll
}: MarketAlmanacFeedProps) {

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (onVerticalScroll) {
      onVerticalScroll(e.currentTarget.scrollTop, index);
    }
  };

  // Safely extract properties
  const targetDate = data?.target_date || new Date().toISOString().split('T')[0];
  const dateFormatted = targetDate.replace(/-/g, ' / ');
  const moodTag = data?.mood_tag || '混沌未明';
  const actionStrategy = data?.action_strategy || '宜：观望 / 忌：盲动';
  const meteorology = data?.meteorology || '微雨';
  const insight = data?.ai_insight || '股指进入混沌期，缺乏明确突破点。板块轮动加速，建议保持观望。';
  
  const entropy = data?.market_entropy || { score: 50, label: '50% · 震荡', breadth: '震荡分化', volume_status: '量能平稳' };
  const sectors = data?.sector_currents || { main: [{name: '待更新', flow: ''}], inverse: [{name: '待更新', flow: ''}] };

  return (
    <div className="min-w-full h-full relative snap-center overflow-hidden">
      <div 
        onScroll={handleScroll}
        className="w-full h-full absolute inset-0 overflow-y-scroll snap-y snap-mandatory scrollbar-hide flex flex-col items-center px-6 pt-32 pb-32"
      >
        <div className="w-full max-w-md space-y-6 mx-auto">
          {/* 1. Macro Mood & Summary */}
          <section className="text-center space-y-2 py-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-2">
               <Sparkles className="w-3 h-3 text-indigo-400" />
               <span className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">{dateFormatted}</span>
            </div>
            
            <h2 className="text-5xl font-black italic tracking-tighter text-white drop-shadow-lg">
              {moodTag}
            </h2>
            <div className="flex flex-col items-center gap-1">
              <p className="text-lg font-bold tracking-[0.2em] text-indigo-100/90">
                {actionStrategy.split(' / ')[0] || actionStrategy}
              </p>
              <div className="flex items-center gap-1.5 opacity-60">
                 <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">气象：{meteorology}</span>
              </div>
            </div>
          </section>

          {/* 2. AI Market Insight (Mirroring Stock AI Insight) */}
          <section className="glass-card p-5 relative overflow-hidden group">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                <Shield className="w-2.5 h-2.5 text-indigo-400 fill-indigo-400/20" />
              </div>
              <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                AI 市场天机 · GLOBAL INSIGHT
              </h3>
            </div>
            
            <p className="text-sm leading-relaxed text-slate-300 font-medium italic pl-1 border-l-2 border-indigo-500/20">
              {insight}
            </p>
          </section>

          {/* 3. Bottom Grid: Data & Action (Mirroring Fact Grid) */}
          <section className="grid grid-cols-2 gap-4">
            {/* Left Box: Sector Currents & Entropy */}
            <div className="glass-card p-4 flex flex-col justify-between overflow-hidden min-h-[140px]">
               <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Waves className="w-3 h-3 text-indigo-400" />
                    <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">板块洋流 · SECTORS</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-300">主向：{sectors.main[0]?.name || '-'}</span>
                      <span className="text-[9px] font-black text-emerald-500">{sectors.main[0]?.flow ? `+${sectors.main[0]?.flow}` : ''}</span>
                    </div>
                    {sectors.inverse && sectors.inverse[0] && (
                      <div className="flex items-center justify-between opacity-50">
                        <span className="text-[10px] font-bold text-slate-400">逆向：{sectors.inverse[0]?.name || '-'}</span>
                        <span className="text-[9px] font-black text-rose-500">{sectors.inverse[0]?.flow ? `-${sectors.inverse[0]?.flow}` : ''}</span>
                      </div>
                    )}
                  </div>
               </div>
               
               <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Thermometer className="w-3 h-3 text-amber-500" />
                    <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">全场热度</span>
                  </div>
                  <span className="text-[10px] font-black mono text-slate-200">{entropy.score}% · {entropy.breadth.substring(0,2)}</span>
               </div>
            </div>
            
            {/* Right Box: Action Almanac */}
            <div className="glass-card p-4 flex flex-col justify-between min-h-[140px]">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Target className="w-3 h-3 text-indigo-400" />
                  <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">行动指南 · ACTION</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-400 px-1 rounded">宜</span>
                    <span className="text-[11px] font-bold text-slate-200">{(actionStrategy.split(' / ')[0] || '').replace('宜：', '')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black bg-rose-500/10 text-rose-500/70 px-1 rounded">忌</span>
                    <span className="text-[11px] font-bold text-slate-400">{(actionStrategy.split(' / ')[1] || '').replace('忌：', '')}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                 <Zap className="w-3 h-3 text-indigo-500 fill-indigo-500/20" />
                 <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block leading-none">全场量能状态</span>
                    <span className="text-[10px] font-black mono text-slate-300">{entropy.volume_status}</span>
                 </div>
              </div>
            </div>
          </section>



          {/* 4. Scroll Indicator */}
          <div className="flex flex-col items-center gap-1.5 pt-4 opacity-20">
            <span className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">右滑进入个股洞察</span>
            <ChevronDown size={14} className="rotate-[270deg] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
});
