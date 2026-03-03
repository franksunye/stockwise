'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Calendar, Share2, Sparkles, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getArticleBySlug } from '@/lib/support-content';
import { motion } from 'framer-motion';
import MarketingFooter from '@/components/MarketingFooter';

export default function SupportDetail() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const article = getArticleBySlug(slug);

  if (!article) {
    return (
      <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center space-y-6 text-center px-6">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center opacity-50">
          <BookOpen className="w-8 h-8 text-slate-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white mb-2">未找到相关指南</h1>
          <p className="text-sm text-slate-500 mb-8">具体内容可能正在由 AI 智囊团紧急编写中...</p>
          <Link href="/support" className="px-6 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold transition-all active:scale-95">
            返回支持中心
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30">
      {/* Article Navbar */}
      <nav className="sticky top-0 z-[60] bg-[#050508]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <button 
            onClick={() => router.back()} 
            className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-slate-400 hover:text-white flex items-center gap-2"
          >
            <ChevronLeft size={20} />
            <span className="text-xs font-bold">返回</span>
          </button>
          <div className="text-slate-600 text-[10px] uppercase font-black tracking-[0.2em] hidden md:block">
            Support Guide · {article.category}
          </div>
          <button className="p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white">
            <Share2 size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <motion.div
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.5 }}
           className="space-y-12"
        >
          {/* Article Header */}
          <header className="space-y-6">
            <div className="flex items-center gap-3">
               <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
                  {article.category}
               </span>
               <div className="h-px w-8 bg-white/10" />
               <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
                  <Calendar size={12} />
                  {article.lastUpdated}
               </div>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight italic">
              {article.title}
            </h1>
          </header>

          {/* Luxury Banner */}
          <div className="relative group">
            <div className="absolute inset-0 bg-indigo-600/10 blur-[60px] rounded-[32px] pointer-events-none" />
            <div className="relative h-32 md:h-48 rounded-[32px] border border-white/5 bg-gradient-to-br from-indigo-500/5 to-transparent flex items-center justify-center overflow-hidden">
               <Sparkles className="w-16 h-16 text-indigo-500/10 absolute -right-4 -bottom-4 rotate-12" />
               <BookOpen className="w-12 h-12 text-indigo-500/20" />
            </div>
          </div>

          {/* Article Content */}
          <article className="prose prose-invert prose-indigo max-w-none">
            <ReactMarkdown
               components={{
                h1: ({children}) => <h2 className="text-2xl font-black text-white mt-12 mb-6 tracking-tight italic border-l-4 border-indigo-500 pl-4">{children}</h2>,
                h2: ({children}) => <h3 className="text-xl font-bold text-slate-200 mt-10 mb-4">{children}</h3>,
                h3: ({children}) => <h4 className="text-lg font-bold text-slate-300 mt-8 mb-3">{children}</h4>,
                p: ({children}) => <p className="text-base text-slate-400 leading-relaxed mb-6 text-justify font-medium">{children}</p>,
                ul: ({children}) => <ul className="space-y-3 mb-8 list-none pl-2">{children}</ul>,
                li: ({children}) => (
                    <li className="flex items-start gap-3 text-slate-400 font-medium">
                        <div className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                        <span>{children}</span>
                    </li>
                ),
                strong: ({children}) => <strong className="text-indigo-100 font-black">{children}</strong>,
                blockquote: ({children}) => (
                    <div className="my-10 p-6 md:p-8 rounded-[24px] bg-white/[0.02] border border-white/5 relative overflow-hidden italic shadow-inner">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50" />
                        <span className="text-slate-400 font-medium leading-relaxed block">{children}</span>
                    </div>
                ),
                a: ({href, children}) => (
                    <a href={href} target="_blank" className="text-indigo-400 hover:text-indigo-300 font-bold underline decoration-indigo-500/30 underline-offset-4 decoration-2">
                        {children}
                    </a>
                ),
                hr: () => <hr className="border-white/5 my-12" />
               }}
            >
              {article.content}
            </ReactMarkdown>
          </article>

          {/* Article Footer */}
          <footer className="pt-12 border-t border-white/5 text-center space-y-8">
             <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase text-slate-500">
               是否解决了你的问题？
             </div>
             <div className="flex justify-center gap-4">
               <button className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-all">是的，谢谢</button>
               <button className="px-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-all">还有点模糊</button>
             </div>
          </footer>
        </motion.div>
      </main>

      <MarketingFooter />
    </div>
  );
}
