'use client';

import { useState, useMemo } from 'react';
import { Search, BookOpen, Clock, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@/context/LocaleContext';
import type { MessageKey } from '@/lib/i18n';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);

  // Mock data - in a real app, this would come from an API or static files
  const courses: CourseMetadata[] = useMemo(() => [
    {
      id: '1',
      title: 'ZISO 认知：为什么你需要 AI 席位？',
      description: '理解知守 AI 的核心设计哲学，以及它如何帮助你克服贪婪与恐惧。',
      category: 'The Mind',
      readingTime: 5,
      slug: 'intro-to-ziso-philosophy',
    },
    {
      id: '2',
      title: '量价背离：识别趋势反转的第一个信号',
      description: '深入学习如何通过成交量与价格的矛盾关系，预判市场潜在的变盘点。',
      category: 'The Method',
      readingTime: 8,
      slug: 'volume-price-divergence',
    },
    {
      id: '3',
      title: '仓位控制的艺术：知守 2-3-5 原则',
      description: '学习如何在不同市场环境下分配仓位，确保账户曲线的平滑与回撤控制。',
      category: 'The Money',
      readingTime: 6,
      slug: 'position-sizing-235',
    },
    {
      id: '4',
      title: '理解 AI 席位：不同性格的算法如何投票',
      description: '拆解知守议会下各席位的逻辑差异，从趋势跟随到价值对冲。',
      category: 'The Machine',
      readingTime: 7,
      slug: 'understanding-ai-seats',
    },
    {
      id: '5',
      title: '历史实战：2024 年 Q1 科技股调整复盘',
      description: '通过真实案例，看 AI 席位如何在剧烈波动中给出防守信号。',
      category: 'The Case',
      readingTime: 10,
      slug: '2024-q1-tech-review',
    },
  ], []);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          course.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || course.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [courses, searchQuery, selectedCategory]);

  if (selectedCourse) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#08090d] animate-in fade-in duration-300">
        <div className="sticky top-0 z-10 border-b border-white/5 bg-[#08090d]/80 backdrop-blur-md px-4 py-4">
          <button 
            onClick={() => setSelectedCourse(null)}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">{t('backToCatalog')}</span>
          </button>
        </div>
        
        <div className="p-6 text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">{t('loadFail')}</p>
        </div>
      </div>
    );
  }

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
                  onClick={() => setSelectedCourse(course.id)}
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
        </div>

        {/* Bottom Stats */}
        <div className="py-8 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-700">
            {t('statsGuides', { count: courses.length })} · {t('statsModules', { count: CATEGORIES.length - 1 })}
          </p>
        </div>
      </div>
    </div>
  );
}
