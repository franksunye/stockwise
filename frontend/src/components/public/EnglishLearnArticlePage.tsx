import Link from 'next/link';
import { ChevronLeft, BookOpen, Clock, Calendar, Share2, ArrowRight } from 'lucide-react';
import MarketingFooter from '@/components/MarketingFooter';
import { getArticleBySlug, getAllArticles } from '@/lib/learn-content';
import { notFound } from 'next/navigation';

export async function EnglishLearnArticlePage({ slug }: { slug: string }) {
  const article = await getArticleBySlug(slug, { locale: 'en' });

  if (!article) {
    notFound();
  }

  const allArticles = await getAllArticles({ locale: 'en' });
  const currentIndex = allArticles.findIndex((a) => a.slug === slug);
  const nextArticle = allArticles[currentIndex + 1];

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30">
      <nav className="sticky top-0 z-[60] bg-[#050508]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/learn" className="flex items-center gap-2 p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-slate-400 hover:text-white">
            <ChevronLeft size={18} />
            <span className="text-sm font-bold">Back to Academy</span>
          </Link>
          <div className="hidden md:block font-bold text-lg tracking-tight">ZISO AI <span className="text-indigo-500">101</span></div>
          <button className="p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
            <Share2 size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 pb-32">
        <article className="space-y-12">
          <header className="space-y-6 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
              {article.category} {article.slug.includes('-') && `· Module ${article.slug.split('-')[0].replace(/\D/g, '')}`}
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[1.1]">
              {article.title}
            </h1>
            {article.subtitle && (
              <p className="text-xl md:text-2xl text-slate-400 font-medium">
                {article.subtitle}
              </p>
            )}
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-6 text-[10px] font-black uppercase tracking-widest text-slate-500 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Clock size={14} />
                {article.readingTime} Min Read
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} />
                {article.date}
              </div>
              <div className="flex items-center gap-2">
                <BookOpen size={14} />
                ZISO Editorial
              </div>
            </div>
          </header>

          <div
            className="prose prose-invert prose-slate max-w-none 
              prose-headings:font-black prose-headings:tracking-tighter
              prose-h2:text-3xl prose-h2:mt-16 prose-h2:mb-8 prose-h2:border-b prose-h2:border-white/5 prose-h2:pb-4
              prose-p:text-slate-300 prose-p:leading-relaxed prose-p:text-lg
              prose-blockquote:border-indigo-500 prose-blockquote:bg-indigo-500/5 prose-blockquote:py-2 prose-blockquote:rounded-r-2xl
              prose-strong:text-white prose-strong:font-black
              prose-li:text-slate-300 prose-li:text-lg
              prose-code:text-indigo-300 prose-code:bg-indigo-500/10 prose-code:px-1 prose-code:rounded
            "
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          {nextArticle && (
            <footer className="mt-24 pt-12 border-t border-white/5">
              <Link
                href={`/learn/${nextArticle.slug}`}
                className="group block p-8 rounded-[40px] bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.04] transition-all"
              >
                <div className="flex items-center justify-between gap-8">
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Next Lesson</div>
                    <h3 className="text-2xl md:text-3xl font-black tracking-tight group-hover:text-white transition-colors">
                      {nextArticle.title}
                    </h3>
                    <p className="text-slate-500 text-sm font-medium">{nextArticle.subtitle}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all shrink-0">
                    <ArrowRight size={24} />
                  </div>
                </div>
              </Link>
            </footer>
          )}
        </article>
      </main>

      <MarketingFooter locale="en" />
    </div>
  );
}
