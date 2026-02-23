'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Download, Zap, Wind, Shield, AlertTriangle } from 'lucide-react';
import { AIPrediction, TacticalData, VisualStory } from '@/lib/types';
import { COLORS } from './constants';

interface SilentPosterProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: AIPrediction;
  stockName: string;
}

export const SilentPoster: React.FC<SilentPosterProps> = ({ isOpen, onClose, prediction, stockName }) => {
  const tacticalData = React.useMemo(() => {
    try {
      return JSON.parse(prediction.ai_reasoning) as TacticalData;
    } catch {
      return null;
    }
  }, [prediction.ai_reasoning]);

  const story = tacticalData?.visual_story;

  if (!isOpen) return null;

  // Fallback if visual story is missing (for older data)
  const defaultStory: VisualStory = {
    token: prediction.signal === 'Long' ? '能量涌现' : prediction.signal === 'Short' ? '暗影规避' : '静水深流',
    almanac: prediction.signal === 'Long' ? '宜：顺势而为' : prediction.signal === 'Short' ? '忌：盲目抄底' : '宜：静待时机',
    visual_state: 'stable',
    aesthetic: {
      hue: prediction.signal === 'Long' ? 'indigo-emerald' : prediction.signal === 'Short' ? 'rose-slate' : 'slate-gray',
      mood: prediction.signal === 'Long' ? '微光' : prediction.signal === 'Short' ? '阴云' : '晨雾',
      dynamic_clues: []
    },
    meta_version: 'v1-fallback'
  };

  const activeStory = story || defaultStory;
  const signalColor = prediction.signal === 'Long' ? COLORS.up : prediction.signal === 'Short' ? COLORS.down : COLORS.hold;

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

          {/* Poster Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm aspect-[9/16] bg-[#0a0a0b] rounded-[40px] shadow-2xl overflow-hidden border border-white/10 flex flex-col"
          >
            {/* Design Elements: Gradient Background */}
            <div className={`absolute inset-0 opacity-20 pointer-events-none bg-gradient-to-b from-transparent via-${activeStory.aesthetic.hue.split('-')[0]}-500/10 to-${activeStory.aesthetic.hue.split('-')[1]}-500/20`} />
            
            {/* Top Bar */}
            <div className="relative z-10 p-8 flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">StockWise · AI Almanac</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-400">{prediction.target_date}</span>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Main Content: The "Silent Math" Symbol & Token */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center">
                {/* Visual State Icon */}
                <div className="mb-8 relative">
                   <div className="absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full animate-pulse" />
                   <div className="relative w-32 h-32 flex items-center justify-center">
                      {prediction.signal === 'Long' ? (
                        <Wind className="w-16 h-16 text-emerald-400/80 stroke-[1]" />
                      ) : prediction.signal === 'Short' ? (
                        <AlertTriangle className="w-16 h-16 text-rose-400/80 stroke-[1]" />
                      ) : (
                        <Shield className="w-16 h-16 text-slate-400/80 stroke-[1]" />
                      )}
                   </div>
                </div>

                <motion.h1 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-5xl font-black tracking-tighter text-white mb-2 italic"
                >
                  {activeStory.token}
                </motion.h1>
                
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg font-medium text-slate-400 mb-8"
                >
                  {activeStory.almanac}
                </motion.p>

                {/* Mood Tag */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-4">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">气象：{activeStory.aesthetic.mood}</span>
                </div>

                {/* Dynamic Clues */}
                {activeStory.aesthetic.dynamic_clues.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {activeStory.aesthetic.dynamic_clues.map((clue, idx) => (
                      <span key={idx} className="text-[10px] font-bold text-indigo-400/60 transition-opacity">
                        #{clue}
                      </span>
                    ))}
                  </div>
                )}
            </div>

            {/* Footer: Data Hook */}
            <div className="relative z-10 p-10 bg-gradient-to-t from-black/60 to-transparent">
               <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tighter text-white">{stockName}</h2>
                    <p className="text-sm font-bold text-slate-500 mono">{prediction.symbol}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black italic tracking-tighter" style={{ color: signalColor }}>
                      {prediction.signal === 'Long' ? 'LONG' : prediction.signal === 'Short' ? 'SHORT' : 'SIDE'}
                    </div>
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                       把握 {(prediction.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
               </div>
            </div>

            {/* Action Buttons */}
            <div className="relative z-10 px-8 pb-8 flex gap-3">
               <button className="flex-1 h-14 rounded-2xl bg-white text-black font-black flex items-center justify-center gap-2 active:scale-95 transition-transform">
                  <Share2 size={18} />
                  分享意境
               </button>
               <button className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
                  <Download size={18} />
               </button>
            </div>

            {/* Micro-brand */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-10">
               <span className="text-[8px] font-black uppercase tracking-[0.5em]">Powered by StockWise AICouncil</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
