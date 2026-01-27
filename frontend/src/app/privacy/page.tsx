'use client';

import { motion } from 'framer-motion';
import { Shield, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function PrivacyPolicy() {
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
              <Shield size={12} /> Compliance
            </div>
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter">隐私政策 <span className="text-indigo-500">Privacy Policy</span></h1>
            <p className="text-slate-400 text-sm">最近更新日期：2026年1月27日</p>
          </div>

          <div className="glass-card p-8 md:p-12 space-y-8 border-white/5 bg-white/[0.01]">
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">1. 信息收集</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                我们仅收集为您提供服务所必需的信息：
                <ul className="list-disc list-inside mt-2 space-y-2 ml-2">
                  <li>账户信息：您的电子邮箱地址。</li>
                  <li>偏好设置：您的自选股列表及通知订阅偏好。</li>
                  <li>支付数据：我们使用 Stripe 处理所有支付交易，StockWise 不会存储您的信用卡卡号或安全码。</li>
                </ul>
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">2. 信息使用</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                收集的信息将用于维护您的账户、发送个性化 AI 股票简报、提供客户支持以及改进我们的 AI 模型算法。我们绝不会向任何第三方出售或出租您的个人数据。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">3. 数据安全</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                我们采用行业标准的加密技术来保护您的数据。然而，互联网传输无法保证 100% 安全，请妥善保管您的登录信息。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">4. Cookie 使用</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                我们使用必要的 Cookie 来维持您的登录状态和优化网站性能。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-white italic">5. 联系我们</h2>
              <p className="text-slate-400 leading-relaxed text-sm">
                如果您对隐私政策有任何疑问，请通过邮件联系我们：<span className="text-indigo-400 font-bold">support@stockwise.ai</span>
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
