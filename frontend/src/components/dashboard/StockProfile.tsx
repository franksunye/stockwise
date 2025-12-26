'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X as CloseIcon, ShieldCheck, TrendingDown } from 'lucide-react';
import { StockData } from '@/lib/types';

interface StockProfileProps {
  stock: StockData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function StockProfile({ stock, isOpen, onClose }: StockProfileProps) {
  if (!stock) return null; // 渲染守护

  const winCount = stock.history?.filter(h => h.validation_status === 'Correct').length || 0;
  const totalCount = stock.history?.filter(h => h.validation_status !== 'Pending').length || 0;
  const winRate = totalCount > 0 ? Math.round((winCount / totalCount) * 100) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
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
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-[200] bg-[#050508] flex flex-col pointer-events-auto shadow-[0_-20px_60px_rgba(0,0,0,0.8)]"
        >
          {/* 顶部视觉拉手 */}
          <div className="w-full flex justify-center pt-3 pb-1">
             <div className="w-12 h-1 rounded-full bg-white/10" />
          </div>

          <div className="h-full w-full p-8 pt-6 flex flex-col overflow-y-auto">
            <header className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-[22px] bg-white/5 border border-white/10 flex items-center justify-center text-xl font-black italic text-indigo-500">
                  {stock.symbol.slice(-2)}
                </div>
                <div>
                  <h2 className="text-2xl font-black italic tracking-tighter text-white">{stock.name}</h2>
                  <p className="text-[10px] text-slate-500 font-bold tracking-[0.2em] uppercase">{stock.symbol}.HK · 统计档案</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
                <CloseIcon className="w-5 h-5 text-slate-400" />
              </button>
            </header>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="glass-card p-4 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">历史胜率</span>
                <p className="text-3xl font-black mono text-emerald-500">{winRate}%</p>
              </div>
              <div className="glass-card p-4 text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">累计验证</span>
                <p className="text-3xl font-black mono text-white">{totalCount}</p>
              </div>
            </div>

            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 px-2">复盘矩阵 (最近 30 天)</h3>
            <div className="grid grid-cols-4 gap-2">
              {stock.history.map((h, i) => (
                <div 
                  key={i} 
                  className={`aspect-square rounded-xl border border-white/5 flex items-center justify-center text-[10px] font-black ${
                    h.validation_status === 'Correct' ? 'bg-emerald-500/10 text-emerald-500/50' : 
                    h.validation_status === 'Incorrect' ? 'bg-rose-500/10 text-rose-500/50' : 'bg-white/5 text-slate-700'
                  }`}
                >
                  {h.date.split('-').slice(1).join('/')}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
