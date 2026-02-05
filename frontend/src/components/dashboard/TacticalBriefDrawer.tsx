'use client';

import { useState, useRef } from 'react';
import { 
  X as CloseIcon, 
  TrendingUp, 
  Zap, 
  BarChart3, 
  RotateCcw, 
  Target,
  ChevronDown,
  Newspaper,
  Crosshair,
  Layers,
  Hash,
  AlertTriangle,
  Info
} from 'lucide-react';
import { TacticalData } from '@/lib/types';
import { AICouncil } from './AICouncil';
import { formatModelName } from '@/lib/model-names';

interface TacticalBriefDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: TacticalData;
  userPos: 'holding' | 'empty' | 'none';
  tier: 'free' | 'pro';
  model?: string;
  symbol: string; 
  targetDate: string; 
}

const getStepConfig = (step: string) => {
  const s = step.toLowerCase();
  if (s.includes('trend')) return { icon: <TrendingUp size={12} />, label: 'TREND' };
  if (s.includes('momentum')) return { icon: <Zap size={12} />, label: 'MOMENTUM' };
  if (s.includes('volume')) return { icon: <BarChart3 size={12} />, label: 'VOLUME' };
  if (s.includes('history')) return { icon: <RotateCcw size={12} />, label: 'HISTORY' };
  if (s.includes('decision')) return { icon: <Target size={12} />, label: 'DECISION' };
  if (s.includes('news') || s.includes('fundamental')) return { icon: <Newspaper size={12} />, label: 'INTELLIGENCE' };
  if (s.includes('position') || s.includes('level') || s.includes('price')) return { icon: <Crosshair size={12} />, label: 'PRICE ACTION' };
  if (s.includes('context')) return { icon: <Layers size={12} />, label: 'CONTEXT' };
  return { icon: <Hash size={12} />, label: s.toUpperCase().replace(/_/g, ' ') };
};

