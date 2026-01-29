'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Zap, Crown, ShieldCheck, Star, PartyPopper, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getCurrentUserId } from '@/lib/user';

const pricingPlans = [
  {
    name: '基础版',
    enName: 'Free',
    price: '0',
    period: '永久免费',
    description: '适合刚接触 AI 投资的个人投资者',
    features: [
      '基础个股日级别简报',
      '每日 3 只自选股监控额度',
      '延迟数据分析',
      '社区技术支持',
    ],
    cta: '立即开始',
    href: '/dashboard',
    highlight: false,
    icon: Zap,
    color: 'slate',
  },
  {
    name: 'Pro 会员',
    enName: 'Pro',
    price: '29.9',
    period: '每月 / ¥299 每年',
    description: '专为追求深度见解的专业投资者设计',
    features: [
      'Matt Levine 风格深度叙事复盘',
      '10 只自选股监控额度',
      '所有技术因子全维度解锁',
      '实时信号翻转推送（战报）',
      '⭐ Pro 专属身份勋章',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_MONTHLY || 'price_1Su1zqS3fDFObThpZbYXr2GG',
    priceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_YEARLY || 'price_1Su1zqS3fDFObThp7iG6X6bK', 
    highlight: true,
    icon: Crown,
    color: 'indigo',
  },
  {
    name: '机构/大户版',
    enName: 'Alpha',
    price: '1,999',
    period: '每年',
    description: '顶级阿尔法收益工具，实时深度监控',
    features: [
      '实时盘中突发事件 AI 分析',
      '1对1 AI 专属策略看板',
      '专属深度研报自动生成',
      'API 原始数据访问接口',
      '行业专家优先支持',
    ],
    cta: '联系我们',
    href: 'mailto:support@visutry.com',
    highlight: false,
    icon: ShieldCheck,
    color: 'emerald',
  },
];

function PricingContent() {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [userTier, setUserTier] = useState<string>('free');
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('session_id')) {
      setShowSuccess(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    // Check current user status
    const userId = getCurrentUserId();
    if (userId) {
      fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      .then(res => res.json())
      .then(data => {
        if (data.tier) setUserTier(data.tier);
        if (typeof data.hasStripeCustomer === 'boolean') setHasStripeCustomer(data.hasStripeCustomer);
      })
      .catch(err => console.error('Failed to fetch user status', err));
    }
  }, [searchParams]);

  const handleManageSubscription = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    
    setLoadingPortal(true);
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || '无法打开订阅管理门户');
      }
    } catch (err) {
      console.error('Portal error:', err);
      alert('系统繁忙，请稍后再试');
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleUpgrade = async (priceId: string) => {
    const userId = getCurrentUserId();
    if (!userId) {
      alert('请先登录或初始化您的账户');
      return;
    }

    setLoadingPriceId(priceId);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, userId }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || '无法创建支付会话');
      }
    } catch (error: unknown) {
      console.error('Checkout error:', error);
      alert('支付 system 暂时不可用，请稍后再试: ' + ((error as Error).message || 'Unknown error'));
    } finally {
      setLoadingPriceId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white overflow-x-hidden font-sans">
      {/* 动态背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
        <div className="absolute inset-0 opacity-20 overflow-hidden">
          <Image 
            src="/pricing-bg.png" 
            alt="Background Gradient" 
            fill 
            className="object-cover scale-110"
          />
        </div>
      </div>

      {/* 顶部导航 */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-8 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <Image 
            src="/logo.png" 
            alt="StockWise AI Logo" 
            width={40} 
            height={40} 
            className="rounded-xl"
          />
          <span className="text-xl font-black italic tracking-tighter">STOCKWISE <span className="text-indigo-500">AI</span></span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-400">
          <Link href="/#features" className="hover:text-white transition-colors">功能</Link>
          <Link href="/pricing" className="text-white transition-colors">价格</Link>
          <Link href="/dashboard" className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white">进入应用</Link>
        </div>
      </nav>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-card max-w-md w-full p-8 text-center relative border-indigo-500/50 shadow-2xl shadow-indigo-500/20"
            >
              <button 
                onClick={() => setShowSuccess(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
              <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <PartyPopper size={40} />
              </div>
              <h2 className="text-3xl font-black italic mb-4">欢迎加入 PRO 会员!</h2>
              <p className="text-slate-400 font-medium mb-8 leading-relaxed">
                您的权限已自动激活。现在您可以享受深度复盘、更多监控额度以及实时战报推送。
              </p>
              <Link 
                href="/dashboard"
                className="block w-full py-4 rounded-2xl bg-indigo-600 text-white font-black italic hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"
              >
                进入仪表盘
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-20 pb-40">
        <div className="text-center space-y-4 mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-black uppercase tracking-widest mb-4"
          >
            <Star size={12} className="fill-indigo-500" />
            Pricing Strategy
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter italic leading-tight">
            选择您的 <br /> 
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">决策加速引擎</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed mt-6">
            StockWise AI 利用 AI 击穿专业投研成本，为您提供高性价比的金融决策辅助方案。
          </p>
        </div>

        {/* 价格方案矩阵 */}
        <div className="grid lg:grid-cols-3 gap-8 mb-20">
          {pricingPlans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`glass-card p-8 flex flex-col relative overflow-hidden ${
                plan.highlight ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-white/5'
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-5 right-[-35px] rotate-45 bg-indigo-600 text-white text-[10px] font-black px-10 py-1 uppercase tracking-tighter">
                  Popular
                </div>
              )}
              
              <div className="mb-8">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 ${
                  plan.color === 'indigo' ? 'bg-indigo-500/10 text-indigo-400' :
                  plan.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' :
                  'bg-slate-500/10 text-slate-400'
                }`}>
                  <plan.icon size={24} />
                </div>
                <h3 className="text-2xl font-black italic mb-1">{plan.name}</h3>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">{plan.enName}</p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold">¥</span>
                  <span className="text-5xl font-black tracking-tighter">{plan.price}</span>
                  <span className="text-slate-500 text-sm ml-2">{plan.period}</span>
                </div>
                <p className="text-slate-400 text-sm mt-4 leading-relaxed italic">
                  {plan.description}
                </p>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm">
                    <div className="mt-1 w-4 h-4 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Check size={10} className={plan.highlight ? 'text-indigo-400' : 'text-slate-500'} />
                    </div>
                    <span className="text-slate-300 font-medium">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                {/* Show Manage Subscription ONLY if already Pro AND has Stripe Customer ID */}
                {userTier === 'pro' && plan.enName === 'Pro' && hasStripeCustomer && (
                  <button 
                    onClick={handleManageSubscription}
                    disabled={loadingPortal}
                    className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black italic bg-white/10 border border-white/20 hover:bg-white/20 text-white transition-all active:scale-95 mt-[-10px] mb-4"
                  >
                    {loadingPortal ? '正在跳转...' : '管理我的订阅 / 取消'}
                  </button>
                )}

                {/* Monthly Button - Always show, just change text if Pro */}
                {plan.priceId && (
                  <button 
                    onClick={() => handleUpgrade(plan.priceId!)}
                    disabled={!!loadingPriceId}
                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black italic transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                      plan.highlight 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 hover:shadow-indigo-600/40' 
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white'
                    }`}
                  >
                    {loadingPriceId === plan.priceId 
                      ? '正在前往收银台...' 
                      : (plan.priceIdAnnual 
                          ? (userTier === 'pro' && plan.enName === 'Pro' ? '按月续费' : '按月支付') 
                          : plan.cta
                        )
                    }
                    {loadingPriceId !== plan.priceId && <ChevronRight size={18} />}
                  </button>
                )}

                {/* Annual Button - Always show */}
                {plan.priceIdAnnual && (
                  <button 
                    onClick={() => handleUpgrade(plan.priceIdAnnual!)}
                    disabled={!!loadingPriceId}
                    className="w-full py-4 rounded-2xl flex flex-col items-center justify-center gap-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black italic transition-all active:scale-95 shadow-lg shadow-orange-500/20 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 mt-3"
                  >
                    <div className="flex items-center gap-2">
                       {loadingPriceId === plan.priceIdAnnual 
                         ? '正在前往收银台...' 
                         : (userTier === 'pro' && plan.enName === 'Pro' ? '按年续费 (¥299)' : '按年支付 (¥299)')
                       }
                       {loadingPriceId !== plan.priceIdAnnual && <ChevronRight size={18} />}
                    </div>
                    <span className="text-[10px] uppercase tracking-widest opacity-80">
                      {userTier === 'pro' && plan.enName === 'Pro' ? '延长会员有效期' : '最划算 - 节省 ¥60+'}
                    </span>
                  </button>
                )}

                {!plan.priceId && !plan.priceIdAnnual && (
                  <Link 
                    href={plan.href || '/'}
                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black italic transition-all active:scale-95 ${
                      plan.highlight 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 hover:shadow-indigo-600/40' 
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white'
                    }`}
                  >
                    {plan.cta}
                    <ChevronRight size={18} />
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* 详细功能对照表 (Comparison Table) */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-32 hidden md:block"
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black italic tracking-tighter">功能深度对照</h2>
            <p className="text-slate-500 text-sm mt-2">为您透明展示不同等级下的底层技术差异</p>
          </div>

          <div className="glass-card overflow-hidden border-white/5 bg-white/[0.01]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="py-6 px-8 text-sm font-black uppercase tracking-widest text-slate-500">能力维度</th>
                  <th className="py-6 px-8 text-sm font-black italic">基础版 (FREE)</th>
                  <th className="py-6 px-8 text-sm font-black italic text-indigo-400">PRO 会员</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {[
                  { label: 'AI 智力内核', free: '混元 Lite (通用大模型)', pro: 'Gemini Pro + DeepSeek (顶级推理)', highlight: true },
                  { label: '决策叙事引擎', free: '标准数据汇总', pro: 'Matt Levine 风格叙事逻辑', highlight: true },
                  { label: '自选股监控名额', free: '3 只', pro: '10 只', highlight: true },
                  { label: '量化模型底座', free: '基于规则的深度量化', pro: '基于规则的深度量化', common: true },
                  { label: '行情覆盖范围', free: 'A股 / 港股 全覆盖', pro: 'A股 / 港股 全覆盖', common: true },
                  { label: '通知推送逻辑', free: '基础事件提醒', pro: '决策级推理结论推送', highlight: true },
                  { label: '预测验证战报', free: '标准验证报告', pro: 'Pro 级收益复盘战报', highlight: true },
                  { label: '数据更新频率', free: '同步实时行情', pro: '同步实时行情', common: true },
                  { label: '专属身份标识', free: '-', pro: '⭐ 专属 Pro 勋章' },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                    <td className="py-5 px-8 text-slate-400 font-bold">{row.label}</td>
                    <td className="py-5 px-8 text-slate-500">
                      {row.common ? <div className="flex items-center gap-2"><Check size={14} className="text-slate-600" /> {row.free}</div> : row.free}
                    </td>
                    <td className={`py-5 px-8 ${row.highlight ? 'text-indigo-100 font-black' : 'text-slate-300'}`}>
                      {row.common ? <div className="flex items-center gap-2"><Check size={14} className="text-indigo-500" /> {row.pro}</div> : row.pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* 底部免责声明 */}
        <div className="glass-card p-6 md:p-10 border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.03] to-transparent text-center max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4 text-emerald-400">
            <ShieldCheck size={20} />
            <span className="text-sm font-black uppercase tracking-widest">Risk Disclosure</span>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed max-w-2xl mx-auto italic font-medium">
            股市有风险，投资需谨慎。本应用生成的所有简报、预测及分析内容均由 AI 驱动，仅供参考，不构成任何形式的投资建议或财务咨询。StockWise AI 不对因使用本服务内容而导致的任何投资损失承担直接或间接责任。
          </p>
        </div>

        {/* 商业对标 */}
        <section className="mt-40 text-center">
            <h2 className="text-3xl font-black italic tracking-tighter mb-12">
               为什么选择 <span className="text-indigo-500">StockWise AI?</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
                <div className="p-6">
                    <h4 className="text-white font-bold mb-3">比通用 AI 更懂股票</h4>
                    <p className="text-slate-500 text-sm font-medium">垂直集成了 2026 最新金融语境，专门针对 A 股/港股逻辑进行深度指令集建模。</p>
                </div>
                <div className="p-6">
                    <h4 className="text-white font-bold mb-3">比传统终端更懂叙事</h4>
                    <p className="text-slate-500 text-sm font-medium">不只是罗列冰冷的技术数据，我们将复杂的价格行为转化为 Matt Levine 式的逻辑白话。</p>
                </div>
                <div className="p-6">
                    <h4 className="text-white font-bold mb-3">极致性价比</h4>
                    <p className="text-slate-500 text-sm font-medium">利用 Gemini 3 Flash 的批处理分布式架构，将年费控制在竞品的 1/5 以下。</p>
                </div>
            </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-20 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <Link href="/" className="flex items-center gap-2">
            <Image 
              src="/logo.png" 
              alt="StockWise AI Logo" 
              width={32} 
              height={32} 
              className="rounded-lg"
            />
            <span className="text-sm font-black italic tracking-tighter">STOCKWISE AI</span>
          </Link>
          <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">© 2026 STOCKWISE AI TECHNOLOGY. ALL RIGHTS RESERVED.</p>
          <div className="flex gap-6 text-xs font-bold text-slate-500">
             <Link href="/status" className="hover:text-white transition-colors">系统状态</Link>
             <Link href="/pricing" className="hover:text-white">价格说明</Link>
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

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050508] flex items-center justify-center text-indigo-500">Loading...</div>}>
      <PricingContent />
    </Suspense>
  );
}
