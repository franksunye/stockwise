'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X as CloseIcon, 
  Info, 
  TrendingUp, 
  Zap, 
  BarChart3, 
  RotateCcw, 
  Target,
  ChevronDown,
  Newspaper,
  Crosshair,
  Layers,
  Hash,
  AlertTriangle,
  Sparkles,
  TrendingDown,
  Shield,
  ChevronUp,
  Copy,
  Check,
  Share2
} from 'lucide-react';
import { AIPrediction, TacticalData, ShortMetrics } from '@/lib/types';
import { shouldEnableHighPerformance } from '@/lib/device-utils';
import { AICouncil } from './AICouncil';
import { TradeManagementTab } from './TradeManagementTab';
import Multiavatar from '@/components/Multiavatar';
import { resolveAnalystForBriefSource } from '@/lib/agent-team';
import {
  getBriefSourceKind,
  getGeneralTactics,
  getPriceNodes,
  getScenarioTacticGroups,
  getShortPressureState,
  formatBriefActionLabel,
  normalizeActionLabel,
  normalizeLegacyTerms,
} from '@/lib/tactical-brief-surface';
import { useT, useLocale } from '@/context/LocaleContext';
import { getLocalizedStockName } from '@/lib/stock-name';
import type { MessageKey } from '@/lib/i18n';
import { SilentPoster } from './SilentPoster';
import { BriefExportSheet } from './BriefExportSheet';
import { TacticalReportPoster } from './TacticalReportPoster';

interface TacticalBriefDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: TacticalData;
  userPos: 'holding' | 'empty' | 'none';
  tier: 'free' | 'go' | 'plus' | 'pro' | 'alpha';
  model?: string;
  symbol: string;
  targetDate: string;
  signal?: 'Long' | 'Short' | 'Side';
  layer1Status?: AIPrediction['layer1_status'];
  confidence?: number;
  stockName?: string;
  stockNameEn?: string | null;
  currentPrice?: number;
  shortMetrics?: ShortMetrics | null;
}

// 辅助函数：获取步骤对应的图标和 i18n key 配置
const getStepConfig = (step: string) => {
  const s = step.toLowerCase();
  
  if (s.includes('trend')) return { icon: <TrendingUp size={12} />, key: 'trend' };
  if (s.includes('momentum')) return { icon: <Zap size={12} />, key: 'momentum' };
  if (s.includes('volume')) return { icon: <BarChart3 size={12} />, key: 'volume' };
  if (s.includes('history')) return { icon: <RotateCcw size={12} />, key: 'history' };
  if (s.includes('decision')) return { icon: <Target size={12} />, key: 'decision' };
  
  if (s.includes('news') || s.includes('fundamental')) return { icon: <Newspaper size={12} />, key: 'intelligence' };
  if (s.includes('position') || s.includes('level') || s.includes('price')) return { icon: <Crosshair size={12} />, key: 'priceAction' };
  if (s.includes('context')) return { icon: <Layers size={12} />, key: 'context' };
  if (s.includes('fund') || s.includes('capital') || s.includes('flow') || s.includes('money')) return { icon: <Hash size={12} />, key: 'capital' };

  return { icon: <Hash size={12} />, key: 'general' };
};

// 语义化价格格式化
const formatPrice = (val: number | string | number[] | undefined, isRange: boolean = false): string => {
  if (val === undefined || val === null) return '--';
  
  if (Array.isArray(val)) {
    if (val.length === 0) return '--';
    
    // 如果是区间，显示 A - B (后端已排序，这里做兜底)
    if (isRange) {
      const sorted = [...val].map(Number).sort((a, b) => a - b);
      return sorted.length >= 2 ? `${sorted[0]} - ${sorted[1]}` : `${sorted[0]}`;
    }
    
    // 如果是离散点位，显示 A / B
    return val.join(' / ');
  }
  
  return String(val);
};

const formatLevel = (val: number | undefined): string => {
  if (val === undefined || !Number.isFinite(val)) return '--';
  return Number.isInteger(val) ? `${val}` : val.toFixed(2).replace(/\.?0+$/, '');
};

const getLevelDistance = (current: number | undefined, level: number | undefined): number | undefined => {
  if (
    current === undefined ||
    level === undefined ||
    !Number.isFinite(current) ||
    !Number.isFinite(level) ||
    current === 0
  ) {
    return undefined;
  }
  return ((level - current) / current) * 100;
};

const formatDistancePercent = (distance: number | undefined): string => {
  if (distance === undefined || !Number.isFinite(distance)) return '--';
  const abs = Math.abs(distance);
  const sign = distance > 0 ? '+' : '-';
  return `${sign}${abs.toFixed(2)}%`;
};

