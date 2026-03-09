'use client';

import { useState, useMemo } from 'react';
import {
  Search, Brain, ShieldCheck, Zap,
  ChevronRight, ChevronLeft, Calendar,
  User, Gift, Bell, Cpu, Gauge
} from 'lucide-react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

import type { SupportArticle } from '@/lib/support-content';

// Mirror the same section structure as the web support page
// Data source: support-content.ts (shared with /support web pages)
const SECTIONS = [
  {
    id: 'experience', title: '交互与导航', icon: Zap,
    color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
    items: [
      { q: '时光机模式 (Time Machine)', slug: 'time-machine-feed' },
      { q: '交互优先策略 (Interaction First)', slug: 'interaction-first' },
      { q: '横向滑动地图 (Snap-X)', slug: 'nav-map-logic' },
      { q: '性能自适应模式 (Auto-Perf)', slug: 'perf-adaptation' },
      { q: '深度链接引导 (Deep Linking)', slug: 'deep-linking-usage' },
      { q: 'TikTok 式沉浸滚动 (Snap-Y)', slug: 'snap-y-dynamics' },
      { q: '搜索联想与秒速响应', slug: 'smart-search' },
      { q: 'iOS 专项性能优化 (Safari)', slug: 'ios-tuning' }
    ]
  },
  {
    id: 'ai-logic', title: 'AI 智慧与分析', icon: Brain,
    color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20',
    items: [
      { q: '投研决议：多维度共识', slug: 'ai-council-logic' },
      { q: '策略内参解读 (Tactical Brief)', slug: 'tactical-brief-guide' },
      { q: '关键价位图解 (Key Levels)', slug: 'key-levels-mapping' },
      { q: '胜率历史矩阵 (Win-Rate)', slug: 'history-matrix-viz' },
      { q: '智能上下文提取机制', slug: 'context-extraction' },
      { q: '失败回溯审计 (Failure Audit)', slug: 'failure-retrospective' }
    ]
  },
  {
    id: 'quant', title: '量化逻辑与纪律', icon: Gauge,
    color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20',
    items: [
      { q: '严格模式：防未来函数', slug: 'anti-future-function' },
      { q: '智能标题逻辑 (Smart Title)', slug: 'smart-title-logic' },
      { q: 'RSI 颜色隐喻 (RSI Metaphor)', slug: 'rsi-color-metaphor' },
      { q: '脉冲与共振 (Pulse Logic)', slug: 'ai-pulse-resonance' },
      { q: '置信度百分比解读', slug: 'confidence-explained' },
      { q: '触感反馈的心理暗示', slug: 'haptic-sync' }
    ]
  },
  {
    id: 'trust', title: '验证与诚信', icon: ShieldCheck,
    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
    items: [
      { q: 'T+3 多日验证机制', slug: 'multi-day-verification' },
      { q: '验证的三种状态说明', slug: 'verification-states' },
      { q: '失败的价值 (Value of Failure)', slug: 'value-of-failure' }
    ]
  },
  {
    id: 'account', title: '账号与安全', icon: User,
    color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20',
    items: [
      { q: '身份护照系统 (Identity ID)', slug: 'identity-passport' },
      { q: '邮箱绑定机制 (Email)', slug: 'email-sync-logic' },
      { q: '身份找回流程 (Recovery)', slug: 'identity-restore-flow' },
      { q: '隐私承诺 (Privacy Pledge)', slug: 'privacy-pledge' },
      { q: '角标清除与数字减压', slug: 'badge-hygiene' }
    ]
  },
  {
    id: 'growth', title: '权益与增长', icon: Gift,
    color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20',
    items: [
      { q: '推荐激励 (Referral Rewards)', slug: 'referral-rewards' },
      { q: '渠道分润看板 (Partners)', slug: 'channel-revenue-guide' },
      { q: '权益兑换码 (Redeem Codes)', slug: 'redeem-code-usage' },
      { q: '免费版与 Pro 版对比', slug: 'tiers-explained' }
    ]
  },
  {
    id: 'notifications', title: '通知与触达', icon: Bell,
    color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20',
    items: [
      { q: '智能反转推送逻辑', slug: 'signal-flip-push' },
      { q: '精细化控制面板', slug: 'notification-preference' },
      { q: 'Web Push 开启指南', slug: 'web-push-setup' },
      { q: '通知连通性测试工具', slug: 'push-debug' }
    ]
  },
  {
    id: 'infra', title: '数据与服务保障', icon: Cpu,
    color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20',
    items: [
      { q: '乐观更新机制 (Optimistic)', slug: 'optimistic-ui-logic' },
      { q: '实时盘中拼接技术', slug: 'realtime-data-splicing' },
      { q: '按需同步调度算法', slug: 'on-demand-sync' },
      { q: '多源降级数据保障', slug: 'data-resiliency' }
    ]
  }
];

export function SupportCenterView() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [article, setArticle] = useState<SupportArticle | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);

  const handleSelectSlug = async (slug: string) => {
    setSelectedSlug(slug);
    setArticleLoading(true);
    try {
      const res = await fetch(`/api/support/${slug}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setArticle(data);
    } catch {
      setArticle(null);
    }
    setArticleLoading(false);
  };

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
          onClick={() => { setSelectedSlug(null); setArticle(null); }}
          className="flex items-center gap-1.5 text-slate-500 hover:text-white active:scale-95 transition-all py-1 -ml-1"
        >
          <ChevronLeft size={16} />
          <span className="text-[10px] font-bold uppercase tracking-wider">返回列表</span>
        </button>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-widest">
              {article.category || '加载中...'}
            </span>
            <div className="flex items-center gap-1 text-slate-600 text-[9px] font-bold">
              <Calendar size={10} />
              {article.lastUpdated || ''}
            </div>
          </div>
          <h3 className="text-lg font-black tracking-tight italic leading-snug text-white">
            {article.title || '加载中...'}
          </h3>
        </div>

        {articleLoading ? (
            <div className="flex items-center justify-center py-10 opacity-50">
                <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
        ) : (
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
                  onClick={() => handleSelectSlug(item.slug)}
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
