import Link from 'next/link';
import { HelpCircle, ChevronRight, Search, FileText } from 'lucide-react';
import MarketingFooter from '@/components/MarketingFooter';
import { getAllSupportArticles } from '@/lib/support-content';
import { getV1SupportAllowlist } from '@/lib/support-v1';

const SUPPORT_CATEGORIES: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  'Onboarding': { label: 'Getting Started', icon: HelpCircle, color: 'text-indigo-400' },
  'Product': { label: 'Product Logic', icon: Search, color: 'text-cyan-400' },
  'Tiers': { label: 'Tiers & Pricing', icon: FileText, color: 'text-purple-400' },
};

export async function EnglishSupportIndexPage() {
  const allowlist = getV1SupportAllowlist('en');
  const articles = await getAllSupportArticles({ locale: 'en' });
  const scopedArticles = allowlist
    ? articles.filter((article) => allowlist.includes(article.slug))
    : articles;
  const categories = Array.from(new Set(scopedArticles.map((a) => a.category)));

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30">
      <nav className="sticky top-0 z-[60] bg-[#050508]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-slate-400 hover:text-white">
            <span className="text-sm font-bold">Back to Home</span>
          </Link>
          <div className="font-bold text-lg tracking-tight">ZISO AI <span className="text-indigo-500">Support</span></div>
          <div className="w-8" />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 pb-32">
        <header className="space-y-6 text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
            Center of Excellence · Support Center
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-tight">
            How can we <span className="bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-transparent">help?</span>
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
            Everything you need to know about setting up your research workflow and understanding the ZISO AI engine.
          </p>
        </header>

        <div className="space-y-16">
          {categories.map((categoryId) => {
            const categoryArticles = scopedArticles.filter((article) => article.category === categoryId);
            const meta = SUPPORT_CATEGORIES[categoryId] || { label: categoryId, icon: FileText, color: 'text-slate-400' };
            const Icon = meta.icon;

            return (
              <section key={categoryId} className="space-y-6">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <div className={`p-2 rounded-xl bg-white/[0.03] border border-white/10 ${meta.color}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight">{meta.label}</h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">{categoryArticles.length} Articles</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {categoryArticles.map((article) => (
                    <Link
                      key={article.slug}
                      href={`/support/${article.slug}`}
                      className="group flex items-center justify-between p-5 rounded-3xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] hover:border-indigo-500/20 transition-all"
                    >
                      <h3 className="text-slate-300 group-hover:text-white font-medium transition-colors">
                        {article.title}
                      </h3>
                      <ChevronRight size={18} className="text-slate-700 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
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
