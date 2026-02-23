'use client';

import { useState } from 'react';
import { Check, ChevronRight, Zap, Crown, Loader2, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { pricingPlans } from '@/lib/pricing-data';

interface Props {
  currentTier: string;
  hasStripeCustomer?: boolean;
  expiresAt?: string | null;
}

export function UserPricingView({ currentTier, hasStripeCustomer, expiresAt }: Props) {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);

  const isPro = currentTier === 'pro';

  // 格式化到期时间
  const formatExpiry = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    } catch {
      return dateStr;
    }
  };

  const handleUpgrade = async (priceId: string) => {
    setLoadingPriceId(priceId);
    try {
      const { getCurrentUser } = await import('@/lib/user');
      await getCurrentUser();

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
      const msg = (error as Error).message || '';
      
      if (msg.includes('Missing required environment variables')) {
        alert('⚠️ 系统配置维护中，请稍后再试或联系微信客服处理。');
      } else {
        alert(`⚠️ 支付发起受阻 (详情: ${msg || '网络波动'})\n\n请检查网络环境或更换支付卡。若持续失败，请添加下方客服二维码进行人工开通。`);
      }
    } finally {
      setLoadingPriceId(null);
    }
  };

  const handleManageSubscription = async () => {
    const { getCurrentUser } = await import('@/lib/user');
    await getCurrentUser();
    
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

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 pb-12">
      {/* 1. 会员身份沉浸区 - The "Status Hero" */}
      {isPro ? (
        <div className="relative overflow-hidden p-6 rounded-[28px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white shadow-2xl shadow-indigo-500/20 mb-8 border border-white/10">
          <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 blur-[60px] rounded-full" />
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                  <Crown size={20} className="text-amber-300 fill-amber-300/20" />
                </div>
                <div>
                  <h2 className="text-xl font-black italic tracking-tight uppercase tracking-tighter">PRO 会员</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-indigo-100/80 uppercase tracking-widest">权益已激活</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold text-indigo-200/60 uppercase block mb-1">服务到期时间</span>
                <span className="text-xs font-black tabular-nums">{expiresAt ? formatExpiry(expiresAt) : '永久尊享'}</span>
              </div>
            </div>

            {hasStripeCustomer && (
              <button 
                onClick={handleManageSubscription}
                disabled={loadingPortal}
                className="mt-2 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {loadingPortal ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                {loadingPortal ? '正在跳转管理门户...' : '管理现有订阅 / 取消自动续费'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/10 mb-6">
          <h3 className="font-black italic text-lg mb-1 uppercase tracking-tighter text-left">订阅投研权益</h3>
          <p className="text-[11px] font-medium text-indigo-100 opacity-90 leading-relaxed text-left">
            解锁专家级投研推演，让知守专家席位接管您的研究深度。
          </p>
        </div>
      )}

      {/* 2. 方案选择矩阵 - Strategic Plan List */}
      <div className="space-y-4">
        {pricingPlans.map((plan) => {
          const planEnName = plan.enName.toLowerCase();
          const isCurrent = (planEnName === 'free' && currentTier === 'free') || 
                            (planEnName === 'pro' && currentTier === 'pro');
          
          // 对 Pro 用户隐藏基础版
          if (isPro && planEnName === 'free') return null;

          return (
            <div 
              key={plan.name}
              className={`relative p-5 rounded-[24px] border transition-all duration-300 ${
                plan.highlight && !isPro
                ? 'bg-indigo-500/5 border-indigo-500/20 ring-1 ring-indigo-500/10' 
                : 'bg-white/[0.02] border-white/5'
              } ${isCurrent ? 'opacity-100' : 'opacity-90 grayscale-[0.3] hover:grayscale-0'}`}
            >
              {plan.highlight && !isPro && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-600 rounded-bl-2xl rounded-tr-[22px] text-[8px] font-black uppercase tracking-widest text-white shadow-lg">
                  最具性价比
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    plan.color === 'indigo' ? 'bg-indigo-500/20 text-indigo-400' :
                    plan.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    <plan.icon size={20} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-base font-black italic uppercase tracking-tight ${plan.highlight ? 'text-white' : 'text-slate-300'}`}>
                        {plan.name}
                      </h3>
                      {isCurrent && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/10 text-[8px] font-black text-indigo-400 uppercase tracking-tighter">
                          <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                          生效中
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] font-bold text-slate-500">¥</span>
                      <span className="text-xl font-black tracking-tighter text-white">{plan.price}</span>
                      {planEnName !== 'free' && <span className="text-[9px] text-slate-500 ml-1 font-bold uppercase">{plan.period.split('/')[0]}</span>}
                    </div>
                  </div>
                </div>
              </div>

              <ul className="grid grid-cols-1 gap-2.5 mb-6">
                {plan.features.slice(0, isPro ? 3 : 5).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400 font-medium text-left">
                    <Check size={12} className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* Actions Section */}
              <div className="flex flex-col gap-2">
                {isCurrent && planEnName === 'free' ? (
                  <button disabled className="w-full py-3 rounded-xl bg-white/5 border border-white/5 text-slate-600 text-[10px] font-black italic uppercase tracking-widest cursor-default">
                    当前账户状态
                  </button>
                ) : plan.priceId ? (
                  <>
                    <button
                      onClick={() => handleUpgrade(plan.priceId!)}
                      disabled={!!loadingPriceId}
                      className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white text-xs font-black italic flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                    >
                      {loadingPriceId === plan.priceId 
                        ? '处理中...' 
                        : (isPro ? '按月续费 (¥29.9)' : '订阅 Pro 会员')
                      }
                      {!loadingPriceId && <ChevronRight size={14} />}
                    </button>
                    {plan.priceIdAnnual && (
                      <button
                        onClick={() => handleUpgrade(plan.priceIdAnnual!)}
                        disabled={!!loadingPriceId}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-95 transition-all text-white text-xs font-black italic flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                      >
                        <div className="flex flex-col items-center leading-none gap-0.5">
                          <span>{isPro ? '按年延长会员 (¥299)' : '年度订阅 (最高优惠)'}</span>
                          <span className="text-[8px] opacity-80 uppercase tracking-wider font-bold">
                            {isPro ? '立即使有效期增加 365 天' : '节省 约 17%'}
                          </span>
                        </div>
                      </button>
                    )}
                  </>
                ) : (
                  <button 
                    onClick={() => { if (plan.href) window.location.href = plan.href; }}
                    className="w-full py-3 rounded-xl bg-white/10 border border-indigo-500/30 text-white text-xs font-black italic uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-indigo-500/20"
                  >
                    {plan.cta || (planEnName === 'alpha' ? '联系定制 ALPHA 权益' : '立即开始')}
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
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
