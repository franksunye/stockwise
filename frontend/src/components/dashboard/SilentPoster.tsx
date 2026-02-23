'use client';

import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Download, Wind, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import { AIPrediction, TacticalData, VisualStory } from '@/lib/types';
import { COLORS } from './constants';

interface SilentPosterProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: AIPrediction;
  stockName: string;
  userPos?: 'holding' | 'empty' | 'none';
}

export const SilentPoster: React.FC<SilentPosterProps> = ({ isOpen, onClose, prediction, stockName, userPos = 'none' }) => {
  const posterRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const tacticalData = React.useMemo(() => {
    try {
      return JSON.parse(prediction.ai_reasoning) as TacticalData;
    } catch {
      return null;
    }
  }, [prediction.ai_reasoning]);

  const story = tacticalData?.visual_story;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const generateFallbackText = useCallback((activeStory: VisualStory) => {
    return `【ZISO AI · 投资黄历 · ${stockName}】\n🌊 意境：${activeStory.token}\n💡 核心：${activeStory.almanac}，气象 ${activeStory.aesthetic.mood}\n🔭 决策：${prediction.signal === 'Long' ? '看多' : prediction.signal === 'Short' ? '看空' : '观望'} (把握 ${(prediction.confidence * 100).toFixed(0)}%)\n——————————\n「AI做功课，带你看门道。」\n👉 知守智囊团 (ZISO AI)`;
  }, [stockName, prediction]);

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
      // Use pixelRatio >= 2 for Retina quality exports
      const dataUrl = await toPng(posterRef.current, { 
        cacheBust: true, 
        pixelRatio: 2,
        filter: filter as unknown as (domNode: HTMLElement) => boolean 
      });
      return dataUrl;
    } catch (err) {
      console.error('Failed to generate poster', err);
      return null;
    }
  }, []);

  const handleDownload = async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    const dataUrl = await generateImage();
    setIsCapturing(false);
    
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `ZISO_AI_${stockName}_${prediction.target_date.replace(/-/g, '')}.png`;
      link.href = dataUrl;
      link.click();
      showToast('图片已保存至本地，快去秀一把吧！');
    } else {
      showToast('图片生成失败，请稍后重试');
    }
  };

  const handleShare = async (activeStory: VisualStory) => {
    if (isCapturing) return;
    setIsCapturing(true);
    const dataUrl = await generateImage();
    setIsCapturing(false);

    if (!dataUrl) {
      showToast('分享准备失败，请稍后重试');
      return;
    }

    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `ZISO_AI_${stockName}.png`, { type: 'image/png' });
      const filesArray = [file];

      if (navigator.canShare && navigator.canShare({ files: filesArray })) {
        await navigator.share({
          files: filesArray,
          title: 'ZISO AI 投资黄历',
          text: generateFallbackText(activeStory),
        });
        // Success silently
      } else {
        throw new Error('Web Share API not fully supported');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.log('Falling back to clipboard + download...');
        try {
           await navigator.clipboard.writeText(generateFallbackText(activeStory));
           const link = document.createElement('a');
           link.download = `ZISO_AI_${stockName}_${prediction.target_date.replace(/-/g, '')}.png`;
           link.href = dataUrl;
           link.click();
           showToast('意境文案已复制，图片已下载！');
        } catch {
            showToast('分享暂时不可用，图片已下载');
        }
      }
    }
  };

  if (!isOpen) return null;

  // Fallback if visual story is missing (for older data)
  const defaultStory: VisualStory = {
    token: prediction?.signal === 'Long' ? '能量涌现' : prediction?.signal === 'Short' ? '暗影规避' : '静水深流',
    almanac: prediction?.signal === 'Long' ? '宜：顺势而为' : prediction?.signal === 'Short' ? '忌：盲目抄底' : '宜：静待时机',
    visual_state: 'stable',
    aesthetic: {
      hue: prediction?.signal === 'Long' ? 'indigo-emerald' : prediction?.signal === 'Short' ? 'rose-slate' : 'slate-gray',
      mood: prediction?.signal === 'Long' ? '微光' : prediction?.signal === 'Short' ? '阴云' : '晨雾',
      dynamic_clues: []
    },
    meta_version: 'v1-fallback'
  };

  const activeStory = story || defaultStory;
  const signalColor = prediction?.signal === 'Long' ? '#e2e8f0' : prediction?.signal === 'Short' ? '#cbd5e1' : '#94a3b8';

  // Almanac Insights Extraction
  const keyLevels = tacticalData?.key_levels;
  const resistanceStr = keyLevels?.strong_resistance || keyLevels?.resistance || '';
  const supportStr = keyLevels?.stop_loss_reference || keyLevels?.strong_support || keyLevels?.support || '';

  let intelligence = '';
  if (tacticalData?.summary) {
    intelligence = tacticalData.summary;
  } else if (tacticalData?.reasoning_trace && tacticalData.reasoning_trace.length > 0) {
    intelligence = tacticalData.reasoning_trace[0].data;
  }
  // Allow line-clamp to handle truncation, but have a higher max safety limit
  if (intelligence.length > 70) {
     intelligence = intelligence.substring(0, 69) + '...';
  }

  let topTactic = null;
  if (userPos === 'holding') {
    topTactic = tacticalData?.tactics?.holding_profit?.[0] || tacticalData?.tactics?.holding_loss?.[0];
  } else {
    topTactic = tacticalData?.tactics?.empty?.[0] || tacticalData?.tactics?.general?.[0];
  }
  if (!topTactic && tacticalData?.tactics) {
    topTactic = tacticalData.tactics.empty?.[0] || tacticalData.tactics.holding_profit?.[0] || tacticalData.tactics.general?.[0];
  }
  const tacticStr = topTactic?.action || '';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />

          {/* Toast Notification */}
          <AnimatePresence>
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="absolute top-10 left-1/2 -translate-x-1/2 z-[400] bg-white text-black px-6 py-3 rounded-full shadow-2xl font-bold text-sm tracking-wide text-center min-w-[200px]"
              >
                {toastMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Poster Container */}
          <motion.div
            ref={posterRef}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm aspect-[9/16] bg-[#0a0a0b] rounded-[40px] shadow-2xl overflow-hidden border border-white/10 flex flex-col"
          >
            {/* Design Elements: Gradient Background */}
            <div className={`absolute inset-0 opacity-20 pointer-events-none bg-gradient-to-b from-transparent via-${activeStory.aesthetic.hue.split('-')[0]}-500/10 to-${activeStory.aesthetic.hue.split('-')[1]}-500/20`} />
            
            {/* Top Bar */}
            <div className="relative z-10 p-6 flex justify-between items-start">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">ZISO AI · 投资黄历</span>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors capture-hidden"
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Content: The "Silent Math" Symbol & Token */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center mt-[-2rem]">
                
                {/* Centered Large Date (Almanac Style) */}
                <div className="mb-4 flex flex-col items-center justify-center relative">
                   {prediction.target_date.includes('-') ? (
                     <>
                       <div className="text-[8px] font-black text-slate-500/80 tracking-[0.4em] mb-1">{prediction.target_date.split('-')[0]}</div>
                       <div className="text-4xl font-black text-white tracking-tighter flex items-center leading-none" style={{ fontFamily: '"SF Pro Display", -apple-system, sans-serif' }}>
                         {prediction.target_date.split('-')[1]}
                         <span className="text-xl text-white/20 mx-1 font-light">/</span>
                         {prediction.target_date.split('-')[2]}
                       </div>
                     </>
                   ) : (
                     <div className="text-xl font-black text-white tracking-widest leading-none">{prediction.target_date}</div>
                   )}
                </div>

                {/* Visual State Icon */}
                <div className="mb-4 relative">
                   <div className="absolute inset-0 bg-white/10 blur-[40px] rounded-full animate-pulse capture-hidden" />
                   <div className="relative w-16 h-16 flex items-center justify-center">
                      {prediction?.signal === 'Long' ? (
                        <Wind className="w-8 h-8 text-slate-300 stroke-[1]" />
                      ) : prediction?.signal === 'Short' ? (
                        <AlertTriangle className="w-8 h-8 text-slate-400 stroke-[1]" />
                      ) : (
                        <Shield className="w-8 h-8 text-slate-500 stroke-[1]" />
                      )}
                   </div>
                </div>

                <motion.h1 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl font-black tracking-tighter text-white mb-1 italic"
                >
                  {activeStory.token}
                </motion.h1>
                
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm font-medium text-slate-400 mb-3"
                >
                  {activeStory.almanac}
                </motion.p>

                {/* Mood Tag */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-1">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">气象：{activeStory.aesthetic.mood}</span>
                </div>

                {/* Dynamic Clues */}
                {activeStory.aesthetic.dynamic_clues.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5 mt-0.5 max-w-[80%] mx-auto opacity-60 hidden">
                    {activeStory.aesthetic.dynamic_clues.map((clue, idx) => (
                      <span key={idx} className="text-[9px] font-bold text-indigo-400/60 transition-opacity">
                        #{clue}
                      </span>
                    ))}
                  </div>
                )}

                {/* --- NEW ALMANAC DATA INSIGHTS --- */}
                <div className="w-full max-w-[280px] mt-4 space-y-1.5 text-left relative z-10 capture-show flex flex-col justify-center">
                   {/* 阵眼结界 */}
                   {(resistanceStr || supportStr) && (
                     <div className="px-2.5 py-2 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md flex items-center justify-between shadow-sm">
                        <div className="flex gap-1.5 items-center tracking-widest leading-none">
                           <div className="flex gap-1 items-center">
                              <div className="w-0.5 h-2 bg-slate-500 rounded-sm" />
                              <span className="text-[8px] text-slate-500 font-bold uppercase">上方阻厄</span>
                           </div>
                           <span className="text-[8px] font-black text-slate-300 ml-1">{resistanceStr || '--'}</span>
                        </div>
                        <div className="w-px h-2 bg-white/10 mx-1" />
                        <div className="flex gap-1.5 items-center tracking-widest leading-none">
                           <div className="flex gap-1 items-center">
                              <div className="w-0.5 h-2 bg-slate-500 rounded-sm" />
                              <span className="text-[8px] text-slate-500 font-bold uppercase">绝对防守</span>
                           </div>
                           <span className="text-[8px] font-black text-slate-300 ml-1">{supportStr || '--'}</span>
                        </div>
                     </div>
                   )}

                   {/* 天机情报 */}
                   {intelligence && (
                     <div className="px-2.5 py-2 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md flex gap-1.5 items-start shadow-sm">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest shrink-0 mt-[3px]">【天机】</span>
                        <p className="text-[8px] text-slate-400 font-medium leading-[1.4] tracking-wider line-clamp-2">{intelligence}</p>
                     </div>
                   )}

                   {/* 冲煞锦囊 */}
                   {tacticStr && (
                     <div className="px-2.5 py-2 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md flex gap-1.5 items-start shadow-sm">
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest shrink-0 mt-[3px]">【锦囊】</span>
                        <p className="text-[8px] text-slate-400 font-bold leading-[1.4] tracking-wider line-clamp-2">{tacticStr}</p>
                     </div>
                   )}
                </div>
            </div>

            {/* Footer: Data Hook */}
            <div className="relative z-10 px-8 pb-4 pt-10 bg-gradient-to-t from-[#0a0a0b] via-black/80 to-transparent flex-shrink-0">
               <div className="flex justify-between items-end">
                  <div className="space-y-0.5">
                    <h2 className="text-xl font-black tracking-tighter text-white">{stockName}</h2>
                    <p className="text-xs font-bold text-slate-500 mono">{prediction?.symbol}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black italic tracking-tighter opacity-80" style={{ color: signalColor }}>
                      {prediction?.signal === 'Long' ? '看多' : prediction?.signal === 'Short' ? '看空' : '观望'}
                    </div>
                    <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">
                       把握 {(prediction?.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
               </div>
            </div>

            {/* Action Buttons */}
            <div className="relative z-10 px-6 pb-6 flex gap-3 capture-hidden">
               <button 
                  onClick={() => handleShare(activeStory)}
                  disabled={isCapturing}
                  className="flex-1 h-14 rounded-2xl bg-white text-black font-black flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
                >
                  {isCapturing ? <Loader2 className="animate-spin" size={18} /> : <Share2 size={18} />}
                  分享意境
               </button>
               <button 
                  onClick={handleDownload}
                  disabled={isCapturing}
                  className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
                >
                  {isCapturing ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
               </button>
            </div>

            {/* Micro-brand (visible in generated image) */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-center opacity-30 pointer-events-none">
               <span className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-500">Powered by ZISO AI · 知守智囊团</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
