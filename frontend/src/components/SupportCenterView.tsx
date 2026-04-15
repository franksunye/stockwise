'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Search, Brain, ShieldCheck, Zap,
  ChevronRight, ChevronLeft, Calendar,
  User, Gift, Bell, Cpu, Gauge
} from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useLocale, useT } from '@/context/LocaleContext';
import type { MessageKey } from '@/lib/i18n';
import type { PublicLocale } from '@/lib/public-i18n';

import type { SupportArticle } from '@/lib/support-content';

interface Section {
  id: string;
  icon: typeof Zap;
  color: string;
  bg: string;
  border: string;
  items: { title: string; slug: string }[];
}

const EN_TITLE_OVERRIDES: Record<string, string> = {
  'smart-search': 'Smart Search & Instant Response',
  'context-extraction': 'Intelligent Context Extraction',
  'confidence-explained': 'How Confidence Percentage Works',
  'badge-hygiene': 'Badge Hygiene and Count Cleanup',
  'signal-flip-push': 'Signal Reversal Push Logic',
  'notification-preference': 'Notification Control Panel',
  'push-debug': 'Push Connectivity Test Tool',
  'realtime-data-splicing': 'Real-time Market Data Splicing',
  'on-demand-sync': 'On-demand Sync Scheduler',
  'data-resiliency': 'Multi-source Data Resiliency',
};

const SECTION_META: Omit<Section, 'items'>[] = [
  {
    id: 'experience', icon: Zap,
    color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
  },
  {
    id: 'ai-logic', icon: Brain,
    color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20',
  },
  {
    id: 'quant', icon: Gauge,
    color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20',
  },
  {
    id: 'trust', icon: ShieldCheck,
    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
  },
  {
    id: 'account', icon: User,
    color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20',
  },
  {
    id: 'growth', icon: Gift,
    color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20',
  },
  {
    id: 'notifications', icon: Bell,
    color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20',
  },
  {
    id: 'infra', icon: Cpu,
    color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20',
  }
];

