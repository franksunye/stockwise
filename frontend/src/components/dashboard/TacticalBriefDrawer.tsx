'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X as CloseIcon, 
  Info, 
  TrendingUp, 
  Zap, 
  BarChart3, 
  RotateCcw, 
  Target,
  ChevronDown 
} from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 核心逻辑：获取当前场景建议 + 通用建议
  const currentTactics = data?.tactics?.[userPos === 'holding' ? 'holding' : 'empty'] || [];
  const generalTactics = data?.tactics?.general || [];
  
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

            <div className="p-8 pt-4 flex flex-col max-h-[85vh] overflow-y-auto scrollbar-hide">
              <header className="flex items-center justify-between mb-8">
                <div>
                  <span className="text-xs uppercase tracking-[0.3em] text-slate-500 font-bold">智能决策核心</span>
                  <h2 className="text-xl font-black italic tracking-tighter text-white">TACTICAL <span className="text-indigo-500">BRIEF</span></h2>
                </div>
                <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 border border-white/10 text-slate-400 active:scale-90 transition-all">
                  <CloseIcon size={20} />
                </button>
              </header>
              <div className="space-y-8 pb-8">
                <section>
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 当前场景建议 ({userPos === 'holding' ? '已持仓' : '未建仓'})
                  </h3>
                  <div className="space-y-3">
                    {currentTactics.map((t, idx) => (
                      <div key={idx} className="glass-card p-4 border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded italic ${t.priority === 'P1' ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'}`}>{t.priority}</span>
                          <span className="text-sm font-bold text-white">{t.action}</span>
                        </div>
                        <p className="text-xs text-slate-400 mb-1">触发: <span className="text-slate-200">{t.trigger}</span></p>
                        <p className="text-xs text-slate-500 font-medium italic">理由: {t.reason}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {generalTactics.length > 0 && (
                  <section>
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-500" /> 通用观察维度
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      {generalTactics.map((t, idx) => (
                        <div key={idx} className="p-4 rounded-2xl border border-white/5 bg-white/[0.01]">
                          <div className="flex items-center gap-2 mb-2">
                             <div className="w-1 h-1 rounded-full bg-slate-700" />
                             <span className="text-xs font-bold text-slate-300">{t.action}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed"><span className="text-slate-400">条件:</span> {t.trigger}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 新增：重点情报 (News Radar) */}
                {data.news_analysis && data.news_analysis.length > 0 && (
                  <section>
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 重点情报 (Last 48h)
                    </h3>
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/[0.05] to-transparent border border-emerald-500/10 space-y-3">
                      {data.news_analysis.map((news, idx) => (
                         <div key={idx} className="flex gap-3 items-start">
                            <span className="text-xs mt-0.5 opacity-60">📰</span>
                            <p className="text-xs text-slate-300 leading-relaxed font-medium">{news}</p>
                         </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 第三层：分析过程 - 推理链 (带折叠交互) */}
                {data.reasoning_trace && data.reasoning_trace.length > 0 && (
                  <section className="space-y-4">
                    <button 
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 group active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center gap-3">
                         <div className={`w-1.5 h-1.5 rounded-full bg-indigo-500 transition-all duration-500 ${isExpanded ? 'shadow-[0_0_12px_rgba(99,102,241,0.8)] scale-125' : 'opacity-40'}`} />
                         <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-200 transition-colors">解析 AI 推理逻辑</span>
                      </div>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        className="text-slate-600 group-hover:text-slate-400"
                      >
                         <ChevronDown size={16} />
                      </motion.div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-6 rounded-2xl bg-white/[0.01] border border-white/[0.03] space-y-0 relative before:absolute before:left-[35px] before:top-8 before:bottom-8 before:w-[1px] before:bg-white/5">
                            {data.reasoning_trace.map((step, idx) => (
                              <div key={idx} className="relative pl-9 pb-6 last:pb-2 group">
                                <div className="absolute left-[8px] top-1.5 w-1.5 h-1.5 rounded-full border border-white/20 bg-[#0a0a0f] group-hover:border-indigo-500 transition-colors z-10" />
                                
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-500">
                                        {step.step === 'trend' && <TrendingUp size={12} />}
                                        {step.step === 'momentum' && <Zap size={12} />}
                                        {step.step === 'volume' && <BarChart3 size={12} />}
                                        {step.step === 'history' && <RotateCcw size={12} />}
                                        {step.step === 'decision' && <Target size={12} />}
                                      </span>
                                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                        {step.step === 'trend' && 'Trend'}
                                        {step.step === 'momentum' && 'Momentum'}
                                        {step.step === 'volume' && 'Volume'}
                                        {step.step === 'history' && 'History'}
                                        {step.step === 'decision' && 'Decision'}
                                      </span>
                                    </div>
                                    <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full italic tracking-tight">
                                      {step.conclusion}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-200/60 font-medium leading-relaxed">
                                    {step.data}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                )}

                <section className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                  <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Info size={12} /> 核心冲突处理原则</h3>
                  <p className="text-sm text-indigo-300/70 leading-relaxed italic">{data.conflict_resolution || "遵循趋势优先原则。"}</p>
                </section>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

