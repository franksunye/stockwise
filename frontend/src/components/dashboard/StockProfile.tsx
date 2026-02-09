'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X as CloseIcon } from 'lucide-react';
import { HistoricalCard } from './HistoricalCard';
import { shouldEnableHighPerformance } from '@/lib/device-utils';
import { AIPrediction } from '@/lib/types';

interface StockProfileProps {
  isOpen: boolean;
  onClose: () => void;
  stock: {
    symbol: string;
    name: string;
    history?: AIPrediction[];
  } | null;
}

export function StockProfile({ isOpen, onClose, stock }: StockProfileProps) {
  const isHighPerformance = shouldEnableHighPerformance();

  if (!stock) return null;

  const validRecordCount = stock.history?.filter(h => h.validation_status !== 'Pending').length || 0;
  const correctCount = stock.history?.filter(h => h.validation_status === 'Correct').length || 0;
  const winRate = validRecordCount > 0 ? ((correctCount / validRecordCount) * 100).toFixed(0) : '0';
  const totalCount = stock.history?.length || 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-end bg-black/80 pointer-events-auto overflow-hidden">
          {/* Background Mask */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
          />

          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 150) onClose();
            }}
            transition={isHighPerformance 
              ? { type: 'tween', ease: 'easeOut', duration: 0.25 }
              : { type: 'spring', damping: 25, stiffness: 200 }
            }
            className="w-full max-w-md h-[85vh] flex flex-col bg-[#050508] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-10"
          >
            {/* Visual Handle */}
            <div className="w-full flex justify-center pt-3 pb-1 shrink-0">
               <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>

            {/* Fixed Navigation Header */}
            <header className="shrink-0 z-20 px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#050508]/80 backdrop-blur-xl">
              <div className="w-10">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black italic text-indigo-500 uppercase tracking-tighter">
                  {stock.symbol.slice(-2)}
                </div>
              </div>
              <div className="flex-1 text-center">
                <h2 className="text-xl font-black italic tracking-tighter text-white uppercase">
                  {stock.name}
                </h2>
              </div>
              <div className="w-10 flex justify-end">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 active:scale-90 transition-all text-slate-400">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-8 py-6 scrollbar-hide">
              <div className="space-y-8 pb-12">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 shrink-0">
                  <div className="glass-card p-5 text-center bg-white/[0.02] border-white/5 rounded-[24px]">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] block mb-2">历史胜率</span>
                    <p className="text-3xl font-black italic tracking-tighter text-emerald-500">{winRate}%</p>
                  </div>
                  <div className="glass-card p-5 text-center bg-white/[0.02] border-white/5 rounded-[24px]">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] block mb-2">累计分析</span>
                    <p className="text-3xl font-black italic tracking-tighter text-white">{totalCount}</p>
                  </div>
                </div>

                {/* History Timeline */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                       <div className="w-1 h-1 rounded-full bg-indigo-500" />
                       历史共识记录
                    </h3>
                    <span className="text-[9px] font-bold text-slate-700 uppercase tracking-widest italic">Timeline</span>
                  </div>

                  <div className="relative pl-6">
                    <div className="space-y-4">
                      {stock.history?.map((record, index) => (
                        <HistoricalCard 
                          key={index} 
                          data={record} 
                        />
                      ))}
                      {(!stock.history || stock.history.length === 0) && (
                        <div className="py-20 text-center">
                           <p className="text-xs font-bold text-slate-600 uppercase tracking-widest italic">No historical data available</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer disclaimer */}
                <div className="pt-8 border-t border-white/5 text-center">
                   <p className="text-[9px] text-slate-700 font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-slate-800" />
                      Historical Performance is not indicative of future results
                      <div className="w-1 h-1 rounded-full bg-slate-800" />
                   </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default StockProfile;
