import { memo } from 'react';
import { Share2, Copy, Shield, Sparkles } from 'lucide-react';
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
        className="w-full h-full absolute inset-0 overflow-y-scroll snap-y snap-mandatory scrollbar-hide flex flex-col items-center justify-center p-6"
      >
        {/* Placeholder Component Structure mirroring Stock Dashboard */}
        <div className="w-full max-w-sm aspect-[3/4.5] rounded-[32px] bg-[#0A0A0F] border border-white/5 relative overflow-hidden flex flex-col justify-between p-8 shadow-2xl">
          
          {/* Header area of card */}
          <div className="flex flex-col items-center gap-2 mt-4 relative z-10">
            <span className="text-[10px] font-black text-slate-500 tracking-[0.3em] uppercase">2026</span>
            <div className="flex items-center text-5xl font-black italic tracking-tighter">
              <span className="text-white">02</span>
              <span className="text-white/20 mx-1">/</span>
              <span className="text-white">24</span>
            </div>
            
            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center mt-6 bg-white/5">
              <Shield className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          {/* Center Intent */}
          <div className="flex flex-col items-center text-center mt-auto mb-auto relative z-10">
            <h2 className="text-5xl font-black italic tracking-tighter mb-4 text-white drop-shadow-lg">
              静水深流
            </h2>
            <p className="text-sm font-bold tracking-widest text-slate-400 mb-6">
              宜：静待时机
            </p>
            <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 flex items-center gap-2">
               <Sparkles className="w-3 h-3 text-indigo-400" />
               <span className="text-[10px] font-bold text-slate-300">气象：晨雾</span>
            </div>
          </div>

          {/* Bottom Data Info */}
          <div className="w-full space-y-3 relative z-10">
            {/* Range */}
            <div className="w-full rounded-2xl bg-white/5 border border-white/10 flex justify-between px-6 py-4">
               <div className="text-left">
                  <p className="text-[10px] text-slate-500 font-bold mb-1">↑ 上方阻尼</p>
                  <p className="text-sm font-black mono text-white">625</p>
               </div>
               <div className="w-px h-full bg-white/10" />
               <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-bold mb-1">↓ 绝对防守</p>
                  <p className="text-sm font-black mono text-white">518</p>
               </div>
            </div>
            
            {/* Tactic text */}
            <div className="w-full rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="flex gap-2 mb-1">
                 <span className="text-[10px] font-black text-indigo-400">【天机】</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                股指短期反弹但中期仍承压，缺乏明确突破催化剂，<span className="text-white font-bold">建议观望等待更明确方向</span>。
              </p>
            </div>
            
            <div className="w-full rounded-2xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black text-slate-400">【锦囊】</span>
                 <span className="text-xs font-bold text-white">观望等待</span>
              </div>
            </div>
          </div>
          
          {/* Subtle background effects inside card */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  );
});
