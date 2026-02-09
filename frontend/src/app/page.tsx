'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, BarChart3, ChevronRight, Zap, BookOpen } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import Multiavatar from '@/components/Multiavatar';

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
            alt="ZISO AI Logo" 
            width={40} 
            height={40} 
            className="rounded-xl"
          />
          <span className="text-xl font-black italic tracking-tighter">ZISO <span className="text-indigo-500">AI</span></span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-400">
          <Link href="#features" className="hover:text-white transition-colors">功能</Link>
          <Link href="/learn" className="hover:text-white transition-colors">101 手册</Link>
          <Link href="/about" className="hover:text-white transition-colors">关于</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">价格</Link>
          <Link href="/support" className="hover:text-white transition-colors">支持</Link>
          <Link href="#faq" className="hover:text-white transition-colors">FAQ</Link>
          <Link href="https://app.ziso.cc" target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white">进入应用</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40 flex flex-col items-center text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6 max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            知其白 · 守其黑 | 知其博弈 · 守其方寸
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter italic leading-tight">
            让交易 <br /> 
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">回归理性的从容</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            看透市场的复杂博弈，守住属于自己的那份从容方寸。 <br className="hidden md:block" />
            不做波动的赌徒，只做 <span className="text-white">有纪律的知守者</span>。
          </p>
          <div className="pt-10 flex flex-col md:flex-row items-center justify-center gap-4">
            <Link 
              href="https://app.ziso.cc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-10 py-5 rounded-3xl bg-indigo-500 text-white font-black italic text-lg shadow-[0_20px_40px_rgba(99,102,241,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              立即开启 AI 复盘 <ChevronRight size={20} />
            </Link>
            <Link href="/learn" className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-white font-black text-lg hover:bg-white/10 transition-all">
              阅读 101 手册
            </Link>
          </div>
        </motion.div>


        {/* How It Works */}
        <section className="pt-40 w-full max-w-4xl">
          <h2 className="text-3xl font-black italic tracking-tighter text-center mb-16">
            如何使用 <span className="text-indigo-500">3 步开始</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto text-2xl font-black text-indigo-400">1</div>
              <h3 className="font-bold text-lg">添加自选股</h3>
              <p className="text-slate-500 text-sm">搜索并添加您关注的港股或 A 股到监控列表</p>
            </div>
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto text-2xl font-black text-purple-400">2</div>
              <h3 className="font-bold text-lg">盘后 AI 复盘</h3>
              <p className="text-slate-500 text-sm">每日收盘后，AI 自动分析并生成明日作战计划</p>
            </div>
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto text-2xl font-black text-emerald-400">3</div>
              <h3 className="font-bold text-lg">盘中触发提醒</h3>
              <p className="text-slate-500 text-sm">当行情触发预设条件时，即时推送通知</p>
            </div>
          </div>
        </section>

        {/* Digital Agent Team */}
        <section className="pt-60 w-full space-y-16">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                Meet The Committee
            </div>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter">
              由 <span className="text-indigo-500">知守 · 专家委员会</span> 驱动
            </h2>
            <p className="text-slate-500 font-medium max-w-2xl mx-auto">
              伟大的交易决策源于多维度的视角冲突与共识。我们的专业委员会 24 小时待命，为您提供如同顶级私募机构般的专家级投研支持。
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                name: "马库斯 (Marcus)", 
                role: "首席观察员 · CHIEF OBSERVER", 
                desc: "早年深耕于高频盘口监测。在马库斯的逻辑里，量价关系是市场唯一的真话。他负责穿透波动的假象，为您标记分时数据中主力留下的每一处“指纹”，确保决策永远锚定在事实之上。", 
                color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", persona: "Marcus" 
              },
              { 
                name: "奎因 (Quinn)", 
                role: "策略精算师 · STRATEGIST", 
                desc: "在他的世界里没有“感觉”，只有“期望值”。奎因负责通过多周期算法过滤底噪，寻求风险收益比的极致最优解，确保委员会的每一份建议都站在概率的一侧。", 
                color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", persona: "Quinn" 
              },
              { 
                name: "诺拉 (Nora)", 
                role: "首席情报官 · CIO", 
                desc: "善于在新闻噪音中抽丝剥茧，寻找被隐藏的“灵魂因子”。诺拉的任务是为算法注入宏观与行业的情报底噪，防止委员会在决策时陷入单纯的数据盲区。", 
                color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", persona: "Nora" 
              },
              { 
                name: "塞拉 (Sylar)", 
                role: "风控执行官 · CRO", 
                desc: "委员会中最被“敬畏”的存在。塞拉从不关心利润，他只关心亏损。他负责冷酷复盘信号表现，并在任何可能导致非理性回撤的时刻，一票否决冲动决策。", 
                color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", persona: "Sylar" 
              },
            ].map((agent, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className={`glass-card p-6 border ${agent.border} ${agent.bg} relative overflow-hidden group`}
              >
                <div className="flex flex-col items-center text-center space-y-4 relative z-10">
                  <div className="w-20 h-20 rounded-full bg-white/5 ring-1 ring-white/10 overflow-hidden relative mb-2 grayscale group-hover:grayscale-0 transition-all duration-500">
                    <Multiavatar 
                      name={agent.persona}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div>
                    <h3 className={`font-black italic text-lg ${agent.color}`}>{agent.name}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">{agent.role}</p>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed font-bold">
                    {agent.desc}
                  </p>
                </div>
                {/* Background Accent */}
                <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-[40px] opacity-20 transition-opacity group-hover:opacity-40 
                   ${i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-purple-500' : i === 2 ? 'bg-emerald-500' : 'bg-slate-500'}
                `} />
              </motion.div>
            ))}
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="pt-60 grid sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          <div className="glass-card p-8 text-left border-indigo-500/10 bg-indigo-500/[0.02]">
            <div className="w-12 h-12 rounded-[20px] bg-indigo-500/10 flex items-center justify-center mb-6">
              <Zap className="text-indigo-400" />
            </div>
            <h3 className="text-xl font-black italic mb-3">盘后规划</h3>
            <p className="text-slate-500 text-sm leading-relaxed font-medium">市场收盘后，AI 自动整理当日得失，帮您在最冷静的时候制定明日作战计划。</p>
          </div>
          
          <div className="glass-card p-8 text-left border-purple-500/10 bg-purple-500/[0.02]">
            <div className="w-12 h-12 rounded-[20px] bg-purple-500/10 flex items-center justify-center mb-6">
              <ShieldCheck className="text-purple-400" />
            </div>
            <h3 className="text-xl font-black italic mb-3">信心熔断</h3>
            <p className="text-slate-500 text-sm leading-relaxed font-medium">拒绝情绪化博弈。当 AI 决策置信度低于 75% 时，系统将强制启动防御姿态输出观望建议，为您冷酷守住本金红线。</p>
          </div>

          <div className="glass-card p-8 text-left border-emerald-500/10 bg-emerald-500/[0.02]">
            <div className="w-12 h-12 rounded-[20px] bg-emerald-500/10 flex items-center justify-center mb-6">
              <BarChart3 className="text-emerald-400" />
            </div>
            <h3 className="text-xl font-black italic mb-3">盘中执行</h3>
            <p className="text-slate-500 text-sm leading-relaxed font-medium">当行情触发昨晚设定的剧本时，推送提醒。让您像机器人一样冷静交易。</p>
          </div>

          <Link href="/learn" className="glass-card p-8 text-left border-amber-500/20 bg-amber-500/[0.03] hover:bg-amber-500/[0.06] transition-all group scale-100 hover:scale-[1.02] active:scale-95">
            <div className="w-12 h-12 rounded-[20px] bg-amber-500/10 flex items-center justify-center mb-6 group-hover:bg-amber-500/20 transition-colors">
              <BookOpen className="text-amber-400" />
            </div>
            <h3 className="text-xl font-black italic mb-3 flex items-center gap-2">
              101 手册
              <span className="text-[10px] not-italic font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 uppercase tracking-tighter">必读</span>
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed font-medium group-hover:text-slate-400 transition-colors">不只是工具，更是心法。内置深度指南，涵盖心态、术法与工具，助您建立完整的理性投研体系。</p>
          </Link>
        </section>

        {/* FAQ Section - Simplified */}
        <section id="faq" className="py-40 w-full max-w-4xl space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter">
              常见问题 <span className="text-indigo-500">FAQ</span>
            </h2>
            <p className="text-slate-400 font-medium">快速了解 ZISO AI</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card p-6 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-2">ZISO AI 是什么？</p>
              <p className="text-slate-400 text-sm">一款 AI 驱动的港股/A股决策辅助工具，帮助个人投资者做出更理性的交易决策。</p>
            </div>
            <div className="glass-card p-6 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-2">支持哪些市场？</p>
              <p className="text-slate-400 text-sm">目前支持港股 (HK) 和 A 股 (CN) 市场。</p>
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
              <p className="text-white font-bold mb-2">信号是怎么判定的？</p>
              <p className="text-slate-400 text-sm">价格站上 MA20 → 做多；跌破 MA20 的 98% → 做空；RSI 在 45-55 震荡区 → 观望。</p>
            </div>
            <div className="glass-card p-6 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent">
              <p className="text-white font-bold mb-2">免费使用吗？</p>
              <p className="text-slate-400 text-sm">基础功能免费。PRO 用户可解锁更多自选股监控额度和高级功能。</p>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="py-20 w-full max-w-3xl text-center space-y-8">
          <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter">
            准备好让 <span className="text-indigo-500">知守委员会</span> 成为你的纪律合伙人了吗？
          </h2>
          <Link 
            href="https://app.ziso.cc"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-10 py-5 rounded-3xl bg-indigo-500 text-white font-black italic text-lg shadow-[0_20px_40px_rgba(99,102,241,0.3)] hover:scale-105 active:scale-95 transition-all"
          >
            立即进入应用 <ChevronRight size={20} />
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-20 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-2">
            <Image 
              src="/logo.png" 
              alt="ZISO AI Logo" 
              width={32} 
              height={32} 
              className="rounded-lg"
            />
            <span className="text-sm font-black italic tracking-tighter">ZISO AI | 知其白，守其黑</span>
          </div>
          <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">© 2026 ZISO AI TECHNOLOGY. ALL RIGHTS RESERVED.</p>
          <div className="flex gap-6 text-xs font-bold text-slate-500">
            <Link href="/learn" className="hover:text-white transition-colors">101 手册</Link>
            <Link href="/status" className="hover:text-white transition-colors">系统状态</Link>
            <Link href="/support" className="hover:text-white transition-colors">支持中心</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">价格方案</Link>
            <Link href="/about" className="hover:text-white transition-colors">关于我们</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">隐私协议</Link>
            <Link href="/terms" className="hover:text-white transition-colors">服务条款</Link>
            <Link href="/refund" className="hover:text-white transition-colors">退款政策</Link>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .glass-card { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 40px; }
      `}</style>
    </div>
  );
}
