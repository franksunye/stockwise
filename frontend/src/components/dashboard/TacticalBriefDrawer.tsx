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
  ChevronDown,
  Newspaper,
  Crosshair,
  Layers,
  Hash
} from 'lucide-react';
import { TacticalData } from '@/lib/types';
import { shouldEnableHighPerformance } from '@/lib/device-utils';
import { AICouncil } from './AICouncil';

interface TacticalBriefDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: TacticalData;
  userPos: 'holding' | 'empty' | 'none';
  tier: 'free' | 'pro';
  model?: string;
  symbol: string; // Add symbol
  targetDate: string; // Add targetDate
}

// 辅助函数：获取步骤对应的图标和标签配置
const getStepConfig = (step: string) => {
  const s = step.toLowerCase();
  
  if (s.includes('trend')) return { icon: <TrendingUp size={12} />, label: 'TREND' };
  if (s.includes('momentum')) return { icon: <Zap size={12} />, label: 'MOMENTUM' };
  if (s.includes('volume')) return { icon: <BarChart3 size={12} />, label: 'VOLUME' };
  if (s.includes('history')) return { icon: <RotateCcw size={12} />, label: 'HISTORY' };
  if (s.includes('decision')) return { icon: <Target size={12} />, label: 'DECISION' };
  
  // 新增映射
  if (s.includes('news') || s.includes('fundamental')) return { icon: <Newspaper size={12} />, label: 'INTELLIGENCE' };
  if (s.includes('position') || s.includes('level') || s.includes('price')) return { icon: <Crosshair size={12} />, label: 'PRICE ACTION' };
  if (s.includes('context')) return { icon: <Layers size={12} />, label: 'CONTEXT' };

  // 兜底
  return { icon: <Hash size={12} />, label: s.toUpperCase().replace(/_/g, ' ') };
};

