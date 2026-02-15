import Link from 'next/link';
import Image from 'next/image';
import { getAllArticles } from '@/lib/learn-content';
import { ChevronLeft, ChevronRight, BookOpen, Brain, Zap, Shield, Sparkles, Target } from 'lucide-react';
import MarketingFooter from '@/components/MarketingFooter';

export const metadata = {
  title: 'ZISO AI 101 | 知守日课',
  description: '你的理性避难所。教你如何用 AI 和概率论在市场中活下来。',
};

interface CategoryStyle {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}

// Map categories to icons, colors, and CHINESE LABELS
const CATEGORY_STYLE: Record<string, CategoryStyle> = {
  'The Mind': { label: '心法篇', icon: Brain, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  'The Method': { label: '方法篇', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  'The Money': { label: '资金篇', icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'The Machine': { label: '工具篇', icon: Sparkles, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  'The Case': { label: '案例篇', icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
};

export default async function LearnPage() {
  const articles = await getAllArticles();
  
  // Group articles by category
  const categories = [
    { id: 'The Mind', label: '心法篇', icon: Brain, desc: '认知与决策心理学', color: 'text-rose-400' },
    { id: 'The Method', label: '方法篇', icon: Zap, desc: '技术面与量价分析', color: 'text-amber-400' },
    { id: 'The Money', label: '资金篇', icon: Shield, desc: '仓位管理与风控系统', color: 'text-emerald-400' },
    { id: 'The Machine', label: '工具篇', icon: Sparkles, desc: 'AI 投研与 ZISO AI 机制', color: 'text-indigo-400' },
    { id: 'The Case', label: '案例篇', icon: Target, desc: '从历史中学习：实战复盘', color: 'text-blue-400' },
  ];

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-[60] bg-[#050508]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-slate-400 hover:text-white">
            <ChevronLeft size={20} />
          </Link>
          <div className="font-bold text-lg tracking-tight">ZISO AI <span className="text-indigo-500">101</span></div>
          <div className="w-8" />
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-10 pb-8 border-b border-white/5">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-600/5 blur-[120px] rounded-full" />
            <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-purple-600/5 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
            <Sparkles size={10} className="animate-pulse" />
            知守投研委员会 · 全天候智力支持
          </div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter italic leading-tight">
            从散户到 <span className="bg-gradient-to-r from-indigo-500 via-purple-300 to-indigo-500 bg-clip-text text-transparent">理性交易者</span>
          </h1>
          <p className="text-slate-500 max-w-xl mx-auto text-sm md:text-base leading-relaxed font-medium">
            这里是你的理性避难所。由 <span className="text-indigo-400/80">知守投研委员会</span> 维护的 40 篇生存日课，教你如何在黑暗森林里活下来。
          </p>
          
          <div className="pt-4 flex flex-wrap justify-center gap-3 text-[10px] font-bold text-slate-500">
             <div className="px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5"><span className="text-white">40+</span> 深度指南</div>
             <div className="px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5"><span className="text-white">5</span> 大核心模块</div>
             <div className="px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5">预计阅读 <span className="text-white">180</span> 分钟</div>
          </div>
        </div>
      </section>

      {/* Sticky Sub-nav */}
      <nav className="sticky top-16 z-50 bg-[#050508]/80 backdrop-blur-xl border-b border-white/5 py-4 scrollbar-hide overflow-x-auto">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-center gap-2 md:gap-4 min-w-max">
          {categories.map((cat) => (
            <a 
              key={cat.id} 
              href={`#${cat.id}`}
              className="px-4 py-2 rounded-full text-xs font-black tracking-widest uppercase transition-all bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:text-white text-slate-400"
            >
              {cat.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-20 space-y-32">
        {categories.map((cat) => {
          const categoryArticles = articles.filter(a => a.category === cat.id);
          if (categoryArticles.length === 0) return null;
          const CatIcon = cat.icon;

          return (
            <section key={cat.id} id={cat.id} className="scroll-mt-40 space-y-10">
              {/* Category Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
                <div className="space-y-3">
                  <div className={`flex items-center gap-3 ${cat.color} font-black tracking-[0.2em] text-xs uppercase`}>
                    <CatIcon size={20} />
                    {cat.id}
                  </div>
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight">{cat.label}</h2>
                  <p className="text-slate-500 font-medium">{cat.desc}</p>
                </div>
                <div className="text-slate-600 text-[10px] font-black tracking-widest uppercase">
                  {categoryArticles.length} ARTICLES
                </div>
              </div>

              {/* Grid Layout */}
              <div className="grid md:grid-cols-2 gap-6">
                {categoryArticles.map((article) => {
                  const style = CATEGORY_STYLE[article.category] || { label: article.category, icon: BookOpen, color: 'text-slate-400', bg: 'bg-white/5', border: 'border-white/10' };
                  return (
                    <Link key={article.slug} href={`/learn/${article.slug}`} className="group relative block h-full">
                      <div className="h-full p-8 rounded-3xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-indigo-500/20 transition-all active:scale-[0.98] flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-6">
                             <div className="text-slate-600 text-[10px] font-mono tracking-tighter">
                                {article.slug.split('-')[1]} • {article.readingTime} MIN READ
                             </div>
                             <div className={`w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden transition-all duration-500 flex-shrink-0
                                ${article.image ? 'opacity-60 group-hover:opacity-100' : `${style.bg} ${style.border} opacity-80 group-hover:opacity-100 group-hover:scale-110`}
                             `}>
                                {article.image ? (
                                   <Image src={article.image} alt={article.title} width={80} height={80} className="w-full h-full object-cover" />
                                ) : (
                                   <style.icon size={20} className={style.color} />
                                )}
                             </div>
                          </div>
                          
                          <h3 className="text-xl font-bold text-slate-200 group-hover:text-white transition-colors mb-4 leading-[1.3]">
                            {article.subtitle || article.title}
                          </h3>
                        </div>

                        <div className="pt-6 flex items-center justify-between text-xs font-black tracking-widest uppercase">
                           <span className={style.color}>{article.title.includes(':') ? article.title.split(':')[1].trim() : 'READ MORE'}</span>
                           <ChevronRight size={14} className="text-slate-700 group-hover:translate-x-1 transition-transform group-hover:text-indigo-500" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Closing */}
        <div className="text-center py-20 border-t border-white/5">
           <p className="text-slate-600 text-sm font-medium">
             这只是开始。更多的实战案例与 AI 投资教程正在连载中...
           </p>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
