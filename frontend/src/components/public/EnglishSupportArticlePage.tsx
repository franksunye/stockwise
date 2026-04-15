import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ChevronLeft, Share2, HelpCircle, FileText, Calendar } from 'lucide-react';
import MarketingFooter from '@/components/MarketingFooter';
import { getSupportArticleBySlug } from '@/lib/support-content';
import { notFound } from 'next/navigation';
import { buildArticleJsonLd } from '@/lib/geo';
import { brandCoreEn } from '@/content/brand-core.en';
import { isSupportSlugAllowedForLocale } from '@/lib/support-v1';

export async function EnglishSupportArticlePage({ slug }: { slug: string }) {
  if (!isSupportSlugAllowedForLocale('en', slug)) {
    notFound();
  }

  const article = await getSupportArticleBySlug(slug, { locale: 'en' });

  if (!article) {
    notFound();
  }

  const jsonLd = buildArticleJsonLd({
    pageTitle: article.title,
    pageDescription: article.title, // Support articles use title as fallback description
    pageUrl: `${brandCoreEn.domain}/support/${article.slug}`,
    datePublished: article.lastUpdated,
    dateModified: article.lastUpdated,
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
          <Link href="/support" className="flex items-center gap-2 p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-slate-400 hover:text-white">
            <ChevronLeft size={18} />
            <span className="text-sm font-bold">Back to Support</span>
          </Link>
          <div className="hidden md:block font-bold text-lg tracking-tight">ZISO AI <span className="text-indigo-500">Support</span></div>
          <button className="p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors">
            <Share2 size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12 pb-32">
        <article className="space-y-10">
          <header className="space-y-6 pt-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
              <HelpCircle size={14} /> {article.category}
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              {article.title}
            </h1>
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <div className="flex items-center gap-2">
                <Calendar size={14} />
                Last Updated: {article.lastUpdated}
              </div>
              <div className="flex items-center gap-2">
                <FileText size={14} />
                Knowledge Base
              </div>
            </div>
          </header>

          <div className="selection:bg-indigo-500/30">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h2 className="text-2xl font-black text-white mt-12 mb-6 tracking-tight italic border-l-4 border-indigo-500 pl-4">{children}</h2>,
                h2: ({ children }) => <h3 className="text-xl font-bold text-slate-200 mt-10 mb-4">{children}</h3>,
                h3: ({ children }) => <h4 className="text-lg font-bold text-slate-300 mt-8 mb-3">{children}</h4>,
                p: ({ children }) => <p className="text-base text-slate-400 leading-relaxed mb-6 font-medium">{children}</p>,
                ul: ({ children }) => <ul className="space-y-3 mb-8 list-disc list-outside ml-6 text-slate-400">{children}</ul>,
                li: ({ children }) => <li className="pl-2 leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="text-indigo-100 font-black">{children}</strong>,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-bold underline decoration-indigo-500/30 underline-offset-4 decoration-2">{children}</a>,
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>

          <footer className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-sm text-slate-500 font-medium">Was this article helpful?</div>
            <div className="flex items-center gap-4">
              <button className="px-6 py-2 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-indigo-500 hover:text-white transition-all text-sm font-bold">
                Yes
              </button>
              <button className="px-6 py-2 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-slate-800 transition-all text-sm font-bold">
                No
              </button>
            </div>
          </footer>
        </article>
      </main>

      <MarketingFooter locale="en" />
    </div>
  );
}
