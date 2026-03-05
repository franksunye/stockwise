import { ShieldCheck, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import Multiavatar from '@/components/Multiavatar';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingHeader from '@/components/MarketingHeader';
import { agentTeam, founders } from '@/lib/agent-team';
import { BoundaryNotice, GeoSummary, SourceBlock } from '@/components/seo/GeoBlocks';
import { brandCoreZhCN } from '@/content/brand-core.zh-CN';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden font-sans">
      {/* 动态背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="bg-glow-orb absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="bg-glow-orb absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      {/* 顶部导航 */}
      <MarketingHeader currentPage="home" />

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40 flex flex-col items-center text-center">
        <div className="space-y-6 max-w-3xl mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            知守 AI (ZISO AI) | 替你做股市功课，带你看投资门道
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter italic leading-tight will-change-transform">
            让交易 <br /> 
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">回归理性的从容</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 font-medium max-w-2xl mx-auto leading-relaxed">
            复杂的分析交给 AI，简单的决策留给你。 <br className="hidden md:block" />
            ZISO AI 自动为你完成复盘与数据建模，让 <span className="text-white">普通投资者也能拥有机构级的投研能力</span>。
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
            <Link href="/learn" prefetch={false} className="px-10 py-5 rounded-3xl bg-white/5 border border-white/10 text-white font-black text-lg hover:bg-white/10 transition-all">
              阅读 101 手册
            </Link>
          </div>
        </div>

        {/* Product Preview - Triple Mobile Overlap for Mobile-First App */}
        <div className="w-full max-w-5xl relative mt-20">
          <div className="relative h-[500px] md:h-[700px] w-full flex items-center justify-center">
            
            {/* Left Phone - Analysis Depth */}
            <div className="absolute left-[5%] md:left-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 -rotate-12 origin-bottom-right hidden sm:flex items-center justify-center p-2 transition-transform hover:-translate-x-2">
               <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                  <Image 
                    src="/images/landing/analysis-depth.png"
                    alt="AI Analysis Detail"
                    fill
                    sizes="(min-width: 768px) 25vw, 45vw"
                    className="object-cover"
                  />
               </div>
            </div>

            {/* Right Phone - Real-time Alert */}
            <div className="absolute right-[5%] md:right-[15%] w-[45%] md:w-[25%] aspect-[9/19] bg-[#0A0A10] rounded-[30px] border border-white/10 shadow-2xl z-10 rotate-12 origin-bottom-left hidden sm:flex items-center justify-center p-2 transition-transform hover:translate-x-2">
               <div className="w-full h-full bg-[#050508] rounded-[22px] border border-white/5 overflow-hidden relative">
                  <Image 
                    src="/images/landing/alert-popup.png"
                    alt="Circuit Breaker Alert"
                    fill
                    sizes="(min-width: 768px) 25vw, 45vw"
                    className="object-cover"
                  />
               </div>
            </div>

            {/* Center Phone - MAIN DASHBOARD */}
            <div className="relative w-[70%] sm:w-[50%] md:w-[32%] aspect-[9/19] bg-[#1A1A25] rounded-[40px] border border-white/20 shadow-[0_0_100px_rgba(99,102,241,0.2)] z-30 flex items-center justify-center p-2 md:p-3 transition-transform hover:scale-[1.02]">
               <div className="w-full h-full bg-[#050508] rounded-[30px] border border-white/10 overflow-hidden relative">
                  <Image 
                    src="/images/landing/main-dashboard.png"
                    alt="Main Dashboard Preview"
                    fill
                    priority
                    sizes="(min-width: 1024px) 32vw, (min-width: 640px) 50vw, 70vw"
                    className="object-cover"
                  />
                  {/* Mock Notch */}
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full border border-white/5 z-20" />
               </div>
            </div>


          </div>
          
          {/* Decorative background glow */}
          <div className="bg-glow-orb absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] -z-10 rounded-full" />
        </div>

        {/* Feature 1: The EOD Review (Right Image, Left Text) */}
        <section id="features" className="pt-60 w-full grid md:grid-cols-2 gap-20 items-center text-left">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">
                制定交易计划
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
         <div className="order-2 md:order-1 glass-card aspect-square bg-[#0A0A10] rounded-[40px] overflow-hidden border border-white/5 relative">
              <Image 
                src="/images/landing/circuit-breaker-logic.png"
                alt="Circuit Breaker Logic"
                fill
                sizes="(min-width: 768px) 45vw, 100vw"
                className="object-cover opacity-80 hover:opacity-100 transition-opacity duration-700"
              />
              <ShieldCheck size={120} className="absolute bottom-4 right-4 opacity-[0.1] text-red-500 pointer-events-none" />
          </div>
          <div className="order-1 md:order-2 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-[0.2em]">
                安全风控系统
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
                   <span className="text-slate-500 uppercase">AI 预测信心</span>
                  <span className="text-red-500">已触发自动熔断</span>
               </div>
               <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full w-[64%] bg-red-500/50" />
               </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">当前信号：空仓观望（防御模式开启）</p>
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
              { num: "02", title: "获取复盘简报", desc: "每日收盘 30 分钟内，由 AI 投研助理为您呈递包含具体支撑位、压力位与决策门道的复盘简报。" },
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

        {/* Team */}
        <section className="pt-60 w-full space-y-16">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                我们的团队
            </div>
            <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter">
              由 <span className="text-indigo-500">双创始人 + 投研执行团队</span> 驱动
            </h2>
            <p className="text-slate-500 font-medium max-w-2xl mx-auto">
              2 位创始人定义方法与边界，3 位量化分析师 + 2 位执行保障角色在每个交易日闭环协作。
            </p>
            <Link
              href="/about"
              prefetch={false}
              className="inline-flex items-center gap-2 text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              查看团队与方法论 <ChevronRight size={16} />
            </Link>
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

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {agentTeam.map((agent) => (
              <div
                key={agent.name}
                className={`glass-card p-6 border ${agent.borderColor} ${agent.bgColor} relative overflow-hidden group lg:min-h-[420px]`}
              >
                <div className="flex flex-col items-center text-center space-y-4 relative z-10">
                  <div className="w-20 h-20 rounded-full bg-white/5 ring-1 ring-white/10 overflow-hidden relative mb-2 grayscale group-hover:grayscale-0 transition-all duration-500">
                    <Multiavatar
                      name={agent.avatarSeed}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </div>
                  <div>
                    <h3 className={`font-black italic text-lg ${agent.textColor}`}>{agent.name}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">{agent.role}</p>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed font-bold">{agent.description}</p>
                </div>
                <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-[40px] opacity-20 transition-opacity group-hover:opacity-40 ${agent.glowColor}`} />
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-600 font-bold">顾深、林序、程矩三位各自独立研判，分别给出结论；诺岚负责情报补充，维尔负责结果复核。</p>
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
              <p className="text-slate-400 text-sm leading-relaxed">一个不仅替你完成股市功课，还能带你看清投资门道的 AI 投研助理。它通过海量历史回测与 AI 智囊团会诊，将复杂的行情分析转化为具体的决策剧本。</p>
            </div>
            <div className="glass-card p-8 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.02] to-transparent text-left">
              <p className="text-white font-bold mb-3 uppercase tracking-tighter">AI 的判断准吗？</p>
              <p className="text-slate-400 text-sm leading-relaxed">AI 复盘的结果支持全量核销。我们不仅替你做功课，更对每一笔“功课”的质量负责。历史预测的胜率在个股档案中公开透明。</p>
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

        <section className="w-full max-w-4xl">
          <GeoSummary
            summary={[
              "知守 AI 聚焦盘后复盘与次日策略，降低情绪化交易干扰。",
              "核心机制包括战术简报、胜率追踪、关键价位与风险提示。",
              "分析结果可回看、可追溯，强调过程透明而非收益承诺。",
            ]}
          />
          <SourceBlock
            sources={[
              ...brandCoreZhCN.defaultSources,
              { name: "Product Positioning", accessedAt: "2026-03-05" },
            ]}
          />
          <BoundaryNotice text={brandCoreZhCN.boundaryNotice.text} />
        </section>

        {/* CTA Banner */}
        <section className="py-40 w-full max-w-4xl text-center space-y-10">
          <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase leading-tight">
            准好让 <span className="text-indigo-500 uppercase">ZISO AI</span> <br className="hidden md:block" />
            替你打理股市功课了吗？
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
            {/* Free Trial Badge Removed */}
          </div>
        </section>
      </main>


      <MarketingFooter />
    </div>
  );
}