export function TacticalBriefDrawer({ 
  isOpen, onClose, data, tier, model, symbol, targetDate
}: TacticalBriefDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'brief' | 'council'>('brief');
  const isFree = tier === 'free';

  const [viewState, setViewState] = useState<'holding_profit'|'holding_loss'|'empty'>('holding_profit');
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 pointer-events-auto overflow-hidden">
      <div className="absolute inset-0" onClick={onClose} />
      <div 
        className="relative w-full max-w-md bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-10 h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300 ease-out"
      >
        {/* Grabber Area */}
        <div className="w-full h-8 flex items-center justify-center cursor-pointer shrink-0" onClick={onClose}>
          <div className="w-12 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header Tabs */}
        <header className="relative flex items-center justify-center py-2 px-6 bg-[#0a0a0f] border-b border-white/5 shrink-0 z-20">
             <div className="flex p-1 rounded-full bg-white/5 border border-white/10 relative z-10">
                 <button 
                   onClick={() => setActiveTab('brief')}
                   className={`relative z-10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'brief' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                   战术简报
                 </button>
                 <button 
                   onClick={() => setActiveTab('council')}
                   className={`relative z-10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'council' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                   AI 智囊团
                 </button>
             </div>

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
              {/* Type Badge */}
              {data.is_llm || (model && model !== 'rule-based') ? (
                  <div className="px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 flex items-center gap-3">
                      <Zap size={14} className="text-amber-400" />
                      <div className="flex-1">
                          <p className="text-xs font-bold text-indigo-200">
                             {model ? formatModelName(model) : 'LLM 深度推理版'}
                          </p>
                          <p className="text-[10px] text-indigo-400/60 mt-0.5">包含完整推理链与市场情绪感知</p>
                      </div>
                  </div>
              ) : (
                  <div className="px-4 py-3 rounded-xl bg-slate-800/40 border border-white/5 flex items-center gap-3">
                      <BarChart3 size={14} className="text-slate-400" />
                      <div className="flex-1">
                          <p className="text-xs font-bold text-slate-300">基础规则版</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">升级 Pro 解锁 LLM 深度推理</p>
                      </div>
                  </div>
              )}

              <section>
                 <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 场景建议
                 </h3>

                <div 
                    ref={scrollRef}
                    onScroll={(e) => {
                       const target = e.currentTarget;
                       const scrollPos = target.scrollLeft;
                       const cardWidth = target.offsetWidth;
                       if (scrollPos < cardWidth * 0.5) setViewState('holding_profit');
                       else if (scrollPos < cardWidth * 1.5) setViewState('holding_loss');
                       else setViewState('empty');
                    }}
                    className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-6 px-6 pb-4"
                >
                   <div className="min-w-full snap-center space-y-3">
                      {(() => {
                        const allProfit = [...(data?.tactics?.holding_profit || []), ...(data?.tactics?.holding || [])];
                        if (allProfit.length === 0) return <div className="p-10 text-center opacity-30 text-[10px] text-slate-500 border border-white/5 rounded-2xl">暂无盈利持仓对策</div>;
                        return allProfit.map((t, idx) => (
                            <div key={idx} className="p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden">
                               <span className="absolute top-2 right-2 text-[8px] font-black opacity-30 text-indigo-300 uppercase tracking-widest">已持仓 (有盈)</span>
                               <div className="flex items-center gap-2 mb-2">
                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded italic ${t.priority === 'P1' ? 'bg-indigo-500' : 'bg-slate-700'} text-white`}>{t.priority}</span>
                                  <span className="text-sm font-bold text-white">{t.action}</span>
                               </div>
                               <div className="space-y-1.5 text-xs">
                                   <p className="text-slate-400">触发: <span className="text-slate-200">{t.trigger}</span></p>
                                   {(t.target_price || t.stop_advance_price) && (
                                        <div className="flex flex-wrap gap-2 py-1 px-2 bg-white/5 rounded-lg w-fit">
                                            {t.target_price && <span className="text-[10px] text-emerald-400 font-bold">目标: {t.target_price}</span>}
                                            {t.stop_advance_price && <span className="text-[10px] text-amber-400 font-bold">移动止盈: {t.stop_advance_price}</span>}
                                        </div>
                                   )}
                                   <p className="text-slate-500 italic mt-1.5 pt-1.5 border-t border-white/5">理由: {t.reason}</p>
                               </div>
                            </div>
                        ));
                      })()}
                   </div>

                   <div className="min-w-full snap-center space-y-3">
                      {(() => {
                        const loss = data?.tactics?.holding_loss || [];
                        if (loss.length === 0) return <div className="p-10 text-center opacity-30 text-[10px] text-slate-500 border border-white/5 rounded-2xl">暂无亏损持仓对策</div>;
                        return loss.map((t, idx) => (
                            <div key={idx} className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 relative overflow-hidden">
                               <span className="absolute top-2 right-2 text-[8px] font-black opacity-30 text-rose-300 uppercase tracking-widest">已持仓 (亏损)</span>
                               <div className="flex items-center gap-2 mb-2">
                                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded italic ${t.priority === 'P1' ? 'bg-rose-500' : 'bg-slate-700'} text-white`}>{t.priority}</span>
                                  <span className="text-sm font-bold text-white">{t.action}</span>
                               </div>
                               <div className="space-y-1.5 text-xs">
                                   <p className="text-slate-400">触发: <span className="text-slate-200">{t.trigger}</span></p>
                                   {t.stop_loss_price && <div className="py-1 px-2 bg-rose-500/10 rounded-lg w-fit text-[10px] text-rose-400 font-bold">止损价: {t.stop_loss_price}</div>}
                                   <p className="text-slate-500 italic mt-1.5 pt-1.5 border-t border-rose-500/10">理由: {t.reason}</p>
                               </div>
                            </div>
                        ));
                      })()}
                   </div>

                   <div className="min-w-full snap-center space-y-3">
                       {(data?.tactics?.empty || []).length === 0 ? (
                           <div className="p-10 text-center opacity-30 text-[10px] text-slate-500 border border-white/5 rounded-2xl">暂无空仓观察建议</div>
                       ) : (data?.tactics?.empty || []).map((t, idx) => (
                          <div key={idx} className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] relative">
                             <span className="absolute top-2 right-2 text-[8px] font-black text-slate-500/30 uppercase tracking-widest">未建仓视角</span>
                             <div className="flex items-center gap-2 mb-2">
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded italic ${t.priority === 'P1' ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'}`}>{t.priority}</span>
                                <span className="text-sm font-bold text-white">{t.action}</span>
                             </div>
                             <div className="space-y-1.5 text-xs">
                                 <p className="text-slate-400">触发: <span className="text-slate-200">{t.trigger}</span></p>
                                 {t.buy_zone_price && <div className="py-1 px-2 bg-indigo-500/10 rounded-lg w-fit text-[10px] text-indigo-400 font-bold italic">理想买入区: {t.buy_zone_price}</div>}
                                 <p className="text-slate-500 italic mt-1.5 pt-1.5 border-t border-white/10">理由: {t.reason}</p>
                             </div>
                          </div>
                       ))}
                   </div>
                </div>
                
                <div className="flex justify-center gap-2 mt-[-8px] mb-2">
                    <div className={`h-1 rounded-full transition-all duration-300 ${viewState === 'holding_profit' ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} />
                    <div className={`h-1 rounded-full transition-all duration-300 ${viewState === 'holding_loss' ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} />
                    <div className={`h-1 rounded-full transition-all duration-300 ${viewState === 'empty' ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} />
                </div>
              </section>

              {data.key_levels && (
                  <section>
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 关键价位参考
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: '支撑防御', value: data.key_levels.strong_support || data.key_levels.support, color: 'text-emerald-400', sub: '支撑位' },
                            { label: '压力挑战', value: data.key_levels.strong_resistance || data.key_levels.resistance, color: 'text-rose-400', sub: '压力位' },
                            { label: '突破信号', value: data.key_levels.breakout_confirmation_level, color: 'text-indigo-400', sub: '确认位' },
                            { label: '止损参考', value: data.key_levels.stop_loss_reference || data.key_levels.stop_loss, color: 'text-slate-200', sub: '止损线' }
                          ].map((level, idx) => (
                             <div key={idx} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                <p className="text-[9px] font-black text-slate-600 uppercase mb-2">{level.label}</p>
                                <div className="space-y-1">
                                    <p className={`text-sm font-black ${level.color}`}>{level.value || '--'}</p>
                                    <p className="text-[10px] text-slate-500 font-bold">{level.sub}</p>
                                </div>
                             </div>
                          ))}
                      </div>
                  </section>
              )}

              {/* News Intelligence */}
              {((Array.isArray(data.news_analysis) && data.news_analysis.length > 0) || (typeof data.news_analysis === 'string' && data.news_analysis.trim() !== '')) && (
                <section className="relative">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 重点情报 (Last 48h)
                  </h3>
                  <div className={`p-4 rounded-2xl bg-gradient-to-br from-emerald-500/[0.05] to-transparent border border-emerald-500/10 space-y-3 ${isFree ? 'opacity-30 blur-[2px] pointer-events-none' : ''}`}>
                    {(Array.isArray(data.news_analysis) ? data.news_analysis : [data.news_analysis]).map((news, idx) => (
                        <div key={idx} className="flex gap-3 items-start">
                           <Newspaper size={12} className="text-slate-500 mt-0.5 shrink-0" />
                           <p className="text-xs text-slate-300 leading-relaxed font-medium">{news}</p>
                        </div>
                    ))}
                  </div>
                  {isFree && (
                      <div className="absolute inset-0 flex items-center justify-center">
                          <span className="px-4 py-1.5 bg-slate-900/80 border border-white/10 rounded-full text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">升级 Pro 查看</span>
                      </div>
                  )}
                </section>
              )}

              {/* Reasoning Trace */}
              {Array.isArray(data.reasoning_trace) && data.reasoning_trace.length > 0 && (
                <section className="space-y-4">
                  <button 
                    onClick={() => !isFree && setIsExpanded(!isExpanded)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 group ${isFree ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                       <div className={`w-1.5 h-1.5 rounded-full bg-indigo-500 transition-all ${isExpanded ? 'shadow-[0_0_8px_rgba(99,102,241,0.8)] scale-125' : 'opacity-40'}`} />
                       <span className="text-xs font-black text-slate-400 uppercase tracking-widest">解析 AI 推理逻辑</span>
                    </div>
                    <ChevronDown size={16} className={`text-slate-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && !isFree && (
                    <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/[0.03] space-y-6 relative before:absolute before:left-[19px] before:top-6 before:bottom-6 before:w-[1px] before:bg-white/5">
                      {data.reasoning_trace.map((step, idx) => (
                        <div key={idx} className="relative pl-6">
                          <div className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full border border-white/20 bg-[#0a0a0f]" />
                          <div className="flex flex-col gap-2">
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-500">{getStepConfig(step.step).icon}</span>
                                  <span className="text-[10px] font-black uppercase text-slate-400">{getStepConfig(step.step).label}</span>
                                </div>
                                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full italic">{step.conclusion}</span>
                             </div>
                             <p className="text-xs text-slate-200/60 leading-relaxed">{step.data}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Counter Argument & Conflict */}
              {data.counter_argument && (
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                  <h3 className="text-xs font-black text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-2"><AlertTriangle size={12} /> 核心风险反思</h3>
                  <p className="text-xs text-rose-300/70 italic leading-relaxed">{data.counter_argument}</p>
                </div>
              )}
              
              <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Info size={12} /> 核心冲突处理原则</h3>
                <p className="text-[11px] text-indigo-300/70 italic leading-relaxed">{data.conflict_resolution || "遵循趋势优先原则。"}</p>
              </div>
            </div>
          ) : (
            <AICouncil symbol={symbol} targetDate={targetDate} />
          )}
        </div>
      </div>
    </div>
  );
}

export default TacticalBriefDrawer;
