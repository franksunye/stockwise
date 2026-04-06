import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { BookOpen, Calendar, ChevronLeft } from 'lucide-react';
import MarketingFooter from '@/components/MarketingFooter';
import { BoundaryNotice, FreshnessBlock, GeoSummary, SourceBlock } from '@/components/seo/GeoBlocks';
import { brandCoreZhCN } from '@/content/brand-core.zh-CN';
import { buildArticleJsonLd } from '@/lib/geo';
import { getAllSupportArticles, getSupportArticleBySlug } from '@/lib/support-content';

export function ChineseSupportArticlePage({ slug }: { slug: string }) {
  const article = getSupportArticleBySlug(slug, { locale: 'cn' });
  if (!article) notFound();

  const related = getAllSupportArticles({ locale: 'cn' })
    .filter((item) => item.category === article.category && item.slug !== article.slug)
    .slice(0, 3);

  const jsonLd = buildArticleJsonLd({
    pageTitle: article.title,
    pageDescription: `${article.category} - ${article.title}`,
    pageUrl: `${brandCoreZhCN.domain}/cn/support/${article.slug}`,
    datePublished: article.lastUpdated,
    dateModified: article.lastUpdated,
    sources: brandCoreZhCN.defaultSources,
  });

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30">
      <nav className="sticky top-0 z-[60] bg-[#050508]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/cn/support" className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-slate-400 hover:text-white flex items-center gap-2">
            <ChevronLeft size={20} />
            <span className="text-xs font-bold">返回</span>
          </Link>
          <div className="text-slate-600 text-[10px] uppercase font-black tracking-[0.2em] hidden md:block">Support Guide</div>
          <div className="w-8" />
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
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
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight italic">{article.title}</h1>
        </header>

        <div className="relative h-32 md:h-48 rounded-[32px] border border-white/5 bg-gradient-to-br from-indigo-500/5 to-transparent flex items-center justify-center overflow-hidden mt-10">
          <BookOpen className="w-12 h-12 text-indigo-500/20" />
        </div>

        <article className="prose prose-invert prose-indigo max-w-none mt-10">
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h2 className="text-2xl font-black text-white mt-12 mb-6 tracking-tight italic border-l-4 border-indigo-500 pl-4">{children}</h2>,
              h2: ({ children }) => <h3 className="text-xl font-bold text-slate-200 mt-10 mb-4">{children}</h3>,
              h3: ({ children }) => <h4 className="text-lg font-bold text-slate-300 mt-8 mb-3">{children}</h4>,
              p: ({ children }) => <p className="text-base text-slate-400 leading-relaxed mb-6 text-justify font-medium">{children}</p>,
              ul: ({ children }) => <ul className="space-y-3 mb-8 list-none pl-2">{children}</ul>,
              li: ({ children }) => <li className="flex items-start gap-3 text-slate-400 font-medium"><div className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 shadow-[0_0_8px_rgba(99,102,241,0.6)]" /><span>{children}</span></li>,
              strong: ({ children }) => <strong className="text-indigo-100 font-black">{children}</strong>,
              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 font-bold underline decoration-indigo-500/30 underline-offset-4 decoration-2">{children}</a>,
            }}
          >
            {article.content}
          </ReactMarkdown>
        </article>

        <GeoSummary summary={[`${article.category} - ${article.title}`]} />
        <SourceBlock
          sources={[
            { name: '知守 AI (ZISO AI) 帮助中心', url: 'https://ziso.cc/cn/support', accessedAt: article.lastUpdated, claimScope: '功能机制定义' },
            { name: '知守 AI (ZISO AI) 投研中心', url: 'https://ziso.cc/cn/learn', accessedAt: article.lastUpdated, claimScope: '方法论背景' },
          ]}
        />
        <BoundaryNotice text={brandCoreZhCN.boundaryNotice.text} />
        <FreshnessBlock updatedAt={article.lastUpdated} />

        {related.length > 0 ? (
          <section className="mt-16 pt-10 border-t border-white/5">
            <h2 className="text-xl font-black tracking-tight mb-5">相关文档</h2>
            <div className="grid gap-3">
              {related.map((item) => (
                <Link
                  key={item.slug}
                  href={`/cn/support/${item.slug}`}
                  className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-slate-300 hover:text-white hover:border-indigo-500/20 transition-colors"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingFooter locale="cn" />
    </div>
  );
}
