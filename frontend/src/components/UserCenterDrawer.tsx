'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Crown, Zap, ShieldCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getWatchlist } from '@/lib/storage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function UserCenterDrawer({ isOpen, onClose }: Props) {
  const [watchlistCount, setWatchlistCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const list = getWatchlist();
      setWatchlistCount(list.length);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm pointer-events-auto overflow-hidden">
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
            className="w-full max-w-md bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto"
          >
            {/* 视觉拉手 */}
            <div className="w-full flex justify-center pt-3 pb-1">
               <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>

            <div className="p-8 pt-4 flex flex-col min-h-[50vh]">
              <header className="flex items-center justify-between mb-8">
                <div>
                   <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">MEMBER CENTER</span>
                   <h2 className="text-xl font-black italic tracking-tighter text-white">个人中心</h2>
                </div>
                <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </header>

              {/* 用户卡片 */}
              <div className="mb-8 p-1 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10">
                <div className="bg-[#0f0f16] rounded-[22px] p-6 flex items-center gap-5">
                   <div className="w-16 h-16 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center">
                     <User className="w-8 h-8 text-slate-400" />
                   </div>
                   <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                       <h3 className="text-lg font-black italic text-white">Guest User</h3>
                       <span className="px-2 py-0.5 rounded-md bg-slate-700/50 border border-white/5 text-[10px] font-bold text-slate-300 uppercase">Free Plan</span>
                     </div>
                     <p className="text-xs text-slate-500">ID: anon-8823...92a</p>
                   </div>
                </div>
              </div>

              {/* 资源用量 */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="glass-card p-5">
                   <div className="flex items-center gap-2 mb-3 text-slate-400">
                     <ShieldCheck size={16} />
                     <span className="text-xs font-bold uppercase">监控配额</span>
                   </div>
                   <div className="flex items-end gap-1.5">
                     <span className="text-2xl font-black text-white">{watchlistCount}</span>
                     <span className="text-sm font-bold text-slate-600 mb-1">/ 3</span>
                   </div>
                   <div className="w-full h-1 bg-white/10 rounded-full mt-3 overflow-hidden">
                     <div className="h-full bg-indigo-500" style={{ width: `${(watchlistCount/3)*100}%` }} />
                   </div>
                </div>

                <div className="glass-card p-5 opacity-60">
                   <div className="flex items-center gap-2 mb-3 text-slate-400">
                     <Zap size={16} />
                     <span className="text-xs font-bold uppercase">AI 分析</span>
                   </div>
                   <div className="flex items-end gap-1.5">
                     <span className="text-sm font-bold text-white">基础版</span>
                   </div>
                   <p className="text-[10px] text-slate-500 mt-2 leading-tight">升级 Pro 解锁深度推理链</p>
                </div>
              </div>

              {/* 升级引导 */}
              <button disabled className="mt-auto w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black italic shadow-[0_10px_30px_rgba(79,70,229,0.4)] flex items-center justify-center gap-2 opacity-80">
                 <Crown size={18} />
                 <span>升级 StockWise Pro (即将上线)</span>
              </button>
              
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
