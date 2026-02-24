import { memo, useRef, useImperativeHandle, forwardRef, useCallback, useState, useMemo, useEffect } from 'react';
import { Shield, Sparkles, ChevronDown, Waves, Thermometer, Target, Zap, Loader2, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MarketAlmanacData } from '@/lib/types';

interface MarketAlmanacFeedProps {
  index: number;
  data?: MarketAlmanacData | MarketAlmanacData[] | null;
  onVerticalScroll?: (top: number, index: number) => void;
  scrollRequest?: number;
}

export type MarketAlmanacHandle = {
  share: () => Promise<void>;
  copy: () => Promise<void>;
};

// --- 1. Infrastructure & Utilities ---

interface MarketAlmanacFeedProps {
  index: number;
  data?: MarketAlmanacData | MarketAlmanacData[] | null;
  onVerticalScroll?: (top: number, index: number) => void;
  scrollRequest?: number;
}

export type MarketAlmanacHandle = {
  share: () => Promise<void>;
  copy: () => Promise<void>;
};

/**
 * Robustly parses action strategy string into distinct Yi/Ji segments.
 * Supports multiple delimiters used across different backend versions.
 */
function parseActionStrategy(strategy: string) {
  const raw = strategy || '宜：观望 · 忌：盲动';
  let yi = '观望';
  let ji = '盲动';

  const delimiters = [
    { key: ' · 忌：', split: ' · 忌：' },
    { key: ' / 忌：', split: ' / 忌：' },
    { key: ' · ', split: ' · ' },
    { key: ' / ', split: ' / ' }
  ];

  const matched = delimiters.find(d => raw.includes(d.key));
  
  if (matched) {
    const parts = raw.split(matched.split);
    yi = parts[0].replace(/^宜[：:]\s*/, '').trim();
    ji = (parts[1] || '').replace(/^忌[：:]\s*/, '').trim();
  } else {
    yi = raw.replace(/^宜[：:]\s*/, '').trim();
  }

  return { yi: yi || '观望', ji: ji || '盲动' };
}

// --- 2. Sub-components ---

interface AlmanacCardProps {
  data: MarketAlmanacData;
  idx: number;
  isCapturing: boolean;
  isCurrent: boolean;
  posterRef: (el: HTMLDivElement | null) => void;
}

