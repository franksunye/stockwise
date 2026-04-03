'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, PartyPopper, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/user';
import { pricingPlans, featureComparison } from '@/lib/pricing-data';
import { PageShell } from './CnLayout';
import { JsonLd } from '@/components/seo/JsonLd';

function PricingContent() {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [userTier, setUserTier] = useState<string>('free');
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const searchParams = useSearchParams();

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "知守 AI (ZISO AI)",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "AggregateOffer",
      "offerCount": "3",
      "lowPrice": "0",
      "highPrice": "299",
      "priceCurrency": "CNY"
    }
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "为什么是订阅制？",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "订阅是为了维持交付深夜战术简报所需的持续计算和多智能体推理。你正在聘请一个在市场收盘后仍在工作的纪律严明的委员会。"
        }
      }
    ]
  };

  useEffect(() => {
    getCurrentUser().then(() => {
      fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      .then(res => res.json())
      .then(data => {
        if (data.tier) setUserTier(data.tier);
        if (typeof data.hasStripeCustomer === 'boolean') setHasStripeCustomer(data.hasStripeCustomer);
      })
      .catch(err => console.error('Failed to fetch user status', err));
    });

    if (searchParams.get('session_id') || searchParams.get('checkout') === 'success') {
      setShowSuccess(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    setLoadingPriceId(priceId);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || '无法创建支付会话');
      }
    } catch (error: unknown) {
      console.error('Checkout error:', error);
      alert('⚠️ 支付暂时受阻。\n\nError: ' + ((error as Error).message || 'Unknown error'));
    } finally {
      setLoadingPriceId(null);
    }
  };

  return (
    <PageShell currentPage="pricing">
      <JsonLd data={softwareSchema} />
      <JsonLd data={faqSchema} />
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
              <h2 className="text-3xl font-black italic mb-4">欢迎加入 Go 会员!</h2>
              <p className="text-slate-400 font-medium mb-8 leading-relaxed">
                您的权限已自动激活。现在您可以享受深度复盘、更多自选额度以及实时推送。
              </p>
              <Link 
                href="/"
                className="block w-full py-4 rounded-2xl bg-indigo-600 text-white font-black italic hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20"
              >
                进入仪表盘
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-40 text-center">
        <div className="space-y-4 mb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4 mx-auto">
              知其白 · 守其黑 | Native Agentic Support
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter italic leading-tight">
            选聘您的 <br /> 
            <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">知守 · 投研委员会</span>
          </h1>
          <p className="text-lg text-slate-400 font-medium max-w-xl mx-auto leading-relaxed mt-6">
            订阅不仅是购买功能，更是雇佣了一组 24/7 在岗的专业交易委员会。让知守委员会帮您克服情绪干扰，构建理性的复盘习惯。
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-20">
          {pricingPlans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`glass-card p-8 flex flex-col relative overflow-hidden text-left ${
                plan.highlight ? 'border-indigo-500/40 ring-1 ring-indigo-500/20' : 'border-white/5'
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-5 right-[-35px] rotate-45 bg-indigo-600 text-white text-[10px] font-black px-10 py-1 uppercase tracking-tighter">
                  Recommended
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
                <h3 className="text-2xl font-black italic mb-1">
                  {plan.enName === 'Go' ? 'Go 会员' : plan.enName === 'Plus' ? 'Plus 卓越版' : '基础版 (FREE)'}
                </h3>
                <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">{plan.enName}</p>
              </div>

              <div className="mb-8 text-left">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold">¥</span>
                  <span className="text-5xl font-black tracking-tighter">{plan.price}</span>
                  <span className="text-slate-500 text-sm ml-2">
                    {plan.enName === 'Plus' ? '待发布' : (plan.enName === 'Go' ? '/月 (¥299/年)' : '/永久免费')}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mt-4 leading-relaxed italic">
                  {plan.description === 'pricing.free.description' ? '适合初学者体验 AI 辅助分析。' : 
                   plan.description === 'pricing.go.description' ? '最具性价比。解锁顶级推理模型与全量实时通知。' :
                   '顶配共识分析。包含多模型交叉验证与优先专家支持。'}
                </p>
              </div>

              <div className="space-y-4 mb-10 flex-1">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm">
                    <div className="mt-1 w-4 h-4 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Check size={10} className={plan.highlight ? 'text-indigo-400' : 'text-slate-500'} />
                    </div>
                    <span className="text-slate-300 font-medium">
                        {feature.includes('Actionable') ? feature.replace('Actionable Insights', '逻辑研判') : 
                         feature.includes('Notifications') ? '全量实时通知' :
                         feature.includes('Community') ? '投资者社区访问' :
                         feature.includes('consensus') ? 'DeepSeek + Gemini 双模型共识' :
                         feature.includes('DeepSeek') ? 'DeepSeek 顶级推理模型' :
                         feature}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                {userTier === 'go' && plan.enName === 'Go' && hasStripeCustomer && (
                  <button 
                    onClick={handleManageSubscription}
                    disabled={loadingPortal}
                    className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black italic bg-white/10 border border-white/20 hover:bg-white/20 text-white transition-all active:scale-95 mt-[-10px] mb-4"
                  >
                    {loadingPortal ? '正在跳转...' : '管理我的订阅 / 取消'}
                  </button>
                )}

                {plan.priceId ? (
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
                          ? (userTier === 'go' && plan.enName === 'Go' ? '按月续费' : '按月支付') 
                          : '免费开始'
                        )
                    }
                    {loadingPriceId !== plan.priceId && <ChevronRight size={18} />}
                  </button>
                ) : (
                  <Link
                    href={plan.href || '#'}
                    className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black italic transition-all active:scale-95 ${
                      plan.enName === 'Plus'
                      ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 text-white'
                    }`}
                  >
                    {plan.enName === 'Plus' ? '加入等待名单' : '免费开始'}
                    <ChevronRight size={18} />
                  </Link>
                )}

                {plan.priceIdAnnual && (
                  <button 
                    onClick={() => handleUpgrade(plan.priceIdAnnual!)}
                    disabled={!!loadingPriceId}
                    className="w-full py-4 rounded-2xl flex flex-col items-center justify-center gap-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black italic transition-all active:scale-95 shadow-lg shadow-orange-500/20 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 mt-3"
                  >
                    <div className="flex items-center gap-2">
                       {loadingPriceId === plan.priceIdAnnual 
                         ? '正在前往收银台...' 
                         : (userTier === 'go' && plan.enName === 'Go' ? '按年续费 (¥299)' : '按年支付 (¥299)')
                       }
                       {loadingPriceId !== plan.priceIdAnnual && <ChevronRight size={18} />}
                    </div>
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <section className="mb-24 hidden md:block">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black italic tracking-tighter uppercase">功能深度对照</h2>
          </div>
          <div className="glass-card overflow-hidden border-white/5 bg-white/[0.01]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="py-6 px-8 text-sm font-black uppercase tracking-widest text-slate-500">能力维度</th>
                  <th className="py-6 px-8 text-sm font-black italic">基础版 (FREE)</th>
                  <th className="py-6 px-8 text-sm font-black italic text-indigo-400">GO 会员 (核心)</th>
                  <th className="py-6 px-8 text-sm font-black italic text-emerald-400/60">PLUS (待发布)</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {featureComparison.map((row: any, i: number) => {
                  if (row.isGroup) {
                    const groupTitle = row.label === 'actionableInsights.group' ? '逻辑研判 (Actionable Insights)' :
                                     row.label === 'notifications.group' ? '实时通知 (Notifications)' :
                                     '知守学院 (Academy)';
                    return (
                      <tr key={i} className="bg-white/[0.03]">
                        <td colSpan={4} className="py-4 px-8 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400/80 text-left">
                          {groupTitle}
                        </td>
                      </tr>
                    );
                  }
                  
                  const label = row.label.split('.')[1] || row.label;
                  const labelCN = label === 'model' ? '分析模型' :
                                label === 'dailyLimit' ? '研判额度 (每日)' :
                                label === 'monthlyLimit' ? '研判上限 (每月)' :
                                label === 'signals' ? '趋势信号 / 交易预案' :
                                label === 'levels' ? '核心点位 / 空头压力' :
                                label === 'reasoning' ? '推演过程 / 风险反思' :
                                label === 'markets' ? '市场覆盖 (US/HK/CN)' :
                                label === 'sharing' ? '报告分享' :
                                label === 'realtime' ? '送达实效性' :
                                label === 'types' ? '通知品类' :
                                label === 'content' ? '教学内容' :
                                label === 'masters' ? '大师逻辑' : label;

                  return (
                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors">
                      <td className="py-5 px-8 text-slate-400 font-bold">{labelCN}</td>
                      <td className="py-5 px-8 text-slate-500">
                        {row.free === 'Limited' ? '基础/受限' : row.free === 'Unlimited' ? '无限制' : row.free === 'All Access' ? '全量访问' : row.free}
                      </td>
                      <td className={`py-5 px-8 ${row.highlight ? 'text-indigo-100 font-black bg-indigo-500/5' : 'text-slate-300'}`}>
                        {row.go === 'Full Real-time' ? '全量实时推送' : row.go === 'All Categories' ? '全品类' : row.go === 'All Access' ? '全量访问' : row.go}
                      </td>
                      <td className="py-5 px-8 text-slate-500 italic opacity-60">
                        {row.plus === 'Full Real-time' ? '全量实时推送' : row.plus === 'All Categories' ? '全品类' : row.plus === 'All Access' ? '全量访问' : row.plus}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </PageShell>
  );
}

export function ChinesePricingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050508] flex items-center justify-center text-indigo-500">Loading...</div>}>
      <PricingContent />
    </Suspense>
  );
}
