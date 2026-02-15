'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ChevronRight, Menu, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import Multiavatar from '@/components/Multiavatar';
import MarketingFooter from '@/components/MarketingFooter';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        {/* Mobile Hamburger Button */}
        <button
          className="md:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-[#050508]/98 backdrop-blur-xl flex flex-col items-center justify-center gap-6 md:hidden"
          >
            {[
              { href: "#features", label: "功能" },
              { href: "/learn", label: "101 手册" },
              { href: "/about", label: "关于" },
              { href: "/pricing", label: "价格" },
              { href: "/support", label: "支持" },
              { href: "#faq", label: "FAQ" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-2xl font-black italic tracking-tighter text-slate-300 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="https://app.ziso.cc"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-4 px-10 py-4 rounded-3xl bg-indigo-500 text-white font-black italic text-lg shadow-[0_20px_40px_rgba(99,102,241,0.3)] flex items-center gap-2"
            >
              进入应用 <ChevronRight size={20} />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40 flex flex-col items-center text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6 max-w-3xl mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            知其白 · 守其黑 | 知其博弈 · 守其方寸
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter italic leading-tight will-change-transform">
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

        {/* Product Preview - Triple Mobile Overlap for Mobile-First App */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 1 }}
          className="w-full max-w-5xl relative mt-20"
        >
          <div className="relative h-[500px] md:h-[700px] w-full flex items-center justify-center">
            
            {/* Left Phone - Analysis Depth */}
            <motion.div 
               whileHover={{ x: -20, rotateY: -10 }}
               className="absolute left-[5%] md:left-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 -rotate-12 origin-bottom-right hidden sm:flex items-center justify-center p-2"
            >
               <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                  <Image 
                    src="/images/landing/analysis-depth.png"
                    alt="AI Analysis Detail"
                    fill
                    className="object-cover"
                  />
               </div>
            </motion.div>

            {/* Right Phone - Real-time Alert */}
            <motion.div 
               whileHover={{ x: 20, rotateY: 10 }}
               className="absolute right-[5%] md:right-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 rotate-12 origin-bottom-left hidden sm:flex items-center justify-center p-2"
            >
               <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                  <Image 
                    src="/images/landing/alert-popup.png"
                    alt="Circuit Breaker Alert"
                    fill
                    className="object-cover"
                  />
               </div>
            </motion.div>

            {/* Center Phone - MAIN DASHBOARD */}
            <motion.div 
               whileHover={{ scale: 1.02 }}
               className="relative w-[70%] sm:w-[50%] md:w-[32%] aspect-[9/19] bg-[#1A1A25] rounded-[40px] border border-white/20 shadow-[0_0_100px_rgba(99,102,241,0.2)] z-30 flex items-center justify-center p-2 md:p-3"
            >
               <div className="w-full h-full bg-[#050508] rounded-[30px] border border-white/10 overflow-hidden relative">
                  <Image 
                    src="/images/landing/main-dashboard.png"
                    alt="Main Dashboard Preview"
                    fill
                    className="object-cover"
                  />
                  {/* Mock Notch */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full border border-white/5 z-20" />
               </div>
            </motion.div>


          </div>
          
          {/* Decorative background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] -z-10 rounded-full" />
        </motion.div>

        {/* Feature 1: The EOD Review (Right Image, Left Text) */}
        <section className="pt-60 w-full grid md:grid-cols-2 gap-20 items-center text-left">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
               Plan The Trade
            </div>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter leading-tight uppercase">
              在冷静时复盘 <br />
              <span className="text-indigo-500">制定明日剧本</span>
            </h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              职业交易员的核心秘密不在于盘中的手感，而在于闭市后的功课。ZISO AI 在每日收盘后自动接入海量行情与新闻，为您生成多维度的决策逻辑。不提供随机预测，只提供可执行的博弈边界。
            </p>
            <ul className="space-y-4">
              {[
                "多周期趋势共振捕捉 (MA/RSI/MACD)",
                "量价异动深度溯源",
                "基于历史胜率的置信度评分"
              ].map((item, i) => (
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
              <Image 
                src="/images/landing/prediction-card-detail.png"
                alt="AI Prediction Detail"
                fill
                className="object-cover opacity-80 hover:opacity-100 transition-opacity duration-700"
              />
           </div>
        </section>

        <section className="pt-40 w-full grid md:grid-cols-2 gap-20 items-center text-left">
         <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               whileInView={{ opacity: 1, scale: 1 }}
               viewport={{ once: true }}
               className="order-2 md:order-1 glass-card aspect-square bg-[#0A0A10] rounded-[40px] overflow-hidden border border-white/5 relative"
            >
              <Image 
                src="/images/landing/circuit-breaker-logic.png"
                alt="Circuit Breaker Logic"
                fill
                className="object-cover opacity-80 hover:opacity-100 transition-opacity duration-700"
              />
              <ShieldCheck size={120} className="absolute bottom-4 right-4 opacity-[0.1] text-red-500 pointer-events-none" />
          </motion.div>
          <div className="order-1 md:order-2 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-[0.2em]">
               Safety System
            </div>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter leading-tight uppercase">
              即便在最疯狂的行情 <br />
              <span className="text-red-500">也要恪守 75% 闸门</span>
            </h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              知其博弈，也要守其方寸。如果 AI 对于次日的逻辑推演置信度低于 75%，系统将冷酷通过“熔断指令”强制阻断所有看多/看空行为，建议持币观望。不亏损，是您在市场中长期生存并最终获胜的第一条铁律。
            </p>
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
               <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                  <span className="text-slate-500 uppercase">AI Confidence Limit</span>
                  <span className="text-red-500">Breaker Triggered</span>
               </div>
               <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-[64%] bg-red-500/50" />
               </div>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Current Signal: SIDE (Defense Mode Active)</p>
            </div>
          </div>
        </section>

        {/* How It Works - Re-styled as a summary flow */}
        <section className="pt-60 w-full">
           <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase">
                 <span className="text-indigo-500 tracking-normal">3 步</span> 开启独立交易系统
              </h2>
           </div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { num: "01", title: "资产锁定", desc: "将您关注的标的加入知守列表，系统将立即开始 250 天历史数据的同步与建模。" },
              { num: "02", title: "获取作战计划", desc: "每日收盘 30 分钟内，由委员会联合为您呈递包含具体支撑位、压力位与止损红线的作战简报。" },
              { num: "03", title: "盘中纪律执行", desc: "不再被盘中的随机分时波动绑架。当行情触及昨晚设定的剧本时，委员会将即时唤醒您的理智执行。" }
            ].map((step, i) => (
              <div key={i} className="text-left space-y-6 relative group">
                <div className="text-7xl font-black italic text-white/[0.03] group-hover:text-indigo-500/10 transition-colors absolute -top-10 -left-4">
                  {step.num}
                </div>
                <h3 className="font-extrabold text-2xl italic relative z-10">{step.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed font-medium relative z-10">{step.desc}</p>
                <div className="w-12 h-1 bg-white/5 rounded-full group-hover:w-20 group-hover:bg-indigo-500/30 transition-all duration-500" />
              </div>
            ))}
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
              每条建议来自四个独立角色的交叉审视：量价观察、策略建模、情报过滤、风险执行。
            </p>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              查看团队与方法论 <ChevronRight size={16} />
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                name: "马库斯 (Marcus)", 
                role: "首席观察员 · CHIEF OBSERVER", 
                desc: "负责量价结构识别，先确认事实，再进入判断。", 
                color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", persona: "Marcus" 
              },
              { 
                name: "奎因 (Quinn)", 
                role: "策略精算师 · STRATEGIST", 
                desc: "负责多周期建模，把噪音过滤成可执行条件。", 
                color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", persona: "Quinn" 
              },
              { 
                name: "诺拉 (Nora)", 
                role: "首席情报官 · CIO", 
                desc: "负责新闻与宏观信号过滤，补全数据上下文。", 
                color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", persona: "Nora" 
              },
              { 
                name: "塞拉 (Sylar)", 
                role: "风控执行官 · CRO", 
                desc: "负责风险闸门与否决权，置信度不足时强制观望。", 
                color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", persona: "Sylar" 
              },
            ].map((agent, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className={`glass-card p-6 border ${agent.border} ${agent.bg} relative overflow-hidden group lg:min-h-[420px]`}
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

        {/* FAQ Section */}
        <section id="faq" className="py-60 w-full max-w-4xl space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase">
              常见问题 <span className="text-indigo-500 uppercase">FAQ</span>
            </h2>
            <p className="text-slate-400 font-medium">深入认知 ZISO AI 的底层逻辑</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent text-left">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">ZISO AI 是什么？</p>
              <p className="text-slate-400 text-sm leading-relaxed">一款由 AI 专家委员会驱动的港股/A股决策外脑，不提供“小道消息”，只提供可验证的“纪律参考”。</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent text-left">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">AI 的判断准吗？</p>
              <p className="text-slate-400 text-sm leading-relaxed">我们每日收盘后对昨日信号进行“全量核销”。历史胜率在个股档案中公开透明，准确率是 ZISO 的生命线。</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent text-left">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">为什么要设定 75% 门槛？</p>
              <p className="text-slate-400 text-sm leading-relaxed">胜率不足 70% 的博弈在数学上是长期负期望的。知其白而守其黑，守住本金是我们对普通用户最大的价值。</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent text-left">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">支持所有股票吗？</p>
              <p className="text-slate-400 text-sm leading-relaxed">支持香港联交所、上交所、深交所的所有主流标的。新股或成交极其低迷的标的由于缺乏锚定点，系统会自动降级。</p>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="py-40 w-full max-w-4xl text-center space-y-10">
          <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase leading-tight">
            准好让 <span className="text-indigo-500 uppercase">ZISO 委员会</span> <br className="hidden md:block" />
            接管您的交易纪律吗？
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <Link 
              href="https://app.ziso.cc"
              target="_blank"
              rel="noopener noreferrer"
              className="px-12 py-6 rounded-3xl bg-indigo-500 text-white font-black italic text-xl shadow-[0_20px_40px_rgba(99,102,241,0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
            >
              立即进入应用 <ChevronRight size={24} />
            </Link>
            <div className="text-left">
               <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Free Trial Available
               </div>
            </div>
          </div>
        </section>
      </main>


      <MarketingFooter />

      <style jsx global>{`
        .glass-card { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 40px; }
      `}</style>
    </div>
  );
}
