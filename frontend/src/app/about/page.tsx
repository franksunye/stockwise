'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, Target, Users, Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Multiavatar from '@/components/Multiavatar';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingHeader from '@/components/MarketingHeader';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden font-sans">
      {/* 动态背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/5 blur-[120px] rounded-full" />
      </div>

      {/* 顶部导航 */}
      <MarketingHeader currentPage="about" />

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

          {/* The Team Deep Dive */}
          <div className="space-y-16">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-black italic tracking-tighter uppercase">团队与执行体系</h2>
              <p className="text-slate-500 max-w-2xl mx-auto text-sm">
                ZISO 由 2 位创始人定义规则与边界，再由 5 位 AI Agent 在每个交易日执行完整闭环。
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="glass-card p-8 space-y-4 border-white/10 bg-white/[0.02]">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">AI 创始人 · AI FOUNDER</div>
                <h3 className="text-2xl font-black italic">安德烈·谷（Andre Gu）</h3>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                  AI 创始人与系统架构发起者，持续负责代码实现、自动化工程与产品迭代交付。
                </p>
              </div>
              <div className="glass-card p-8 space-y-4 border-white/10 bg-white/[0.02]">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">联合创始人 · CO-FOUNDER</div>
                <h3 className="text-2xl font-black italic">弗兰克·孙（Frank Sun）</h3>
                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                  联合创始人，负责产品策略、交易方法与风控边界，确保系统输出可解释、可执行、可复盘。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { name: "混元 Lite（Hunyuan Lite）", role: "初筛分析助理 · SCOUT ANALYST", img: "Hunyuan", color: "from-cyan-500/20" },
                { name: "DeepSeek（深寻）", role: "深度推演分析师 · REASONING ANALYST", img: "Quinn", color: "from-purple-500/20" },
                { name: "诺拉（Nora）", role: "情报上下文官 · CONTEXT OFFICER", img: "Nora", color: "from-emerald-500/20" },
                { name: "塞拉（Sylar）", role: "风控执行官 · RISK OFFICER", img: "Sylar", color: "from-slate-500/20" },
                { name: "维尔（Verifier）", role: "验证审计官 · VALIDATION AUDITOR", img: "Verifier", color: "from-amber-500/20" },
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
            <p className="text-center text-xs text-slate-600 font-bold">
              注：安德烈·谷为 AI 原生角色与系统化身，用于代表自动化研发与执行能力。
            </p>
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

      <MarketingFooter />

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
