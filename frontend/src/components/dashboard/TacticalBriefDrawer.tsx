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
  Calendar,
  TrendingDown,
  Shield,
  ChevronUp
} from 'lucide-react';
import { AIPrediction, TacticalData, Tactic, ShortMetrics } from '@/lib/types';
import { shouldEnableHighPerformance } from '@/lib/device-utils';
import { AICouncil } from './AICouncil';
import Multiavatar from '@/components/Multiavatar';
import { resolveAnalystForBriefSource } from '@/lib/agent-team';

import { formatModelName } from '@/lib/model-names';

interface TacticalBriefDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: TacticalData;
  userPos: 'holding' | 'empty' | 'none';
  tier: 'free' | 'pro';
  model?: string;
  symbol: string;
  targetDate: string;
  signal?: 'Long' | 'Short' | 'Side';
  confidence?: number;
  stockName?: string;
  currentPrice?: number;
  shortMetrics?: ShortMetrics | null;
}

import { SilentPoster } from './SilentPoster';

// 辅助函数：获取步骤对应的图标和标签配置
const getStepConfig = (step: string) => {
  const s = step.toLowerCase();
  
  if (s.includes('trend')) return { icon: <TrendingUp size={12} />, label: '趋势' };
  if (s.includes('momentum')) return { icon: <Zap size={12} />, label: '动能' };
  if (s.includes('volume')) return { icon: <BarChart3 size={12} />, label: '成交量' };
  if (s.includes('history')) return { icon: <RotateCcw size={12} />, label: '历史' };
  if (s.includes('decision')) return { icon: <Target size={12} />, label: '决策' };
  
  // 新增映射
  if (s.includes('news') || s.includes('fundamental')) return { icon: <Newspaper size={12} />, label: '情报' };
  if (s.includes('position') || s.includes('level') || s.includes('price')) return { icon: <Crosshair size={12} />, label: '价格行为' };
  if (s.includes('context')) return { icon: <Layers size={12} />, label: '上下文' };
  if (s.includes('fund') || s.includes('capital') || s.includes('flow') || s.includes('money')) return { icon: <Hash size={12} />, label: '资金博弈' };

  // 兜底使用更专业的词汇
  return { icon: <Hash size={12} />, label: '综合研判' };
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

type BriefSourceKind = 'llm' | 'rule';


interface PriceLevelNode {
  id: string;
  price: number;
  label: string;
  kind: 'resistance' | 'target' | 'current' | 'support' | 'stoploss' | 'breakout';
  description: string;
  action: string;
}

const normalizeActionLabel = (action: string | undefined): string => {
  if (!action) return '建议观察';
  if (action.includes('观察')) return '建议观察';
  if (action.includes('止损') || action.includes('减仓') || action.includes('防守')) return '建议防守';
  if (action.includes('加仓') || action.includes('跟随') || action.includes('买')) return '建议进场';
  if (action.includes('落袋') || action.includes('止盈') || action.includes('离场')) return '建议落袋';
  return action;
};

const getPriceNodes = (data: TacticalData, currentPrice?: number): PriceLevelNode[] => {
  const nodes: PriceLevelNode[] = [];
  
  const add = (raw: number | string | number[] | undefined, label: string, kind: PriceLevelNode['kind'], desc: string, action: string) => {
    const list = Array.isArray(raw) ? raw : [raw];
    const parsed = list
      .map((x) => (typeof x === 'number' ? x : Number(x)))
      .filter((x) => Number.isFinite(x));
    const prices = Array.from(new Map(parsed.map((x) => [x.toFixed(4), x])).values());
    
    prices.forEach((p, idx) => {
      const CN_ORD = ["第一", "第二", "第三"];
      nodes.push({
        id: `${kind}-${idx}-${p}`,
        price: p,
        label: prices.length > 1 ? CN_ORD[idx] + label : label,
        kind,
        description: desc,
        action
      });
    });
  };

  // 按业务优先级和角色添加节点
  if (data?.key_levels?.strong_resistance) 
    add(data.key_levels.strong_resistance, '强压力区', 'resistance', '核心供给区，多空博弈终点', '执行落袋');
  if (data?.key_levels?.resistance || data?.key_levels?.immediate_resistance) 
    add(data.key_levels.immediate_resistance || data.key_levels.resistance, '挑战位', 'target', '局部阶段目标，注意动能释放', '执行落袋');
  if (data?.key_levels?.breakout_confirmation_level)
    add(data.key_levels.breakout_confirmation_level, '突破确认', 'breakout', '反转结构成立的关键锚点', '执行进场');
  
  if (currentPrice) nodes.push({ id: 'current', price: currentPrice, label: '当前价', kind: 'current', description: '目前市场成交活跃点', action: '执行观察' });

  if (data?.key_levels?.support || data?.key_levels?.immediate_support) 
    add(data.key_levels.immediate_support || data.key_levels.support, '防守位', 'support', '多头防线，不破即维持强势', '执行防守');
  if (data?.key_levels?.strong_support) 
    add(data.key_levels.strong_support, '强支撑区', 'support', '底部核心支撑，中长期成本位', '执行进场');
  if (data?.key_levels?.stop_loss_reference || data?.key_levels?.stop_loss)
    add(data.key_levels.stop_loss_reference || data.key_levels.stop_loss, '止损参考', 'stoploss', '结构崩溃底线', '执行防守');

  const sorted = nodes.sort((a, b) => b.price - a.price);
  // Dedup: remove nodes with identical prices to prevent phantom pagination dots
  return sorted.filter((node, idx, self) => 
    idx === 0 || Math.abs(node.price - self[idx-1].price) > 0.001
  );
};

type ScenarioKind = 'holding_profit' | 'holding_loss' | 'empty';
type ScenarioTactic = Tactic & { __placeholder?: boolean };

const PRIORITY_ORDER: Record<string, number> = { P1: 1, P2: 2, P3: 3 };

const createPlaceholderTactic = (kind: ScenarioKind, idx: number): ScenarioTactic => {
  const templates: Record<ScenarioKind, ScenarioTactic[]> = {
    holding_profit: [
      {
        priority: 'P1',
        action: '执行观察',
        trigger: '不跌破一防位',
        reason: '趋势未被破坏，先守纪律。',
        target_price: undefined,
        stop_advance_price: undefined,
        __placeholder: true,
      },
      {
        priority: 'P2',
        action: '执行落袋',
        trigger: '接近一攻位且动能放缓',
        reason: '锁定波段利润，避免冲高回落。',
        target_price: undefined,
        stop_advance_price: undefined,
        __placeholder: true,
      },
    ],
    holding_loss: [
      {
        priority: 'P1',
        action: '执行防守',
        trigger: '有效跌破一防位',
        reason: '优先控制回撤，避免亏损扩大。',
        stop_loss_price: undefined,
        __placeholder: true,
      },
      {
        priority: 'P2',
        action: '执行防守',
        trigger: '反抽压力位但未能突破',
        reason: '弱势反弹先降风险敞口。',
        stop_loss_price: undefined,
        __placeholder: true,
      },
    ],
    empty: [
      {
        priority: 'P1',
        action: '执行观察',
        trigger: '回踩一防位企稳后再评估',
        reason: '先等右侧信号，再考虑入场。',
        buy_zone_price: undefined,
        __placeholder: true,
      },
      {
        priority: 'P2',
        action: '执行进场',
        trigger: '放量突破一攻位并站稳',
        reason: '确认后再交易，避免假突破。',
        buy_zone_price: undefined,
        __placeholder: true,
      },
    ],
  };
  return templates[kind][idx] ?? templates[kind][1];
};

const normalizeScenarioTactics = (items: Tactic[] | undefined, kind: ScenarioKind): ScenarioTactic[] => {
  const list = Array.isArray(items) ? items : [];
  const normalized = list
    .filter((t) => t && typeof t.action === 'string' && typeof t.trigger === 'string')
    .map((t) => ({
      ...t,
      priority: (String(t.priority).toUpperCase() as Tactic['priority']) || 'P3',
      __placeholder: false,
    }))
    .sort((a, b) => (PRIORITY_ORDER[a.priority] || 99) - (PRIORITY_ORDER[b.priority] || 99));

  const deduped: ScenarioTactic[] = [];
  const seen = new Set<string>();
  for (const t of normalized) {
    const key = `${t.action.trim()}|${t.trigger.trim()}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(t);
    if (deduped.length === 2) break;
  }

  while (deduped.length < 2) {
    deduped.push(createPlaceholderTactic(kind, deduped.length));
  }
  return deduped.slice(0, 2);
};

export function TacticalBriefDrawer({ 
  isOpen, onClose, data, tier, model, symbol, targetDate, signal, confidence, stockName, currentPrice, shortMetrics, userPos
}: TacticalBriefDrawerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const isFetchingDetail = false;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isHighPerformance = shouldEnableHighPerformance();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'brief' | 'council'>('brief');
  const isFree = tier === 'free';
  const sourceKind: BriefSourceKind = data.is_llm || (model && model !== 'rule-based') ? 'llm' : 'rule';
  const analystProfile = resolveAnalystForBriefSource(sourceKind, model);
  const modelFact = sourceKind === 'llm'
    ? (model ? formatModelName(model) : 'LLM 深度推理版')
    : '量化规则引擎';
  const sourceFact = `${modelFact} 生成`;
  
  const rawGeneral = data?.tactics?.general;
  const generalTactics = Array.isArray(rawGeneral) ? rawGeneral : (rawGeneral ? [rawGeneral] : []);

  const profitRaw = [...(data?.tactics?.holding_profit || []), ...(data?.tactics?.holding || [])];
  const scenarioHoldingProfit = normalizeScenarioTactics(profitRaw, 'holding_profit');
  const scenarioHoldingLoss = normalizeScenarioTactics(data?.tactics?.holding_loss || [], 'holding_loss');
  const scenarioEmpty = normalizeScenarioTactics(data?.tactics?.empty || [], 'empty');

  const [viewState, setViewState] = useState<'holding_profit'|'holding_loss'|'empty'>('holding_profit');
  const [activeIndex, setActiveIndex] = useState(0);
  const nodes = getPriceNodes(data, currentPrice);
  const isHK = symbol.length === 5;
  const scrollRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const shortRatio = (() => {
    const v = shortMetrics?.short_turnover_ratio;
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })();

  const shortPressure = (() => {
    if (!isHK) return { label: '--', color: 'text-slate-500', interpretation: '仅港股显示' };
    if (shortRatio === null) return { label: '待同步', color: 'text-slate-500', interpretation: '港交所日度数据收盘后更新' };
    if (shortRatio > 0.25) return { label: '极高', color: 'text-rose-500', interpretation: '空头压力极高，优先风险控制' };
    if (shortRatio > 0.15) return { label: '高', color: 'text-rose-400', interpretation: '空头压力偏高，注意反弹质量' };
    if (shortRatio >= 0.05) return { label: '中', color: 'text-amber-400', interpretation: '空头压力中性，保持观察' };
    return { label: '低', color: 'text-emerald-400', interpretation: '空头压力偏低，抛压有限' };
  })();

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

  // Reset carousel position whenever drawer opens, stock context changes,
  // or the user switches back to the tactical brief tab.
  useEffect(() => {
    if (!isOpen || activeTab !== 'brief') return;
    setActiveIndex(defaultActiveIndex);
    syncCarouselToIndex(defaultActiveIndex);
  }, [activeTab, defaultActiveIndex, isOpen, syncCarouselToIndex]);

  // Council preload removed — AICouncil's useSWR is the single fetch entry point.
  // localStorage cache keyed by target_date handles cross-session reuse.


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
    confidence: confidence || 0,
    ai_reasoning: JSON.stringify(data),
    date: '',
    support_price: 0,
    validation_status: 'Pending',
    actual_change: null
  };

  if (!isMounted) return null;

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 pointer-events-auto overflow-hidden">
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
            className="w-full max-w-md bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto z-10 h-[85vh] flex flex-col transform-gpu will-change-transform"
          >
            {/* 顶部视觉拉手 */}
            <div className="w-full flex justify-center pt-3 pb-1 shrink-0 bg-[#0a0a0f]">
               <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>

            {/* 固定 Header */}
            <header className="relative flex items-center justify-center py-2 px-6 bg-[#0a0a0f] border-b border-white/5 shadow-lg shadow-black/20 shrink-0 z-20">
                 {/* Left: Almanac */}
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setIsShareOpen(true);
                   }} 
                   className="absolute left-4 p-2.5 rounded-full bg-white/5 border border-white/10 text-indigo-400 active:scale-95 transition-all hover:bg-white/10 hover:text-indigo-300 z-20"
                   title="查看投资黄历"
                 >
                   <Calendar size={18} />
                 </button>

                 {/* Center: Tabs */}
                 <div className="flex p-1 rounded-full bg-white/5 border border-white/10 relative z-10">
                     <button 
                       onClick={() => setActiveTab('brief')}
                       className={`relative z-10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors duration-200 ${activeTab === 'brief' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                     >
                       策略内参
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
                     <button 
                       onClick={() => setActiveTab('council')}
                       className={`relative z-10 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors duration-200 ${activeTab === 'council' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                     >
                       投研决议
                       {activeTab === 'council' && (
                         <motion.div 
                           className="absolute inset-0 bg-indigo-500 rounded-full -z-10 shadow-lg shadow-indigo-500/20"
                           initial={{ opacity: 0, scale: 0.9 }}
                           animate={{ opacity: 1, scale: 1 }}
                           layoutId="activeTab"
                           transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
                         />
                       )}
                     </button>
                 </div>

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
                            {analystProfile.name} · {analystProfile.role}
                          </p>
                          <p className={`text-xs leading-tight mt-0.5 ${sourceKind === 'llm' ? 'text-indigo-300/80' : 'text-slate-400'}`}>
                            {sourceFact}
                          </p>
                      </div>
                  </div>

                  <section>
                     {/* Header */}
                     <div className="mb-4">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 交易预案
                        </h3>
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
                        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-6 px-6 pb-2"
                    >
                       
 	                       {/* CARD 1: HOLDING PROFIT (Subtle Green) */}
 	                       <div className="min-w-full snap-center space-y-3">
 	                            {scenarioHoldingProfit.map((t, idx) => (
 	                                <div key={idx} className="glass-card p-4 min-h-[152px] relative overflow-hidden bg-white/[0.02] border-white/5">
                                       {/* Subtle Side Indicator */}
                                       <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#2ECC71]/30" />
                                       
                                       <div className="flex items-center justify-between mb-2.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded italic ${t.priority === 'P1' ? 'bg-indigo-500' : 'bg-slate-700'} text-white`}>{t.priority}</span>
                                                <span className="text-sm font-bold text-white">{normalizeActionLabel(t.action)}</span>
                                            </div>
                                            <div className="px-2 py-0.5 rounded-lg bg-[#2ECC71]/10 border border-[#2ECC71]/20 text-[10px] font-bold text-[#2ECC71]">
                                                盈利中
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <p className="text-xs text-slate-400">触发: <span className="text-slate-200">{t.trigger}</span></p>
                                            {(t.target_price || t.stop_advance_price) && (
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 py-1 px-2 bg-white/5 rounded-lg w-fit">
                                                    {t.target_price && <p className="text-[10px] text-emerald-400 font-bold uppercase">目标: {t.target_price}</p>}
                                                    {t.stop_advance_price && <p className="text-[10px] text-amber-400 font-bold uppercase">移动止盈: {t.stop_advance_price}</p>}
                                                </div>
                                            )}
                                            <p className="text-xs text-slate-500 font-medium italic border-t border-white/5 pt-1.5 mt-1.5">理由: {t.reason}</p>
                                        </div>
 	                                </div>
 	                            ))}
 	                       </div>

 	                       {/* CARD 2: HOLDING LOSS (Subtle Red) */}
 	                       <div className="min-w-full snap-center space-y-3">
 	                            {scenarioHoldingLoss.map((t, idx) => (
 	                                <div key={idx} className="glass-card p-4 min-h-[152px] relative overflow-hidden bg-white/[0.02] border-white/5">
                                       <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF4D4F]/30" />
                                       
                                       <div className="flex items-center justify-between mb-2.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded italic ${t.priority === 'P1' ? 'bg-rose-500' : 'bg-slate-700'} text-white`}>{t.priority}</span>
                                                <span className="text-sm font-bold text-white">{normalizeActionLabel(t.action)}</span>
                                            </div>
                                            <div className="px-2 py-0.5 rounded-lg bg-[#FF4D4F]/10 border border-[#FF4D4F]/20 text-[10px] font-bold text-[#FF4D4F]">
                                                亏损中
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <p className="text-xs text-slate-400">触发: <span className="text-slate-200">{t.trigger}</span></p>
                                            {t.stop_loss_price && (
                                                <div className="py-1 px-2 bg-rose-500/10 rounded-lg w-fit">
                                                    <p className="text-[10px] text-rose-400 font-bold uppercase">止损价: {t.stop_loss_price}</p>
                                                </div>
                                            )}
                                            <p className="text-xs text-slate-500 font-medium italic border-t border-white/5 pt-1.5 mt-1.5">理由: {t.reason}</p>
                                        </div>
 	                                </div>
 	                            ))}
 	                       </div>

 	                       {/* CARD 3: WATCH (Subtle Blue) */}
 	                       <div className="min-w-full snap-center space-y-3">
 	                           {scenarioEmpty.map((t, idx) => (
 	                              <div key={idx} className="glass-card p-4 min-h-[152px] relative overflow-hidden bg-white/[0.02] border-white/5">
                                     <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#3A7AFE]/30" />
                                     
                                     <div className="flex items-center justify-between mb-2.5">
                                          <div className="flex items-center gap-2">
                                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded italic ${t.priority === 'P1' ? 'bg-indigo-500' : 'bg-slate-700'} text-white`}>{t.priority}</span>
                                              <span className="text-sm font-bold text-white">{normalizeActionLabel(t.action)}</span>
                                          </div>
                                          <div className="px-2 py-0.5 rounded-lg bg-[#3A7AFE]/10 border border-[#3A7AFE]/20 text-[10px] font-bold text-[#5DA9FF]">
                                              等待入场
                                          </div>
                                      </div>

                                      <div className="space-y-1.5">
                                          <p className="text-xs text-slate-400">触发: <span className="text-slate-200">{t.trigger}</span></p>
                                          {t.buy_zone_price && (
                                              <div className="py-1 px-2 bg-white/5 rounded-lg w-fit">
                                                  <p className="text-[10px] text-indigo-400 font-bold uppercase italic">理想买入区: {formatPrice(t.buy_zone_price, true)}</p>
                                              </div>
                                          )}
                                          <p className="text-xs text-slate-500 font-medium italic border-t border-white/5 pt-1.5 mt-1.5">理由: {t.reason}</p>
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
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500" /> 基础市场研判
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {generalTactics.map((t, idx) => (
                          <div key={idx} className="p-4 rounded-2xl border border-white/5 bg-white/[0.01]">
                            <div className="flex items-center gap-2 mb-2">
                               <div className="w-1 h-1 rounded-full bg-slate-700" />
                               <span className="text-xs font-bold text-slate-300">{normalizeActionLabel(t.action)}</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed"><span className="text-slate-400">条件:</span> {t.trigger}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {isHK && (
                    <section>
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 空头压力
                      </h3>
                      <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.01] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">压力等级</span>
                          <span className={`text-sm font-black ${shortPressure.color}`}>{shortPressure.label}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-1">日度沽空比</p>
                            <p className={`text-xs font-black ${shortPressure.color}`}>
                              {shortRatio === null ? '--' : `${(shortRatio * 100).toFixed(1)}%`}
                            </p>
                            <p className="text-[10px] text-slate-600 mt-1">{shortMetrics?.trade_date || '日期待同步'}</p>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mb-1">做空仓位</p>
                            <p className="text-xs font-black text-slate-300">
                              {shortMetrics?.short_interest_shares != null ? Number(shortMetrics.short_interest_shares).toLocaleString() : '--'}
                            </p>
                            <p className="text-[10px] text-slate-600 mt-1">{shortMetrics?.report_week || '周度待同步'}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-white/5 pt-2.5">
                          <p className="text-xs text-slate-500 italic">{shortPressure.interpretation}</p>
                          <span className="text-[10px] text-slate-500 font-bold">
                            可沽空: {shortMetrics?.is_eligible ? '是' : '未知'}
                          </span>
                        </div>
                      </div>
                    </section>
                  )}

                  {/* 核心战术结构：可视化阶梯图 + 策略卡片 */}
                   <section className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                      <div className="mb-4">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> 核心操盘点位
                        </h3>
                      </div>
                      
                      {/* Price Structure Graph */}
                      <div className="relative h-[280px] w-full mb-6 px-4 bg-white/[0.01] rounded-[24px] border border-white/[0.03] overflow-hidden">
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
                              const isLeft = i % 2 === 0; // 奇偶错位逻辑
                              
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
                                                    NOW · {formatLevel(node.price)}
                                                </span>
                                              </div>
                                              <div className="flex-1 border-t border-indigo-500/30 border-dashed" />
                                           </div>
                                      ) : (
                                          <div className={`w-full flex items-center ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                                              {/* 这里的线段根据左右位置弹性伸缩 */}
                                              <div className={`w-4 border-t ${isActive ? 'border-solid border-2' : 'border-dashed border-[1px]'} ${isActive ? 'border-indigo-400' : 'border-white/5'}`} />
                                              
                                              {isActive ? (
                                                  <div className={`px-3 py-1.5 rounded-xl border ${badgeColor} shadow-xl shadow-black/40 flex flex-col items-center min-w-[100px] pointer-events-auto`}>
                                                      <span className={`text-[9px] font-black uppercase tracking-[0.1em] ${color}`}>{node.label}</span>
                                                      <span className="text-sm font-black text-white">{formatLevel(node.price)}</span>
                                                  </div>
                                              ) : (
                                                  <div className={`mx-2 flex items-center gap-2 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                                                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight flex items-center gap-0.5">
                                                          {node.price > (currentPrice || 0) ? <ChevronUp size={10} className="text-slate-700" /> : <ChevronDown size={10} className="text-slate-700" />}
                                                          {node.label}
                                                      </span>
                                                      <span className="text-[11px] font-black text-slate-400">{formatLevel(node.price)}</span>
                                                  </div>
                                              )}
                                              
                                              <div className={`flex-1 border-t ${isActive ? 'border-solid border-2 opacity-30' : 'border-dashed border-[1px] opacity-10'} ${isActive ? 'border-indigo-400' : 'border-white/5'}`} />
                                          </div>
                                      )}
                                  </motion.div>
                              )
                          })}
                      </div>

                      {/* Linked Strategy Carousel */}
                      <div 
                        ref={carouselRef}
                        onScroll={(e) => {
                           const target = e.currentTarget;
                           const scrollPos = target.scrollLeft;
                            const firstChild = target.children[0] as HTMLElement;
                            // physical step = card offsetWidth + gap(16px)
                            const itemWidth = firstChild ? firstChild.offsetWidth + 16 : target.clientWidth - 16; 
                           
                           // 使用中心点偏移算法，确保在滚动到一半时就触发索引切换
                           const index = Math.round(scrollPos / itemWidth);
                           
                           if (index !== activeIndex && index >= 0 && index < nodes.length) {
                               setActiveIndex(index);
                           }
                        }}
                        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-6 px-6 pb-2"
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
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? textColor : 'text-slate-500'}`}>{node.label}</span>
                                                <h4 className="text-xl font-black text-white mt-1">{formatLevel(node.price)}</h4>
                                            </div>
                                            {isActive && (
                                                <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter bg-white/5 border border-white/10 ${textColor} flex items-center`}>
                                                    {isCurrent ? (
                                                        '当前实时锚点'
                                                    ) : (
                                                        <span className="flex items-center gap-1">
                                                            {node.price > (currentPrice || 0) ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                            {node.price > (currentPrice || 0) ? '上方空间' : '向下缓冲'} {formatDistancePercent(getLevelDistance(currentPrice, node.price))}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold leading-relaxed ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>{node.description}</p>
                                            <p className={`text-[10px] mt-2 flex items-center gap-1.5 font-bold ${isActive ? textColor : 'text-slate-600'}`}>
                                                {isCurrent ? (
                                                    <>
                                                        {signal === 'Long' && <Zap size={12} className="text-rose-400" />}
                                                        {signal === 'Side' && <Crosshair size={12} className="text-amber-400" />}
                                                        {signal === 'Short' && <Shield size={12} className="text-emerald-400" />}
                                                        {signal === 'Long' ? '建议进场' : signal === 'Short' ? '建议防守' : '建议观察'}
                                                    </>
                                                ) : (
                                                    <>
                                                        {normalizeActionLabel(node.action) === '建议防守' && <Shield size={12} />}
                                                        {normalizeActionLabel(node.action) === '建议落袋' && <Target size={12} />}
                                                        {normalizeActionLabel(node.action) === '建议进场' && <TrendingUp size={12} />}
                                                        {normalizeActionLabel(node.action) === '建议观察' && <Crosshair size={12} />}
                                                        {normalizeActionLabel(node.action)}
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                        
                                        {/* Background Decorative Price */}
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

                  {/* 重点情报 (News Radar) */}
                  {((Array.isArray(data.news_analysis) && data.news_analysis.length > 0) || (typeof data.news_analysis === 'string' && data.news_analysis.trim() !== '')) && (
                    <section className="relative">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 重点情报 (Last 48h)
                      </h3>
                      <div className={`p-4 rounded-2xl bg-gradient-to-br from-emerald-500/[0.05] to-transparent border border-emerald-500/10 space-y-3 ${isFree ? (isHighPerformance ? 'opacity-20 grayscale brightness-50 select-none pointer-events-none' : 'blur-md select-none pointer-events-none opacity-40') : ''}`}>
                        {Array.isArray(data.news_analysis) ? (
                          data.news_analysis.map((news, idx) => (
                            <div key={idx} className="flex gap-3 items-start">
                               <span className="text-slate-500 mt-0.5"><Newspaper size={12} /></span>
                               <p className="text-xs text-slate-300 leading-relaxed font-medium">{news}</p>
                            </div>
                          ))
                        ) : (
                          <div className="flex gap-3 items-start">
                             <span className="text-slate-500 mt-0.5"><Newspaper size={12} /></span>
                             <p className="text-xs text-slate-300 leading-relaxed font-medium">{data.news_analysis}</p>
                          </div>
                        )}
                      </div>
                      {isFree && (
                          <div className="absolute inset-x-0 bottom-4 flex justify-center z-10">
                              <span className={`px-3 py-1 rounded-full border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider ${!isHighPerformance ? 'bg-white/10 backdrop-blur-md' : 'bg-slate-800'}`}>升级 Pro 解锁情报</span>
                          </div>
                      )}
                    </section>
                  )}

                  {/* 分析过程 - 推理链 (带折叠交互) */}
                  {Array.isArray(data.reasoning_trace) && data.reasoning_trace.length > 0 && (
                    <section className="space-y-4 relative">
                      <button 
                        onClick={() => !isFree && setIsExpanded(!isExpanded)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 group active:scale-[0.98] transition-all ${isFree ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                           <div className={`w-1.5 h-1.5 rounded-full bg-indigo-500 transition-all duration-500 ${isExpanded ? 'shadow-[0_0_12px_rgba(99,102,241,0.8)] scale-125' : 'opacity-40'}`} />
                           <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-200 transition-colors">查看策略推演过程</span>
                        </div>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          className="text-slate-600 group-hover:text-slate-400"
                        >
                           <ChevronDown size={16} />
                        </motion.div>
                      </button>
                      {isFree && (
                          <div className="absolute inset-0 flex items-center justify-center">
                              <div className={`px-4 py-2 rounded-2xl border border-indigo-500/30 text-[10px] font-black italic text-indigo-400 uppercase tracking-widest shadow-2xl ${!isHighPerformance ? 'bg-indigo-500/20 backdrop-blur-xl' : 'bg-[#0f0f18]'}`}>
                                  升级 PRO 解锁 AI 推理详情
                              </div>
                          </div>
                      )}

                      <AnimatePresence>
                        {isExpanded && !isFree && (
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
                                              {config.label}
                                            </span>
                                          </div>
                                        );
                                      })()}
                                      <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full italic tracking-tight">
                                        {step.conclusion}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-200/60 font-medium leading-relaxed">
                                      {step.data}
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
                    <section className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                      <h3 className="text-xs font-black text-rose-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <AlertTriangle size={12} /> 思维复盘 / 风险反思
                      </h3>
                      <p className="text-sm text-rose-300/70 leading-relaxed italic">{data.counter_argument}</p>
                    </section>
                  )}

                  <section className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                    <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Info size={12} /> 核心冲突处理原则</h3>
                    <p className="text-sm text-indigo-300/70 leading-relaxed italic">{data.conflict_resolution || "遵循趋势优先原则。"}</p>
                  </section>
                </div>
              ) : (
                <AICouncil symbol={symbol} stockName={stockName} targetDate={targetDate} />
              )}
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {isOpen && (
      <SilentPoster 
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        prediction={posterPrediction}
        stockName={stockName || symbol}
        userPos={userPos}
      />
    )}
    </>
  );
}
