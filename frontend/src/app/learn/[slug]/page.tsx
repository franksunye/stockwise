import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticleBySlug, getAllArticles } from '@/lib/learn-content';
import ReactMarkdown from 'react-markdown';
import { ChevronLeft, Calendar, Share2 } from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};
  
  return {
    title: `${article.title} - StockWise Learn`,
    description: article.subtitle,
  };
}

export async function generateStaticParams() {
  const articles = await getAllArticles();
  return articles.map((post) => ({
    slug: post.slug,
  }));
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  // Custom Markdown Components for Premium Styling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MarkdownComponents: Record<string, React.FC<any>> = {
    h1: ({ children }) => <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-8 mt-12 first:mt-0">{children}</h1>,
    h2: ({ children }) => <h2 className="text-2xl font-bold tracking-tight text-indigo-200 mb-6 mt-12 border-l-4 border-indigo-500 pl-4">{children}</h2>,
    h3: ({ children }) => <h3 className="text-xl font-bold text-white mb-4 mt-8">{children}</h3>,
    p: ({ children }) => <p className="text-slate-300 leading-8 mb-6 text-lg">{children}</p>,
    ul: ({ children }) => <ul className="list-disc list-outside ml-6 space-y-2 mb-6 text-slate-300">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal list-outside ml-6 space-y-2 mb-6 text-slate-300">{children}</ol>,
    li: ({ children }) => <li className="pl-2">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-indigo-500/50 bg-indigo-500/5 p-6 rounded-r-xl my-8 italic text-indigo-200 text-lg">
        {children}
      </blockquote>
    ),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    code: ({ node, inline, className, children, ...props }) => {
      // const match = /language-(\w+)/.exec(className || '');
      return !inline ? (
        <div className="bg-[#111] border border-white/10 rounded-xl p-4 my-6 overflow-x-auto">
          <code className={className} {...props}>
            {children}
          </code>
        </div>
      ) : (
        <code className="bg-white/10 text-indigo-300 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
          {children}
        </code>
      );
    },
    hr: () => <hr className="border-white/10 my-12" />,
    a: ({ href, children }) => <a href={href} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4 decoration-indigo-500/30">{children}</a>,
    strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
  };

  return (
    <article className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30">
      
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 bg-[#050508]/90 backdrop-blur border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/learn" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
            <span className="font-medium text-sm">Back</span>
          </Link>
          <div className="text-sm font-bold tracking-tight opacity-0 animate-fade-in md:opacity-100">
             {article.slug.split('-')[0]}-{article.slug.split('-')[1]}
          </div>
          <button className="p-2 -mr-2 text-slate-400 hover:text-white transition-colors">
            <Share2 size={20} />
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        
        {/* Header */}
        <header className="mb-12 border-b border-white/10 pb-12">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded border border-indigo-500/20">
              {article.category}
            </span>
            <div className="flex items-center gap-1 text-slate-500 text-xs font-mono">
              <Calendar size={12} />
              {article.date}
            </div>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tight text-white mb-6">
            {article.title}
          </h1>
          
          {article.subtitle && (
            <p className="text-xl md:text-2xl text-slate-400 font-light leading-relaxed">
              {article.subtitle}
            </p>
          )}

          {article.image ? (
            <div className="mt-8 rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-indigo-500/10">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img 
                 src={article.image} 
                 alt={article.title}
                 className="w-full h-auto object-cover max-h-[500px]"
               />
            </div>
          ) : article.image_prompt ? (
             <div className="mt-8 p-4 rounded-xl bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/10 flex items-center justify-center min-h-[200px] text-center">
                <div className="text-indigo-300/50 text-sm italic max-w-md">
                   🖼️ [Image Placeholder]<br/>
                   &quot;{article.image_prompt}&quot;
                </div>
             </div>
          ) : null}
        </header>

        {/* Markdown Content */}
        <main className="pb-24">
          <ReactMarkdown components={MarkdownComponents}>
            {article.content}
          </ReactMarkdown>
        </main>

        {/* Footer Navigation */}
        <footer className="border-t border-white/10 pt-12">
          <Link href="/learn" className="inline-flex items-center justify-center w-full py-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold transition-all">
            Return to Index
          </Link>
        </footer>

      </div>
    </article>
  );
}
