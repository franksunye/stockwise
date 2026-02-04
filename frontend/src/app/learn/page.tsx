import Link from 'next/link';
import { getAllArticles } from '@/lib/learn-content';
import { ChevronLeft, BookOpen, Brain, Zap, Shield, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'StockWise 101 | 散户生存手册',
  description: 'AI 时代的散户交易知识库，涵盖交易心理、技术分析与风控系统。',
};

// Map categories to icons, colors, and CHINESE LABELS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CATEGORY_STYLE: Record<string, any> = {
  'The Mind': { label: '心法篇', icon: Brain, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  'The Method': { label: '术法篇', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  'The Money': { label: '资金篇', icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'The Machine': { label: '工具篇', icon: Sparkles, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
};

export default async function LearnPage() {
  const articles = await getAllArticles();
  
  // Group by category but maintain number order within
  // Or just display in 101 order which is already sorted by slug
  
  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#050508]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-slate-400 hover:text-white">
            <ChevronLeft size={20} />
          </Link>
          <div className="font-bold text-lg tracking-tight">StockWise <span className="text-indigo-500">Learn</span></div>
          <div className="w-8" /> {/* Balance */}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        
        {/* Hero */}
        <div className="space-y-6 text-center py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold uppercase tracking-widest">
            <BookOpen size={12} />
            散户生存手册
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-500">
            StockWise 101
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-lg leading-relaxed">
            交易很难，但你不必独自面对。这里是你的理性避难所，教你如何用 AI 和概率论在市场中活下来。
          </p>
        </div>

        {/* Content List */}
        <div className="grid gap-4">
          {articles.map((article) => {
            // Dynamic key access based on string category
            const style = CATEGORY_STYLE[article.category] || { label: article.category, icon: BookOpen, color: 'text-slate-400', bg: 'bg-white/5', border: 'border-white/10' };
            const Icon = style.icon;

            return (
              <Link key={article.slug} href={`/learn/${article.slug}`}>
                <div className="group relative p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition-all active:scale-[0.99] overflow-hidden">
                  <div className="flex flex-col-reverse sm:flex-row items-start justify-between gap-6 relative z-10">
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                         <span className={`text-[10px] font-black uppercase tracking-widest ${style.color} px-2 py-0.5 rounded bg-white/5`}>
                           {style.label}
                         </span>
                         <span className="text-slate-500 text-xs font-mono">{article.date}</span>
                      </div>
                      
                      <h2 className="text-xl font-bold text-slate-200 group-hover:text-white transition-colors mb-3 leading-tight">
                        {article.title}
                      </h2>
                      
                      <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                        {article.subtitle || '点击阅读全文...'}
                      </p>
                    </div>

                    {/* Thumbnail Logic */}
                    {article.image ? (
                      <div className="w-full sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden border border-white/10 shadow-lg group-hover:shadow-indigo-500/10 transition-all">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={article.image} 
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                    ) : (
                      <div className={`mt-1 p-3 rounded-xl ${style.bg} ${style.border} border hidden sm:flex items-center justify-center shrink-0 w-16 h-16`}>
                        <Icon className={`w-8 h-8 ${style.color}`} />
                      </div>
                    )}

                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="text-center pt-12 pb-24">
           <p className="text-slate-600 text-sm">
             更多章节正在连载中...
           </p>
        </div>

      </main>
    </div>
  );
}
