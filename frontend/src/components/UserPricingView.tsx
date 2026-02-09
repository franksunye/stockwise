'use client';

import { useState } from 'react';
import { Check, ChevronRight, Zap } from 'lucide-react';
import Image from 'next/image';
import { getCurrentUserId } from '@/lib/user';
import { pricingPlans } from '@/lib/pricing-data';

interface Props {
  currentTier: string;
}

export function UserPricingView({ currentTier }: Props) {
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
      alert('⚠️ 支付暂时受阻。\n\n如多次尝试无效，请添加客服进行人工处理。\n\nError: ' + ((error as Error).message || 'Unknown error'));
    } finally {
      setLoadingPriceId(null);
    }
  };

  const handleManageSubscription = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    
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
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 pb-12">
      {currentTier === 'free' && (
        <div className="p-4 rounded-2xl bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/10 mb-6">
          <h3 className="font-black italic text-lg mb-1 uppercase tracking-tighter text-left">订阅投研权益</h3>
          <p className="text-[11px] font-medium text-indigo-100 opacity-90 leading-relaxed text-left">
            解锁专家级投研推演，让知守专家席位接管您的研究深度。
          </p>
        </div>
      )}

      {pricingPlans.map((plan) => {
        const isCurrent = (plan.enName.toLowerCase() === 'free' && currentTier === 'free') || 
                          (plan.enName.toLowerCase() === 'pro' && currentTier === 'pro');
        
        return (
          <div 
            key={plan.name}
            className={`relative p-5 rounded-[24px] border transition-colors ${
              plan.highlight 
              ? 'bg-indigo-500/5 border-indigo-500/20' 
              : 'bg-white/[0.02] border-white/5'
            }`}
          >
            {plan.highlight && (
              <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-600 rounded-bl-2xl rounded-tr-[22px] text-[8px] font-black uppercase tracking-widest text-white">
                Best Value
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
              <div className="text-left">
                <h3 className={`text-base font-black italic uppercase tracking-tight ${plan.highlight ? 'text-white' : 'text-slate-300'}`}>{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold text-slate-500">¥</span>
                  <span className="text-xl font-black tracking-tighter text-white">{plan.price}</span>
                  {plan.enName !== 'Free' && <span className="text-[9px] text-slate-500 ml-1 font-bold uppercase">{plan.period.split('/')[0]}</span>}
                </div>
              </div>
            </div>

            <ul className="space-y-2.5 mb-6">
              {plan.features.slice(0, 5).map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400 font-medium text-left">
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
                当前订阅
              </button>
            ) : plan.priceId ? (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleUpgrade(plan.priceId!)}
                  disabled={!!loadingPriceId}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white text-xs font-black italic flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                >
                  {loadingPriceId === plan.priceId ? '处理中...' : (plan.priceIdAnnual ? '按月订阅' : plan.cta)}
                  {!loadingPriceId && <ChevronRight size={14} />}
                </button>
                {plan.priceIdAnnual && (
                  <button
                    onClick={() => handleUpgrade(plan.priceIdAnnual!)}
                    disabled={!!loadingPriceId}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-95 transition-all text-white text-xs font-black italic flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                  >
                    <div className="flex flex-col items-center leading-none gap-0.5">
                      <span>按年订阅 (¥299/年)</span>
                      <span className="text-[8px] opacity-80 uppercase tracking-wider font-bold">节省约 17%</span>
                    </div>
                  </button>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
      
      <div className="mt-8 pt-6 border-t border-white/5">
        <div className="p-6 rounded-[24px] border border-white/5 bg-white/[0.01] flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-4">
            <Zap size={10} className="fill-current" />
            <span>人工通道</span>
          </div>
          <h3 className="text-sm font-black italic text-white mb-2 uppercase tracking-tight">扫码添加客服获取支持</h3>
          <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-5">支持 RMB 直接转账或处理支付问题。</p>
          
          <div className="relative group">
            <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full"></div>
            <div className="relative z-10 p-2 bg-white rounded-2xl">
              <Image 
                src="/support-qr.png" 
                alt="Support QR" 
                width={120} 
                height={120}
                className="rounded-lg"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 pb-8">
        <p className="text-[10px] text-center text-slate-600 font-medium leading-relaxed italic px-2">
          股市有风险，投资需谨慎。本应用生成的所有内容由 AI 驱动，仅供参考。
          订阅即代表同意 服务条款 与 隐私协议。
        </p>
      </div>
    </div>
  );
}
