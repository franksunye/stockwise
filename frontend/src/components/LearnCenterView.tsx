'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, BookOpen, Clock, ChevronRight, Loader2, ChevronLeft, ExternalLink, Link2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useLocale, useT } from '@/context/LocaleContext';
import type { MessageKey } from '@/lib/i18n';
import { localizePublicPath, type PublicLocale } from '@/lib/public-i18n';

interface CourseMetadata {
  id: string;
  title: string;
  description: string;
  category: string;
  readingTime: number;
  slug: string;
}

interface LearnArticle {
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  category: string;
  content: string;
  readingTime: number;
}

const CATEGORIES: { id: string; labelKey: MessageKey<'learn'> }[] = [
  { id: 'all', labelKey: 'all' },
  { id: 'The Mind', labelKey: 'categories.The Mind' },
  { id: 'The Method', labelKey: 'categories.The Method' },
  { id: 'The Money', labelKey: 'categories.The Money' },
  { id: 'The Machine', labelKey: 'categories.The Machine' },
  { id: 'The Case', labelKey: 'categories.The Case' },
];


export function LearnCenterView() {
  const t = useT('learn');
  const { locale } = useLocale();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [courses, setCourses] = useState<CourseMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [article, setArticle] = useState<LearnArticle | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const listScrollYRef = useRef(0);

  const publicLocale: PublicLocale = locale === 'cn' ? 'cn' : 'en';

  useEffect(() => {
    const controller = new AbortController();

    async function loadCourses() {
      setIsLoading(true);
      setHasLoadError(false);

      try {
        const response = await fetch(`/api/learn?locale=${publicLocale}`, {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Failed to load learn catalog: ${response.status}`);
        }

        const data = (await response.json()) as Array<{
          slug: string;
          title: string;
          subtitle?: string;
          category: string;
          readingTime: number;
        }>;

        setCourses(
          data.map((article) => ({
            id: article.slug,
            slug: article.slug,
            title: article.title,
            description: article.subtitle || article.title,
            category: article.category,
            readingTime: article.readingTime,
          })),
        );
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
        setCourses([]);
        setHasLoadError(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadCourses();

    return () => controller.abort();
  }, [publicLocale]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          course.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || course.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [courses, searchQuery, selectedCategory]);

  const openArticle = async (slug: string) => {
    if (typeof window !== 'undefined') {
      listScrollYRef.current = window.scrollY;
    }
    setSelectedSlug(slug);
    setArticle(null);
    setArticleLoading(true);
    try {
      const response = await fetch(`/api/learn/${slug}?locale=${publicLocale}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`Failed to load article: ${response.status}`);
      }
      const data = (await response.json()) as LearnArticle;
      setArticle(data);
    } catch {
      setArticle(null);
    } finally {
      setArticleLoading(false);
    }
  };

  const articleHref = selectedSlug
    ? localizePublicPath(`/learn/${selectedSlug}`, publicLocale)
    : localizePublicPath('/learn', publicLocale);

  const handleCopyLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${articleHref}`);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1500);
    } catch {
      setCopiedLink(false);
    }
  };

  if (selectedSlug) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[#08090d]">
        <motion.div
          key={`learn-detail-${selectedSlug}`}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
          className="p-5 space-y-5 max-w-4xl mx-auto w-full"
        >
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setSelectedSlug(null);
                setArticle(null);
                requestAnimationFrame(() => {
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: listScrollYRef.current, behavior: 'auto' });
                  }
                });
                setCopiedLink(false);
              }}
              className="flex items-center gap-1.5 text-slate-500 hover:text-white active:scale-95 transition-all py-1 -ml-1"
            >
              <ChevronLeft size={16} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{t('backToCatalog')}</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleCopyLink()}
                className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-white transition-colors flex items-center gap-1"
              >
                {copiedLink ? <Check size={12} /> : <Link2 size={12} />}
                {copiedLink ? 'Copied' : 'Copy Link'}
              </button>
              <Link
                href={articleHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-white transition-colors flex items-center gap-1"
              >
                <ExternalLink size={12} />
                Open Page
              </Link>
            </div>
          </div>

          {articleLoading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
            </div>
          ) : !article ? (
            <div className="py-20 text-center space-y-3">
              <p className="text-slate-500 text-sm">{t('loadFail')}</p>
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                  Learn · {t(`categories.${article.category}` as MessageKey<'learn'>)}
                </p>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                    {t(`categories.${article.category}` as MessageKey<'learn'>)}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                    <Clock size={12} />
                    <span>{t('readingTime', { minutes: article.readingTime })}</span>
                  </div>
                </div>
                <h3 className="text-lg font-black tracking-tight italic leading-snug text-white">{article.title}</h3>
                {article.subtitle ? (
                  <p className="text-sm text-slate-400 leading-relaxed">{article.subtitle}</p>
                ) : null}
              </div>

              <article className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => <h3 className="text-base font-black text-slate-200 mt-6 mb-3">{children}</h3>,
                    h3: ({ children }) => <h4 className="text-sm font-bold text-slate-200 mt-5 mb-2">{children}</h4>,
                    p: ({ children }) => <p className="text-[13px] text-slate-400 leading-relaxed mb-3 font-medium">{children}</p>,
                    ul: ({ children }) => <ul className="space-y-2 mb-3 list-none pl-0">{children}</ul>,
                    ol: ({ children }) => <ol className="space-y-2 mb-3 list-none pl-0">{children}</ol>,
                    li: ({ children }) => (
                      <li className="flex items-start gap-2 text-[13px] text-slate-400 font-medium">
                        <div className="mt-1.5 w-1 h-1 rounded-full bg-indigo-500 shrink-0 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
                        <span>{children}</span>
                      </li>
                    ),
                    strong: ({ children }) => <strong className="text-indigo-100 font-black">{children}</strong>,
                    code: ({ children }) => <code className="text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                  }}
                >
                  {article.content}
                </ReactMarkdown>
              </article>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#08090d]">
      <div className="p-5 space-y-6 max-w-4xl mx-auto w-full">
        {/* Header Section */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                  selectedCategory === cat.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                    : 'bg-white/[0.03] border border-white/10 text-slate-500 hover:text-slate-300'
                }`}
              >
                {cat.id === 'all' ? 'All' : t(cat.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Course Grid */}
        <div className="grid gap-4">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
            </div>
          ) : hasLoadError ? (
            <div className="py-20 text-center space-y-3">
              <p className="text-slate-500 text-sm">{t('loadFail')}</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredCourses.length > 0 ? (
              filteredCourses.map((course, idx) => (
                <motion.button
                  key={course.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => void openArticle(course.slug)}
                  className="group relative text-left bg-white/[0.02] border border-white/5 rounded-[24px] p-5 hover:bg-white/[0.04] hover:border-white/10 transition-all active:scale-[0.98]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                      {t(`categories.${course.category}` as MessageKey<'learn'>)}
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                      <Clock size={12} />
                      <span>{t('readingTime', { minutes: course.readingTime })}</span>
                    </div>
                  </div>
                  
                  <h3 className="text-base font-black tracking-tight text-white group-hover:text-indigo-300 transition-colors">
                    {course.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400 line-clamp-2">
                    {course.description}
                  </p>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 group-hover:text-slate-400 transition-colors">ZISO ACADEMY</span>
                    <ChevronRight className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all" size={16} />
                  </div>
                </motion.button>
              ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-20 text-center space-y-3"
                >
                  <BookOpen className="w-12 h-12 text-slate-800 mx-auto opacity-50" />
                  <p className="text-slate-500 text-sm">{t('noResults')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* Bottom Stats */}
        <div className="py-8 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-700">
            {t('statsGuides', { count: courses.length })} · {t('statsModules', { count: CATEGORIES.length - 1 })}
          </p>
        </div>

        <div className="pb-6 text-center">
          <Link
            href={localizePublicPath('/learn', publicLocale)}
            className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-colors"
          >
            {t('backToCatalog')}
          </Link>
        </div>
      </div>
    </div>
  );
}
