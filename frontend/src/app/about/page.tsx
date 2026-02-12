'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Target, Users, Sparkles, ChevronRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import Multiavatar from '@/components/Multiavatar';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden font-sans">
      {/* 动态背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/5 blur-[120px] rounded-full" />
      </div>

      {/* 顶部导航 */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-8 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2 group">
          <Image 
            src="/logo.png" 
            alt="ZISO AI Logo" 
            width={32} 
            height={32} 
            className="rounded-lg group-hover:scale-110 transition-transform"
          />
          <span className="text-lg font-black italic tracking-tighter">ZISO <span className="text-indigo-500">AI</span></span>
        </Link>
        <div className="flex items-center gap-6 text-xs font-bold text-slate-400 uppercase tracking-widest">
          <Link href="/learn" className="hover:text-white transition-colors">101 手册</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">订阅</Link>
          <Link href="https://app.ziso.cc" className="px-4 py-2 rounded-full bg-indigo-500 text-white hover:bg-indigo-400 transition-all">进入应用</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-4xl mx-auto px-8 pt-20 pb-40">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-8 text-center sm:text-left"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest">
            <Sparkles size={12} /> 关于我们 · ABOUT ZISO AI
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter italic leading-tight uppercase">
            为普通投资者 <br />
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">构建理性的交易防线</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-2xl">
            它是你口袋里的分析助手、随身的决策参谋，更是一位恪守原则的交易助理。
          </p>
        </motion.div>

        {/* The Problem & Vision */}
        <section className="pt-40 space-y-24">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <Target className="text-indigo-400" />
              </div>
              <h2 className="text-3xl font-black italic tracking-tighter">我们的使命</h2>
              <p className="text-slate-400 leading-relaxed font-bold">
                ZISO AI (知守 AI) 的诞生，源于一个明确的目标：<span className="text-white">让普通人像机构一样专业地交易。</span>
              </p>
              <p className="text-slate-500 text-sm leading-relaxed">
                散户在市场中不仅面临信息落差，更缺乏能时刻保持冷静的工具。我们通过多维 Agent 的深度协作，为您提供客观、高频、可复用的分析逻辑。我们希望辅助每位用户从“凭感觉交易”，迭代为拥有 AI 参谋辅助、严格执行纪律的理性交易者。
              </p>
            </div>
            <div className="glass-card p-1 relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-[38px] blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="bg-[#0a0a0f] rounded-[38px] p-8 relative z-10 space-y-4">
                <div className="text-indigo-400 font-black italic text-xl">“知其白，守其黑。”</div>
                <p className="text-slate-500 text-xs text-justify">这就是 ZISO AI 名称的由来 —— 洞察先机的“知”是我们的<b>分析助手</b>，恪守底线的“守”是我们的<b>风控助理</b>。在变幻莫测的市场中，为你守住那一份确定性。</p>
              </div>
            </div>
          </div>

          {/* The Committee Deep Dive */}
          <div className="space-y-16">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-black italic tracking-tighter uppercase">专家委员会的诞生</h2>
              <p className="text-slate-500 max-w-2xl mx-auto text-sm">
                我们认为，单一的 AI 模型容易产生偏差。因此，我们构建了一支拥有不同性格与专长的“数字专家团队”。
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { name: "Marcus", role: "量价捕捉", img: "Marcus", color: "from-blue-500/20" },
                { name: "Quinn", role: "因子建模", img: "Quinn", color: "from-purple-500/20" },
                { name: "Nora", role: "舆情过滤", img: "Nora", color: "from-emerald-500/20" },
                { name: "Sylar", role: "风控底线", img: "Sylar", color: "from-slate-500/20" },
              ].map((member, i) => (
                <div key={i} className={`p-6 rounded-[32px] bg-gradient-to-b ${member.color} to-transparent border border-white/5 flex flex-col items-center text-center space-y-4`}>
                  <div className="w-16 h-16 rounded-full bg-black/40 border border-white/10 overflow-hidden grayscale">
                    <Multiavatar name={member.img} className="w-full h-full" />
                  </div>
                  <div>
                    <div className="font-black italic text-white">{member.name}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{member.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Our Values */}
          <div className="grid md:grid-cols-3 gap-8">
             {[
               { title: "深度分析助手", desc: "拒绝盲从，拒绝盘感。基于多维因子模型，将杂乱的 K 线数据转化为颗粒度清晰的技术信号分析。", icon: ShieldCheck },
               { title: "动态策略参谋", desc: "AI 不是指示灯，而是您的数字智囊。根据行情变动实时推演博弈场景，辅助您做出独立决策。", icon: Users },
               { title: "恪守原则助理", desc: "在行情过热或极端恐惧时，为您提供冷酷的风险对冲建议。我们不预测奇迹，我们只负责守住净值。", icon: Sparkles },
             ].map((value, i) => (
               <div key={i} className="glass-card p-10 space-y-6 border-white/5">
                 <value.icon className="text-indigo-400 w-8 h-8" />
                 <h3 className="text-xl font-black italic">{value.title}</h3>
                 <p className="text-slate-500 text-sm leading-relaxed">{value.desc}</p>
               </div>
             ))}
          </div>
        </section>

        {/* Join the Tribe */}
        <section className="pt-60 text-center space-y-12">
           <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase leading-tight">
             不再孤军奋战 <br />
             <span className="text-indigo-500">全面开启 AI 决策增强模式</span>
           </h2>
           <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="https://app.ziso.cc" className="px-10 py-5 rounded-3xl bg-indigo-500 text-white font-black italic shadow-lg hover:scale-105 transition-all">
                开启专家协作模式
              </Link>
              <Link href="/" className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-slate-400 font-black hover:text-white transition-all flex items-center gap-2">
                <ArrowLeft size={18} /> 返回首页
              </Link>
           </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-20 px-8 text-center sm:text-left">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black italic tracking-tighter uppercase">ZISO AI | 知其白，守其黑</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">
            <Link href="/" className="hover:text-white transition-colors">首页</Link>
            <Link href="/learn" className="hover:text-white transition-colors">101 手册</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">价格</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">隐私</Link>
            <Link href="/terms" className="hover:text-white transition-colors">条款</Link>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .glass-card { 
          background: rgba(255, 255, 255, 0.02); 
          backdrop-filter: blur(20px); 
          border: 1px solid rgba(255, 255, 255, 0.05); 
          border-radius: 40px; 
        }
      `}</style>
    </div>
  );
}
