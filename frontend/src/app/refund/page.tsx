'use client';

import { motion } from 'framer-motion';
import { RefreshCcw, ChevronLeft, Calendar } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden font-sans">
      {/* 动态背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <nav className="relative z-50 flex items-center justify-between px-8 py-8 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Logo" width={32} height={32} className="rounded-lg" />
          <span className="text-lg font-black italic tracking-tighter">STOCKWISE <span className="text-indigo-500">AI</span></span>
        </Link>
        <Link href="/" className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
          <ChevronLeft size={16} /> 返回首页
        </Link>
      </nav>

      <main className="relative z-10 max-w-3xl mx-auto px-8 py-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest">
              <RefreshCcw size={12} /> Billing
            </div>
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter">退款政策 <span className="text-indigo-500">Refund Policy</span></h1>
            <p className="text-slate-400 text-sm">最近更新日期：2026年1月27日</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-card p-6 border-indigo-500/20 bg-indigo-500/[0.05] space-y-3">
              <Calendar className="text-indigo-400" size={24} />
              <h3 className="font-bold text-white">48小时冷静期</h3>
              <p className="text-slate-400 text-xs leading-relaxed">初次订阅 Pro 会员后的 48 小时内，如果您对服务不满意，可申请全额退款。</p>
            </div>
            <div className="glass-card p-6 border-white/5 bg-white/[0.02] space-y-3">
              <RefreshCcw className="text-slate-400" size={24} />
              <h3 className="font-bold text-white">随时取消订阅</h3>
              <p className="text-slate-400 text-xs leading-relaxed">您可以随时在管理面板中取消续订，当前周期内的会员功能将持续有效直至结束。</p>
            </div>
          </div>

          <div className="glass-card p-8 md:p-12 space-y-8 border-white/5 bg-white/[0.01]">
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">1. 退款条件</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                全额退款保证仅适用于**首次订阅**的用户，且申请必须在订阅成功后的 48 小时内提出。对于重复订阅或已享受过退款政策的用户，不适用此规则。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">2. 申请流程</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                要申请退款，请发送邮件至 <span className="text-indigo-400 font-bold">refunds@visutry.com</span>。邮件主题请注明：[退款申请] + 您的账户邮箱。我们通常在 1-3 个工作日内处理。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">3. 处理时间</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                一旦退款被批准，款项将通过 Stripe 退回至您的原始支付渠道。退款到账时间取决于银行的处理速度，通常需要 5-10 个工作日。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">4. 例外情况</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                如果用户账户因违反服务条款（如恶意爬虫等）而被封禁，则不享受任何形式的退款。
              </p>
            </section>
          </div>
        </motion.div>
      </main>

      <footer className="py-20 text-center text-xs text-slate-600 font-bold uppercase tracking-widest">
        © 2026 STOCKWISE AI TECHNOLOGY. ALL RIGHTS RESERVED.
      </footer>

      <style jsx global>{`
        .glass-card { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 40px; }
      `}</style>
    </div>
  );
}
