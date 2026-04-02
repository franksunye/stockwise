import Link from 'next/link';
import { Brain, BookOpen, ChevronRight, Shield, Sparkles, Target, Zap } from 'lucide-react';
import MarketingFooter from '@/components/MarketingFooter';
import { getAllArticles } from '@/lib/learn-content';

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; desc: string; color: string }> = {
  'The Mind': { label: '心法篇', icon: Brain, desc: '认知与决策心理学', color: 'text-rose-400' },
  'The Method': { label: '方法篇', icon: Zap, desc: '技术面与量价分析', color: 'text-amber-400' },
  'The Money': { label: '资金篇', icon: Shield, desc: '仓位管理与风控系统', color: 'text-emerald-400' },
  'The Machine': { label: '工具篇', icon: Sparkles, desc: 'AI 投研与 ZISO AI 机制', color: 'text-indigo-400' },
  'The Case': { label: '案例篇', icon: Target, desc: '从历史中学习：实战复盘', color: 'text-blue-400' },
};

export async function ChineseLearnIndexPage() {
  const articles = await getAllArticles({ locale: 'cn' });
  const categories = Object.entries(CATEGORY_META).filter(([id]) =>
    articles.some((article) => article.category === id)
  );

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30">
      <nav className="sticky top-0 z-[60] bg-[#050508]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/cn" className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-slate-400 hover:text-white">
            <span className="text-sm font-bold">返回中文首页</span>
          </Link>
          <div className="font-bold text-lg tracking-tight">ZISO AI <span className="text-indigo-500">101</span></div>
          <div className="w-8" />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12 pb-24">
        <section className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
            知守投研委员会 · 101 Academy
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight">
            从散户到 <span className="bg-gradient-to-r from-indigo-500 via-purple-300 to-indigo-500 bg-clip-text text-transparent">理性交易者</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            中文版 101 学院暂时独立运营于 `/cn/learn`。在英文内容完成翻译前，这里承载全部中文投资方法论与案例内容。
          </p>
        </section>

        <div className="space-y-14">
          {categories.map(([categoryId, meta]) => {
            const categoryArticles = articles.filter((article) => article.category === categoryId);
            const Icon = meta.icon;

            return (
              <section key={categoryId} className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-5">
                  <div className="space-y-2">
                    <div className={`flex items-center gap-2 text-xs font-black tracking-[0.2em] uppercase ${meta.color}`}>
                      <Icon size={16} />
                      {categoryId}
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight">{meta.label}</h2>
                    <p className="text-slate-500 text-sm">{meta.desc}</p>
                  </div>
                  <div className="text-slate-600 text-[10px] font-black tracking-widest uppercase">{categoryArticles.length} Articles</div>
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  {categoryArticles.map((article) => (
                    <Link
                      key={article.slug}
                      href={`/cn/learn/${article.slug}`}
                      className="group rounded-3xl border border-white/5 bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-indigo-500/20 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-mono tracking-tight text-slate-600 mb-3">
                            {article.slug.split('-')[1]} · {article.readingTime} 分钟阅读
                          </div>
                          <h3 className="text-lg font-bold text-slate-100 group-hover:text-white transition-colors leading-snug">
                            {article.subtitle || article.title}
                          </h3>
                        </div>
                        <BookOpen size={18} className="text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0" />
                      </div>
                      <div className="mt-6 flex items-center justify-between text-xs font-black uppercase tracking-widest">
                        <span className={meta.color}>阅读全文</span>
                        <ChevronRight size={14} className="text-slate-700 group-hover:translate-x-1 group-hover:text-indigo-400 transition-all" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      <MarketingFooter locale="cn" />
    </div>
  );
}
