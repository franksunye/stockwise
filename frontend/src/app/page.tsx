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
          <Link href="#preview" className="hover:text-white transition-colors">预览</Link>
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
            AI 驱动的炒股决策助手
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter italic leading-tight">
            让交易 <br /> 
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">更简单，更智能</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 font-medium max-w-xl mx-auto leading-relaxed">
            极致简约的港股 AI 决策系统。实时监控、深度复盘、智能决策，专为追求效率的交易者打造。
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
            <h3 className="text-xl font-black italic mb-3">实时监控</h3>
            <p className="text-slate-500 text-sm leading-relaxed font-medium">每 10 分钟同步一次市场数据，结合大模型深度分析，为您提供即时决策支持。</p>
          </div>
          <div className="glass-card p-10 text-left border-purple-500/10 bg-purple-500/[0.02]">
            <div className="w-12 h-12 rounded-[20px] bg-purple-500/10 flex items-center justify-center mb-6">
              <ShieldCheck className="text-purple-400" />
            </div>
            <h3 className="text-xl font-black italic mb-3">多维验证</h3>
            <p className="text-slate-500 text-sm leading-relaxed font-medium">独创的 AI 预测验证系统，每日盘后自动复盘，确保 AI 指标的真实有效性。</p>
          </div>
          <div className="glass-card p-10 text-left border-emerald-500/10 bg-emerald-500/[0.02]">
            <div className="w-12 h-12 rounded-[20px] bg-emerald-500/10 flex items-center justify-center mb-6">
              <BarChart3 className="text-emerald-400" />
            </div>
            <h3 className="text-xl font-black italic mb-3">极致复盘</h3>
            <p className="text-slate-500 text-sm leading-relaxed font-medium">完整的历史预测轨迹，清晰的盈亏分析，让您在实战前就已经心中有数。</p>
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
