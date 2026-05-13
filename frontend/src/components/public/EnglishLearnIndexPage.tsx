import Link from 'next/link';
import { Brain, BookOpen, ChevronRight, Shield, Sparkles, Target, Zap } from 'lucide-react';
import MarketingFooter from '@/components/MarketingFooter';
import { getAllArticles } from '@/lib/learn-content';

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; desc: string; color: string }> = {
  'The Mind': { label: 'The Mind', icon: Brain, desc: 'Psychology & Decision Discipline', color: 'text-rose-400' },
  'The Method': { label: 'The Method', icon: Zap, desc: 'Technical & Price-Volume Analysis', color: 'text-amber-400' },
  'The Money': { label: 'The Money', icon: Shield, desc: 'Position Sizing & Risk Systems', color: 'text-emerald-400' },
  'The Machine': { label: 'The Machine', icon: Sparkles, desc: 'AI Research & ZISO Mechanics', color: 'text-indigo-400' },
  'The Case': { label: 'The Case', icon: Target, desc: 'Learning from History: Case Studies', color: 'text-blue-400' },
};

export async function EnglishLearnIndexPage() {
  const articles = await getAllArticles({ locale: 'en' });
  const categories = Object.entries(CATEGORY_META).filter(([id]) =>
    articles.some((article) => article.category === id)
  );

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30">
      <nav className="sticky top-0 z-[60] bg-[#050508]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-slate-400 hover:text-white">
            <span className="text-sm font-bold">Back to Home</span>
          </Link>
          <div className="font-bold text-lg tracking-tight">ZISO AI <span className="text-indigo-500">101</span></div>
          <div className="w-8" />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12 pb-24">
        <section className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
            ZISO Research Desk · 101 Academy
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight">
            From Retailer to <span className="bg-gradient-to-r from-indigo-500 via-purple-300 to-indigo-500 bg-clip-text text-transparent">Rational Trader</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            The ZISO 101 Academy is designed to dismantle cognitive illusions and build a cold, methodical execution habit.
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
                      href={`/learn/${article.slug}`}
                      className="group rounded-3xl border border-white/5 bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-indigo-500/20 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-mono tracking-tight text-slate-600 mb-3">
                            {article.slug.includes('-') ? article.slug.split('-')[1] : 'Intro'} · {article.readingTime} min read
                          </div>
                          <h3 className="text-lg font-bold text-slate-100 group-hover:text-white transition-colors leading-snug">
                            {article.title}
                          </h3>
                          {article.subtitle && (
                            <p className="mt-3 text-sm leading-relaxed text-slate-500">
                              {article.subtitle}
                            </p>
                          )}
                        </div>
                        <BookOpen size={18} className="text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0" />
                      </div>
                      <div className="mt-6 flex items-center justify-between text-xs font-black uppercase tracking-widest">
                        <span className={meta.color}>Read Article</span>
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

      <MarketingFooter locale="en" />
    </div>
  );
}
