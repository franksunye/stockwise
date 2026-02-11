'use client';

import { useState, useMemo } from 'react';
import {
  Search, Brain, Target, ShieldCheck, Zap,
  ChevronRight, ChevronLeft, Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { getArticleBySlug } from '@/lib/support-content';

// Mirror the same section structure as the web support page
// Data source: support-content.ts (shared with /support web pages)
const SECTIONS = [
  {
    id: 'get-started', title: '快速开始', icon: Zap,
    color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
    items: [
      { q: '什么是 PWA？', slug: 'what-is-pwa' },
      { q: 'iOS 如何安装？', slug: 'install-ios' },
      { q: 'Android 如何安装？', slug: 'install-android' },
      { q: '初次入场 3 个核心动作', slug: 'first-moves' }
    ]
  },
  {
    id: 'ai-logic', title: '底层智能', icon: Brain,
    color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20',
    items: [
      { q: '战术简报的推理逻辑', slug: 'brief-logic' },
      { q: '智囊团是如何"共鸣"的？', slug: 'ai-council' },
      { q: '为什么有数据延迟？', slug: 'data-delay' },
      { q: '风险反思：对抗确认偏差', slug: 'counter-argument' }
    ]
  },
  {
    id: 'trading', title: '交易实战', icon: Target,
    color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20',
    items: [
      { q: '历史卡片：如何回顾？', slug: 'historical-cards' },
      { q: '验证系统工作流程', slug: 'validation-logic' },
      { q: '盈利与亏损战术差异', slug: 'scenario-tactics' },
      { q: '如何解读关键价位？', slug: 'key-levels' }
    ]
  },
  {
    id: 'account', title: '账号与安全', icon: ShieldCheck,
    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
    items: [
      { q: '身份护照的重要性', slug: 'identity-passport' },
      { q: '如何绑定恢复邮箱？', slug: 'recovery-email' },
      { q: '多端登录与权益同步', slug: 'cross-device' },
      { q: '专业版与免费版对比', slug: 'pro-vs-free' }
    ]
  }
];

export function SupportCenterView() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const article = selectedSlug ? getArticleBySlug(selectedSlug) : null;

  const filteredSections = useMemo(() => {
    if (!searchQuery) return SECTIONS;
    const q = searchQuery.toLowerCase();
    return SECTIONS.map(s => ({
      ...s,
      items: s.items.filter(item => item.q.toLowerCase().includes(q))
    })).filter(s => s.items.length > 0);
  }, [searchQuery]);

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
          onClick={() => setSelectedSlug(null)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-white active:scale-95 transition-all py-1 -ml-1"
        >
          <ChevronLeft size={16} />
          <span className="text-[10px] font-bold uppercase tracking-wider">返回列表</span>
        </button>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-widest">
              {article.category}
            </span>
            <div className="flex items-center gap-1 text-slate-600 text-[9px] font-bold">
              <Calendar size={10} />
              {article.lastUpdated}
            </div>
          </div>
          <h3 className="text-lg font-black tracking-tight italic leading-snug text-white">
            {article.title}
          </h3>
        </div>

        <article className="prose prose-invert prose-sm max-w-none">
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
            {article.content}
          </ReactMarkdown>
        </article>
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
          placeholder="搜索问题..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
        />
      </div>

      {/* Sections */}
      {filteredSections.map((section) => {
        const Icon = section.icon;
        return (
          <div key={section.id} className="space-y-1.5">
            <div className="flex items-center gap-2.5 px-1 mb-1">
              <div className={`w-6 h-6 rounded-md ${section.bg} ${section.border} border flex items-center justify-center`}>
                <Icon size={12} className={section.color} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{section.title}</span>
            </div>

            <div className="bg-white/[0.02] rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
              {section.items.map((item) => (
                <button
                  key={item.slug}
                  onClick={() => setSelectedSlug(item.slug)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors text-left"
                >
                  <span className="text-[13px] font-medium text-slate-300">{item.q}</span>
                  <ChevronRight size={14} className="text-slate-700 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {filteredSections.length === 0 && (
        <div className="text-center py-10">
          <p className="text-sm text-slate-600 font-medium">没有找到相关问题</p>
        </div>
      )}
    </motion.div>
  );
}
