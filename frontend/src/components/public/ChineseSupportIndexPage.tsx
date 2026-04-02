import Link from 'next/link';
import { ChevronRight, LifeBuoy } from 'lucide-react';
import MarketingFooter from '@/components/MarketingFooter';
import { getAllSupportArticles } from '@/lib/support-content';

export function ChineseSupportIndexPage() {
  const articles = getAllSupportArticles({ locale: 'cn' });
  const grouped = Array.from(
    articles.reduce((map, article) => {
      const list = map.get(article.category) || [];
      list.push(article);
      map.set(article.category, list);
      return map;
    }, new Map<string, typeof articles>())
  );

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30">
      <nav className="sticky top-0 z-[60] bg-[#050508]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/cn" className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-slate-400 hover:text-white">
            <span className="text-sm font-bold">返回中文首页</span>
          </Link>
          <div className="font-bold text-lg tracking-tight italic">ZISO <span className="text-indigo-500">SUPPORT</span></div>
          <div className="w-8" />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12 pb-24">
        <section className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
            中文帮助中心
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight">
            构建你的 <span className="bg-gradient-to-r from-indigo-500 via-purple-300 to-indigo-500 bg-clip-text text-transparent">理性交易优势</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            中文帮助中心暂时独立运营于 `/cn/support`，用于承载功能机制、风控语义、提醒逻辑与账户使用说明。
          </p>
        </section>

        <div className="grid md:grid-cols-2 gap-6">
          {grouped.map(([category, items]) => (
            <section key={category} className="rounded-[32px] border border-white/5 bg-white/[0.02] p-7">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <LifeBuoy className="text-indigo-400" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">{category}</h2>
                  <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">{items.length} Docs</p>
                </div>
              </div>

              <div className="space-y-3">
                {items.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/cn/support/${article.slug}`}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/20 px-4 py-3 hover:border-indigo-500/20 hover:bg-white/[0.02] transition-all"
                  >
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                      {article.title}
                    </span>
                    <ChevronRight size={14} className="text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <MarketingFooter locale="cn" />
    </div>
  );
}
