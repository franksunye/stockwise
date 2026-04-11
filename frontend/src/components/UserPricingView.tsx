'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Check, ChevronRight, Zap, Crown, Loader2, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { useT, useGlobalT, useLocale } from '@/context/LocaleContext';
import { getPricingPlans } from '@/lib/pricing-data';
import type { FullMessageKey } from '@/lib/i18n';
import { useAnalytics } from '@/hooks/useAnalytics';

interface Props {
  currentTier: string;
  hasStripeCustomer?: boolean;
  expiresAt?: string | null;
}

export function UserPricingView({ currentTier, hasStripeCustomer, expiresAt }: Props) {
  const t = useT('pricing');
  const tGlobal = useGlobalT();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);

  const { locale } = useLocale();
  const { trackEvent } = useAnalytics();
  const pricingPlans = useMemo(() => getPricingPlans(locale), [locale]);
  const hasAttemptedAutoCheckoutRef = useRef(false);
  const isCN = locale === 'cn';
  const currencySymbol = isCN ? '¥' : '$';

  const isGo = currentTier === 'go';
  const isPlus = currentTier === 'plus';
  const isPremium = isGo || isPlus;
  const canManageStripeSubscription = Boolean(hasStripeCustomer);

  // Strategic prices for translation placeholders
  const monthlyPriceStr = `${currencySymbol}${isCN ? '49' : '6.99'}`;
  const annualPriceStr = `${currencySymbol}${isCN ? '499' : '69.9'}`;
  const getSubscribeLabel = (planName: string) => {
    const tierName = tGlobal(planName as FullMessageKey);
    return t('subscribeTier', { tier: tierName });
  };

  // Formatter for expiry date
  const formatExpiry = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return t('expiryFormat', { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });
    } catch {
      return dateStr;
    }
  };

  const createCheckoutSession = async (
    priceId: string,
    options?: { bootstrapUser?: boolean; silentUnauthorized?: boolean }
  ): Promise<string | null> => {
    if (options?.bootstrapUser) {
      const { getCurrentUser } = await import('@/lib/user');
      await getCurrentUser();
    }

    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    });
    const data = await response.json();

    if (response.status === 401 && options?.silentUnauthorized) {
      return null;
    }

    if (!response.ok || !data.url) {
      throw new Error(data.error || '无法创建支付会话');
    }

    return data.url as string;
  };

  const handleUpgrade = async (priceId: string) => {
    setLoadingPriceId(priceId);
    trackEvent('checkout_start', {
      price_id: priceId,
      current_tier: currentTier,
      locale,
      surface: 'user_pricing_view',
    });
    try {
      const checkoutUrl = await createCheckoutSession(priceId, { bootstrapUser: true });
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (error: unknown) {
      console.error('Checkout error:', error);
      const msg = (error as Error).message || '';
      trackEvent('checkout_error', {
        price_id: priceId,
        current_tier: currentTier,
        locale,
        reason: msg || 'unknown',
        surface: 'user_pricing_view',
      });
      
      if (msg.includes('Missing required environment variables')) {
        alert(t('systemMaintenance'));
      } else {
        alert(`${t('checkoutError')} (ID: ${msg || 'NW_ERR'})\n\n${t('supportContactNote')}`);
      }
    } finally {
      setLoadingPriceId(null);
    }
  };

  const handleManageSubscription = async () => {
    const { getCurrentUser } = await import('@/lib/user');
    await getCurrentUser();
    
    setLoadingPortal(true);
    trackEvent('billing_portal_open', {
      current_tier: currentTier,
      locale,
      surface: 'user_pricing_view',
    });
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || t('portalError'));
      }
    } catch (err) {
      console.error('Portal error:', err);
      alert(t('systemBusy'));
    } finally {
      setLoadingPortal(false);
    }
  };

  // 3. 极速跳转逻辑 - URL Parameter Bridge
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasAttemptedAutoCheckoutRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const targetPriceId = params.get('priceId');
    
    // Security Audit Fix: Validate Price ID against whitelist before auto-trigger
    const isWhitelisted = targetPriceId && pricingPlans.some(p => 
      p.priceId === targetPriceId || p.priceIdAnnual === targetPriceId
    );

    if (targetPriceId && isWhitelisted) {
      hasAttemptedAutoCheckoutRef.current = true;
      trackEvent('checkout_start', {
        price_id: targetPriceId,
        current_tier: currentTier,
        locale,
        surface: 'pricing_url_bridge',
      });
      void (async () => {
        try {
          const checkoutUrl = await createCheckoutSession(targetPriceId, { bootstrapUser: true });
          if (checkoutUrl) {
            window.location.href = checkoutUrl;
            return;
          }
        } catch (error) {
          console.error('Auto checkout error:', error);
          trackEvent('checkout_error', {
            price_id: targetPriceId,
            current_tier: currentTier,
            locale,
            reason: error instanceof Error ? error.message : 'unknown',
            surface: 'pricing_url_bridge',
          });
        }
      })();
    }
  }, [currentTier, locale, pricingPlans, trackEvent]);

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-4 pb-12">
      {/* 1. 会员身份沉浸区 - The "Status Hero" */}
      {isPremium ? (
        <div className="relative overflow-hidden p-6 rounded-[28px] bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 text-white shadow-2xl shadow-indigo-500/20 mb-8 border border-white/10">
          <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 blur-[60px] rounded-full" />
          <div className="relative z-10 flex flex-col gap-4 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                  <Crown size={20} className="text-amber-300 fill-amber-300/20" />
                </div>
                <div>
                  <h2 className="text-xl font-black italic tracking-tight uppercase tracking-tighter">
                    {isPlus ? t('plus.name') : t('go.name')}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-indigo-100/80 uppercase tracking-widest">{t('active')}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold text-indigo-200/60 uppercase block mb-1">{t('expiryLabel')}</span>
                <span className="text-xs font-black tabular-nums">{expiresAt ? formatExpiry(expiresAt) : t('lifetimeLabel')}</span>
              </div>
            </div>

            {canManageStripeSubscription && (
              <button 
                onClick={handleManageSubscription}
                disabled={loadingPortal}
                className="mt-2 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                {loadingPortal ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
                {loadingPortal ? t('portalRedirecting') : t('manageSub')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/10 mb-6 text-left">
          <h3 className="font-black italic text-lg mb-1 uppercase tracking-tighter">{t('subtitle')}</h3>
          <p className="text-[11px] font-medium text-indigo-100 opacity-90 leading-relaxed">
            {t('desc')}
          </p>
          {canManageStripeSubscription && (
            <button
              onClick={handleManageSubscription}
              disabled={loadingPortal}
              className="mt-4 w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all border border-white/10 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {loadingPortal ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />}
              {loadingPortal ? t('portalRedirecting') : t('manageSub')}
            </button>
          )}
        </div>
      )}

      {/* 2. 方案选择矩阵 - Strategic Plan List */}
      <div className="space-y-4">
        {pricingPlans.map((plan) => {
          const planEnName = plan.enName.toLowerCase();
          const isCurrent = (planEnName === 'free' && currentTier === 'free') || 
                            (planEnName === 'go' && currentTier === 'go') ||
                            (planEnName === 'plus' && currentTier === 'plus');
          
          // Hide free plan for premium users
          if (isPremium && planEnName === 'free') return null;
          // Hide Go plan for Plus users
          if (isPlus && planEnName === 'go') return null;

          return (
            <div 
              key={plan.name}
              className={`relative p-5 rounded-[24px] border transition-all duration-300 ${
                plan.highlight && !isPremium
                ? 'bg-indigo-500/5 border-indigo-500/20 ring-1 ring-indigo-500/10' 
                : 'bg-white/[0.02] border-white/5'
              } ${isCurrent ? 'opacity-100' : 'opacity-90 grayscale-[0.3] hover:grayscale-0'}`}
            >
              {plan.highlight && !isPremium && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-600 rounded-bl-2xl rounded-tr-[22px] text-[8px] font-black uppercase tracking-widest text-white shadow-lg">
                  {t('recommend')}
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    plan.color === 'indigo' ? 'bg-indigo-500/10 text-indigo-400' :
                    plan.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-slate-500/10 text-slate-400'
                  }`}>
                    <plan.icon size={20} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-base font-black italic uppercase tracking-tight ${plan.highlight ? 'text-white' : 'text-slate-300'}`}>
                        {tGlobal(plan.name as FullMessageKey)}
                      </h3>
                      {isCurrent && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/10 text-[8px] font-black text-indigo-400 uppercase tracking-tighter">
                          <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                          {t('active')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] font-bold text-slate-500">{currencySymbol}</span>
                      <span className="text-xl font-black tracking-tighter text-white">{plan.price}</span>
                      {planEnName !== 'free' && <span className="text-[10px] text-slate-500 ml-1 font-bold uppercase">
                        {planEnName === 'plus' ? 'Coming Soon' : tGlobal(plan.period as FullMessageKey, { price: annualPriceStr }).split('/')[0]}
                      </span>}
                    </div>
                  </div>
                </div>
              </div>

              <ul className="grid grid-cols-1 gap-2.5 mb-6">
                {plan.features.slice(0, isPremium ? 3 : 5).map((feature) => {
                  let rendered = feature;
                  if (feature.startsWith('pricing.')) {
                    const [keyWithPrefix, val] = feature.split('|');
                    const key = keyWithPrefix as FullMessageKey;
                    if (key === 'pricing.features.insights') {
                      rendered = tGlobal(key, { count: val });
                    } else if (key === 'pricing.features.model') {
                      rendered = tGlobal(key, { model: val });
                    } else {
                      rendered = tGlobal(key);
                    }
                  }

                  return (
                    <li key={feature} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400 font-medium text-left">
                      <Check size={12} className={`mt-0.5 shrink-0 ${plan.highlight ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <span>{rendered}</span>
                    </li>
                  );
                })}
              </ul>

              {/* Actions Section */}
              <div className="flex flex-col gap-2">
                {isCurrent && (planEnName === 'free' || planEnName === 'go' || planEnName === 'plus') ? (
                  <button disabled className="w-full py-3 rounded-xl bg-white/5 border border-white/5 text-slate-600 text-[10px] font-black italic uppercase tracking-widest cursor-default">
                    {t('currentStatus')}
                  </button>
                ) : plan.priceId ? (
                  <>
                    <button
                      onClick={() => handleUpgrade(plan.priceId!)}
                      disabled={!!loadingPriceId}
                      className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white text-xs font-black italic flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                    >
                      {loadingPriceId === plan.priceId 
                        ? t('processing') 
                        : (isPremium ? t('monthly', { price: monthlyPriceStr }) : getSubscribeLabel(plan.name))
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
                          <span>{isPremium ? t('annualExtended', { price: annualPriceStr }) : t('annual')}</span>
                          <span className="text-[8px] opacity-80 uppercase tracking-wider font-bold">
                            {isPremium ? t('annualBenefit') : t('annualDiscount')}
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
                    {planEnName === 'plus' ? 'Join Waiting List' : (plan.cta ? tGlobal(plan.cta as FullMessageKey) : t('ctaDefault'))}
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
            <span>{t('manualChannel')}</span>
          </div>
          <h3 className="text-sm font-black italic text-white mb-2 uppercase tracking-tight">{t('manualSupport')}</h3>
          <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-5">{t('manualSupportDesc')}</p>
          
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

      <div className="pt-4 pb-8 space-y-2">
        <p className="text-[10px] text-center text-slate-500 font-medium leading-relaxed italic px-2">
          {t('androidPushWarning')}
        </p>
        <p className="text-[10px] text-center text-slate-600 font-medium leading-relaxed italic px-2">
          {t('riskWarning')}
        </p>
      </div>
    </div>
  );
}
