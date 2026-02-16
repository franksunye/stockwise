'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X as CloseIcon, FileText, Loader2, Sparkles, NotebookText, Bot, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getCurrentUser } from '@/lib/user';
import { getHKTime, getLastTradingDay } from '@/lib/date-utils';
import { useUserProfile } from '@/hooks/useUserProfile';
import { shouldEnableHighPerformance } from '@/lib/device-utils';
import Multiavatar from '@/components/Multiavatar';

interface BriefData {
  date: string;
  content: string;
  push_hook: string;
  created_at: string;
}

interface BriefDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  limitToSymbol?: string;
  onUpgrade?: () => void;
}

export function BriefDrawer({ isOpen, onClose, limitToSymbol, onUpgrade }: BriefDrawerProps) {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tier, refreshProfile } = useUserProfile();
  const [showGlobal, setShowGlobal] = useState(false);
  const [isHighPerformance, setIsHighPerformance] = useState(false);

  useEffect(() => {
    setIsHighPerformance(shouldEnableHighPerformance());
    if (isOpen) {
      setLoading(true);
      setError(null);
      setShowGlobal(false);
      const fetchBrief = async () => {
        try {
          const user = await getCurrentUser();
          refreshProfile();
          const today = getHKTime().toISOString().split('T')[0];
          const yesterday = getLastTradingDay().toISOString().split('T')[0];
          let res = await fetch(`/api/brief?date=${today}`, { headers: { 'x-user-id': user.userId } });
          let data = await res.json();
          if (!data.brief) {
            res = await fetch(`/api/brief?date=${yesterday}`, { headers: { 'x-user-id': user.userId } });
            data = await res.json();
          }
          setBrief(data.brief);
        } catch (err) {
          console.error(err);
          setError('暂无可用简报');
        } finally {
          setLoading(false);
        }
      };
      fetchBrief();
    }
  }, [isOpen, refreshProfile]);

  const extractedContent = useMemo(() => {
    if (!brief || !limitToSymbol) return brief?.content;
    const safeSymbol = limitToSymbol.trim();
    const stockHeaderPattern = new RegExp(
      `### [^\\n]*\\(${safeSymbol}(?:\\.HK|\\.SZ|\\.SH)?\\)([\\s\\S]*?)(?=\\n### [^\\n]+\\([A-Z0-9]{5,6}\\)|\\n---\\n|$)`,
      'i'
    );
    const match = brief.content.match(stockHeaderPattern);
    if (match) return match[0].trim();
    const sections = brief.content.split(/(?=\n### [^\n]+\([A-Z0-9]+\))/);
    const fallbackMatch = sections.find(section => section.includes(`(${safeSymbol})`));
    if (fallbackMatch) {
      const footerIndex = fallbackMatch.indexOf('\n---');
      return footerIndex !== -1 ? fallbackMatch.substring(0, footerIndex).trim() : fallbackMatch.trim();
    }
    return null;
  }, [brief, limitToSymbol]);

  const isSpecificStock = !!limitToSymbol && !showGlobal;
  const showContent = isSpecificStock ? extractedContent : brief?.content;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-end bg-black/80 pointer-events-auto overflow-hidden">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0" />

          <motion.div 
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 150) onClose(); }}
            transition={isHighPerformance ? { type: 'tween', ease: 'easeOut', duration: 0.25 } : { type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-md h-[85vh] flex flex-col bg-[#050508] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-10"
          >
            {/* Visual Handle */}
            <div className="w-full flex justify-center pt-3 pb-1 shrink-0"><div className="w-12 h-1 rounded-full bg-white/20" /></div>

            {/* Fixed Header */}
            <header className="shrink-0 z-20 px-6 py-5 flex items-center justify-between border-b border-white/5 bg-[#050508]/80 backdrop-blur-xl">
               <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <NotebookText className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black italic tracking-tighter text-white flex items-baseline gap-2">
                      {isSpecificStock ? '个股简报' : '每日简报'}
                      <span className="text-sm font-bold text-slate-500 not-italic tracking-normal font-mono">
                        {brief ? (brief.date.split('-')[1] + '/' + brief.date.split('-')[2]) : '--/--'}
                      </span>
                    </h2>
                    {tier === 'pro' && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[8px] font-black uppercase tracking-wider translate-y-[-1px]">
                        PRO
                      </span>
                    )}
                  </div>
               </div>
               <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white active:scale-90 transition-all">
                 <CloseIcon className="w-5 h-5" />
               </button>
            </header>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-8 py-6 scrollbar-hide">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 py-20 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">正在同步深度复盘...</p>
                </div>
              ) : error || !brief ? (
                <div className="h-full flex flex-col items-center justify-center space-y-6 text-center py-20">
                  <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center"><Sparkles size={24} className="text-slate-600" /></div>
                  <div>
                    <h3 className="text-white font-bold text-sm mb-1 uppercase tracking-tight">今日简报尚未就绪</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">请保持监控列表活跃，AI 将在收盘后生成深度分析。</p>
                  </div>
                </div>
              ) : (isSpecificStock && !showContent) ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-6 text-center py-20">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center opacity-50"><FileText size={24} className="text-slate-600" /></div>
                    <div className="space-y-4">
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">今日日报中未发现对于股票 {limitToSymbol} 的重大异动分析。</p>
                      <button onClick={() => setShowGlobal(true)} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-500/20">查看完整日报</button>
                    </div>
                  </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-12">
                  {!isSpecificStock && (
                      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 blur-xl rounded-full" />
                        <h3 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-3 flex items-center gap-2 relative z-10"><Sparkles size={11} /> AI 核心摘要</h3>
                        <p className="text-sm font-medium text-indigo-100 leading-relaxed relative z-10 italic">{brief.push_hook}</p>
                      </div>
                  )}

                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        h1: ({children}) => <h3 className="text-lg font-black text-white mt-8 mb-4 tracking-tight uppercase italic">{children}</h3>,
                        h2: ({children}) => <h4 className="text-base font-bold text-slate-200 mt-6 mb-3">{children}</h4>,
                        h3: ({children}) => <h5 className="text-base font-black text-indigo-400 mt-6 mb-3 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />{children}</h5>,
                        p: ({children}) => <p className="text-sm text-slate-400 leading-relaxed mb-4 text-justify">{children}</p>,
                        ul: ({children}) => <ul className="space-y-2 mb-4 list-disc pl-4 marker:text-indigo-500/50">{children}</ul>,
                        li: ({children}) => <li className="text-sm text-slate-400 pl-1">{children}</li>,
                        strong: ({children}) => <span className="text-indigo-200 font-bold">{children}</span>,
                        hr: () => <hr className="border-white/5 my-8" />,
                      }}
                    >
                      {showContent?.replace(/StockWise AI 生成于\s*\d{1,2}:\d{2}/g, '').trim() || ''}
                    </ReactMarkdown>
                  </div>
                  
                  <div className="pt-8 border-t border-white/5 flex flex-col items-center space-y-4">
                     {isSpecificStock && (
                        <button onClick={() => setShowGlobal(true)} className="w-full py-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] text-indigo-300 font-black tracking-[0.2em] uppercase transition-all active:scale-[0.98] flex items-center justify-center gap-2"><Sparkles size={14} /> 阅读完整日报 ({brief.date})</button>
                     )}
                     {!isSpecificStock && limitToSymbol && (
                        <button onClick={() => setShowGlobal(false)} className="w-full py-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] text-slate-400 font-black tracking-[0.2em] uppercase transition-all active:scale-[0.98]">返回 {limitToSymbol} 简解</button>
                     )}
                     {tier === 'free' && (
                        <div className="w-full p-4 rounded-[24px] bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 relative overflow-hidden group">
                          <div className="relative z-10 flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="text-[11px] font-black text-amber-200 flex items-center gap-2 mb-1 uppercase italic tracking-tight">⭐ 解锁 PRO 深度复盘</h4>
                              <p className="text-[9px] text-amber-400/70 leading-relaxed font-bold">专属首席主笔深度解读，叙事驱动的行业与个股专业分析</p>
                            </div>
                            <button onClick={() => { if (onUpgrade) { onClose(); onUpgrade(); } else { window.location.href = '/pricing'; } }} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black tracking-widest uppercase transition-all active:scale-95 whitespace-nowrap ml-4">升级</button>
                          </div>
                        </div>
                     )}
                  <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 overflow-hidden shrink-0 grayscale hover:grayscale-0 transition-all duration-500">
                        <Multiavatar name="Quinn" className="w-full h-full" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-black text-white">DeepSeek (深寻)</span>
                           <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 uppercase tracking-wider flex items-center gap-1">
                             <CheckCircle2 size={10} />
                             深度推演分析师
                           </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium font-mono">
                           发布于 {(() => {
                              const match = brief.content.match(/StockWise AI 生成于\s*(\d{1,2}:\d{2})/);
                              return match ? match[1] : (brief.created_at ? new Date(brief.created_at).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', hour12: false}) : '--:--');
                           })()}
                        </p>
                      </div>
                    </div>
                    {tier === 'pro' && (
                       <div className="opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                              <Sparkles size={14} className="text-amber-400" />
                          </div>
                       </div>
                    )}
                  </div>
                </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
