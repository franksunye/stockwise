'use client';

import { ShieldCheck, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import Multiavatar from '@/components/Multiavatar';
import { agentTeam, founders } from '@/lib/agent-team';
import { PageShell } from './CnLayout';
import { GeoSummary, SourceBlock, BoundaryNotice } from '@/components/seo/GeoBlocks';
import { JsonLd } from '@/components/seo/JsonLd';
import { brandCoreZhCN } from '@/content/brand-core.zh-CN';
import { ProductHuntBadge } from '../ProductHuntBadge';

export function ChineseHomePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "ZISO AI 到底是什么？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "它是一个专业的投研桌面，接管了枯燥的市场复盘工作。通过将深度的历史建模与多智能体推理委员会结合，它将复杂的市场噪音转化为结构化、可执行的决策脚本。"
        }
      },
      {
        "@type": "Question",
        "name": "支持哪些市场？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "ZISO AI 目前涵盖美股、港股和中国 A 股市场。引擎捕捉本地化的流动性矢量和特定市场上下文，确保全球投资组合的覆盖。"
        }
      }
    ]
  };

  return (
    <PageShell currentPage="home">
      <JsonLd data={faqSchema} />
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40 flex flex-col items-center text-center">
        <div className="space-y-6 max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            知守 AI (ZISO AI) | 替你做股市功课，带你看投资门道
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter italic leading-tight uppercase">
            让交易 <br /> 
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">回归理性的从容</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            复杂的分析交给 AI，简单的决策留给用户。<br className="hidden md:block" />
            ZISO AI 通过分析 <strong>整合上下文（宏观、资金流、波动率）</strong> 生成 <strong>逻辑严密的决策脚本</strong>，确保您的执行基于客观遥测数据，而非盘中情绪。
          </p>
          <div className="pt-10 flex flex-col md:flex-row items-center justify-center gap-4">
            <Link 
              href="https://app.ziso.cc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-5 rounded-3xl bg-indigo-500 text-white font-black italic text-lg shadow-[0_20px_40px_rgba(99,102,241,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              立刻开启专家协作模式 <ChevronRight size={20} />
            </Link>
            <Link href="/cn/learn" prefetch={false} className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-white font-black text-lg hover:bg-white/10 transition-all">
              阅读 101 手册
            </Link>
          </div>
          <ProductHuntBadge locale="cn" />
        </div>

        {/* Product Preview */}
        <div className="w-full max-w-5xl relative mt-20">
          <div className="relative h-[500px] md:h-[700px] w-full flex items-center justify-center">
            <div className="absolute left-[5%] md:left-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 -rotate-12 origin-bottom-right hidden sm:flex items-center justify-center p-2 transition-transform hover:-translate-x-2">
               <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                  <Image src="/images/landing/1-logical-trace.cn.png" alt="AI Analysis Detail" fill sizes="(min-width: 768px) 25vw, 45vw" className="object-cover" />
               </div>
            </div>

            <div className="absolute right-[5%] md:right-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 rotate-12 origin-bottom-left hidden sm:flex items-center justify-center p-2 transition-transform hover:translate-x-2">
               <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                  <Image src="/images/landing/2-main-dashboard.cn.png" alt="Circuit Breaker Alert" fill sizes="(min-width: 768px) 25vw, 45vw" className="object-cover" />
               </div>
            </div>

            <div className="relative w-[70%] sm:w-[50%] md:w-[32%] aspect-[9/19] bg-[#1A1A25] rounded-[40px] border border-white/20 shadow-[0_0_100px_rgba(99,102,241,0.2)] z-30 flex items-center justify-center p-2 md:p-3 transition-transform hover:scale-[1.02]">
               <div className="w-full h-full bg-[#050508] rounded-[30px] border border-white/10 overflow-hidden relative">
                  <Image src="/images/landing/3-user-center.cn.png" alt="Main Dashboard Preview" fill priority sizes="(min-width: 1024px) 32vw, (min-width: 640px) 50vw, 70vw" className="object-cover" />
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full border border-white/5 z-20" />
               </div>
            </div>
          </div>
          <div className="bg-glow-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] -z-10 rounded-full" />
        </div>

        {/* Feature 1: The EOD Review */}
        <section id="features" className="pt-60 w-full grid md:grid-cols-2 gap-20 items-center text-left">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]"> 制定交易计划 </div>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter leading-tight uppercase">
              在冷静时复盘 <br />
              <span className="text-indigo-500">制定明日剧本</span>
            </h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              职业交易员的长期优势源于收盘后的专注。ZISO AI 在每日收盘后整合市场上下文、资金流向与量价动态，将其转化为结构化的决策脚本。它不通过随机预测制造幻觉，它致力于定义可执行的博弈边界。
            </p>
            <ul className="space-y-4">
              {[ "多周期趋势共振捕捉 (MA/RSI/MACD)", "量价异动深度溯源", "基于历史表现的置信度评分" ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                    <ChevronRight size={14} />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
           <div className="glass-card aspect-square bg-[#0A0A10] rounded-[40px] overflow-hidden border border-white/5 relative">
              <Image src="/images/landing/prediction-card-detail.png" alt="AI Prediction Detail" fill className="object-cover opacity-80 hover:opacity-100 transition-opacity duration-700" />
           </div>
        </section>

        <section className="pt-40 w-full grid md:grid-cols-2 gap-20 items-center text-left">
         <div className="order-2 md:order-1 glass-card aspect-square bg-[#0A0A10] rounded-[40px] overflow-hidden border border-white/5 relative">
              <Image src="/images/landing/circuit-breaker-logic.png" alt="Circuit Breaker Logic" fill sizes="(min-width: 768px) 45vw, 100vw" className="object-cover opacity-80 hover:opacity-100 transition-opacity duration-700" />
              <ShieldCheck size={120} className="absolute bottom-4 right-4 opacity-[0.1] text-red-500 pointer-events-none" />
          </div>
          <div className="order-1 md:order-2 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em]"> 纪律框架 </div>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter leading-tight uppercase">
              透明度是
              <br />
              <span className="text-indigo-500">终极的交易纪律</span>
            </h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              通过理解每个信号背后的“如何”与“为何”，消除情绪干扰。ZISO Go 为每一个交易设置提供全面的 <strong>逻辑追踪</strong>、<strong>逻辑审计</strong> 和 <strong>干预协议</strong>，确保您的执行扎根于客观推理。
            </p>
            <div className="grid grid-cols-1 gap-3">
              {[
                { title: '逻辑追踪 (Logical Trace)', desc: '步进式推理链条', active: true },
                { title: '逻辑审计 (Rationale Audit)', desc: '批判性的风险反射与审计', active: true },
                { title: '干预协议 (Intervention Protocols)', desc: '冲突解决与执行脚本', active: true },
              ].map((pillar) => (
                <div key={pillar.title} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">{pillar.title}</div>
                    <div className="text-xs text-slate-500 font-medium">{pillar.desc}</div>
                  </div>
                  <div className="px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-bold text-indigo-400 uppercase tracking-tighter">
                    Go 版解锁
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pt-32 w-full">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-tight">
              只需 <span className="text-indigo-500">3 步</span>，开启独立的量化决策
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-12 text-left">
            {[
              {
                num: '01',
                title: '锁定自选清单',
                desc: '添加您关心的股票。系统立即开始同步并建模约 250 个交易日的历史数据。',
              },
              {
                num: '02',
                title: '审计盘后推理',
                desc: '收盘后分钟内，研究助手将交付包含支撑压力位、战术框架和决策逻辑的推理审计。',
              },
              {
                num: '03',
                title: '恪守交易纪律',
                desc: '不再让盘中随机波动干扰决策。当价格触及昨晚设定的脚本边界时，委员会将协助您恢复执行纪律。',
              },
            ].map((step) => (
              <div key={step.num} className="space-y-6 relative group">
                <div className="text-7xl font-black text-white/[0.03] group-hover:text-indigo-500/10 transition-colors absolute -top-10 -left-4">
                  {step.num}
                </div>
                <h3 className="font-extrabold text-2xl relative z-10">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium relative z-10">{step.desc}</p>
                <div className="w-12 h-1 bg-white/5 rounded-full group-hover:w-20 group-hover:bg-indigo-500/30 transition-all duration-500" />
              </div>
            ))}
          </div>
        </section>

        <section className="pt-32 w-full space-y-16">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]"> 我们的团队 </div>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter">
              由 <span className="text-indigo-500">双创始人 + 投研团队</span> 驱动
            </h2>
            <p className="text-slate-500 font-medium max-w-2xl mx-auto">
              2 位创始人定义边界与研究方向，3 位分析师负责判断与解读，1 位量化工程师负责模型底座，情报与审计角色保障每个交易日闭环协作。
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {founders.map((founder) => (
              <div key={founder.name} className="glass-card p-8 border-white/10 bg-white/[0.02] space-y-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">{founder.label}</p>
                <h3 className="text-2xl font-black italic">{founder.name}</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">{founder.description}</p>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {agentTeam.map((agent) => (
              <div key={agent.name} className={`glass-card p-6 border ${agent.borderColor} ${agent.bgColor} relative overflow-hidden group lg:min-h-[420px]`}>
                <div className="flex flex-col items-center text-center space-y-4 relative z-10">
                  <div className="w-20 h-20 rounded-full bg-white/5 ring-1 ring-white/10 overflow-hidden relative mb-2 grayscale group-hover:grayscale-0 transition-all duration-500">
                    <Multiavatar name={agent.avatarSeed} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div>
                    <h3 className={`font-black italic text-lg ${agent.textColor}`}>{agent.name}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">{agent.role}</p>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed font-bold">{agent.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="pt-32 pb-10 w-full max-w-4xl space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase"> 常见问题 <span className="text-indigo-500 uppercase">FAQ</span> </h2>
            <p className="text-slate-400 font-medium">深入认知 ZISO AI 的底层逻辑</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">ZISO AI 是什么？</p>
              <p className="text-slate-400 text-sm leading-relaxed">一个不仅替你完成股市功课，还能带你看清投资门道的 AI 投研助理。它通过海量历史回测与 AI 智囊团会诊，将复杂的行情分析转化为具体的决策剧本。</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">历史记录真实吗？</p>
              <p className="text-slate-400 text-sm leading-relaxed">透明度是我们的核心。所有盘后推理及其后续表现均可回溯校验。我们不只是提供建议，我们为每一次战术会议保留完整的审计追踪。</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">支持哪些市场？</p>
              <p className="text-slate-400 text-sm leading-relaxed">ZISO AI 目前覆盖美股、港股和中国 A 股市场，确保您的自选清单能跨全球流动性矢量和特定市场上下文进行同步。</p>
            </div>
          </div>
        </section>

        <section className="w-full max-w-4xl pt-10 pb-20 opacity-[0.05] hover:opacity-100 transition-opacity">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="flex-1 text-left">
              <GeoSummary
                summary={[
                  "核心研究：聚焦多周期量价与动态脉络的盘后深度复盘。",
                  "决策逻辑：多智能体协作架构，分析包括宏观、资金流与历史胜率在内的整合上下文。",
                  "透明度协议：三柱审计框架（追踪、审计、协议），用严谨的纪律化替代盘中的情绪反应。",
                ]}
              />
            </div>
            <div className="flex-1 text-left">
              <SourceBlock
                sources={[
                  ...brandCoreZhCN.defaultSources,
                  { name: "Product Positioning", url: "https://ziso.cc", accessedAt: "2026-03-05" },
                ]}
              />
            </div>
          </div>
          <BoundaryNotice text={brandCoreZhCN.boundaryNotice.text} />
        </section>
      </main>
    </PageShell>
  );
}
