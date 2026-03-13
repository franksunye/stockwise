'use client';

import { useState, useMemo } from 'react';
import {
  ChevronLeft, Search, Brain,
  ShieldCheck, Zap, RefreshCw, MessageCircle, ChevronRight,
  User, Gift, Bell, Cpu, Gauge
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import MarketingFooter from '@/components/MarketingFooter';

// Content structure following the Manifesto logic (40 articles across 8 sections)
const SUPPORT_SECTIONS = [
  {
    id: 'experience',
    title: '交互与导航',
    subtitle: 'EXPERIENCE & NAVIGATION',
    icon: Zap,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    items: [
      { q: '时光机模式 (Time Machine)', slug: 'time-machine-feed' },
      { q: '交互优先策略 (Interaction First)', slug: 'interaction-first' },
      { q: '横向滑动地图 (Snap-X)', slug: 'nav-map-logic' },
      { q: '性能自适应模式 (Auto-Perf)', slug: 'perf-adaptation' },
      { q: '深度链接引导 (Deep Linking)', slug: 'deep-linking-usage' },
      { q: 'TikTok 式沉浸滚动 (Snap-Y)', slug: 'snap-y-dynamics' },
      { q: '搜索联想与秒速响应', slug: 'smart-search' },
      { q: 'iOS 专项性能优化 (Safari)', slug: 'ios-tuning' },
      { q: '沉浸式投资模式配置 (Investment Mode)', slug: 'investment-mode-config' }
    ]
  },
  {
    id: 'ai-logic',
    title: 'AI 智慧与分析',
    subtitle: 'THE BRAIN',
    icon: Brain,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    items: [
      { q: 'AI 智囊团：群体决策机制', slug: 'ai-council-logic' },
      { q: '战术简报解读 (Tactical Brief)', slug: 'tactical-brief-guide' },
      { q: '关键价位图解 (Key Levels)', slug: 'key-levels-mapping' },
      { q: '回看历史矩阵 (Review Matrix)', slug: 'history-matrix-viz' },
      { q: '智能上下文提取机制', slug: 'context-extraction' },
      { q: '失败回溯审计 (Failure Audit)', slug: 'failure-retrospective' }
    ]
  },
  {
    id: 'quant',
    title: '量化逻辑与纪律',
    subtitle: 'QUANT LOGIC & DISCIPLINE',
    icon: Gauge,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    items: [
      { q: '严格模式：防未来函数', slug: 'anti-future-function' },
      { q: '智能标题逻辑 (Smart Title)', slug: 'smart-title-logic' },
      { q: 'RSI 颜色隐喻 (RSI Metaphor)', slug: 'rsi-color-metaphor' },
      { q: '脉冲与共振 (Pulse Logic)', slug: 'ai-pulse-resonance' },
      { q: '置信度百分比解读', slug: 'confidence-explained' },
      { q: '触感反馈的心理暗示', slug: 'haptic-sync' },
      { q: '四态交易决策语义 (4-States)', slug: 'four-states-semantics' }
    ]
  },
  {
    id: 'trust',
    title: '验证与诚信',
    subtitle: 'VALIDATION & TRUST',
    icon: ShieldCheck,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    items: [
      { q: 'T+3 多日验证机制', slug: 'multi-day-verification' },
      { q: '验证的三种状态说明', slug: 'verification-states' },
      { q: '失败的价值 (Value of Failure)', slug: 'value-of-failure' },
      { q: '双轨生产与验证池 (Dual-Lane)', slug: 'dual-lane-architecture' }
    ]
  },
  {
    id: 'account',
    title: '账号与安全',
    subtitle: 'IDENTITY & SECURITY',
    icon: User,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    items: [
      { q: '身份护照系统 (Identity ID)', slug: 'identity-passport' },
      { q: '邮箱绑定机制 (Email)', slug: 'email-sync-logic' },
      { q: '身份找回流程 (Recovery)', slug: 'identity-restore-flow' },
      { q: '隐私承诺 (Privacy Pledge)', slug: 'privacy-pledge' },
      { q: '角标清除与数字减压', slug: 'badge-hygiene' }
    ]
  },
  {
    id: 'growth',
    title: '权益与增长',
    subtitle: 'BENEFITS & GROWTH',
    icon: Gift,
    color: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/20',
    items: [
      { q: '推荐激励 (Referral Rewards)', slug: 'referral-rewards' },
      { q: '渠道分润看板 (Partners)', slug: 'channel-revenue-guide' },
      { q: '权益兑换码 (Redeem Codes)', slug: 'redeem-code-usage' },
      { q: '免费版与 Pro 版对比', slug: 'tiers-explained' },
      { q: '邀请码分发与获取 (Invitation Ops)', slug: 'invitation-ops-guide' }
    ]
  },
  {
    id: 'notifications',
    title: '通知与触达',
    subtitle: 'NOTIFICATIONS',
    icon: Bell,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    items: [
      { q: '智能反转推送逻辑', slug: 'signal-flip-push' },
      { q: '精细化控制面板', slug: 'notification-preference' },
      { q: 'Web Push 开启指南', slug: 'web-push-setup' },
      { q: '通知连通性测试工具', slug: 'push-debug' }
    ]
  },
  {
    id: 'infra',
    title: '数据与服务保障',
    subtitle: 'INFRASTRUCTURE',
    icon: Cpu,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    items: [
      { q: '乐观更新机制 (Optimistic)', slug: 'optimistic-ui-logic' },
      { q: '实时盘中拼接技术', slug: 'realtime-data-splicing' },
      { q: '按需同步调度算法', slug: 'on-demand-sync' },
      { q: '多源降级数据保障', slug: 'data-resiliency' }
    ]
  }
];

export default function SupportPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSections = useMemo(() => {
    if (!searchQuery) return SUPPORT_SECTIONS;
    return SUPPORT_SECTIONS.map(section => ({
      ...section,
      items: section.items.filter(item => 
        item.q.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(section => section.items.length > 0);
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-indigo-500/30">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-[60] bg-[#050508]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/5 active:scale-95 transition-all text-slate-400 hover:text-white">
            <ChevronLeft size={20} />
          </Link>
          <div className="font-bold text-lg tracking-tight italic">
            ZISO <span className="text-indigo-500">SUPPORT</span>
          </div>
          <div className="w-8" />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12 pb-32">
        {/* Hero Section */}
        <section className="text-center space-y-8 mb-20">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic leading-tight">
              构建你的 <span className="bg-gradient-to-r from-indigo-500 via-purple-300 to-indigo-500 bg-clip-text text-transparent">理性交易优势</span>
            </h1>
            <p className="text-slate-500 max-w-xl mx-auto text-sm md:text-base font-medium">
              不仅是工具的使用说明，更是 AI 驱动的职业交易员思维蓝图。
            </p>
          </div>

          {/* World-class Search Bar */}
          <div className="max-w-2xl mx-auto relative group">
            <div className="absolute inset-0 bg-indigo-500/10 blur-xl group-focus-within:bg-indigo-500/20 transition-all rounded-full" />
            <div className="relative flex items-center bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 transition-all group-focus-within:border-indigo-500/50 group-focus-within:bg-white/[0.05]">
              <Search className="w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 mr-4 transition-colors" />
              <input 
                type="text" 
                placeholder="搜索问题、功能或 AI 逻辑 (例如: PWA 安装)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none w-full text-sm font-medium placeholder:text-slate-600"
              />
              <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-black text-slate-600">
                <span className="text-[12px]">⌘</span> K
              </div>
            </div>
          </div>
        </section>

        {/* Bento Grid Sections */}
        <div className="grid md:grid-cols-2 gap-8">
          {filteredSections.map((section, idx) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              key={section.id}
              className="glass-card p-8 rounded-[32px] border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-all group overflow-hidden relative"
            >
              <div className={`absolute -top-10 -right-10 w-32 h-32 ${section.bg} blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity`} />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div className={`w-14 h-14 rounded-2xl ${section.bg} ${section.border} border flex items-center justify-center`}>
                    <section.icon size={24} className={section.color} />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">{section.subtitle}</p>
                    <h2 className="text-xl font-black italic mt-1">{section.title}</h2>
                  </div>
                </div>

                <div className="space-y-4">
                  {section.items.map((item, i) => (
                    <Link 
                      key={i} 
                      href={`/support/${item.slug}`} 
                      className="flex items-center justify-between group/link py-1 hover:pl-2 transition-all"
                    >
                      <span className="text-sm font-medium text-slate-400 group-hover/link:text-white transition-colors">
                        {item.q}
                      </span>
                      <ChevronRight size={14} className="text-slate-700 group-hover/link:text-indigo-400 transition-all" />
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom Support Channels */}
        <section className="mt-32 pt-20 border-t border-white/5">
           <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: '开发者社区', desc: '参与 ZISO AI 的开源逻辑讨论', icon: MessageCircle, link: '#' },
                { title: '人工申诉', desc: '账号恢复、支付异常处理', icon: ShieldCheck, link: '/pricing' },
                { title: '系统状态', desc: '检查 AI 节点与数据同步心跳', icon: RefreshCw, link: '/status' }
              ].map((channel, i) => (
                <Link key={i} href={channel.link} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/30 transition-all text-center group">
                   <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <channel.icon size={18} className="text-indigo-400" />
                   </div>
                   <h4 className="text-sm font-bold mb-1">{channel.title}</h4>
                   <p className="text-xs text-slate-600 font-medium">{channel.desc}</p>
                </Link>
              ))}
           </div>
        </section>
      </main>

      <MarketingFooter />

      <style jsx global>{`
        .glass-card { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); border-radius: 40px; }
      `}</style>
    </div>
  );
}