export function TacticalBriefDrawer({ 
  isOpen, onClose, data, userPos, tier, model, symbol, targetDate
}: TacticalBriefDrawerProps) {
  const isHighPerformance = shouldEnableHighPerformance();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'brief' | 'council'>('brief');
  const isFree = tier === 'free';
  
  // 核心逻辑：获取当前场景建议 + 通用建议
  const currentTactics = data?.tactics?.[userPos === 'holding' ? 'holding' : 'empty'] || [];
  const generalTactics = data?.tactics?.general || [];
  
  return (
    <AnimatePresence>
      {isOpen && (
        <div className={`fixed inset-0 z-[200] flex items-end justify-center bg-black/60 pointer-events-auto overflow-hidden ${!isHighPerformance ? 'backdrop-blur-sm' : ''}`}>
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
            onDragEnd={(_, info) => {
              if (info.offset.y > 150) onClose();
            }}
            transition={isHighPerformance 
              ? { type: 'tween', ease: 'easeOut', duration: 0.25 }
              : { type: 'spring', damping: 25, stiffness: 200 }
            }
            className="w-full max-w-md bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-10"
          >
            {/* 顶部视觉拉手 */}
            <div className="w-full flex justify-center pt-3 pb-1">
               <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>

            <div className="p-6 pt-2 flex flex-col max-h-[85vh] overflow-y-auto scrollbar-hide">
              <header className="flex items-center justify-between mb-6 sticky top-0 z-20 py-3 -mx-2 px-2 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/5">
                 <div className="flex p-1 rounded-full bg-white/5 border border-white/10 relative">
                     <button 
                       onClick={() => setActiveTab('brief')}
                       className={`relative z-10 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors duration-200 ${activeTab === 'brief' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                     >
                       战术简报
                       {activeTab === 'brief' && (
                         <motion.div 
                           className="absolute inset-0 bg-indigo-500 rounded-full -z-10 shadow-lg shadow-indigo-500/20"
                           initial={{ opacity: 0, scale: 0.9 }}
                           animate={{ opacity: 1, scale: 1 }}
                           transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                         />
                       )}
                     </button>
                     <button 
                       onClick={() => setActiveTab('council')}
                       className={`relative z-10 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors duration-200 ${activeTab === 'council' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                     >
                       AI 智囊团
                       {activeTab === 'council' && (
                         <motion.div 
                           className="absolute inset-0 bg-indigo-500 rounded-full -z-10 shadow-lg shadow-indigo-500/20"
                           initial={{ opacity: 0, scale: 0.9 }}
                           animate={{ opacity: 1, scale: 1 }}
                           transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                         />
                       )}
                     </button>
                 </div>

                 <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 border border-white/10 text-slate-400 active:scale-95 transition-all hover:bg-white/10 hover:text-white">
                   <CloseIcon size={18} />
                 </button>
              </header>

              {activeTab === 'brief' ? (
                <div className="space-y-8 pb-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* 源类型标记 */}
                  {data.is_llm || (model && model !== 'rule-based') ? (
                      <div className="mb-6 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 flex items-center gap-3">
                          <div className="p-1.5 rounded-full bg-indigo-500/20">
                              <Zap size={14} className="text-amber-400" />
                          </div>
                          <div className="flex-1">
                              <p className="text-xs font-bold text-indigo-200">
                                 {model?.toLowerCase().includes('deepseek') ? 'DeepSeek AI' : 
                                  model?.toLowerCase().includes('gemini') ? 'Gemini Pro' : 
                                  model ? model : 'LLM 深度推理版'}
                              </p>
                              <p className="text-[10px] text-indigo-400/60 leading-tight mt-0.5">包含完整推理链与市场情绪感知</p>
                          </div>
                      </div>
                  ) : (
                      <div className="mb-6 px-4 py-3 rounded-xl bg-slate-800/40 border border-white/5 flex items-center gap-3">
                          <div className="p-1.5 rounded-full bg-slate-700">
                              <BarChart3 size={14} className="text-slate-400" />
                          </div>
                          <div className="flex-1">
                              <p className="text-xs font-bold text-slate-300">基础规则版</p>
                              <p className="text-[10px] text-slate-500 leading-tight mt-0.5">升级 Pro 解锁 LLM 深度推理与情报分析</p>
                          </div>
                      </div>
                  )}

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
                            <p className="text-xs text-slate-500 leading-relaxed"><span className="text-slate-400">条件:</span> {t.trigger}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 重点情报 (News Radar) */}
                  {data.news_analysis && (
                    <section className="relative">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 重点情报 (Last 48h)
                      </h3>
                      <div className={`p-4 rounded-2xl bg-gradient-to-br from-emerald-500/[0.05] to-transparent border border-emerald-500/10 space-y-3 ${isFree ? (isHighPerformance ? 'opacity-20 grayscale brightness-50 select-none pointer-events-none' : 'blur-md select-none pointer-events-none opacity-40') : ''}`}>
                        {Array.isArray(data.news_analysis) ? (
                          data.news_analysis.map((news, idx) => (
                            <div key={idx} className="flex gap-3 items-start">
                               <span className="text-slate-500 mt-0.5"><Newspaper size={12} /></span>
                               <p className="text-xs text-slate-300 leading-relaxed font-medium">{news}</p>
                            </div>
                          ))
                        ) : (
                          <div className="flex gap-3 items-start">
                             <span className="text-slate-500 mt-0.5"><Newspaper size={12} /></span>
                             <p className="text-xs text-slate-300 leading-relaxed font-medium">{data.news_analysis}</p>
                          </div>
                        )}
                      </div>
                      {isFree && (
                          <div className="absolute inset-x-0 bottom-4 flex justify-center z-10">
                              <span className={`px-3 py-1 rounded-full border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider ${!isHighPerformance ? 'bg-white/10 backdrop-blur-md' : 'bg-slate-800'}`}>升级 Pro 解锁情报</span>
                          </div>
                      )}
                    </section>
                  )}

                  {/* 分析过程 - 推理链 (带折叠交互) */}
                  {Array.isArray(data.reasoning_trace) && data.reasoning_trace.length > 0 && (
                    <section className="space-y-4 relative">
                      <button 
                        onClick={() => !isFree && setIsExpanded(!isExpanded)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 group active:scale-[0.98] transition-all ${isFree ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                      {isFree && (
                          <div className="absolute inset-0 flex items-center justify-center">
                              <div className={`px-4 py-2 rounded-2xl border border-indigo-500/30 text-[10px] font-black italic text-indigo-400 uppercase tracking-widest shadow-2xl ${!isHighPerformance ? 'bg-indigo-500/20 backdrop-blur-xl' : 'bg-[#0f0f18]'}`}>
                                  UPGRADE TO PRO TO UNLOCK REASONING
                              </div>
                          </div>
                      )}

                      <AnimatePresence>
                        {isExpanded && !isFree && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/[0.03] space-y-0 relative before:absolute before:left-[19px] before:top-6 before:bottom-6 before:w-[1px] before:bg-white/5">
                              {data.reasoning_trace.map((step, idx) => (
                                <div key={idx} className="relative pl-6 pb-6 last:pb-2 group">
                                  <div className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full border border-white/20 bg-[#0a0a0f] group-hover:border-indigo-500 transition-colors z-10" />
                                  
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                      {(() => {
                                        const config = getStepConfig(step.step);
                                        return (
                                          <div className="flex items-center gap-2">
                                            <span className="text-slate-500">{config.icon}</span>
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                              {config.label}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full italic tracking-tight">
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
              ) : (
                <AICouncil symbol={symbol} targetDate={targetDate} />
              )}
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
