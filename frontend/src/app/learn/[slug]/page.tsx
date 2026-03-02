import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getArticleBySlug, getAllArticles } from '@/lib/learn-content';
import ReactMarkdown from 'react-markdown';
import { ChevronLeft, BookOpen, Brain, Zap, Shield, Sparkles, Target } from 'lucide-react';
import MarketingFooter from '@/components/MarketingFooter';

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: 'Article Not Found' };
  
  return {
    title: `${article.title.split(': ')[1] || article.title} | ZISO AI 101 | 知守日课`,
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

  const style = CATEGORY_STYLE[article.category] || { label: article.category, icon: BookOpen, color: 'text-slate-400', bg: 'bg-white/5', border: 'border-white/10' };
  const Icon = style.icon;

  // Custom Markdown Components for Premium Styling
  const MarkdownComponents: Record<string, React.ElementType> = {
    h1: ({ children }) => <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-10 mt-16 first:mt-0">{children}</h1>,
    h2: ({ children }) => <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-8 mt-16 border-l-4 border-indigo-500 pl-5 leading-tight">{children}</h2>,
    h3: ({ children }) => <h3 className="text-xl md:text-2xl font-bold text-indigo-100 mb-6 mt-12">{children}</h3>,
    p: ({ children }) => <p className="text-slate-300 leading-[1.8] mb-8 text-[1.1rem] tracking-wide">{children}</p>,
    ul: ({ children }) => <ul className="list-disc list-outside ml-6 space-y-3 mb-8 text-slate-300 text-[1.1rem]">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal list-outside ml-6 space-y-3 mb-8 text-slate-300 text-[1.1rem]">{children}</ol>,
    li: ({ children }) => <li className="pl-2 leading-[1.8]">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-indigo-500/50 bg-white/[0.03] p-8 rounded-r-2xl my-10 italic text-indigo-100 text-lg leading-relaxed [&_p]:mb-0">
        {children}
      </blockquote>
    ),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    code: ({ node, inline, className, children, ...props }) => {
      return !inline ? (
        <div className="bg-[#111] border border-white/10 rounded-xl p-6 my-8 overflow-x-auto">
          <code className={`${className} text-emerald-400 font-mono text-sm`} {...props}>
            {children}
          </code>
        </div>
      ) : (
        <code className="bg-white/10 text-indigo-300 px-1.5 py-0.5 rounded text-sm font-mono mx-0.5" {...props}>
          {children}
        </code>
      );
    },
    hr: () => <hr className="border-white/10 my-16" />,
    a: ({ href, children }) => <a href={href} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4 decoration-indigo-500/30 font-medium transition-colors">{children}</a>,
    strong: ({ children }) => <strong className="font-black text-white px-0.5">{children}</strong>,
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30 pb-20">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#050508]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/learn" className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-slate-400 hover:text-white">
            <ChevronLeft size={20} />
          </Link>
          <div className="font-bold text-lg tracking-tight">ZISO AI <span className="text-indigo-500">101</span></div>
          <div className="w-8" />
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-12">
        
        {/* Header */}
        <header className="mb-12 text-center space-y-6">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${style.bg} ${style.color} border ${style.border}`}>
              <Icon size={12} />
              {style.label}
            </span>
            <span className="text-slate-500 text-xs font-mono">{article.readingTime} 分钟阅读</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-slate-400 leading-tight">
            {article.title}
          </h1>

          <p className="text-xl text-slate-400 font-medium leading-relaxed max-w-2xl mx-auto">
            {article.subtitle}
          </p>
        </header>

        {/* Featured Image */}
        {article.image ? (
            <div className="mb-12 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-indigo-500/10 relative aspect-video">
                <Image 
                  src={article.image} 
                  alt={article.title} 
                  fill
                  className="object-cover" 
                />
            </div>
        ) : article.image_prompt ? (
             <div className="mb-12 p-8 rounded-2xl bg-white/5 border border-white/10 border-dashed text-center">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Image Prompt</p>
                <p className="text-slate-400 italic font-mono text-sm max-w-lg mx-auto">&quot;{article.image_prompt}&quot;</p>
            </div>
        ) : null}

        {/* Content */}
        <div className="selection:bg-indigo-500/30">
            <ReactMarkdown components={MarkdownComponents}>
              {article.content}
            </ReactMarkdown>
        </div>

        {/* Footer */}
        <div className="mt-20 pt-10 border-t border-white/10 flex justify-center">
            <Link 
              href="/learn"
              className="group flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-slate-400 hover:text-white"
            >
              <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-bold text-sm">返回 101 目录</span>
            </Link>
        </div>

      </article>

      <MarketingFooter />
    </div>
  );
}
