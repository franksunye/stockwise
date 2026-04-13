'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, BookOpen, Clock, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [courses, setCourses] = useState<CourseMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

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

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#08090d]">
      <div className="p-5 space-y-6">
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
                  onClick={() => router.push(localizePublicPath(`/learn/${course.slug}`, publicLocale))}
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
