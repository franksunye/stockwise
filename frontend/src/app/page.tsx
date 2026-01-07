'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, BarChart3, ChevronRight, Zap } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden font-sans">
      {/* 动态背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      {/* 顶部导航 */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Image 
            src="/logo.png" 
            alt="StockWise Logo" 
            width={40} 
            height={40} 
            className="rounded-xl"
          />
          <span className="text-xl font-black italic tracking-tighter">STOCKWISE <span className="text-indigo-500">X</span></span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-400">
          <Link href="#features" className="hover:text-white transition-colors">功能</Link>
          <Link href="#faq" className="hover:text-white transition-colors">FAQ</Link>
          <Link href="/dashboard" className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white">进入应用</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-40 flex flex-col items-center text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            AI 纪律合伙人
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter italic leading-tight">
            让交易 <br /> 
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">更简单，更智能</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">
            Plan the Trade, Trade the Plan. 用 AI 帮您在盘后冷静规划，在盘中理性执行。
          </p>
          <div className="pt-10 flex flex-col md:flex-row items-center justify-center gap-4">
            <Link 
              href="/dashboard" 
              className="px-10 py-5 rounded-3xl bg-indigo-500 text-white font-black italic text-lg shadow-[0_20px_40px_rgba(99,102,241,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              立刻开始体验 <ChevronRight size={20} />
            </Link>
            <button className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-white font-black text-lg hover:bg-white/10 transition-all">
              了解全部功能
            </button>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <section id="features" className="pt-60 grid md:grid-cols-3 gap-8 w-full">
          <div className="glass-card p-10 text-left border-indigo-500/10 bg-indigo-500/[0.02]">
            <div className="w-12 h-12 rounded-[20px] bg-indigo-500/10 flex items-center justify-center mb-6">
              <Zap className="text-indigo-400" />
            </div>
            <h3 className="text-xl font-black italic mb-3">盘后规划</h3>
            <p className="text-slate-500 text-sm leading-relaxed font-medium">市场收盘后，AI 自动整理当日得失，帮您在最冷静的时候制定明日作战计划。</p>
          </div>
          <div className="glass-card p-10 text-left border-purple-500/10 bg-purple-500/[0.02]">
            <div className="w-12 h-12 rounded-[20px] bg-purple-500/10 flex items-center justify-center mb-6">
              <ShieldCheck className="text-purple-400" />
            </div>
            <h3 className="text-xl font-black italic mb-3">风控熔断</h3>
            <p className="text-slate-500 text-sm leading-relaxed font-medium">当 AI 信心不足或指标混沌时，强制建议观望。不亏就是赚，本金优先。</p>
          </div>
          <div className="glass-card p-10 text-left border-emerald-500/10 bg-emerald-500/[0.02]">
            <div className="w-12 h-12 rounded-[20px] bg-emerald-500/10 flex items-center justify-center mb-6">
              <BarChart3 className="text-emerald-400" />
            </div>
            <h3 className="text-xl font-black italic mb-3">盘中执行</h3>
            <p className="text-slate-500 text-sm leading-relaxed font-medium">当行情触发昨晚设定的剧本时，推送提醒。让您像机器人一样冷静交易。</p>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-40 w-full max-w-5xl space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter">
              常见问题 <span className="text-indigo-500">FAQ</span>
            </h2>
            <p className="text-slate-400 font-medium">关于产品、AI 决策与量化规则</p>
          </div>

          {/* 产品相关 */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 pl-2">关于产品</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-card p-6 border-slate-500/10">
                <p className="text-white font-bold mb-2">StockWise X 是什么？</p>
                <p className="text-slate-400 text-sm">一款 AI 驱动的港股/A股决策辅助工具，帮助个人投资者做出更理性的交易决策。</p>
              </div>
              <div className="glass-card p-6 border-slate-500/10">
                <p className="text-white font-bold mb-2">支持哪些市场？</p>
                <p className="text-slate-400 text-sm">目前支持港股 (HK) 和 A 股 (CN) 市场。</p>
              </div>
              <div className="glass-card p-6 border-slate-500/10">
                <p className="text-white font-bold mb-2">数据多久更新一次？</p>
                <p className="text-slate-400 text-sm">盘中每 10 分钟同步一次实时行情，盘后进行全量日线更新。</p>
              </div>
              <div className="glass-card p-6 border-slate-500/10">
                <p className="text-white font-bold mb-2">免费使用吗？</p>
                <p className="text-slate-400 text-sm">基础功能免费。PRO 用户可解锁更多自选股监控额度和高级功能。</p>
              </div>
            </div>
          </div>

          {/* AI 决策相关 */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 pl-2">关于 AI 决策</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-card p-6 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
                <p className="text-white font-bold mb-2">AI 用的是什么模型？</p>
                <p className="text-slate-400 text-sm">我们使用 Google Gemini、DeepSeek 等大语言模型进行综合研判。</p>
              </div>
              <div className="glass-card p-6 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
                <p className="text-white font-bold mb-2">AI 的判断准确吗？</p>
                <p className="text-slate-400 text-sm">我们每日盘后自动验证 AI 预测准确率，历史胜率公开透明，可在个股页面查看。</p>
              </div>
              <div className="glass-card p-6 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
                <p className="text-white font-bold mb-2">为什么经常建议观望？</p>
                <p className="text-slate-400 text-sm">当 AI 置信度低于 75% 时，系统会自动熔断，强制输出观望以保护您的本金。</p>
              </div>
              <div className="glass-card p-6 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
                <p className="text-white font-bold mb-2">AI 会考虑新闻和基本面吗？</p>
                <p className="text-slate-400 text-sm">是的。AI 会综合分析公司简介、行业背景以及近期市场情绪。</p>
              </div>
            </div>
          </div>

          {/* 量化规则相关 */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-purple-400 pl-2">关于量化规则</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-card p-6 border-purple-500/10 bg-gradient-to-br from-purple-500/[0.02] to-transparent">
                <p className="text-white font-bold mb-2">信号是怎么判定的？</p>
                <p className="text-slate-400 text-sm">价格站上 MA20 → 做多；跌破 MA20 的 98% → 做空；RSI 在 45-55 震荡区 → 观望。</p>
              </div>
              <div className="glass-card p-6 border-purple-500/10 bg-gradient-to-br from-purple-500/[0.02] to-transparent">
                <p className="text-white font-bold mb-2">什么是 MA20？</p>
                <p className="text-slate-400 text-sm">20 日移动平均线。价格站上 MA20 视为多头趋势，跌破则视为空头趋势。</p>
              </div>
              <div className="glass-card p-6 border-purple-500/10 bg-gradient-to-br from-purple-500/[0.02] to-transparent">
                <p className="text-white font-bold mb-2">什么是 RSI？</p>
                <p className="text-slate-400 text-sm">相对强弱指数 (0-100)。RSI 在 45-55 区间表示市场震荡无方向，系统会建议观望。</p>
              </div>
              <div className="glass-card p-6 border-purple-500/10 bg-gradient-to-br from-purple-500/[0.02] to-transparent">
                <p className="text-white font-bold mb-2">什么是多周期共振？</p>
                <p className="text-slate-400 text-sm">当日线、周线、月线趋势方向一致时，信号置信度会显著提升（最高 88%）。</p>
              </div>
              <div className="glass-card p-6 border-purple-500/10 bg-gradient-to-br from-purple-500/[0.02] to-transparent">
                <p className="text-white font-bold mb-2">置信度百分比怎么算的？</p>
                <p className="text-slate-400 text-sm">基础置信度 65%，周线共振 +10%，月线共振 +13%。无共振或观望时为 50%。</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-20 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-2">
            <Image 
              src="/logo.png" 
              alt="StockWise Logo" 
              width={32} 
              height={32} 
              className="rounded-lg"
            />
            <span className="text-sm font-black italic tracking-tighter">STOCKWISE X</span>
          </div>
          <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">© 2025 STOCKWISE TECHNOLOGY. ALL RIGHTS RESERVED.</p>
          <div className="flex gap-6 text-xs font-bold text-slate-500">
            <Link href="#" className="hover:text-white transition-colors">隐私协议</Link>
            <Link href="#" className="hover:text-white transition-colors">服务条款</Link>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .glass-card { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 40px; }
      `}</style>
    </div>
  );
}