export function SupportCenterView() {
  const t = useT('support');
  const { locale } = useLocale();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [article, setArticle] = useState<SupportArticle | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [catalogBySlug, setCatalogBySlug] = useState<Record<string, SupportArticle>>({});
  const [catalogLoading, setCatalogLoading] = useState(true);
  const publicLocale: PublicLocale = locale === 'cn' ? 'cn' : 'en';

  const handleSelectSlug = async (slug: string) => {
    setSelectedSlug(slug);
    setArticleLoading(true);
    try {
      const res = await fetch(`/api/support/${slug}?locale=${publicLocale}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setArticle(data);
    } catch {
      setArticle(null);
    }
    setArticleLoading(false);
  };

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setCatalogLoading(true);

    async function loadCatalog() {
      try {
        const res = await fetch(`/api/support?locale=${publicLocale}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to load support catalog');
        const data = (await res.json()) as SupportArticle[];
        if (!alive) return;
        const next: Record<string, SupportArticle> = {};
        for (const entry of data) {
          next[entry.slug] = entry;
        }
        setCatalogBySlug(next);
      } catch {
        if (!alive) return;
        setCatalogBySlug({});
      } finally {
        if (!alive) return;
        setCatalogLoading(false);
      }
    }

    void loadCatalog();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [publicLocale]);

  const getDisplayQuestion = (articleEntry: SupportArticle) => {
    if (locale === 'cn') {
      return articleEntry.title;
    }

    if (articleEntry.sourceLocale !== 'cn') {
      return articleEntry.title;
    }

    const override = EN_TITLE_OVERRIDES[articleEntry.slug];
    if (override) {
      return override;
    }

    const trailingEnglish = articleEntry.title.match(/\(([^)]+)\)\s*$/);
    if (trailingEnglish?.[1]) {
      return trailingEnglish[1];
    }

    return articleEntry.title;
  };

  const resolveSectionId = (articleEntry: SupportArticle): string => {
    const slug = articleEntry.slug.toLowerCase();
    const category = (articleEntry.category || '').toLowerCase();

    if (slug.includes('push') || slug.includes('notification') || slug.includes('signal-flip')) return 'notifications';
    if (slug.includes('identity') || slug.includes('email') || slug.includes('privacy') || slug.includes('badge')) return 'account';
    if (slug.includes('redeem') || slug.includes('referral') || slug.includes('tier') || slug.includes('quota') || slug.includes('channel')) return 'growth';
    if (slug.includes('verification') || slug.includes('failure')) return 'trust';
    if (slug.includes('optimistic') || slug.includes('realtime') || slug.includes('sync') || slug.includes('resilien') || slug.includes('infra') || slug.includes('zero-stale')) return 'infra';
    if (slug.includes('rsi') || slug.includes('confidence') || slug.includes('future') || slug.includes('tradeability') || slug.includes('pulse')) return 'quant';
    if (slug.includes('ai-') || slug.includes('tactical') || slug.includes('key-level') || slug.includes('matrix') || slug.includes('context')) return 'ai-logic';

    if (category.includes('通知')) return 'notifications';
    if (category.includes('账号') || category.includes('security')) return 'account';
    if (category.includes('增长') || category.includes('growth') || category.includes('tiers')) return 'growth';
    if (category.includes('验证') || category.includes('trust')) return 'trust';
    if (category.includes('数据') || category.includes('engineering') || category.includes('infra')) return 'infra';
    if (category.includes('量化') || category.includes('discipline')) return 'quant';
    if (category.includes('ai') || category.includes('logic') || category.includes('engine')) return 'ai-logic';

    return 'experience';
  };

  const filteredSections = useMemo(() => {
    const sectionMap = new Map<string, Section>(
      SECTION_META.map((meta) => [meta.id, { ...meta, items: [] }]),
    );

    const articles = Object.values(catalogBySlug);
    for (const articleEntry of articles) {
      const sectionId = resolveSectionId(articleEntry);
      const section = sectionMap.get(sectionId) || sectionMap.get('experience');
      if (!section) continue;
      section.items.push({
        slug: articleEntry.slug,
        title: getDisplayQuestion(articleEntry),
      });
    }

    for (const section of sectionMap.values()) {
      section.items.sort((a, b) => a.title.localeCompare(b.title));
    }

    const q = searchQuery.toLowerCase();
    const built = SECTION_META
      .map((meta) => sectionMap.get(meta.id)!)
      .map((section) => {
        if (!searchQuery) return section;
        return {
          ...section,
          items: section.items.filter((item) => item.title.toLowerCase().includes(q)),
        };
      })
      .filter((section) => section.items.length > 0);

    return built;
  }, [catalogBySlug, searchQuery, locale]);

  // ─── Article Detail View ───
  if (article) {
    return (
      <motion.div
        key={`detail-${selectedSlug}`}
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-5"
      >
        <button
          onClick={() => { setSelectedSlug(null); setArticle(null); }}
           className="flex items-center gap-1.5 text-slate-500 hover:text-white active:scale-95 transition-all py-1 -ml-1"
        >
          <ChevronLeft size={16} />
          <span className="text-[10px] font-bold uppercase tracking-wider">{t('backToList')}</span>
        </button>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-widest">
              {article.category || t('loading')}
            </span>
            {article.isFallback && article.sourceLocale === 'cn' ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[9px] font-black uppercase tracking-widest">
                {t('fallbackBadge')}
              </span>
            ) : null}
            <div className="flex items-center gap-1 text-slate-600 text-[9px] font-bold">
              <Calendar size={10} />
              {article.lastUpdated || ''}
            </div>
          </div>
          <h3 className="text-lg font-black tracking-tight italic leading-snug text-white">
            {article.title || t('loading')}
          </h3>
        </div>

        {articleLoading ? (
            <div className="flex items-center justify-center py-10 opacity-50">
                <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
        ) : (
            <article className="prose prose-invert prose-sm max-w-none">
              {article.isFallback && article.sourceLocale === 'cn' && locale !== 'cn' ? (
                <p className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-200 not-prose">
                  {t('fallbackNotice')}
                </p>
              ) : null}
              <ReactMarkdown
                components={{
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
                  blockquote: ({ children }) => (
                    <div className="my-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-0.5 h-full bg-indigo-500/50" />
                      <span className="text-slate-400 text-[13px] font-medium leading-relaxed block pl-2.5">{children}</span>
                    </div>
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
              {article.content || ''}
            </ReactMarkdown>
          </article>
        )}
      </motion.div>
    );
  }

  // ─── List View ───
  return (
    <motion.div
      key="list"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="space-y-5"
    >
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
        />
      </div>

      {/* Sections */}
      {catalogLoading && filteredSections.length === 0 ? (
        <div className="flex items-center justify-center py-10 opacity-50">
          <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : null}
      {filteredSections.map((section) => {
        const Icon = section.icon;
        return (
          <div key={section.id} className="space-y-1.5">
            <div className="flex items-center gap-2.5 px-1 mb-1">
              <div className={`w-6 h-6 rounded-md ${section.bg} ${section.border} border flex items-center justify-center`}>
                <Icon size={12} className={section.color} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t(`sections.${section.id}` as MessageKey<'support'>)}</span>
            </div>

            <div className="bg-white/[0.02] rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
              {section.items.map((item) => (
                <button
                  key={item.slug}
                  onClick={() => handleSelectSlug(item.slug)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors text-left"
                >
                  <span className="text-[13px] font-medium text-slate-300">{item.title}</span>
                  <ChevronRight size={14} className="text-slate-700 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {filteredSections.length === 0 && (
        <div className="text-center py-10">
          <p className="text-sm text-slate-600 font-medium">{t('noResults')}</p>
        </div>
      )}
    </motion.div>
  );
}
