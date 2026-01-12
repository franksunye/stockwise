'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X as CloseIcon, Share2, FileText, Loader2, Sparkles, NotebookText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getCurrentUser } from '@/lib/user';
import { formatStockSymbol } from '@/lib/date-utils';

interface BriefData {
  content: string;
  push_hook: string;
  created_at: string;
}

interface BriefDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  limitToSymbol?: string;
}

export function BriefDrawer({ isOpen, onClose, limitToSymbol }: BriefDrawerProps) {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showGlobal, setShowGlobal] = useState(false);

  // Helper to extract specific stock section from the full brief
  const extractedContent = useMemo(() => {
    if (!brief || !limitToSymbol) return brief?.content;
    const safeSymbol = limitToSymbol.trim();
    
    // Robust parsing: Split by headers "### "
    // This avoids complex regex issues with newlines/special chars
    const sections = brief.content.split('### ');
    
    // Find the section that contains our symbol in the title line
    // Format is "Name (Symbol)"
    const match = sections.find(section => {
      // Relaxed check: Just look for the symbol code. 
      // This handles cases where format might be "(00700)" or "(00700.HK)" or "00700" 
      // without strictly requiring surrounding parens, as long as it's in the title line.
      return firstLine.includes(safeSymbol);
    });

    if (match) {
        // If it's the last section, it might contain the footer ("--- ...")
        // We should strip the footer if present
        const content = match.trim();
        const footerIndex = content.indexOf('\n---');
        if (footerIndex !== -1) {
            return content.substring(0, footerIndex).trim();
        }
        return content;
    }
    
    return null;
  }, [brief, limitToSymbol]);


  useEffect(() => {
    // Reset state when opening
    if (isOpen) {
        setLoading(true);
        setError(null);
        setShowGlobal(false); // Reset to specific view on open
        
        const fetchBrief = async () => {
          try {
            const user = await getCurrentUser();
            const today = new Date().toISOString().split('T')[0];
            
            // Assuming the API returns the GLOBAL brief for the user
            const res = await fetch(`/api/brief?date=${today}`, {
              headers: {
                'x-user-id': user.userId
              }
            });
            
            if (!res.ok) throw new Error('Failed to fetch');
            
            const data = await res.json();
            setBrief(data.brief);
          } catch (err) {
            console.error(err);
            setError('暂无今日简报');
          } finally {
            setLoading(false);
          }
      };
      fetchBrief();
    }
  }, [isOpen]);

  const handleShare = async () => {
    if (navigator.share && brief) {
      try {
        await navigator.share({
          title: 'StockWise 每日简报',
          text: brief.push_hook,
          url: window.location.origin + '/dashboard', 
        });
      } catch (err) {
        console.log('Share cancelled', err);
      }
    }
  };

  const isSpecificStock = !!limitToSymbol && !showGlobal;
  const showContent = isSpecificStock ? extractedContent : brief?.content;
  // If specific stock has NO content, we might want to default to global or show empty state?
  // Current logic: show specific empty state. User can then click "View Global".

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
          {/* 顶部视觉拉手 - Exactly matching StockProfile */}
          <div className="w-full flex justify-center pt-3 pb-1">
             <div className="w-12 h-1 rounded-full bg-white/10" />
          </div>

          <div className="h-full w-full p-8 pt-6 flex flex-col overflow-y-auto">
            {/* Header */}
            <header className="flex items-center justify-between mb-10">
               <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-[22px] bg-white/5 border border-white/10 flex items-center justify-center">
                    <NotebookText className="w-7 h-7 text-indigo-500" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black italic tracking-tighter text-white">
                      {isSpecificStock ? '个股简报' : '每日简报'}
                    </h2>
                    <p className="text-[10px] text-slate-500 font-bold tracking-[0.2em] uppercase flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-indigo-500" />
                      {isSpecificStock ? `STOCK REVIEW: ${limitToSymbol}` : 'DAILY REVIEW'} 
                      <span className="opacity-50 ml-2">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}</span>
                    </p>
                  </div>
               </div>

               <div className="flex items-center gap-2">
                 {brief && (
                   <button 
                     onClick={handleShare}
                     className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all text-slate-400 hover:text-white"
                   >
                     <Share2 size={18} />
                   </button>
                 )}
                 <button 
                   onClick={onClose} 
                   className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all"
                 >
                   <CloseIcon className="w-5 h-5 text-slate-400" />
                 </button>
               </div>
            </header>

            {/* Content Area */}
            <div className="flex-1">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 text-slate-500 min-h-[40vh]">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-xs font-bold uppercase tracking-widest">AI 正在调取简报...</p>
                </div>
              ) : error || !brief ? (
                <div className="h-full flex flex-col items-center justify-center space-y-6 text-center px-4 min-h-[40vh]">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold mb-2">今日暂无简报</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      请确保您的监控列表不为空。<br />
                      AI 可能会在收盘后生成。
                    </p>
                  </div>
                </div>
              ) : (isSpecificStock && !showContent) ? (
                  // Case: Brief exists, but not for THIS stock
                  <div className="h-full flex flex-col items-center justify-center space-y-6 text-center px-4 min-h-[40vh]">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center opacity-50">
                      <FileText className="w-8 h-8 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold mb-2">未收录该股简报</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        今日简报未包含对 {limitToSymbol} 的重点分析。<br/>
                        可能是因为该股今日无重大异动。
                      </p>
                      
                      <button 
                        onClick={() => setShowGlobal(true)}
                        className="mt-6 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all active:scale-95"
                      >
                        阅读完整日报
                      </button>
                    </div>
                  </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
                  
                  {/* Push Hook Summary - Only show for Global Brief */}
                  {!isSpecificStock && (
                      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/5 blur-xl rounded-full" />
                        <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-3 flex items-center gap-2 relative z-10">
                          <Sparkles size={12} /> AI 核心摘要
                        </h3>
                        <p className="text-sm font-medium text-indigo-100 leading-relaxed relative z-10">
                          {brief.push_hook}
                        </p>
                      </div>
                  )}

                  {/* Main Content */}
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        h1: ({children}) => <h3 className="text-lg font-black text-white mt-8 mb-4 tracking-tight">{children}</h3>,
                        h2: ({children}) => <h4 className="text-base font-bold text-slate-200 mt-6 mb-3">{children}</h4>,
                        h3: ({children}) => <h5 className="text-sm font-bold text-slate-300 mt-4 mb-2 uppercase tracking-wide">{children}</h5>,
                        p: ({children}) => <p className="text-sm text-slate-400 leading-relaxed mb-4 text-justify">{children}</p>,
                        ul: ({children}) => <ul className="space-y-2 mb-4 list-disc pl-4 marker:text-indigo-500/50">{children}</ul>,
                        li: ({children}) => <li className="text-sm text-slate-400 pl-1">{children}</li>,
                        strong: ({children}) => <span className="text-indigo-200 font-bold">{children}</span>,
                        a: ({href, children}) => (
                          <a 
                            href={href} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-indigo-400 hover:text-indigo-300 font-bold underline decoration-indigo-500/30 underline-offset-4 transition-colors inline-flex items-center gap-1"
                          >
                            {children}
                          </a>
                        ),
                        blockquote: ({children}) => (
                           <blockquote className="border-l-2 border-indigo-500/30 pl-4 py-2 my-6 bg-white/[0.02] rounded-r-xl italic text-slate-400">
                             {children}
                           </blockquote>
                        ),
                        hr: () => <hr className="border-white/10 my-8" />,
                      }}
                    >
                      {showContent || ''}
                    </ReactMarkdown>
                  </div>
                  
                  {/* Footer Action Area */}
                  <div className="pt-8 border-t border-white/5 flex flex-col items-center space-y-4">
                     {/* Show "Read Full Brief" if in specific mode */}
                     {isSpecificStock && (
                        <button 
                          onClick={() => setShowGlobal(true)}
                          className="w-full py-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-indigo-300 font-bold tracking-wider uppercase transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                          <Sparkles size={14} /> 阅读完整日报 ({new Date().toISOString().split('T')[0]})
                        </button>
                     )}

                     {/* Show "Back to Stock" if in global mode but came from specific */}
                     {!isSpecificStock && limitToSymbol && (
                        <button 
                          onClick={() => setShowGlobal(false)}
                          className="w-full py-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-slate-400 font-bold tracking-wider uppercase transition-all active:scale-[0.98]"
                        >
                          返回 {limitToSymbol} 简报
                        </button>
                     )}

                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest flex items-center justify-center gap-2 mt-4">
                      <span className="w-1 h-1 rounded-full bg-indigo-500" />
                      Generated by StockWise AI
                      <span className="w-1 h-1 rounded-full bg-indigo-500" />
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
