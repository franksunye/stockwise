import { memo } from 'react';
import { Share2, Copy, Shield, Sparkles, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface MarketAlmanacFeedProps {
  index: number;
  onVerticalScroll?: (top: number, index: number) => void;
}

export const MarketAlmanacFeed = memo(function MarketAlmanacFeed({ 
  index,
  onVerticalScroll
}: MarketAlmanacFeedProps) {

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (onVerticalScroll) {
      onVerticalScroll(e.currentTarget.scrollTop, index);
    }
  };

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
               <span className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">2026 · 02 / 24</span>
            </div>
            
            <h2 className="text-5xl font-black italic tracking-tighter text-white drop-shadow-lg">
              静水深流
            </h2>
            <div className="flex flex-col items-center gap-1">
              <p className="text-lg font-bold tracking-[0.2em] text-indigo-100/90">
                宜：静待时机
              </p>
              <div className="flex items-center gap-1.5 opacity-60">
                 <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">气象：晨雾</span>
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
              &quot;股指短期反弹但中期仍承压，在此混沌期，缺乏明确突破催化剂，<span className="text-white font-bold">建议保持耐心，观望等待更明确方向</span>。&quot;
            </p>
          </section>

          {/* 3. Bottom Grid: Data & Action (Mirroring Fact Grid) */}
          <section className="grid grid-cols-2 gap-4">
            {/* Left Box: Key Levels */}
            <div className="glass-card p-4 space-y-4">
               <div>
                  <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest block mb-1">↑ 上方阻尼</span>
                  <p className="text-xl font-black mono tracking-tight text-white">625</p>
               </div>
               <div className="pt-3 border-t border-white/5">
                  <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest block mb-1">↓ 绝对防守</span>
                  <p className="text-xl font-black mono tracking-tight text-white">518</p>
               </div>
            </div>
            
            {/* Right Box: Tactics */}
            <div className="glass-card p-4 flex flex-col justify-between">
              <div>
                <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest block mb-2">今日锦囊</span>
                <div className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10">
                   <p className="text-xs font-bold text-white text-center">观望等待</p>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                 <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                 <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">战略重心：避险</span>
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