export function TacticalBriefDrawer({ 
  isOpen, onClose, data, tier, model, symbol, targetDate, signal, layer1Status, confidence, stockName, stockNameEn, currentPrice, shortMetrics, userPos
}: TacticalBriefDrawerProps) {
  const t = useT('brief');
  const tCommon = useT('common');
  const { locale } = useLocale();
  const stockLocale = locale === 'en' ? 'en' : 'cn';
  const displayStockName = useMemo(
    () =>
      getLocalizedStockName(
        { symbol, name: stockName || symbol, name_en: stockNameEn ?? null },
        stockLocale,
      ),
    [symbol, stockName, stockNameEn, stockLocale],
  );
  const [isMounted, setIsMounted] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isCounterArgumentExpanded, setIsCounterArgumentExpanded] = useState(false);
  const [isConflictResolutionExpanded, setIsConflictResolutionExpanded] = useState(false);
  const [isScenarioCopied, setIsScenarioCopied] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isHighPerformance = shouldEnableHighPerformance();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'brief' | 'council' | 'management'>('brief');
  const isV10 = ['free', 'go', 'plus'].includes(tier);
  const showManagement = ['pro', 'alpha'].includes(tier);
  const showStockAlmanacExport = tier === 'pro' || tier === 'alpha';
  const sourceKind = getBriefSourceKind(data, model);
  const analystProfile = resolveAnalystForBriefSource(sourceKind, model);
  const analystDisplayName =
    locale === 'en' ? analystProfile.nameEn ?? analystProfile.name : analystProfile.name;
  const analystDisplayRole =
    locale === 'en' ? analystProfile.roleEn ?? analystProfile.role : analystProfile.role;
  const sourceFact = sourceKind === 'llm' ? t('independentView') : t('ruleView');
  const generalTactics = getGeneralTactics(data);
  const { scenarioHoldingProfit, scenarioHoldingLoss, scenarioEmpty } = getScenarioTacticGroups(data);

  const [viewState, setViewState] = useState<'holding_profit'|'holding_loss'|'empty'>('holding_profit');
  const [activeIndex, setActiveIndex] = useState(0);
  const nodes = getPriceNodes(data, currentPrice);
  const isHK = symbol.length === 5;
  const scrollRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const { shortRatio, ...shortPressure } = getShortPressureState(symbol, shortMetrics);

  const scenarioCopyConfig = {
    holding_profit: {
      title: t('scenario.holding_profit'),
      badge: t('scenarioBadge.holding_profit'),
      items: scenarioHoldingProfit,
    },
    holding_loss: {
      title: t('scenario.holding_loss'),
      badge: t('scenarioBadge.holding_loss'),
      items: scenarioHoldingLoss,
    },
    empty: {
      title: t('scenario.empty'),
      badge: t('scenarioBadge.empty'),
      items: scenarioEmpty,
    },
  } as const;

  const defaultActiveIndex = useMemo(() => {
    const nowIdx = nodes.findIndex((node) => node.kind === 'current');
    return nowIdx >= 0 ? nowIdx : 0;
  }, [nodes]);

  const syncCarouselToIndex = useCallback((index: number) => {
    requestAnimationFrame(() => {
      const container = carouselRef.current;
      if (!container) return;

      const firstChild = container.children[0] as HTMLElement | undefined;
      const step = firstChild ? firstChild.offsetWidth + 16 : container.clientWidth;
      container.scrollTo({ left: index * step, behavior: 'auto' });
    });
  }, []);

  useEffect(() => {
    if (isV10 && activeTab !== 'brief') {
      setActiveTab('brief');
    }
  }, [tier, isV10, activeTab]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'brief') return;
    setActiveIndex(defaultActiveIndex);
    syncCarouselToIndex(defaultActiveIndex);
  }, [activeTab, defaultActiveIndex, isOpen, syncCarouselToIndex]);

  const priceRange = {
    max: Math.max(...nodes.map(n => n.price)) * 1.05,
    min: Math.min(...nodes.map(n => n.price)) * 0.95
  };

  const getY = (price: number) => {
    const range = priceRange.max - priceRange.min;
    return range === 0 ? 50 : ((priceRange.max - price) / range) * 100;
  };
  
  const posterPrediction: AIPrediction = {
    symbol,
    target_date: targetDate,
    signal: signal || 'Side',
    // Pass through layer1_status so TacticalReportPoster can apply tier gating
    // consistently with the dashboard card.
    layer1_status: layer1Status,
    confidence: confidence || 0,
    ai_reasoning: JSON.stringify(data),
    date: '',
    support_price: 0,
    validation_status: 'Pending',
    actual_change: null
  };

  const buildScenarioCopyText = () => {
    const currentScenario = scenarioCopyConfig[viewState];
    const lines: string[] = [`${t('tradingPlan')}｜${displayStockName}`, `${t('date.tradingDayAdvice' as MessageKey<'brief'>, { date: targetDate })}`, '', `${t('condition')}：${currentScenario.title}`];

    currentScenario.items.forEach((tactic, index) => {
      lines.push(`${tactic.priority} ${formatBriefActionLabel(tactic.action, (slug) => t(`actions.${slug}` as MessageKey<'brief'>))}`);
      lines.push(`${t('triggerLabel')}：${normalizeLegacyTerms(tactic.trigger)}`);

      if (tactic.target_price) {
        lines.push(`${t('target')}：${formatPrice(tactic.target_price)}`);
      }
      if (tactic.stop_advance_price) {
        lines.push(`${t('stopAdvance')}：${formatPrice(tactic.stop_advance_price, true)}`);
      }
      if (tactic.stop_loss_price) {
        lines.push(`${t('stopLoss')}：${formatPrice(tactic.stop_loss_price, true)}`);
      }
      if (tactic.buy_zone_price) {
        lines.push(`${t('buyZone')}：${formatPrice(tactic.buy_zone_price, true)}`);
      }

      lines.push(`${t('reasonLabel')}：${normalizeLegacyTerms(tactic.reason)}`);

      if (index < currentScenario.items.length - 1) {
        lines.push('');
      }
    });

    lines.push('', '- ZISO AI -');

    return lines.join('\n');
  };

  const handleCopyScenario = async () => {
    try {
      await navigator.clipboard.writeText(buildScenarioCopyText());
      setIsScenarioCopied(true);
      setTimeout(() => setIsScenarioCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy tactical scenario', error);
    }
  };

  const handleOpenAlmanac = () => {
    setIsExportOpen(false);
    setIsShareOpen(true);
  };

  const handleOpenReport = () => {
    setIsExportOpen(false);
    setIsReportOpen(true);
  };

  if (!isMounted) return null;

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <div
          data-tactical-brief-drawer="true"
          data-tactical-brief-symbol={symbol}
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 pointer-events-auto overflow-hidden overscroll-none"
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 will-change-opacity"
          />
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 150) onClose();
            }}
            transition={isHighPerformance 
              ? { type: 'tween', ease: 'easeOut', duration: 0.25 }
              : { type: 'spring', damping: 25, stiffness: 200 }
            }
            className="w-full max-w-md bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-10 h-[85vh] flex flex-col transform-gpu will-change-transform touch-pan-y"
          >
            {/* 顶部视觉拉手 */}
            <div className="w-full flex justify-center pt-3 pb-1 shrink-0 bg-[#0a0a0f]">
               <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>

            {/* 固定 Header */}
            <header className="relative flex items-center justify-center py-2 px-6 bg-[#0a0a0f] border-b border-white/5 shadow-lg shadow-black/20 shrink-0 z-20">
                 {/* Left: Export */}
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setIsExportOpen(true);
                   }} 
                   className="absolute left-4 p-2.5 rounded-full bg-white/5 border border-white/10 text-indigo-400 active:scale-95 transition-all hover:bg-white/10 hover:text-indigo-300 z-20"
                   title={t('exportBrief')}
                 >
                   <Share2 size={18} />
                 </button>

                 {/* Center: Navigation (Tier-Aware) */}
                  {isV10 ? (
                    <div className="flex p-1 rounded-full bg-white/5 border border-white/10 relative z-10">
                        <button
                        type="button"
                        disabled
                        className="relative z-10 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-white cursor-default"
                        aria-current="page"
                      >
                        {t('title')}
                        <div className="absolute inset-0 bg-indigo-500 rounded-full -z-10 shadow-lg shadow-indigo-500/20" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex p-1 rounded-full bg-white/5 border border-white/10 relative z-10">
                        <button 
                          onClick={() => setActiveTab('brief')}
                          className={`relative z-10 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors duration-200 ${activeTab === 'brief' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          {t('title')}
                          {activeTab === 'brief' && (
                            <motion.div 
                              className="absolute inset-0 bg-indigo-500 rounded-full -z-10 shadow-lg shadow-indigo-500/20"
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              layoutId="activeTab"
                              transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                            />
                          )}
                        </button>
                        
                        {showManagement && (
                          <button 
                            onClick={() => setActiveTab('management')}
                            className={`relative z-10 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors duration-200 ${activeTab === 'management' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            {tCommon('tradeManagement')}
                            {activeTab === 'management' && (
                              <motion.div 
                                className="absolute inset-0 bg-indigo-500 rounded-full -z-10 shadow-lg shadow-indigo-500/20"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                layoutId="activeTab"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                              />
                            )}
                          </button>
                        )}
                    </div>
                  )}

                 {/* Right: Close Button */}
                 <button 
                   onClick={onClose} 
                   className="absolute right-4 p-2.5 rounded-full bg-white/5 border border-white/10 text-slate-400 active:scale-95 transition-all hover:bg-white/10 hover:text-white z-20"
                 >
                   <CloseIcon size={18} />
                 </button>
            </header>

            <div className={`p-6 pt-4 flex-1 overflow-y-auto scrollbar-hide relative`}>
              {activeTab === 'brief' ? (
                <div className="space-y-8 pb-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* 源类型标记 */}
                  <div className={`mb-6 px-4 py-3 rounded-xl border flex items-center gap-3 ${sourceKind === 'llm' ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/20' : 'bg-slate-800/40 border-white/5'}`}>
                      <div className="relative w-10 h-10 shrink-0">
                        <Multiavatar name={analystProfile.avatarSeed} className="w-full h-full" />
                        <div className={`absolute -right-0.5 -bottom-0.5 w-4 h-4 rounded-full border border-[#0a0a0f] flex items-center justify-center ${sourceKind === 'llm' ? 'bg-indigo-500/90' : 'bg-slate-600/90'}`}>
                          {sourceKind === 'llm' ? (
                            <Zap size={9} className="text-white" />
                          ) : (
                            <BarChart3 size={9} className="text-white" />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${sourceKind === 'llm' ? 'text-indigo-200' : 'text-slate-200'}`}>
                            {t('analyst', { name: analystDisplayName, role: analystDisplayRole })}
                          </p>
                          <p className={`text-xs leading-tight mt-0.5 ${sourceKind === 'llm' ? 'text-indigo-300/80' : 'text-slate-400'}`}>
                            {sourceFact}
                          </p>
                      </div>
                  </div>

                  <section>
                     {/* Header */}
                     <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> {t('tradingPlan')}
                        </h3>
                        <button
                          onClick={handleCopyScenario}
                          className="shrink-0 flex items-center justify-center rounded-lg p-1 group"
                          aria-label={t('copyScenario')}
                          title={t('copyScenario')}
                        >
                          <div className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 p-1.5 rounded-lg text-slate-500 group-hover:text-white transition-colors">
                            {isScenarioCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          </div>
                        </button>
                     </div>

                     {/* Horizontal Scroll Container for Scenarios */}
                    <div 
                        ref={scrollRef}
                        onScroll={(e) => {
                           const target = e.currentTarget;
                           const scrollPos = target.scrollLeft;
                           const cardWidth = target.offsetWidth;
                           
                           if (scrollPos < cardWidth * 0.5) {
                               if (viewState !== 'holding_profit') setViewState('holding_profit');
                           } else if (scrollPos < cardWidth * 1.5) {
                               if (viewState !== 'holding_loss') setViewState('holding_loss');
                           } else {
                               if (viewState !== 'empty') setViewState('empty');
                           }
                        }}
                        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-6 px-6 pb-2 overscroll-x-contain"
                    >
                        {/* CARD 1: HOLDING PROFIT (Subtle Green) */}
                        <div className="min-w-full snap-center space-y-3">
                             {scenarioHoldingProfit.map((tactic, idx) => (
                                 <div key={idx} className="glass-card p-4 min-h-[152px] relative overflow-hidden bg-white/[0.02] border-white/5">
                                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#2ECC71]/30" />
                                    
                                    <div className="flex items-center justify-between mb-2.5">
                                         <div className="flex items-center gap-2">
                                             <span className={`text-[10px] font-black px-1.5 py-0.5 rounded italic ${tactic.priority === 'P1' ? 'bg-indigo-500' : 'bg-slate-700'} text-white`}>{tactic.priority}</span>
                                             <span className="text-sm font-bold text-white">{formatBriefActionLabel(tactic.action, (slug) => t(`actions.${slug}` as MessageKey<'brief'>))}</span>
                                         </div>
                                         <div className="px-2 py-0.5 rounded-lg bg-[#2ECC71]/10 border border-[#2ECC71]/20 text-[10px] font-bold text-[#2ECC71]">
                                             {t('scenarioBadge.holding_profit')}
                                         </div>
                                     </div>

                                     <div className="space-y-1.5">
                                         <p className="text-xs text-slate-400">{t('triggerLabel')}: <span className="text-slate-200">{tactic.trigger.startsWith('trigger.') ? t(tactic.trigger as MessageKey<'brief'>) : tactic.trigger}</span></p>
                                         {(tactic.target_price || tactic.stop_advance_price) && (
                                             <div className="flex flex-wrap gap-x-4 gap-y-1 py-1 px-2 bg-white/5 rounded-lg w-fit">
                                                 {tactic.target_price && <p className="text-[10px] text-emerald-400 font-bold uppercase">{t('target')}: {tactic.target_price}</p>}
                                                 {tactic.stop_advance_price && <p className="text-[10px] text-amber-400 font-bold uppercase">{t('stopAdvance')}: {tactic.stop_advance_price}</p>}
                                             </div>
                                         )}
                                         <p className="text-xs text-slate-500 font-medium italic border-t border-white/5 pt-1.5 mt-1.5">{t('reasonLabel')}: {tactic.reason.startsWith('reason.') ? t(tactic.reason as MessageKey<'brief'>) : tactic.reason}</p>
                                     </div>
                                 </div>
                             ))}
                        </div>

                        {/* CARD 2: HOLDING LOSS (Subtle Red) */}
                        <div className="min-w-full snap-center space-y-3">
                             {scenarioHoldingLoss.map((tactic, idx) => (
                                 <div key={idx} className="glass-card p-4 min-h-[152px] relative overflow-hidden bg-white/[0.02] border-white/5">
                                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF4D4F]/30" />
                                    
                                    <div className="flex items-center justify-between mb-2.5">
                                         <div className="flex items-center gap-2">
                                             <span className={`text-[10px] font-black px-1.5 py-0.5 rounded italic ${tactic.priority === 'P1' ? 'bg-rose-500' : 'bg-slate-700'} text-white`}>{tactic.priority}</span>
                                             <span className="text-sm font-bold text-white">{formatBriefActionLabel(tactic.action, (slug) => t(`actions.${slug}` as MessageKey<'brief'>))}</span>
                                         </div>
                                         <div className="px-2 py-0.5 rounded-lg bg-[#FF4D4F]/10 border border-[#FF4D4F]/20 text-[10px] font-bold text-[#FF4D4F]">
                                             {t('scenarioBadge.holding_loss')}
                                         </div>
                                     </div>

                                     <div className="space-y-1.5">
                                         <p className="text-xs text-slate-400">{t('triggerLabel')}: <span className="text-slate-200">{tactic.trigger.startsWith('trigger.') ? t(tactic.trigger as MessageKey<'brief'>) : tactic.trigger}</span></p>
                                         {tactic.stop_loss_price && (
                                             <div className="py-1 px-2 bg-rose-500/10 rounded-lg w-fit">
                                                 <p className="text-[10px] text-rose-400 font-bold uppercase">{t('stopLoss')}: {tactic.stop_loss_price}</p>
                                             </div>
                                         )}
                                         <p className="text-xs text-slate-500 font-medium italic border-t border-white/5 pt-1.5 mt-1.5">{t('reasonLabel')}: {tactic.reason.startsWith('reason.') ? t(tactic.reason as MessageKey<'brief'>) : tactic.reason}</p>
                                     </div>
                                 </div>
                             ))}
                        </div>

                        {/* CARD 3: WATCH (Subtle Blue) */}
                        <div className="min-w-full snap-center space-y-3">
                            {scenarioEmpty.map((tactic, idx) => (
                               <div key={idx} className="glass-card p-4 min-h-[152px] relative overflow-hidden bg-white/[0.02] border-white/5">
                                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#3A7AFE]/30" />
                                  
                                  <div className="flex items-center justify-between mb-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded italic ${tactic.priority === 'P1' ? 'bg-indigo-500' : 'bg-slate-700'} text-white`}>{tactic.priority}</span>
                                            <span className="text-sm font-bold text-white">{formatBriefActionLabel(tactic.action, (slug) => t(`actions.${slug}` as MessageKey<'brief'>))}</span>
                                        </div>
                                        <div className="px-2 py-0.5 rounded-lg bg-[#3A7AFE]/10 border border-[#3A7AFE]/20 text-[10px] font-bold text-[#5DA9FF]">
                                            {t('scenarioBadge.empty')}
                                        </div>
                                   </div>

                                   <div className="space-y-1.5">
                                       <p className="text-xs text-slate-400">{t('triggerLabel')}: <span className="text-slate-200">{tactic.trigger.startsWith('trigger.') ? t(tactic.trigger as MessageKey<'brief'>) : tactic.trigger}</span></p>
                                       {tactic.buy_zone_price && (
                                           <div className="py-1 px-2 bg-white/5 rounded-lg w-fit">
                                               <p className="text-[10px] text-indigo-400 font-bold uppercase italic">{t('buyZone')}: {formatPrice(tactic.buy_zone_price, true)}</p>
                                           </div>
                                       )}
                                       <p className="text-xs text-slate-500 font-medium italic border-t border-white/5 pt-1.5 mt-1.5">{t('reasonLabel')}: {tactic.reason.startsWith('reason.') ? t(tactic.reason as MessageKey<'brief'>) : tactic.reason}</p>
                                   </div>
                               </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Pagination Dots */}
                    <div className="flex justify-center gap-2 mt-[-4px] mb-2">
                        <div className={`h-1 rounded-full transition-all duration-300 ${viewState === 'holding_profit' ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} />
                        <div className={`h-1 rounded-full transition-all duration-300 ${viewState === 'holding_loss' ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} />
                        <div className={`h-1 rounded-full transition-all duration-300 ${viewState === 'empty' ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} />
                    </div>
                  </section>

                  {generalTactics.length > 0 && (
                    <section>
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500" /> {t('baseMarket')}
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {generalTactics.map((tactic, idx) => (
                          <div key={idx} className="p-4 rounded-2xl border border-white/5 bg-white/[0.01]">
                            <div className="flex items-center gap-2 mb-2">
                               <div className="w-1 h-1 rounded-full bg-slate-700" />
                               <span className="text-xs font-bold text-slate-300">{formatBriefActionLabel(tactic.action, (slug) => t(`actions.${slug}` as MessageKey<'brief'>))}</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed"><span className="text-slate-400">{t('condition')}:</span> {tactic.trigger}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {isHK && (
                    <section>
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> {t('shortPressure')}
                      </h3>
                      <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{t('pressureLevel')}</span>
                          <span className={`text-sm font-black ${shortPressure.color}`}>
                            {t(shortPressure.label as MessageKey<'brief'>)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-1">{t('shortRatio')}</p>
                            <p className={`text-xs font-black ${shortPressure.color}`}>
                              {shortRatio === null ? '--' : `${(shortRatio * 100).toFixed(1)}%`}
                            </p>
                            <p className="text-[10px] text-slate-600 mt-1">{shortMetrics?.trade_date || t('staleDate')}</p>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-1">{t('shortInterest')}</p>
                            <p className="text-xs font-black text-slate-300">
                              {shortMetrics?.short_interest_shares != null ? Number(shortMetrics.short_interest_shares).toLocaleString() : '--'}
                            </p>
                            <p className="text-[10px] text-slate-600 mt-1">{shortMetrics?.report_week || t('staleWeek')}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
                          <p className="text-xs text-slate-500 italic">{t(shortPressure.interpretation as MessageKey<'brief'>)}</p>
                          <span className="text-[10px] text-slate-500 font-bold">
                            {t('eligible')}: {shortMetrics?.is_eligible ? t('yes') : t('no')}
                          </span>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* 核心战术结构：可视化阶梯图 + 策略卡片 */}
                   <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                      <div className="mb-4">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> {t('keyLevelsHeadline')}
                        </h3>
                      </div>
                      
                      {/* Price Structure Graph */}
                      <div className="relative h-[280px] w-full mb-6 px-4 bg-white/[0.01] rounded-[24px] border border-white/[0.03] overflow-hidden pointer-events-none select-none">
                          {/* Y-axis Guides */}
                          <div className="absolute inset-0 flex flex-col justify-between py-6 opacity-20 pointer-events-none">
                              {[0, 1, 2, 3, 4].map(idx => (
                                  <div key={idx} className="w-full border-t border-dashed border-white/20" />
                              ))}
                          </div>

                          {/* Level Zones & Lines */}
                          {nodes.map((node, i) => {
                              const isActive = activeIndex === i;
                              const y = getY(node.price);
                              const isCurrent = node.kind === 'current';
                              const isLeft = i % 2 === 0;
                              
                              let color = 'text-slate-400';
                              let badgeColor = 'bg-white/5 border-white/10';
                              
                              if (node.kind === 'resistance') { color = 'text-rose-400'; badgeColor = 'bg-rose-500/10 border-rose-500/30'; }
                              if (node.kind === 'target') { color = 'text-amber-400'; badgeColor = 'bg-amber-500/10 border-amber-400/30'; }
                              if (node.kind === 'support') { color = 'text-emerald-400'; badgeColor = 'bg-emerald-500/10 border-emerald-500/30'; }
                              if (node.kind === 'breakout') { color = 'text-indigo-400'; badgeColor = 'bg-indigo-500/10 border-indigo-500/30'; }
                              if (node.kind === 'stoploss') { color = 'text-rose-600'; badgeColor = 'bg-rose-900/20 border-rose-900/50'; }

                              return (
                                  <motion.div 
                                      key={node.id}
                                       animate={{ 
                                           opacity: (activeIndex === -1 || isActive) ? 1 : 0.4,
                                           scale: isActive ? 1.02 : 1,
                                           zIndex: isActive ? 10 : 0
                                       }}
                                       transition={{ duration: 0.25, ease: "easeOut" }}
                                      style={{ top: `${y}%` }}
                                      className="absolute left-0 right-0 -translate-y-1/2 flex items-center pointer-events-none"
                                  >
                                      {isCurrent ? (
                                           <div className="w-full flex items-center justify-center">
                                              <div className="flex-1 border-t border-indigo-500/30 border-dashed" />
                                              <div className="px-4 flex items-center gap-2">
                                                <div className="relative">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,1)]" />
                                                    <div className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-40" />
                                                </div>
                                                <span className="text-[11px] font-black text-white bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/40 uppercase tracking-tighter">
                                                    {t('now')} · {formatLevel(node.price)}
                                                </span>
                                              </div>
                                              <div className="flex-1 border-t border-indigo-500/30 border-dashed" />
                                           </div>
                                      ) : (
                                          <div className={`w-full flex items-center ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                                              <div className={`w-4 border-t ${isActive ? 'border-solid border-2' : 'border-dashed border-[1px]'} ${isActive ? 'border-indigo-400' : 'border-white/5'}`} />
                                              
                                              {isActive ? (
                                                  <div className={`px-3 py-1.5 rounded-xl border ${badgeColor} shadow-xl shadow-black/40 flex flex-col items-center min-w-[100px] pointer-events-auto`}>
                                                      <span className={`text-[9px] font-black uppercase tracking-[0.1em] ${color}`}>
                                                          {node.__i18n?.ordinal ? t(node.label as MessageKey<'brief'>, { label: t(`levelLabels.${node.__i18n.key}` as MessageKey<'brief'>) }) : t(node.label as MessageKey<'brief'>)}
                                                      </span>
                                                      <span className="text-sm font-black text-white">{formatLevel(node.price)}</span>
                                                  </div>
                                              ) : (
                                                  <div className={`mx-2 flex items-center gap-2 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                                                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight flex items-center gap-0.5">
                                                          {node.price > (currentPrice || 0) ? <ChevronUp size={10} className="text-slate-700" /> : <ChevronDown size={10} className="text-slate-700" />}
                                                          {node.__i18n?.ordinal ? t(node.label as MessageKey<'brief'>, { label: t(`levelLabels.${node.__i18n.key}` as MessageKey<'brief'>) }) : t(node.label as MessageKey<'brief'>)}
                                                      </span>
                                                      <span className="text-[11px] font-black text-slate-400">{formatLevel(node.price)}</span>
                                                  </div>
                                              )}
                                              
                                              <div className={`flex-1 border-t ${isActive ? 'border-solid border-2 opacity-30' : 'border-dashed border-[1px] opacity-10'} ${isActive ? 'border-indigo-400' : 'border-white/5'}`} />
                                          </div>
                                      )}
                                  </motion.div>
                              );
                          })}
                      </div>

                      {/* Linked Strategy Carousel */}
                      <div 
                        ref={carouselRef}
                        onScroll={(e) => {
                           const target = e.currentTarget;
                           const scrollPos = target.scrollLeft;
                           const firstChild = target.children[0] as HTMLElement;
                           const itemWidth = firstChild ? firstChild.offsetWidth + 16 : target.clientWidth - 16; 
                           
                           const index = Math.round(scrollPos / itemWidth);
                           
                           if (index !== activeIndex && index >= 0 && index < nodes.length) {
                               setActiveIndex(index);
                           }
                        }}
                        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-6 px-6 pb-2 overscroll-x-contain"
                      >
                         {nodes.map((node, i) => {
                            const isActive = activeIndex === i;
                            const isCurrent = node.kind === 'current';
                            
                            let accentColor = 'from-slate-500/20';
                            let textColor = 'text-slate-300';
                            if (node.kind === 'resistance') { accentColor = 'from-rose-500/20'; textColor = 'text-rose-300'; }
                            if (node.kind === 'target') { accentColor = 'from-amber-500/20'; textColor = 'text-amber-300'; }
                            if (node.kind === 'support') { accentColor = 'from-emerald-500/20'; textColor = 'text-emerald-300'; }
                            if (node.kind === 'breakout') { accentColor = 'from-indigo-500/20'; textColor = 'text-indigo-300'; }
                            if (node.kind === 'stoploss') { accentColor = 'from-rose-600/30'; textColor = 'text-rose-400'; }

                            return (
                                <div 
                                    key={node.id} 
                                    className="min-w-[calc(100%-32px)] snap-center p-0.5"
                                    onClick={() => {
                                        const container = carouselRef.current;
                                        if (container) {
                                             const fc = container.children[0] as HTMLElement; const step = fc ? fc.offsetWidth + 16 : (container.clientWidth - 32) + 16;
                                             container.scrollTo({ left: i * step, behavior: 'smooth' });
                                        }
                                    }}
                                >
                                    <div className={`h-[140px] rounded-[24px] p-5 border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${isActive ? `bg-gradient-to-br ${accentColor} to-[#0a0a0f] border-white/10 shadow-2xl` : 'bg-white/[0.01] border-white/5 opacity-40'}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? textColor : 'text-slate-500'}`}>
                                                    {node.__i18n?.ordinal ? t(node.label as MessageKey<'brief'>, { label: t(`levelLabels.${node.__i18n.key}` as MessageKey<'brief'>) }) : t(node.label as MessageKey<'brief'>)}
                                                </span>
                                                <h4 className="text-xl font-black text-white mt-1">{formatLevel(node.price)}</h4>
                                            </div>
                                            {isActive && (
                                                <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter bg-white/5 border border-white/10 ${textColor} flex items-center`}>
                                                    {isCurrent ? (
                                                        t('currentAnchor')
                                                    ) : (
                                                        <span className="flex items-center gap-1">
                                                            {node.price > (currentPrice || 0) ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                            {node.price > (currentPrice || 0) ? t('upside') : t('downside')} {formatDistancePercent(getLevelDistance(currentPrice, node.price))}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold leading-relaxed ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>{t(node.description as MessageKey<'brief'>)}</p>
                                            <p className={`text-[10px] mt-2 flex items-center gap-1.5 font-bold ${isActive ? textColor : 'text-slate-600'}`}>
                                                {isCurrent ? (
                                                    <>
                                                        {signal === 'Long' && <Zap size={12} className="text-rose-400" />}
                                                        {signal === 'Side' && <Crosshair size={12} className="text-amber-400" />}
                                                        {signal === 'Short' && <Shield size={12} className="text-emerald-400" />}
                                                        {t(`actions.${normalizeActionLabel(signal === 'Long' ? 'long' : signal === 'Short' ? 'defense' : 'observe')}` as MessageKey<'brief'>)}
                                                    </>
                                                ) : (
                                                    <>
                                                        {t(`actions.${node.action}` as MessageKey<'brief'>) === t('actions.defense') && <Shield size={12} />}
                                                        {t(`actions.${node.action}` as MessageKey<'brief'>) === t('actions.profit') && <Target size={12} />}
                                                        {t(`actions.${node.action}` as MessageKey<'brief'>) === t('actions.long') && <TrendingUp size={12} />}
                                                        {t(`actions.${node.action}` as MessageKey<'brief'>) === t('actions.observe') && <Crosshair size={12} />}
                                                        {t(`actions.${node.action}` as MessageKey<'brief'>)}
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                        
                                        <span className="absolute -bottom-4 -right-2 text-6xl font-black opacity-[0.02] pointer-events-none italic select-none">
                                            {formatLevel(node.price)}
                                        </span>
                                    </div>
                                </div>
                            );
                         })}
                         {/* 物理占位，确保最后一张卡片可 Snap 居中 */}
                         <div className="min-w-[24px] h-full shrink-0" />
                      </div>

                      {/* Pagination Dots */}
                      <div className="flex justify-center gap-1.5 mt-2">
                          {nodes.map((_, i) => (
                              <button 
                                  key={i} 
                                  onClick={() => {
                                      const container = carouselRef.current;
                                      if (container) {
                                           const fc = container.children[0] as HTMLElement; const step = fc ? fc.offsetWidth + 16 : (container.clientWidth - 32) + 16;
                                           container.scrollTo({ left: i * step, behavior: 'smooth' });
                                      }
                                  }}
                                  className={`h-1 rounded-full transition-all duration-300 ${activeIndex === i ? 'w-6 bg-white' : 'w-1 bg-white/20'}`} 
                              />
                          ))}
                      </div>
                   </section>

                  {/* 分析过程 - 推理链 (带折叠交互) */}
                  {Array.isArray(data.reasoning_trace) && data.reasoning_trace.length > 0 && (
                    <section className="space-y-4 relative">
                      <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 group active:scale-[0.98] transition-all"
                      >
                        <div className="flex items-center gap-3">
                           <Sparkles
                             size={12}
                             className={`text-indigo-400 transition-all duration-500 ${isExpanded ? 'scale-110' : 'opacity-50'}`}
                           />
                           <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-200 transition-colors">{t('reasoningChain')}</span>
                        </div>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          className="text-slate-600 group-hover:text-slate-400"
                        >
                           <ChevronDown size={16} />
                        </motion.div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/[0.03] space-y-0 relative before:absolute before:left-[19px] before:top-6 before:bottom-6 before:w-[1px] before:bg-white/5">
                              {data.reasoning_trace.map((step, idx) => (
                                <div key={idx} className="relative pl-6 pb-6 last:pb-2 group">
                                  <div className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full border border-white/20 bg-[#0a0a0f] group-hover:border-indigo-500 transition-colors z-10" />
                                  
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                      {(() => {
                                        const config = getStepConfig(step.step);
                                        return (
                                          <div className="flex items-center gap-2">
                                            <span className="text-slate-500">{config.icon}</span>
                                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                               {t(config.key as MessageKey<'brief'>)}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full italic tracking-tight">
                                        {normalizeLegacyTerms(step.conclusion)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-200/60 font-medium leading-relaxed">
                                      {normalizeLegacyTerms(step.data)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </section>
                  )}

                  {/* 思维复盘 / 反向论点 (Counter Argument) */}
                  {data.counter_argument && (
                    <section className="space-y-4">
                      <button
                        onClick={() => setIsCounterArgumentExpanded(!isCounterArgumentExpanded)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl group active:scale-[0.98] transition-all ${
                          isCounterArgumentExpanded
                            ? 'bg-rose-500/5 border border-rose-500/10'
                            : 'bg-rose-500/[0.03] border border-rose-500/[0.08]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <AlertTriangle size={12} className={isCounterArgumentExpanded ? 'text-rose-400' : 'text-rose-400/75'} />
                          <span className={`text-xs font-black uppercase tracking-widest transition-colors ${isCounterArgumentExpanded ? 'text-rose-400' : 'text-rose-400/75 group-hover:text-rose-300/90'}`}>{t('riskReflection')}</span>
                        </div>
                        <motion.div
                          animate={{ rotate: isCounterArgumentExpanded ? 180 : 0 }}
                          className={`transition-colors ${isCounterArgumentExpanded ? 'text-rose-400/70 group-hover:text-rose-300' : 'text-rose-400/50 group-hover:text-rose-300/80'}`}
                        >
                          <ChevronDown size={16} />
                        </motion.div>
                      </button>

                      <AnimatePresence>
                        {isCounterArgumentExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                              <p className="text-sm text-rose-300/70 leading-relaxed italic">{normalizeLegacyTerms(data.counter_argument)}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </section>
                  )}

                  <section className="space-y-4">
                    <button
                      onClick={() => setIsConflictResolutionExpanded(!isConflictResolutionExpanded)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl group active:scale-[0.98] transition-all ${
                        isConflictResolutionExpanded
                          ? 'bg-indigo-500/5 border border-indigo-500/10'
                          : 'bg-indigo-500/[0.03] border border-indigo-500/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Info size={12} className={isConflictResolutionExpanded ? 'text-indigo-400' : 'text-indigo-400/75'} />
                        <span className={`text-xs font-black uppercase tracking-widest transition-colors ${isConflictResolutionExpanded ? 'text-indigo-400' : 'text-indigo-400/75 group-hover:text-indigo-300/90'}`}>{t('conflictResolution')}</span>
                      </div>
                      <motion.div
                        animate={{ rotate: isConflictResolutionExpanded ? 180 : 0 }}
                        className={`transition-colors ${isConflictResolutionExpanded ? 'text-indigo-400/70 group-hover:text-indigo-300' : 'text-indigo-400/50 group-hover:text-indigo-300/80'}`}
                      >
                        <ChevronDown size={16} />
                      </motion.div>
                    </button>

                    <AnimatePresence>
                      {isConflictResolutionExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                            <p className="text-sm text-indigo-300/70 leading-relaxed italic">{normalizeLegacyTerms(data.conflict_resolution || "遵循趋势优先原则。")}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                </div>
              ) : activeTab === 'council' ? (
                <AICouncil symbol={symbol} stockName={displayStockName} targetDate={targetDate} />
              ) : (
                <TradeManagementTab
                  isActive={activeTab === 'management'}
                  isOpen={isOpen}
                  symbol={symbol}
                  stockName={stockName}
                  stockNameEn={stockNameEn}
                />
              )}
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {isOpen && (
      <BriefExportSheet
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onOpenAlmanac={handleOpenAlmanac}
        onOpenReport={handleOpenReport}
        showAlmanac={showStockAlmanacExport}
      />
    )}

    {isOpen && (
      <SilentPoster 
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        prediction={posterPrediction}
        stockName={displayStockName}
        userPos={userPos}
      />
    )}

    {isOpen && (
      <TacticalReportPoster
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        tier={tier}
        prediction={posterPrediction}
        stockName={displayStockName}
        symbol={symbol}
        targetDate={targetDate}
        data={data}
        currentPrice={currentPrice}
      />
    )}
    </>
  );
}
