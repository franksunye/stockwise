'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, ShieldCheck, Target, Clock } from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { shouldEnableHighPerformance } from '@/lib/device-utils';
import { MEMBERSHIP_CONFIG } from '@/lib/membership-config';
import { getPredictionActionMeta } from '@/lib/layer1-ui';
import { useT, useLocale } from '@/context/LocaleContext';
import { getLocalizedStockName } from '@/lib/stock-name';
import { getMarketBadge } from '@/lib/market-badge';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { MessageKey } from '@/lib/i18n';
import { commitOnboardingCompletionSnapshot } from '@/lib/dashboard-bootstrap';
import {
  WATCHLIST_SYNC_EVENT,
  readCachedWatchlist,
} from '@/lib/watchlist-cache';

// Fallback data for the reveal step
const DEFAULT_REVEAL_DATA = { 
  name: 'Stock', 
  price: 100.00, 
  change: 2.5, 
  signal: 'Long', 
  confidence: 0.85, 
  reason: 'Strong bullish pattern with ideal volume support.', 
  support: 95.00 
};

interface RecommendedStock {
  symbol: string;
  name: string;
  name_en?: string | null;
  market: string;
}

export function OnboardingOverlay() { 
  const t = useT('onboarding');
  const tDashboard = useT('dashboard');
  const { locale } = useLocale();
  const stockLocale = locale === 'en' ? 'en' : 'cn';
  const isHighPerformance = shouldEnableHighPerformance();
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [trialDays, setTrialDays] = useState(MEMBERSHIP_CONFIG.onboarding.trialDays);
  const [isCompleting, setIsCompleting] = useState(false);
  const { trackEvent } = useAnalytics();

  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [selectedStockName, setSelectedStockName] = useState<string | null>(null);
  const [selectedStockNameEn, setSelectedStockNameEn] = useState<string | null>(null);
  const [analyzingStage, setAnalyzingStage] = useState(0); // 0: None, 1: Connecting, 2: Flows, 3: AI
  const [revealData, setRevealData] = useState(DEFAULT_REVEAL_DATA);
  const [recommendedStocks, setRecommendedStocks] = useState<RecommendedStock[]>([]);
  const { profile, loading: profileLoading, refreshProfile } = useUserProfile();
  const revealActionMeta = getPredictionActionMeta({
    signal: revealData.signal as 'Long' | 'Short' | 'Side',
  });
  const hasActiveAccess = Boolean(
    profile?.tier &&
    profile.tier !== 'free' &&
    profile.expiresAt &&
    new Date(profile.expiresAt).getTime() > Date.now(),
  );
  const willGrantOnboardingTrial = Boolean(
    profile &&
    !profile.hasOnboarded &&
    profile.tier === 'free' &&
    !profile.expiresAt,
  );

  const fetchRecommendedStocks = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/onboarding/stocks?locale=${locale}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.stocks && data.stocks.length > 0) {
        setRecommendedStocks(data.stocks);
      }
    } catch (e) {
      console.error("Fetch recommended stocks failed", e);
    }
  }, [locale]);

  useEffect(() => {
    if (!profileLoading && profile) {
      if (!profile.hasOnboarded) {
        setIsVisible(true);
        // Track the start of onboarding
        trackEvent('onboarding_start', { tier: profile.tier });
        
        // If they already have an active trial/membership, show the remaining valid days.
        if (profile.tier !== 'free' && profile.expiresAt) {
          const expiry = new Date(profile.expiresAt);
          const now = new Date();
          const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 3) setTrialDays(diffDays);
        }
      } else {
        localStorage.setItem('STOCKWISE_HAS_ONBOARDED', 'true');
        setIsVisible(false);
      }
    }
  }, [profile, profileLoading, trackEvent]);

  // Track each step view
  useEffect(() => {
    if (isVisible) {
      trackEvent('onboarding_step_view', { 
        step_number: step,
        step_name: ['Welcome', 'Select Stock', 'Reveal Analysis', 'Complete'][step - 1]
      });
    }
  }, [step, isVisible, trackEvent]);

  useEffect(() => {
    fetchRecommendedStocks();
  }, [fetchRecommendedStocks]);

  const handleComplete = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
        const response = await fetch('/api/user/onboarding/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selectedStock })
        });
        if (!response.ok) {
          throw new Error(`Onboarding completion failed: ${response.status}`);
        }
        const completionPayload = await response.json().catch(() => null);
        const nextWatchlist = selectedStock
          ? (() => {
              const currentList = readCachedWatchlist();
              const alreadyExists = currentList.some((item) => item?.symbol === selectedStock);
              if (alreadyExists) return currentList;
              return [
                ...currentList,
                {
                  symbol: selectedStock,
                  name: selectedStockName || selectedStock,
                  name_en: selectedStockNameEn ?? null,
                  addedAt: Date.now(),
                },
              ];
            })()
          : readCachedWatchlist();

        const snapshot = profile?.userId
          ? commitOnboardingCompletionSnapshot({
              userId: profile.userId,
              tier: completionPayload?.tier || profile.tier,
              expiresAt: completionPayload?.expiresAt ?? profile.expiresAt ?? null,
              watchlist: nextWatchlist,
              profile,
            })
          : null;

        if (selectedStock) {
          try {
            window.dispatchEvent(new Event(WATCHLIST_SYNC_EVENT));
          } catch (storageError) {
            console.error('Failed to seed onboarding watchlist cache', storageError);
          }
        }
        
        // Track final completion (Standard Sign-Up)
        trackEvent('sign_up', { method: 'onboarding_invite', tier: snapshot?.tier || profile?.tier });
        trackEvent('onboarding_complete');

        window.dispatchEvent(new Event('stockwise-onboarding-complete'));
        setIsVisible(false);

        // Refresh profile in background so UI can enter dashboard immediately.
        void refreshProfile({ force: true }).catch((error) => {
          console.error('Background profile refresh after onboarding failed', error);
        });
        
    } catch (e) {
        console.error("Completion failed", e);
        setIsCompleting(false);
    }
  };

  const startAnalysis = async (symbol: string, name?: string, nameEn?: string | null) => {
    trackEvent('onboarding_stock_selected', { symbol });
    setSelectedStock(symbol);
    setSelectedStockName(name || symbol);
    setSelectedStockNameEn(nameEn ?? null);
    setAnalyzingStage(1);
    
    // Simulate Steps Timeline (Ensures progress even if API is slow)
    const stage2Timer = setTimeout(() => setAnalyzingStage(2), 2000);
    const stage3Timer = setTimeout(() => setAnalyzingStage(3), 4500);
    const step4Timer = setTimeout(() => setStep(3), 7000); // 兜底进入下一步

    // Fetch real stock data with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6秒请求超时

      const res = await fetch(`/api/stock?symbol=${symbol}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`API status: ${res.status}`);
      const data = await res.json();
      
      if (data.price || data.prediction) {
        // Parse ai_reasoning JSON
        let reasoningSummary = t('analysis.defaultReasoning');
        try {
          const rawReasoning = data.prediction?.ai_reasoning || '';
          if (rawReasoning.startsWith('{')) {
              const tacticalData = JSON.parse(rawReasoning);
              reasoningSummary = tacticalData?.summary || tacticalData?.conclusion || reasoningSummary;
          } else {
              reasoningSummary = rawReasoning || reasoningSummary;
          }
        } catch {
          reasoningSummary = data.prediction?.ai_reasoning || reasoningSummary;
        }
        
        setRevealData({
          name: getLocalizedStockName(
            { symbol, name: name || symbol, name_en: nameEn ?? null },
            stockLocale,
          ),
          price: data.price?.close || 0,
          change: data.price?.change_percent || 0,
          signal: data.prediction?.signal || 'Side',
          confidence: data.prediction?.confidence || 0.7,
          reason: reasoningSummary,
          support: data.prediction?.support_price || (data.price?.close ? (data.price.close * 0.95) : 95)
        });
      }
    } catch (e) {
      console.warn('Onboarding fetch failed/timed out, using fallback:', e);
      // Data is already set to default or will be updated if fetch eventually succeeds before step 4
      setRevealData({
        ...DEFAULT_REVEAL_DATA,
        name: getLocalizedStockName(
          { symbol, name: name || symbol, name_en: nameEn ?? null },
          stockLocale,
        ),
      });
    }

    // Cleanup timers if we manually change step (optional, but good practice if logic evolves)
    return () => {
        clearTimeout(stage2Timer);
        clearTimeout(stage3Timer);
        clearTimeout(step4Timer);
    };
  };

  if (!isVisible) return null;

  return (
    <div
      data-dashboard-onboarding-overlay="true"
      className="fixed inset-0 z-[999] bg-[#050508] text-white overflow-y-auto"
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[#050508]">
        {!isHighPerformance && (
          <>
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full" />
          </>
        )}
        {isHighPerformance && (
          <>
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-900/10 via-black to-purple-900/10" />
            <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-indigo-900/10 rounded-full opacity-30" />
          </>
        )}
      </div>

      <div className="relative z-10 w-full max-w-md px-6 mx-auto flex flex-col min-h-full pb-12">
        
        {/* Step Indicator */}
        <div className="flex gap-1 pt-8 mb-8 justify-center">
            {[1, 2, 3, 4].map(s => (
                <div key={s} className={`h-1 rounded-full transition-all duration-500 ${s <= step ? 'w-8 bg-indigo-500' : 'w-2 bg-white/10'}`} />
            ))}
        </div>

        <div className="flex-1 flex flex-col justify-center py-4">
            <AnimatePresence mode='wait'>
                
                {/* STEP 1: WELCOME */}
                {step === 1 && (
                    <motion.div 
                        key="step1"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-center space-y-8"
                    >
                        <div className="relative inline-block">
                             {!isHighPerformance && <div className="absolute inset-0 bg-indigo-500 blur-[40px] opacity-40 rounded-full" />}
                             <Zap className="w-24 h-24 text-white relative z-10" />
                        </div>
                        <div className="space-y-4">
                            <h1 className="text-4xl font-black italic tracking-tighter">
                                {t('welcome')}<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{t('assistant')}</span>
                            </h1>
                            <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-xs mx-auto">
                                {t('subtitle')}
                            </p>
                        </div>
                        <button onClick={() => setStep(2)} className="w-full py-4 bg-white text-black font-black text-lg rounded-2xl active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)]">
                            {t('start')}
                        </button>
                    </motion.div>
                )}

                {/* STEP 2: INTERACTIVE INPUT */}
                {step === 2 && (
                    <motion.div 
                        key="step2"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        className="space-y-8 text-center"
                    >
                        {analyzingStage === 0 ? (
                            <>
                                <h2 className="text-2xl font-bold">{t('selectTitle')}</h2>
                                <p className="text-slate-400 text-sm">{t('selectDesc')}</p>
                                
                                {/* Curated Stock List - Only stocks with AI predictions */}
                                <div className="space-y-3 text-left">
                                    {(recommendedStocks.length > 0 ? recommendedStocks : [
                                        { symbol: '00700', name: '腾讯控股', market: 'HK' },
                                        { symbol: '600519', name: '贵州茅台', market: 'CN' },
                                        { symbol: '01398', name: '工商银行', market: 'HK' },
                                        { symbol: '688981', name: '中芯国际', market: 'CN' },
                                    ]).map(item => {
                                        const badge = getMarketBadge(item.market, 'full', locale);
                                        return (
                                            <button 
                                                key={item.symbol} 
                                                onClick={() => startAnalysis(item.symbol, item.name, item.name_en)} 
                                                className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-indigo-500/30 transition-all active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xs font-black border ${badge.className}`}>
                                                        {badge.label}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-base font-bold text-white">{getLocalizedStockName(item, stockLocale)}</p>
                                                        <p className="text-[10px] text-slate-500 mono uppercase tracking-wider">{item.symbol}{badge.suffix}</p>
                                                    </div>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                                    <Zap size={14} className="text-indigo-400" />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                
                                <p className="text-[10px] text-slate-600 italic">{t('selectNote')}</p>
                            </>
                        ) : (
                            <div className="py-12 space-y-8">
                                <div className="relative w-32 h-32 mx-auto">
                                    <svg className="w-full h-full animate-spin-slow" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" fill="none" className="text-white/10" />
                                        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" fill="none" className="text-indigo-500" strokeDasharray="283" strokeDashoffset="100" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Zap className="w-10 h-10 text-indigo-400 animate-pulse" />
                                    </div>
                                </div>
                                <div className="space-y-2 h-16">
                                    <motion.p 
                                        key={analyzingStage}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-lg font-bold text-white tracking-wide"
                                    >
                                        {analyzingStage === 1 && t('analyzing.connecting')}
                                        {analyzingStage === 2 && t('analyzing.flows')}
                                        {analyzingStage === 3 && t('analyzing.ai')}
                                    </motion.p>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* STEP 3: REVEAL (THE WOW MOMENT) */}
                {step === 3 && (
                    <motion.div 
                        key="step3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="relative"
                    >
                        <div className="absolute -top-9 left-0 right-0 text-center mb-4">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 text-amber-300 text-[10px] font-bold border border-amber-500/20 uppercase tracking-[0.18em]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    {t('reveal.goUnlocked')}
                                </span>
                        </div>

                        {/* HERO CARD UI */}
                        <div className="bg-[#1a1a24] border border-white/10 rounded-3xl p-5 shadow-2xl relative overflow-hidden group">
                           {/* Decorative Glow */}
                           {!isHighPerformance && (
                              <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br opacity-20 blur-[60px] rounded-full pointer-events-none ${
                                  revealData.signal === 'Long' ? 'from-emerald-500' : 'from-rose-500'
                              }`} />
                           )}

                           <div className="relative z-10 space-y-5">
                                {/* Header */}
                                <div className="flex justify-between items-start">
                                    <div className="pr-4">
                                        <h3 className="text-[2rem] leading-[0.95] font-black italic text-white tracking-tighter">{revealData.name}</h3>
                                        <p className="text-[10px] font-black text-slate-500 tracking-[0.24em] uppercase mt-2">{t('reveal.reportTitle')}</p>
                                    </div>
                                    <div className={`flex flex-col items-end shrink-0 ${revealData.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        <span className="text-[1.9rem] leading-none font-black mono">{revealData.price.toFixed(2)}</span>
                                        <span className="text-[11px] font-bold mt-1">{revealData.change >= 0 ? '+' : ''}{revealData.change.toFixed(2)}%</span>
                                    </div>
                                </div>

                                {/* Core Signal */}
                                <div className="py-4 text-center border border-white/5 bg-black/20 rounded-2xl relative overflow-hidden">
                                     <div className={`text-[10px] font-black uppercase tracking-[0.18em] mb-2 ${
                                         revealData.signal === 'Long' ? 'text-emerald-500' : revealData.signal === 'Short' ? 'text-rose-500' : 'text-amber-500'
                                     }`}>
                                         {t('reveal.advice')}
                                     </div>
                                     <div className={`text-[2rem] leading-none font-black tracking-tighter ${
                                         revealData.signal === 'Long' ? 'text-emerald-400' : revealData.signal === 'Short' ? 'text-rose-400' : 'text-amber-400'
                                     }`}>
                                         {tDashboard(`signal.${revealActionMeta.headline}` as MessageKey<'dashboard'>)}
                                     </div>
                                </div>

                                {/* Deep Insight (Usually Blurred) */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-indigo-400">
                                        <Zap className="w-4 h-4 fill-current" />
                                        <span className="text-[11px] font-black uppercase tracking-[0.18em]">{t('reveal.insight')}</span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-300 leading-relaxed border-l-2 border-indigo-500/40 pl-3">
                                        &quot;{revealData.reason}&quot;
                                    </p>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/5 rounded-2xl p-3 flex flex-col justify-between min-h-[92px]">
                                        <div className="text-[10px] text-slate-500 uppercase font-black tracking-[0.12em] flex items-center gap-1">
                                            <Target className="w-3 h-3" /> {t('reveal.confidence')}
                                        </div>
                                        <span className="text-[1.75rem] leading-none font-black text-white mt-2">{(revealData.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="bg-white/5 rounded-2xl p-3 flex flex-col justify-between min-h-[92px]">
                                        <div className="text-[10px] text-slate-500 uppercase font-black tracking-[0.12em] flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3" /> {t('reveal.support')}
                                        </div>
                                        <span className="text-[1.75rem] leading-none font-black text-white mt-2">{revealData.support.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Prompt */}
                                <div className="pt-1">
                                     <p className="text-[10px] text-center text-slate-500 italic leading-relaxed">
                                        {t('reveal.privilegeNote')}
                                     </p>
                                </div>
                           </div>
                        </div>

                        <div className="mt-7 space-y-3">
                             <button onClick={() => setStep(4)} className="w-full py-4 bg-indigo-600 text-white font-black text-lg rounded-2xl active:scale-95 transition-all shadow-lg hover:bg-indigo-500">
                                {t('reveal.cta')}
                             </button>
                        </div>
                    </motion.div>
                )}

                {/* STEP 4: COMPLETION */}
                {step === 4 && (
                    <motion.div 
                        key="step4"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-8"
                    >
                         <div className="relative inline-block">
                             {!isHighPerformance && <div className="absolute inset-0 bg-emerald-500 blur-[40px] opacity-40 rounded-full" />}
                             <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center relative z-10 mx-auto shadow-2xl">
                                 <Check className="w-12 h-12 text-white" />
                             </div>
                        </div>
                        
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black italic text-white">{t('complete.ready')}</h2>
                            <p className="text-slate-400">
                                <span className="text-white font-bold">{selectedStock && selectedStockName ? getLocalizedStockName({ symbol: selectedStock, name: selectedStockName, name_en: selectedStockNameEn }, stockLocale) : (selectedStock || 'Trial Asset')}</span> {t('complete.added', { symbol: '' })}
                            </p>
                            
                            {/* Access Status Card */}
                            <div className="bg-gradient-to-br from-indigo-900/40 to-black border border-indigo-500/30 p-6 rounded-2xl relative overflow-hidden">
                                <div className="relative z-10">
                                     <h3 className="text-indigo-300 font-bold uppercase tracking-widest text-xs mb-2">
                                        {hasActiveAccess ? t('complete.activeAccess') : willGrantOnboardingTrial ? t('complete.gift') : t('complete.workspace')}
                                     </h3>
                                     <p className="text-white font-bold text-lg mb-1">
                                        {hasActiveAccess
                                          ? t('complete.activeTitle', { days: trialDays })
                                          : willGrantOnboardingTrial
                                            ? t('complete.trial', { days: trialDays })
                                            : t('complete.workspaceTitle')}
                                     </p>
                                     <p className="text-slate-400 text-xs">
                                        {hasActiveAccess
                                          ? t('complete.activeDesc')
                                          : willGrantOnboardingTrial
                                            ? t('complete.trialDesc')
                                            : t('complete.workspaceDesc')}
                                     </p>
                                </div>
                                <Clock className="absolute -bottom-4 -right-4 w-24 h-24 text-indigo-500/10" />
                            </div>
                        </div>

                        <button
                          onClick={handleComplete}
                          disabled={isCompleting}
                          className="w-full py-4 bg-white text-black font-black text-lg rounded-2xl active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isCompleting ? (locale === 'en' ? 'Opening...' : '正在打开...') : t('complete.cta')}
                        </button>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
