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
            让普通投资者也能 <br />
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">拥有机构级的投研外脑</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-2xl">
            ZISO AI 是你口袋里的复盘专家，也是你的实战导师。它替你打理繁琐的股市功课，带你一眼看清投资背后的深度门道。
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
                散户在市场中面临的最大障碍是专业信息差与碎片化的复盘精力。我们通过多维 Agent 的深度协作，为您自动完成每日数千条数据的清洗与建模。我们希望辅助用户告别“拍脑袋交易”，进入拥有 AI 参谋辅助、有据可依的理性交易时代。
              </p>
            </div>
            <div className="glass-card p-1 relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-[38px] blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
              <div className="bg-[#0a0a0f] rounded-[38px] p-8 relative z-10 space-y-4">
                <div className="text-indigo-400 font-black italic text-xl">“知其白，守其黑。”</div>
                <p className="text-slate-500 text-xs text-justify">这就是 ZISO AI 名称的由来 —— 知，是 <b>90% 的深度研判</b>，帮你看清行情细节与博弈剧本；守，是那 <b>10% 的风控红线</b>，在关键时刻为你守住确定性。</p>
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
               { title: "深度复盘助手", desc: "告别劳累，告别盲目。AI 自动扫描海量市场因子，将复杂的 K 线行情转化为条理清晰的投研功课。", icon: ShieldCheck },
               { title: "实战决策参谋", desc: "AI 不是冷冰冰的数字，而是您的实战导师。它通过多维博弈推演看清行情门道，助您从容做出决策。", icon: Users },
               { title: "理性风控助理", desc: "在市场情绪狂热或非理性的时刻，为您留出一道冷静的红线。我们不预测奇迹，只负责守护您的交易理性。", icon: Sparkles },
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
