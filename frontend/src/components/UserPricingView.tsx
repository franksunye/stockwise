'use client';

import { useState } from 'react';
import { Check, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { getCurrentUserId } from '@/lib/user';
import { pricingPlans } from '@/lib/pricing-data';


interface Props {
  onBack: () => void;
  currentTier: string;
}

export function UserPricingView({ onBack, currentTier }: Props) {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

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
      alert('⚠️ 支付暂时受阻。\n\n如多次尝试无效，请直接添加页面下方的【人工客服】。\n\nError: ' + ((error as Error).message || 'Unknown error'));
    } finally {
      setLoadingPriceId(null);
    }
  };

  const handleManageSubscription = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    
    // Simple alert for now, effectively loading
    const start = confirm('即将跳转到 Stripe 订阅管理门户？');
    if (!start) return;

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
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col">
       {/* Header */}
       <div className="flex items-center gap-2 mb-6">
            <button 
                onClick={onBack}
                className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
            >
                <ArrowLeftRight className="w-4 h-4 rotate-180" /> 返回
            </button>
            <span className="text-white font-black italic flex-1 text-right text-lg">
                权益升级
            </span>
       </div>

       <div className="flex-1 overflow-y-auto pr-1 -mr-2 space-y-4 pb-10 custom-scrollbar">
            {currentTier === 'free' && (
                 <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/20 mb-6">
                    <h3 className="font-black italic text-lg mb-1">限时升级 Pro</h3>
                    <p className="text-xs font-medium text-indigo-100 opacity-90 mb-0">
                        解锁 DeepSeek 深度推理与实时信号推送，让 AI 真正接管您的交易纪律。
                    </p>
                 </div>
            )}

            {pricingPlans.map((plan) => {
                const isCurrent = (plan.enName.toLowerCase() === 'free' && currentTier === 'free') || 
                                  (plan.enName.toLowerCase() === 'pro' && currentTier === 'pro');
                
                return (
                    <div 
                        key={plan.name}
                        className={`relative p-5 rounded-[24px] border ${
                            plan.highlight 
                            ? 'bg-gradient-to-b from-[#1a1a24] to-[#0f0f13] border-indigo-500/30' 
                            : 'bg-white/5 border-white/5'
                        }`}
                    >
                        {plan.highlight && (
                             <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-600 rounded-bl-2xl rounded-tr-[22px] text-[9px] font-black uppercase tracking-widest text-white">
                                Recommended
                             </div>
                        )}

                        <div className="flex items-center gap-4 mb-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                plan.color === 'indigo' ? 'bg-indigo-500/20 text-indigo-400' :
                                plan.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                                'bg-slate-500/20 text-slate-400'
                            }`}>
                                <plan.icon size={20} />
                            </div>
                            <div>
                                <h3 className={`text-base font-black italic ${plan.highlight ? 'text-white' : 'text-slate-300'}`}>{plan.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xs font-bold text-slate-500">¥</span>
                                    <span className="text-xl font-black tracking-tighter text-white">{plan.price}</span>
                                    {plan.name !== '基础版' && <span className="text-[9px] text-slate-500 ml-1">{plan.period.split('/')[0]}</span>}
                                </div>
                            </div>
                        </div>

                        <ul className="space-y-2.5 mb-6">
                            {plan.features.map((feature) => (
                                <li key={feature} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400 font-medium">
                                    <Check size={12} className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-indigo-400' : 'text-slate-500'}`} />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>

                        {/* Actions */}
                        {isCurrent && plan.enName === 'Pro' ? (
                            <button 
                                onClick={handleManageSubscription}
                                className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-2"
                            >
                                管理订阅 / 续费
                            </button>
                        ) : isCurrent ? (
                            <button disabled className="w-full py-3 rounded-xl bg-white/5 border border-white/5 text-slate-500 text-xs font-bold cursor-default">
                                当前方案
                            </button>
                        ) : plan.priceId ? (
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => handleUpgrade(plan.priceId!)}
                                    disabled={!!loadingPriceId}
                                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white text-xs font-black italic flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                                >
                                    {loadingPriceId === plan.priceId ? '处理中...' : '立即开通 (月付)'}
                                    {!loadingPriceId && <ChevronRight size={14} />}
                                </button>
                                {plan.priceIdAnnual && (
                                    <button
                                        onClick={() => handleUpgrade(plan.priceIdAnnual!)}
                                        disabled={!!loadingPriceId}
                                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-95 transition-all text-white text-xs font-black italic flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                                    >
                                        <div className="flex flex-col items-center leading-none gap-0.5">
                                            <span>年付更省 (¥299/年)</span>
                                            <span className="text-[8px] opacity-80 uppercase tracking-wider">Save 17%</span>
                                        </div>
                                    </button>
                                )}
                            </div>
                        ) : 'href' in plan && plan.href ? (
                            <a 
                                href={plan.href}
                                className={`w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                                    plan.color === 'emerald' 
                                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                                    : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                                }`}
                            >
                                {plan.cta}
                                <ChevronRight size={14} />
                            </a>
                        ) : null}
                    </div>
                );
            })}
            
            <div className="px-2 pt-2 pb-6">
                <p className="text-[10px] text-center text-slate-600 font-medium leading-relaxed">
                    订阅即代表同意 <span className="underline">服务条款</span> 与 <span className="underline">隐私协议</span>。
                    <br/>
                    支持随时取消，下个计费周期生效。
                </p>
            </div>
       </div>
    </div>
  );
}