const AlmanacCard = memo(function AlmanacCard({ 
  data, idx, isCapturing, isCurrent, posterRef 
}: AlmanacCardProps) {
  const { yi, ji } = useMemo(() => parseActionStrategy(data.action_strategy), [data.action_strategy]);
  
  const targetDate = data.target_date || new Date().toISOString().split('T')[0];
  const dateFormatted = targetDate.replace(/-/g, ' / ');
  const weekday = new Date(targetDate + 'T00:00:00').toLocaleDateString('zh-CN', { weekday: 'long' });
  const dateStr = `${dateFormatted} · ${weekday}`;
  
  const sectors = useMemo(() => 
    (typeof data.sector_currents === 'object' && data.sector_currents) 
      ? data.sector_currents 
      : { main: [], inverse: [] }, 
    [data.sector_currents]
  );

  const entropy = useMemo(() => 
    (typeof data.market_entropy === 'object' && data.market_entropy)
      ? data.market_entropy
      : { volume_status: '量能平稳' },
    [data.market_entropy]
  );

  return (
    <div className="w-full h-full shrink-0 flex flex-col items-center justify-center px-6 snap-center snap-always">
      <div ref={posterRef} className="w-full max-w-md space-y-6 mx-auto relative">
        {isCapturing && isCurrent && (
          <div className="pt-8 pb-4 text-center">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">ZISO AI · 投资黄历</span>
          </div>
        )}

        <section className="text-center space-y-2 py-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-2">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">{dateStr}</span>
          </div>
          <h2 className="text-5xl font-black italic tracking-tighter text-white drop-shadow-lg">{data.mood_tag || '混沌未明'}</h2>
          <div className="flex flex-col items-center gap-1">
            <p className="text-lg font-bold tracking-[0.2em] text-indigo-100/90">{yi}</p>
            <div className="flex items-center gap-1.5 opacity-60">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">气象：{data.meteorology || '微雨'}</span>
            </div>
          </div>
        </section>

        <section className="glass-card p-5 relative overflow-hidden">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-md bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
              <Shield className="w-2.5 h-2.5 text-indigo-400 fill-indigo-400/20" />
            </div>
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AI 市场天机</h3>
          </div>
          <p className="text-sm leading-relaxed text-slate-300 font-medium italic pl-1 border-l-2 border-indigo-500/20">
            {data.ai_insight || '分析正在生成中...'}
          </p>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div className="glass-card p-4 flex flex-col justify-between overflow-hidden min-h-[140px]">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Waves className="w-3 h-3 text-indigo-400" />
                <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mt-0.5">板块洋流</h4>
              </div>
              <div className="space-y-1.5">
                {sectors.main?.slice(0, 3).map((s: any, si: number) => (
                  <div key={`main-${si}`} className="flex justify-between items-center bg-white/5 px-2 py-1.5 rounded gap-1">
                    <span className="text-[10px] text-slate-400 font-bold truncate pr-1">{si === 0 ? '主向: ' : ''}{s.name}</span>
                    <span className="text-[10px] text-emerald-400 font-black italic whitespace-nowrap shrink-0">{s.flow}</span>
                  </div>
                ))}
                {sectors.inverse?.slice(0, 2).map((s: any, si: number) => (
                  <div key={`inv-${si}`} className="flex justify-between items-center opacity-40 px-2 py-0.5 mt-1 gap-1">
                    <span className="text-[9px] text-slate-500 truncate pr-1">逆向: {s.name}</span>
                    <span className="text-[9px] text-rose-400 font-bold italic whitespace-nowrap shrink-0">{s.flow}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-card p-4 flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="w-3 h-3 text-indigo-400" />
                <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none mt-0.5">行动指南</h4>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 shrink-0 mt-0.5">
                    <span className="text-[8px] font-black text-indigo-400">宜</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-100 leading-[1.4] text-left">{yi}</span>
                </div>
                <div className="flex items-start gap-2.5 opacity-50">
                  <div className="w-4 h-4 rounded bg-rose-500/20 flex items-center justify-center border border-rose-500/30 shrink-0 mt-0.5">
                    <span className="text-[8px] font-black text-rose-400">忌</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 leading-[1.4] text-left">{ji}</span>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-white/5 block">
              <div className="flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-indigo-400" />
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">全场量能状态</span>
              </div>
              <div className="text-[10px] font-black text-white italic mt-1 pl-1">
                {entropy.volume_status}
              </div>
            </div>
          </div>
        </section>

        {isCapturing && idx === 0 && (
          <div className="absolute inset-0 z-[500] bg-[#050508]/90 flex items-center justify-center capture-hidden border border-white/10 rounded-[32px]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm font-black text-white italic tracking-widest">正在幻化意境图...</p>
            </div>
          </div>
        )}

        {idx === 0 && (
          <section className="text-center pt-8 pb-4 capture-hidden">
            <p className="text-[10px] font-black italic text-slate-700 uppercase tracking-widest flex items-center justify-center gap-2">
              上滑查看历史黄历
              <ChevronDown className="w-3 h-3 opacity-30" />
            </p>
          </section>
        )}
      </div>
    </div>
  );
});

// --- 3. Main Container Component ---

export const MarketAlmanacFeed = memo(forwardRef<MarketAlmanacHandle, MarketAlmanacFeedProps>(function MarketAlmanacFeed({ 
  index,
  data,
  onVerticalScroll,
  scrollRequest
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const posterRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentVerticalIndex, setCurrentVerticalIndex] = useState(0);

  // Handle back to top requests ONLY when counter increases (ignoring mount and blur)
  const prevScrollRequestRef = useRef(scrollRequest || 0);

  useEffect(() => {
    if (containerRef.current && scrollRequest !== undefined && scrollRequest > prevScrollRequestRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      prevScrollRequestRef.current = scrollRequest;
    }
  }, [scrollRequest]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Performance Fix: Avoid synchronous layout thrashing (clientHeight) on every scroll frame
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let ticking = false;
    const handlePassiveScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!container) return;
          const scrollTop = container.scrollTop;
          
          // Use innerHeight instead of querying clientHeight to prevent iOS layout deadlocks during animations
          const height = window.innerHeight;
          const newIndex = Math.round(scrollTop / height);
          
          if (newIndex !== currentVerticalIndex) {
            setCurrentVerticalIndex(newIndex);
          }
          
          if (onVerticalScroll) {
            onVerticalScroll(scrollTop, index);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handlePassiveScroll, { passive: true });
    return () => container.removeEventListener('scroll', handlePassiveScroll);
  }, [currentVerticalIndex, index, onVerticalScroll]);

  const almanacsList = Array.isArray(data) ? data : (data ? [data] : []);
  const currentAlmanac = almanacsList[currentVerticalIndex] || almanacsList[0] || {} as MarketAlmanacData;

  // Safely extract properties for the current viewed almanac (used for share/copy logic)
  const targetDate = currentAlmanac?.target_date || new Date().toISOString().split('T')[0];
  const moodTag = currentAlmanac?.mood_tag || '混沌未明';
  const actionStrategy = currentAlmanac?.action_strategy || '宜：观望 / 忌：盲动';
  const meteorology = currentAlmanac?.meteorology || '微雨';
  const insight = currentAlmanac?.ai_insight || '股指进入混沌期，缺乏明确突破点。板块轮动加速，建议保持观望。';
  
  const entropy = useMemo(() => typeof currentAlmanac?.market_entropy === 'object' && currentAlmanac?.market_entropy ? currentAlmanac?.market_entropy : { score: 50, label: '50% · 震荡', breadth: '震荡分化', volume_status: '量能平稳' }, [currentAlmanac?.market_entropy]);
  const sectors = useMemo(() => typeof currentAlmanac?.sector_currents === 'object' && currentAlmanac?.sector_currents ? currentAlmanac?.sector_currents : { main: [{name: '待更新', flow: ''}], inverse: [{name: '待更新', flow: ''}] }, [currentAlmanac?.sector_currents]);

  const { yiTextMarketing, jiTextMarketing } = useMemo(() => 
    parseActionStrategy(currentAlmanac?.action_strategy || ''), 
    [currentAlmanac?.action_strategy]
  );

  const generateMarketingText = useCallback(() => {
    let text = `ZISO AI 投资黄历 (${targetDate})\n\n`;
    text += `📜 卦象：${moodTag}\n`;
    text += `宜：${yiTextMarketing}\n`;
    text += `忌：${jiTextMarketing}\n`;
    text += `☁️ 气象：${meteorology}\n\n`;
    text += `🔍 市场天机：${insight}\n\n`;
    
    if (sectors.main && sectors.main.length > 0) {
      const mainStr = sectors.main.slice(0, 3).map(s => `${s.name}(${s.flow})`).join(', ');
      text += `🌊 主流方向：${mainStr}\n`;
    }
    
    if (sectors.inverse && sectors.inverse.length > 0) {
      const invStr = sectors.inverse.slice(0, 2).map(s => `${s.name}(${s.flow})`).join(', ');
      text += `❄️ 逆向压力：${invStr}\n`;
    }
    
    text += `\n—— ZISO AI：替你做股市功课，带你看投资门道。\n`;
    text += `#ZISOAI #知守AI #AI股票分析 #投资黄历 #大盘分析`;
    return text;
  }, [targetDate, moodTag, yiTextMarketing, jiTextMarketing, meteorology, insight, sectors]);

  const generateImage = useCallback(async () => {
    const activePoster = posterRefs.current[currentVerticalIndex];
    if (!activePoster) return null;
    
    // Filter out interactive elements from the generated image
    const filter = (node: HTMLElement) => {
      if (node.classList?.contains('capture-hidden')) {
        return false;
      }
      return true;
    };

    const originalStyle = activePoster.style.transform;
    try {
      // Lazy load html-to-image to keep initial bundle lite
      const { toPng } = await import('html-to-image');
      
      // Use pixelRatio >= 2 for Retina quality exports
      const dataUrl = await toPng(activePoster, { 
        cacheBust: true, 
        pixelRatio: 2,
        backgroundColor: '#050508', // Match background color for smooth edges
        filter: filter
      });
      return dataUrl;
    } catch {
      // Ensure transformation is restored even on error
      if (activePoster) activePoster.style.transform = originalStyle;
      console.error('Failed to generate poster');
      return null;
    }
  }, [currentVerticalIndex]);

  useImperativeHandle(ref, () => ({
    copy: async () => {
      const text = generateMarketingText();
      try {
        await navigator.clipboard.writeText(text);
        showToast('黄历文案已复制！');
      } catch {
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
        className="w-full h-full absolute inset-0 overflow-y-scroll snap-y snap-mandatory scrollbar-hide flex flex-col items-center"
      >
        {almanacsList.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center px-6 animate-pulse">
             <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center space-y-4">
                   <div className="w-48 h-4 bg-white/5 rounded-full" />
                   <div className="w-64 h-16 bg-white/10 rounded-2xl" />
                   <div className="w-32 h-6 bg-white/5 rounded-full" />
                </div>
                <div className="w-full h-40 bg-white/5 rounded-[32px]" />
                <div className="grid grid-cols-2 gap-4">
                   <div className="h-32 bg-white/5 rounded-[24px]" />
                   <div className="h-32 bg-white/5 rounded-[24px]" />
                </div>
             </div>
          </div>
        ) : (
          almanacsList.map((item, idx) => (
            <AlmanacCard 
              key={`${item.target_date}-${idx}`}
              data={item}
              idx={idx}
              isCapturing={isCapturing}
              isCurrent={idx === currentVerticalIndex}
              posterRef={el => { posterRefs.current[idx] = el; }}
            />
          ))
        )}
      </div>
    </div>
  );
}));
