'use client';

import { useState, useRef } from 'react';
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

import { formatModelName } from '@/lib/model-names';

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
  
  const rawGeneral = data?.tactics?.general;
  const generalTactics = Array.isArray(rawGeneral) ? rawGeneral : (rawGeneral ? [rawGeneral] : []);

  const [viewState, setViewState] = useState<'holding_profit'|'holding_loss'|'empty'>('holding_profit');
  const scrollRef = useRef<HTMLDivElement>(null);


  
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
            className="w-full max-w-md bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-10 h-[85vh] flex flex-col"
          >
            {/* 顶部视觉拉手 */}
            <div className="w-full flex justify-center pt-3 pb-1 shrink-0 bg-[#0a0a0f]">
               <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>

            {/* 固定 Header，不再随内容滚动，彻底消除缝隙穿透 */}
            <header className="relative flex items-center justify-center py-2 px-6 bg-[#0a0a0f] border-b border-white/5 shadow-lg shadow-black/20 shrink-0 z-20">
                 {/* Center: Tabs */}
                 <div className="flex p-1 rounded-full bg-white/5 border border-white/10 relative z-10">
                     <button 
                       onClick={() => setActiveTab('brief')}
                       className={`relative z-10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors duration-200 ${activeTab === 'brief' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
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
                       className={`relative z-10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors duration-200 ${activeTab === 'council' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
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

                 {/* Right: Close Button */}
                 <button 
                   onClick={onClose} 
                   className="absolute right-4 p-2.5 rounded-full bg-white/5 border border-white/10 text-slate-400 active:scale-95 transition-all hover:bg-white/10 hover:text-white z-20"
                 >
                   <CloseIcon size={18} />
                 </button>
            </header>

            <div className="p-6 pt-4 flex-1 overflow-y-auto scrollbar-hide">

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
                                 {model ? formatModelName(model) : 'LLM 深度推理版'}
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
                     {/* Header */}
                     <div className="mb-4">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 场景建议
                        </h3>
                     </div>

                     {/* Horizontal Scroll Container for Scenarios */}
                    <div 
                        ref={scrollRef}
                        onScroll={(e) => {
                           const target = e.currentTarget;
                           const scrollPos = target.scrollLeft;
                           const cardWidth = target.offsetWidth;
                           
                           if (scrollPos < cardWidth * 0.5) {
                               if (viewState !== 'holding_profit') setViewState('holding_profit');
                           } else if (scrollPos < cardWidth * 1.5) {
                               if (viewState !== 'holding_loss') setViewState('holding_loss');
                           } else {
                               if (viewState !== 'empty') setViewState('empty');
                           }
                        }}
                        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-6 px-6 pb-4"
                    >
                       
                       {/* CARD 1: HOLDING PROFIT */}
                       <div className="min-w-full snap-center space-y-3">
                          {(() => {
                            const profit = data?.tactics?.holding_profit || [];
                            const legacy = data?.tactics?.holding || [];
                            const allProfit = [...profit, ...legacy];
                            
                            if (allProfit.length === 0) return (
                                <div className="p-10 text-center opacity-30 italic text-[10px] text-slate-500 border border-white/5 rounded-2xl">
                                   该标的目前暂无盈利持仓特定对策
                                </div>
                            );

                            return allProfit.map((t, idx) => (
                                <div key={idx} className="glass-card p-4 relative overflow-hidden border-indigo-500/20 bg-indigo-500/5">
                                   <span className="absolute top-2 right-2 text-[9px] font-black opacity-30 uppercase tracking-widest pointer-events-none text-indigo-300">已持仓 (有盈)</span>
                                   <div className="absolute right-0 top-6 p-2 opacity-5 pointer-events-none">
                                      <TrendingUp size={40} className="text-emerald-400" />
                                   </div>
                                   <div className="flex items-center gap-2 mb-2 relative z-10">
                                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded italic ${t.priority === 'P1' ? 'bg-indigo-500' : 'bg-slate-700'} text-white`}>{t.priority}</span>
                                      <span className="text-sm font-bold text-white">{t.action}</span>
                                   </div>
                                   <div className="space-y-1.5 relative z-10">
                                       <p className="text-xs text-slate-400">触发: <span className="text-slate-200">{t.trigger}</span></p>
                                       {(t.target_price || t.stop_advance_price) && (
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 py-1 px-2 bg-white/5 rounded-lg w-fit">
                                                {t.target_price && <p className="text-[10px] text-emerald-400 font-bold uppercase">目标: {t.target_price}</p>}
                                                {t.stop_advance_price && <p className="text-[10px] text-amber-400 font-bold uppercase">移动止盈: {t.stop_advance_price}</p>}
                                            </div>
                                       )}
                                       <p className="text-xs text-slate-500 font-medium italic border-t border-white/5 pt-1.5 mt-1.5">理由: {t.reason}</p>
                                   </div>
                                </div>
                            ));
                          })()}
                       </div>

                       {/* CARD 2: HOLDING LOSS */}
                       <div className="min-w-full snap-center space-y-3">
                          {(() => {
                            const loss = data?.tactics?.holding_loss || [];
                            
                            if (loss.length === 0) return (
                                <div className="p-10 text-center opacity-30 italic text-[10px] text-slate-500 border border-white/5 rounded-2xl">
                                   该标的目前暂无亏损持仓特定对策
                                </div>
                            );

                            return loss.map((t, idx) => (
                                <div key={idx} className="glass-card p-4 relative overflow-hidden border-rose-500/20 bg-rose-500/5">
                                   <span className="absolute top-2 right-2 text-[9px] font-black opacity-30 uppercase tracking-widest pointer-events-none text-rose-300">已持仓 (亏损)</span>
                                   <div className="absolute right-0 top-6 p-2 opacity-5 pointer-events-none">
                                      <Target size={40} className="text-rose-400" />
                                   </div>
                                   <div className="flex items-center gap-2 mb-2 relative z-10">
                                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded italic ${t.priority === 'P1' ? 'bg-rose-500' : 'bg-slate-700'} text-white`}>{t.priority}</span>
                                      <span className="text-sm font-bold text-white">{t.action}</span>
                                   </div>
                                   <div className="space-y-1.5 relative z-10">
                                       <p className="text-xs text-slate-400">触发: <span className="text-slate-200">{t.trigger}</span></p>
                                       {t.stop_loss_price && (
                                            <div className="py-1 px-2 bg-rose-500/10 rounded-lg w-fit">
                                                <p className="text-[10px] text-rose-400 font-bold uppercase">止损价: {t.stop_loss_price}</p>
                                            </div>
                                       )}
                                       <p className="text-xs text-slate-500 font-medium italic border-t border-rose-500/10 pt-1.5 mt-1.5">理由: {t.reason}</p>
                                   </div>
                                </div>
                            ));
                          })()}
                       </div>

                       {/* CARD 3: EMPTY SCENARIO */}
                       <div className="min-w-full snap-center space-y-3">
                           {(data?.tactics?.empty || []).length === 0 ? (
                               <div className="p-10 text-center opacity-30 italic text-[10px] text-slate-500 border border-white/5 rounded-2xl">
                                  该标的目前暂无空仓观察建议
                               </div>
                           ) : (data?.tactics?.empty || []).map((t, idx) => (
                              <div key={idx} className="glass-card p-4 border-white/5 bg-white/[0.02] relative">
                                 <span className="absolute top-2 right-2 text-[9px] font-black text-slate-500/30 uppercase tracking-widest pointer-events-none">未建仓视角</span>
                                 <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded italic ${t.priority === 'P1' ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'}`}>{t.priority}</span>
                                    <span className="text-sm font-bold text-white">{t.action}</span>
                                 </div>
                                 <div className="space-y-1.5">
                                     <p className="text-xs text-slate-400">触发: <span className="text-slate-200">{t.trigger}</span></p>
                                     {t.buy_zone_price && (
                                         <div className="py-1 px-2 bg-indigo-500/10 rounded-lg w-fit">
                                             <p className="text-[10px] text-indigo-400 font-bold uppercase italic">理想买入区: {t.buy_zone_price}</p>
                                         </div>
                                     )}
                                     <p className="text-xs text-slate-500 font-medium italic border-t border-white/10 pt-1.5 mt-1.5">理由: {t.reason}</p>
                                 </div>
                              </div>
                           ))}
                       </div>
                    </div>
                    
                    {/* Pagination Dots */}
                    <div className="flex justify-center gap-2 mt-[-8px] mb-2">
                        <div className={`h-1 rounded-full transition-all duration-300 ${viewState === 'holding_profit' ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} />
                        <div className={`h-1 rounded-full transition-all duration-300 ${viewState === 'holding_loss' ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} />
                        <div className={`h-1 rounded-full transition-all duration-300 ${viewState === 'empty' ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} />
                    </div>
                  </section>

                   {generalTactics.length > 0 && (
                    <section>
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500" /> 基础市场研判
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

                  {/* 关键关键价位 (Key Levels) - 新增展示 */}
                  {data.key_levels && (
                      <section className="animate-in fade-in slide-in-from-bottom-2 duration-700">
                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" /> 关键价位参考
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                  <p className="text-[9px] font-black text-slate-600 uppercase mb-2 tracking-tighter">支撑防御</p>
                                  <div className="space-y-1">
                                      <p className="text-sm font-black text-emerald-400">
                                          {data.key_levels.strong_support || data.key_levels.support || '--'}
                                      </p>
                                      <p className="text-[10px] text-slate-500 font-bold">支撑位</p>
                                  </div>
                              </div>
                              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                  <p className="text-[9px] font-black text-slate-600 uppercase mb-2 tracking-tighter">压力挑战</p>
                                  <div className="space-y-1">
                                      <p className="text-sm font-black text-rose-400">
                                          {data.key_levels.strong_resistance || data.key_levels.resistance || '--'}
                                      </p>
                                      <p className="text-[10px] text-slate-500 font-bold">压力位</p>
                                  </div>
                              </div>
                              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                  <p className="text-[9px] font-black text-slate-600 uppercase mb-2 tracking-tighter">突破信号</p>
                                  <div className="space-y-1">
                                      <p className="text-sm font-black text-indigo-400">
                                          {data.key_levels.breakout_confirmation_level || '--'}
                                      </p>
                                      <p className="text-[10px] text-slate-500 font-bold">确认位</p>
                                  </div>
                              </div>
                              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                  <p className="text-[9px] font-black text-slate-600 uppercase mb-2 tracking-tighter">极端止损</p>
                                  <div className="space-y-1">
                                      <p className="text-sm font-black text-slate-200">
                                          {data.key_levels.stop_loss_reference || data.key_levels.stop_loss || '--'}
                                      </p>
                                      <p className="text-[10px] text-slate-500 font-bold">止损线</p>
                                  </div>
                              </div>
                          </div>
                      </section>
                  )}

                  {/* 重点情报 (News Radar) */}
                  {((Array.isArray(data.news_analysis) && data.news_analysis.length > 0) || (typeof data.news_analysis === 'string' && data.news_analysis.trim() !== '')) && (
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
