'use client';

import { motion } from 'framer-motion';
import { FileText, ChevronLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function TermsOfService() {
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
              <FileText size={12} /> Legal
            </div>
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter">服务条款 <span className="text-indigo-500">Terms of Service</span></h1>
            <p className="text-slate-400 text-sm">最近更新日期：2026年1月27日</p>
          </div>

          <div className="glass-card p-6 border-amber-500/20 bg-amber-500/[0.02] flex gap-4 items-start">
            <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={20} />
            <div className="text-sm text-amber-200/80 leading-relaxed font-medium">
              重要声明：StockWise AI 提供的所有预测、分析和报告均由人工智能自动生成，仅供技术参考，不构成任何投资建议、财务咨询或法律意见。股市有风险，投资需谨慎。
            </div>
          </div>

          <div className="glass-card p-8 md:p-12 space-y-8 border-white/5 bg-white/[0.01]">
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">1. 服务说明</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                StockWise AI 是一家提供基于 AI 的股票市场分析、预测简报及实时提醒服务的平台。您知悉并接受 AI 生成内容的局限性及市场波动预测的不确定性。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">2. 账户责任</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                您应当对通过您的账户进行的任何活动负责。如有未经授权使用账户的情况，请立即通知我们。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">3. 费用与订阅</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                Pro 会员采用订阅制。除非您在结算周期结束前至少 24 小时取消，否则订阅将自动续订。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">4. 限制行为</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                禁止使用爬虫抓取本站数据，禁止利用本站信息进行非法证券活动或内幕交易。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">5. 免责限制</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                在法律允许的最大范围内，StockWise AI 对您基于本站信息作出的任何交易决策所产生的盈利或损失概不负责。
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
