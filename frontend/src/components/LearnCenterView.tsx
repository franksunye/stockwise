'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Brain, Zap, Shield, Sparkles, Target,
  ChevronRight, ChevronLeft, Loader2, Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface ArticleMeta {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  readingTime: number;
}

const CATEGORIES = [
  { id: 'The Mind', label: '心法篇', desc: '认知与决策心理学', icon: Brain, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  { id: 'The Method', label: '方法篇', desc: '技术面与量价分析', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { id: 'The Money', label: '资金篇', desc: '仓位管理与风控', icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { id: 'The Machine', label: '工具篇', desc: 'AI 投研机制', icon: Sparkles, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  { id: 'The Case', label: '案例篇', desc: '历史实战复盘', icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
];

export function LearnCenterView() {
  const [articles, setArticles] = useState<ArticleMeta[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [articleContent, setArticleContent] = useState<string | null>(null);
  const [articleMeta, setArticleMeta] = useState<ArticleMeta | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch catalog once on mount
  useEffect(() => {
    fetch('/api/learn')
      .then(res => res.json())
      .then((data: ArticleMeta[]) => {
        setArticles(data);
        setCatalogLoading(false);
      })
      .catch(() => setCatalogLoading(false));
  }, []);

  // Open article → fetch content on demand
  const openArticle = useCallback(async (slug: string) => {
    const meta = articles.find(a => a.slug === slug) || null;
    setSelectedSlug(slug);
    setArticleMeta(meta);
    setContentLoading(true);
    try {
      const res = await fetch(`/api/learn/${slug}`);
      const data = await res.json();
      setArticleContent(data.content);
    } catch {
      setArticleContent('> 加载失败，请稍后重试。');
    }
    setContentLoading(false);
  }, [articles]);

  const goBack = useCallback(() => {
    setSelectedSlug(null);
    setArticleContent(null);
    setArticleMeta(null);
  }, []);

  // Group articles by category, apply search filter
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return CATEGORIES.map(cat => ({
      ...cat,
      articles: articles
        .filter(a => a.category === cat.id)
        .filter(a => !q || a.title.toLowerCase().includes(q) || (a.subtitle && a.subtitle.toLowerCase().includes(q)))
    })).filter(cat => cat.articles.length > 0);
  }, [articles, searchQuery]);

  // ─── Article Detail View ───
  if (selectedSlug) {
    const catStyle = articleMeta ? CATEGORIES.find(c => c.id === articleMeta.category) : null;

    return (
      <motion.div
        key={`learn-${selectedSlug}`}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-slate-500 hover:text-white active:scale-95 transition-all py-1 -ml-1"
        >
          <ChevronLeft size={16} />
          <span className="text-[10px] font-bold uppercase tracking-wider">返回目录</span>
        </button>

        {/* Article header */}
        <div className="space-y-2">
          {catStyle && (
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full ${catStyle.bg} border ${catStyle.border} ${catStyle.color} text-[9px] font-black uppercase tracking-widest`}>
                {catStyle.label}
              </span>
              {articleMeta && (
                <span className="flex items-center gap-1 text-slate-600 text-[9px] font-bold">
                  <Clock size={10} />
                  {articleMeta.readingTime} 分钟
                </span>
              )}
            </div>
          )}
          <h3 className="text-lg font-black tracking-tight italic leading-snug text-white">
            {articleMeta?.title?.replace(/^101-\d+:\s*/, '') || ''}
          </h3>
          {articleMeta?.subtitle && (
            <p className="text-[13px] text-slate-500 font-medium">{articleMeta.subtitle}</p>
          )}
        </div>

        {/* Content */}
        {contentLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <article className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h2 className="text-base font-black text-white mt-6 mb-3 tracking-tight">{children}</h2>,
                h2: ({ children }) => <h3 className="text-sm font-black text-white mt-5 mb-2 border-l-2 border-indigo-500 pl-3">{children}</h3>,
                h3: ({ children }) => <h4 className="text-sm font-bold text-slate-200 mt-4 mb-2">{children}</h4>,
                p: ({ children }) => <p className="text-[13px] text-slate-400 leading-relaxed mb-3 font-medium">{children}</p>,
                ul: ({ children }) => <ul className="space-y-1.5 mb-3 list-none pl-0">{children}</ul>,
                ol: ({ children }) => <ol className="space-y-1.5 mb-3 list-none pl-0">{children}</ol>,
                li: ({ children }) => (
                  <li className="flex items-start gap-2 text-[13px] text-slate-400 font-medium">
                    <div className="mt-1.5 w-1 h-1 rounded-full bg-indigo-500 shrink-0 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
                    <span>{children}</span>
                  </li>
                ),
                strong: ({ children }) => <strong className="text-indigo-100 font-black">{children}</strong>,
                em: ({ children }) => <em className="text-slate-300 italic">{children}</em>,
                code: ({ children }) => <code className="text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                blockquote: ({ children }) => (
                  <div className="my-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-0.5 h-full bg-indigo-500/50" />
                    <span className="text-slate-400 text-[13px] font-medium leading-relaxed block pl-2.5 italic">{children}</span>
                  </div>
                ),
                hr: () => <hr className="border-white/5 my-5" />,
                a: ({ href, children }) => (
                  <a href={href} className="text-indigo-400 font-bold underline decoration-indigo-500/30 underline-offset-2 text-[13px]">
                    {children}
                  </a>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3 rounded-xl border border-white/5">
                    <table className="w-full text-xs">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-white/5">{children}</thead>,
                th: ({ children }) => <th className="px-3 py-2 text-left font-bold text-slate-300 text-[11px]">{children}</th>,
                td: ({ children }) => <td className="px-3 py-2 text-slate-400 border-t border-white/5 text-[11px]">{children}</td>,
              }}
            >
              {articleContent || ''}
            </ReactMarkdown>
          </article>
        )}
      </motion.div>
    );
  }

  // ─── Catalog View ───
  if (catalogLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      key="learn-list"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="space-y-5"
    >
      {/* Stats bar */}
      <div className="flex items-center justify-center gap-3 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
        <span><span className="text-white">{articles.length}</span> 篇指南</span>
        <span className="text-white/10">·</span>
        <span><span className="text-white">5</span> 大模块</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
        <input
          type="text"
          placeholder="搜索课程..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
        />
      </div>

      {/* Category sections */}
      {filteredCategories.map((cat) => {
        const Icon = cat.icon;
        return (
          <div key={cat.id} className="space-y-1.5">
            <div className="flex items-center gap-2.5 px-1 mb-1">
              <div className={`w-6 h-6 rounded-md ${cat.bg} ${cat.border} border flex items-center justify-center`}>
                <Icon size={12} className={cat.color} />
              </div>
              <div className="flex-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{cat.label}</span>
              </div>
              <span className="text-[9px] text-slate-700 font-bold">{cat.articles.length}</span>
            </div>

            <div className="bg-white/[0.02] rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
              {cat.articles.map((article) => (
                <button
                  key={article.slug}
                  onClick={() => openArticle(article.slug)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors text-left gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-slate-300 block truncate">
                      {article.title.replace(/^101-\d+:\s*/, '')}
                    </span>
                    {article.subtitle && (
                      <span className="text-[11px] text-slate-600 block truncate mt-0.5">{article.subtitle}</span>
                    )}
                  </div>
                  <ChevronRight size={14} className="text-slate-700 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {filteredCategories.length === 0 && (
        <div className="text-center py-10">
          <p className="text-sm text-slate-600 font-medium">没有找到相关课程</p>
        </div>
      )}
    </motion.div>
  );
}
