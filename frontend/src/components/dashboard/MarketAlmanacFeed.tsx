import { memo, useRef, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import { Share2, Copy, Shield, Sparkles, ChevronDown, Waves, Thermometer, Target, Zap, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarketAlmanacData } from '@/lib/types';

interface MarketAlmanacFeedProps {
  index: number;
  data?: MarketAlmanacData | null;
  onVerticalScroll?: (top: number, index: number) => void;
}

export type MarketAlmanacHandle = {
  share: () => Promise<void>;
  copy: () => Promise<void>;
};

export const MarketAlmanacFeed = memo(forwardRef<MarketAlmanacHandle, MarketAlmanacFeedProps>(function MarketAlmanacFeed({ 
  index,
  data,
  onVerticalScroll
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (onVerticalScroll) {
      onVerticalScroll(e.currentTarget.scrollTop, index);
    }
  };

  // Safely extract properties
  const targetDate = data?.target_date || new Date().toISOString().split('T')[0];
  const dateFormatted = targetDate.replace(/-/g, ' / ');
  const weekday = new Date(targetDate + 'T00:00:00').toLocaleDateString('zh-CN', { weekday: 'long' });
  const dateWithWeekday = `${dateFormatted} · ${weekday}`;
  const moodTag = data?.mood_tag || '混沌未明';
  const actionStrategy = data?.action_strategy || '宜：观望 / 忌：盲动';
  const meteorology = data?.meteorology || '微雨';
  const insight = data?.ai_insight || '股指进入混沌期，缺乏明确突破点。板块轮动加速，建议保持观望。';
  
  const entropy = data?.market_entropy || { score: 50, label: '50% · 震荡', breadth: '震荡分化', volume_status: '量能平稳' };
  const sectors = data?.sector_currents || { main: [{name: '待更新', flow: ''}], inverse: [{name: '待更新', flow: ''}] };

  const generateMarketingText = useCallback(() => {
    let text = `ZISO AI 投资黄历 (${targetDate})\n\n`;
    text += `📜 卦象：${moodTag}\n`;
    text += `💡 策略：${actionStrategy}\n`;
    text += `☁️ 气象：${meteorology}\n\n`;
    text += `🔍 市场天机：${insight}\n\n`;
    text += `⚖️ 全场热度：${entropy.label} (${entropy.breadth})\n`;
    if (sectors.main && sectors.main.length > 0) {
      text += `🌊 主流方向：${sectors.main[0].name} (${sectors.main[0].flow})\n`;
    }
    text += `\n—— ZISO AI：替你做股市功课，带你看投资门道。\n`;
    text += `#ZISOAI #知守AI #AI股票分析 #投资黄历 #大盘分析`;
    return text;
  }, [targetDate, moodTag, actionStrategy, meteorology, insight, entropy, sectors]);

  const generateImage = useCallback(async () => {
    if (!posterRef.current) return null;
    
    // Filter out interactive elements from the generated image
    const filter = (node: HTMLElement) => {
      if (node.classList?.contains('capture-hidden')) {
        return false;
      }
      return true;
    };

    try {
      // Lazy load html-to-image to keep initial bundle lite
      const { toPng } = await import('html-to-image');
      
      // Use pixelRatio >= 2 for Retina quality exports
      const dataUrl = await toPng(posterRef.current, { 
        cacheBust: true, 
        pixelRatio: 2,
        backgroundColor: '#050508', // Match background color for smooth edges
        filter: filter as unknown as (domNode: HTMLElement) => boolean 
      });
      return dataUrl;
    } catch (err) {
      console.error('Failed to generate market almanac poster', err);
      return null;
    }
  }, []);

  useImperativeHandle(ref, () => ({
    copy: async () => {
      const text = generateMarketingText();
      try {
        await navigator.clipboard.writeText(text);
        showToast('黄历文案已复制！');
      } catch (err) {
        showToast('复制失败，请重试');
      }
    },
    share: async () => {
      if (isCapturing) return;
      setIsCapturing(true);
      // Wait for React to render the branding before capturing
      await new Promise(resolve => setTimeout(resolve, 100));
      const dataUrl = await generateImage();
      setIsCapturing(false);
      
      if (!dataUrl) {
        showToast('图片生成失败');
        return;
      }

      // Capability-First Sharing Strategy (Industrial Grade)
      try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const fileName = `Market_Almanac_${targetDate.replace(/-/g, '')}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        
        // If the browser supports native file sharing (Modern iOS & Android Chrome)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: '知守 AI · 投资黄历',
            text: generateMarketingText()
          });
          return;
        }
      } catch (err) {
        console.error('Priority Share failed, falling back to download', err);
      }

      // Default Fallback: Download (Reliable for Desktop and older mobile browsers)
      const link = document.createElement('a');
      link.download = `Market_Almanac_${targetDate.replace(/-/g, '')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('黄历海报已幻化完成！');
    }
  }), [generateMarketingText, targetDate, generateImage, isCapturing, showToast]);

  return (
    <div className="min-w-full h-full relative snap-center overflow-hidden">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-32 left-1/2 -translate-x-1/2 z-[400] bg-white text-black px-6 py-3 rounded-full shadow-2xl font-bold text-sm tracking-wide text-center min-w-[200px]"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-full absolute inset-0 overflow-y-scroll snap-y snap-mandatory scrollbar-hide flex flex-col items-center px-6 pt-32 pb-32"
      >
        <div ref={posterRef} className="w-full max-w-md space-y-6 mx-auto bg-[#050508] relative">
          {/* Header Branding (Visible in Share) */}
          {isCapturing && (
            <div className="pt-8 pb-4 text-center">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">ZISO AI · 投资黄历</span>
            </div>
          )}

          {/* 1. Macro Mood & Summary */}
          <section className="text-center space-y-2 py-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-2">
               <Sparkles className="w-3 h-3 text-indigo-400" />
               <span className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">{dateWithWeekday}</span>
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
                AI 市场天机
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
                    <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mt-0.5">板块洋流</h4>
                  </div>
                  <div className="space-y-1.5 mb-2">
                     <div className="flex justify-between items-center bg-white/5 px-2 py-1 rounded">
                        <span className="text-[10px] text-slate-400 font-bold">主向: {sectors.main[0].name}</span>
                        <span className="text-[10px] text-emerald-400 font-black italic">{sectors.main[0].flow}</span>
                     </div>
                     <div className="flex justify-between items-center opacity-40 px-2">
                        <span className="text-[9px] text-slate-500">逆向: {sectors.inverse?.[0]?.name || '--'}</span>
                        <span className="text-[9px] text-rose-400 font-bold italic">{sectors.inverse?.[0]?.flow || '--'}</span>
                     </div>
                  </div>
               </div>
               
               <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                     <Thermometer className="w-2.5 h-2.5 text-amber-500" />
                     <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">全场热度</span>
                  </div>
                  <span className="text-[10px] font-black text-white italic">{entropy.label}</span>
               </div>
            </div>

            {/* Right Box: Actions & Stats */}
            <div className="glass-card p-4 flex flex-col justify-between min-h-[140px]">
               <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Target className="w-3 h-3 text-indigo-400" />
                    <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mt-0.5">行动指南</h4>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                       <div className="w-4 h-4 rounded bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                          <span className="text-[8px] font-black text-indigo-400">宜</span>
                       </div>
                       <span className="text-[10px] font-black text-slate-200">{actionStrategy.split(' / ')[0] || '观望'}</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-50">
                       <div className="w-4 h-4 rounded bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                          <span className="text-[8px] font-black text-rose-400">忌</span>
                       </div>
                       <span className="text-[10px] font-bold text-slate-400">{actionStrategy.split(' / ')[1] || '盲动'}</span>
                    </div>
                  </div>
               </div>

               <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                     <Zap className="w-2.5 h-2.5 text-indigo-400" />
                     <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">全场量能状态</span>
                  </div>
               </div>
               <div className="text-[10px] font-black text-white italic mt-1 pl-1">
                  {entropy.volume_status}
               </div>
            </div>
          </section>

          {/* Loading Overlay (if captured) */}
          {isCapturing && (
            <div className="absolute inset-0 z-[500] bg-[#050508]/90 flex items-center justify-center capture-hidden border border-white/10 rounded-[32px]">
               <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-sm font-black text-white italic tracking-widest">正在幻化意境图...</p>
               </div>
            </div>
          )}

          {/* User Tip - Bottom */}
          <section className="text-center pt-8 capture-hidden">
             <p className="text-[10px] font-black italic text-slate-700 uppercase tracking-widest flex items-center justify-center gap-2">
                右滑进入个股洞察
                <ChevronDown className="w-3 h-3 -rotate-90 opacity-30" />
             </p>
          </section>
        </div>
      </div>
    </div>
  );
}));
