'use client';

import { motion } from 'framer-motion';
import { Target, Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Multiavatar from '@/components/Multiavatar';
import { agentTeam, founders } from '@/lib/agent-team';
import { PageShell } from './CnLayout';
import { JsonLd } from '@/components/seo/JsonLd';

export function ChineseAboutPage() {
  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "mainEntity": {
      "@type": "Organization",
      "name": "知守 AI (ZISO AI)",
      "description": "知守 AI 是个人投资者的专业研究伙伴和执行教练。它利用多智能体推理架构（智能体委员会）将复杂的市场数据转化为结构化的战术简报。",
      "founder": founders.map(f => ({
        "@type": "Person",
        "name": f.name,
        "jobTitle": f.label
      })),
      "knowsAbout": [
        "市场研究",
        "AI 推理",
        "量化建模",
        "风险管理"
      ]
    }
  };

  return (
    <PageShell currentPage="about">
      <JsonLd data={aboutSchema} />
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
            <div className="space-y-6 text-left">
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
              <div className="bg-[#0a0a0f] rounded-[38px] p-8 relative z-10 space-y-4 text-left">
                <div className="text-indigo-400 font-black italic text-xl leading-tight">“知其白，守其黑，为天下式。”</div>
                <p className="text-slate-500 text-xs text-justify leading-relaxed">这就是 <b>ZISO AI (知守)</b> 名称的由来 —— <b>知其白</b>，是帮你看清行情门道；<b>守其黑</b>，是在关键时刻为你守护确定性。</p>
              </div>
            </div>
          </div>

          {/* The Team Deep Dive */}
          <div className="space-y-16">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-black italic tracking-tighter uppercase">团队与执行体系</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6 text-left">
              {founders.map((founder) => (
                <div key={founder.name} className="glass-card p-8 space-y-4 border-white/10 bg-white/[0.02]">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">{founder.label}</div>
                  <h3 className="text-2xl font-black italic">{founder.name}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed font-medium">{founder.description}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {agentTeam.map((member) => (
                <div key={member.name} className={`p-6 rounded-[32px] bg-gradient-to-b ${member.aboutGradient} to-transparent border border-white/5 flex flex-col items-center text-center space-y-4`}>
                  <div className="w-16 h-16 rounded-full bg-black/40 border border-white/10 overflow-hidden grayscale">
                    <Multiavatar name={member.avatarSeed} className="w-full h-full" />
                  </div>
                  <div>
                    <div className={`font-black italic ${member.textColor}`}>{member.name}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{member.role}</div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-medium">{member.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Join the Tribe */}
        <section className="pt-60 text-center space-y-12 border-b border-white/5 pb-40">
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
    </PageShell>
  );
}
