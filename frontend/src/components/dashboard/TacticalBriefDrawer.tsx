'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X as CloseIcon, Info } from 'lucide-react';
import { TacticalData } from '@/lib/types';

interface TacticalBriefDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: TacticalData;
  userPos: 'holding' | 'empty' | 'none';
}

export function TacticalBriefDrawer({ 
  isOpen, onClose, data, userPos 
}: TacticalBriefDrawerProps) {
  const tactics = data?.tactics?.[userPos === 'none' ? 'empty' : userPos] || [];
  
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm pointer-events-auto overflow-hidden">
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
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-md bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-10"
          >
            {/* 顶部视觉拉手 */}
            <div className="w-full flex justify-center pt-3 pb-1">
               <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>

            <div className="p-8 pt-4 flex flex-col">
              <header className="flex items-center justify-between mb-8">
                <div>
                  <span className="text-xs uppercase tracking-[0.3em] text-slate-500 font-bold">智能决策核心</span>
                  <h2 className="text-xl font-black italic tracking-tighter text-white">TACTICAL <span className="text-indigo-500">BRIEF</span></h2>
                </div>
                <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 border border-white/10 text-slate-400 active:scale-90 transition-all">
                  <CloseIcon size={20} />
                </button>
              </header>
              <div className="space-y-8">
                <section>
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 当前场景建议 ({userPos === 'holding' ? '已持仓' : '未建仓'})
                  </h3>
                  <div className="space-y-3">
                    {tactics.map((t, idx) => (
                      <div key={idx} className="glass-card p-4 border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-xs font-black px-1.5 py-0.5 rounded italic ${t.p === 'P1' ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'}`}>{t.p}</span>
                          <span className="text-sm font-bold text-white">{t.a}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-1">触发: <span className="text-slate-200">{t.c}</span></p>
                        <p className="text-xs text-slate-500 font-medium italic">理由: {t.r}</p>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 mb-8">
                  <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Info size={12} /> 核心冲突处理原则</h3>
                  <p className="text-sm text-indigo-300/70 leading-relaxed italic">{data.conflict || "遵循趋势优先原则。"}</p>
                </section>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
