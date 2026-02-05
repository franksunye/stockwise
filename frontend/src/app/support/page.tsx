'use client';

import { useState, useMemo } from 'react';
import { 
  ChevronLeft, Search, Brain, Target, 
  ShieldCheck, Zap, RefreshCw, MessageCircle, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Content structure following the Manifesto logic
const SUPPORT_SECTIONS = [
  {
    id: 'get-started',
    title: '快速开始',
    subtitle: 'GETTING STARTED',
    icon: Zap,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    items: [
      { q: '什么是 PWA？', slug: 'what-is-pwa' },
      { q: 'iOS 如何安装 ZISO AI？', slug: 'install-ios' },
      { q: 'Android 如何安装 ZISO AI？', slug: 'install-android' },
      { q: '初次使用的 3 个核心动作', slug: 'first-moves' }
    ]
  },
  {
    id: 'ai-logic',
    title: '底层智能',
    subtitle: 'THE BRAIN',
    icon: Brain,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    items: [
      { q: '战术简报的推理逻辑', slug: 'brief-logic' },
      { q: '智囊团是如何“共鸣”的？', slug: 'ai-council' },
      { q: '为什么有 15 分钟的数据延迟？', slug: 'data-delay' },
      { q: '风险反思逻辑：对抗确认偏差', slug: 'counter-argument' }
    ]
  },
  {
    id: 'trading',
    title: '交易实战',
    subtitle: 'TRADING PERFORMANCE',
    icon: Target,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    items: [
      { q: '历史卡片：如何回顾过往？', slug: 'historical-cards' },
      { q: '验证系统的工作流程', slug: 'validation-logic' },
      { q: '持仓盈利 vs 亏损的战术差异', slug: 'scenario-tactics' },
      { q: '如何解读关键价位？', slug: 'key-levels' }
    ]
  },
  {
    id: 'account',
    title: '账号与安全',
    subtitle: 'IDENTITY & ACCOUNT',
    icon: ShieldCheck,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    items: [
      { q: '身份护照 (User ID) 的重要性', slug: 'identity-passport' },
      { q: '如何绑定恢复邮箱？', slug: 'recovery-email' },
      { q: '多端登录与权益恢复', slug: 'cross-device' },
      { q: '专业版与免费版的完整对比', slug: 'pro-vs-free' }
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

      <style jsx global>{`
        .glass-card { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); border-radius: 40px; }
      `}</style>
    </div>
  );
}
