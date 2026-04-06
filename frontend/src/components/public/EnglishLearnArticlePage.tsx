import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ChevronLeft, BookOpen, Clock, Calendar, Share2, ArrowRight } from 'lucide-react';
import MarketingFooter from '@/components/MarketingFooter';
import { getArticleBySlug, getAllArticles } from '@/lib/learn-content';
import { notFound } from 'next/navigation';
import { buildArticleJsonLd } from '@/lib/geo';
import { brandCoreEn } from '@/content/brand-core.en';

export async function EnglishLearnArticlePage({ slug }: { slug: string }) {
  const article = await getArticleBySlug(slug, { locale: 'en' });

  if (!article) {
    notFound();
  }

  const allArticles = await getAllArticles({ locale: 'en' });
  const currentIndex = allArticles.findIndex((a) => a.slug === slug);
  const nextArticle = allArticles[currentIndex + 1];
  
  const jsonLd = buildArticleJsonLd({
    pageTitle: article.title,
    pageDescription: article.subtitle,
    pageUrl: `${brandCoreEn.domain}/learn/${article.slug}`,
    datePublished: article.date,
    dateModified: article.date,
    image: article.image,
    sources: brandCoreEn.defaultSources,
  });

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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

          <div className="selection:bg-indigo-500/30">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white mb-10 mt-16 first:mt-0 leading-tight">{children}</h1>,
                h2: ({ children }) => <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-8 mt-16 border-l-4 border-indigo-500 pl-5 leading-tight">{children}</h2>,
                h3: ({ children }) => <h3 className="text-xl md:text-2xl font-bold text-indigo-100 mb-6 mt-12 leading-snug">{children}</h3>,
                p: ({ children }) => <p className="text-slate-300 leading-[1.8] mb-8 text-[1.1rem] tracking-wide">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-outside ml-6 space-y-3 mb-8 text-slate-300 text-[1.1rem]">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-outside ml-6 space-y-3 mb-8 text-slate-300 text-[1.1rem]">{children}</ol>,
                li: ({ children }) => <li className="pl-2 leading-[1.8]">{children}</li>,
                blockquote: ({ children }) => <blockquote className="border-l-4 border-indigo-500/50 bg-white/[0.03] p-8 rounded-r-2xl my-10 italic text-indigo-100 text-lg leading-relaxed [&_p]:mb-0">{children}</blockquote>,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4 decoration-indigo-500/30 font-medium transition-colors">{children}</a>,
                strong: ({ children }) => <strong className="font-black text-white px-0.5">{children}</strong>,
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>

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
