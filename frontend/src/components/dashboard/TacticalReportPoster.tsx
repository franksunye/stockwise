'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Crosshair,
  Download,
  Hash,
  Layers,
  Loader2,
  Newspaper,
  RotateCcw,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import Multiavatar from '@/components/Multiavatar';
import { getPredictionActionMeta } from '@/lib/layer1-ui';
import {
  buildCouncilCards,
  fetchAICouncilData,
  getActionChipClass,
  getCouncilActionLabel,
  getCouncilActionMeta,
  getCouncilHeadlineAction,
} from '@/lib/ai-council-surface';
import {
  getPriceNodes,
  getScenarioTacticGroups,
  normalizeActionLabel,
  normalizeLegacyTerms,
} from '@/lib/tactical-brief-surface';
import type { AIPrediction, TacticalData } from '@/lib/types';

interface TacticalReportPosterProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: AIPrediction;
  stockName: string;
  symbol: string;
  targetDate: string;
  data: TacticalData;
  currentPrice?: number;
}

function formatPrice(val: number | string | number[] | undefined, isRange = false): string {
  if (val === undefined || val === null) return '--';
  if (Array.isArray(val)) {
    if (val.length === 0) return '--';
    if (isRange) {
      const sorted = [...val].map(Number).sort((a, b) => a - b);
      return sorted.length >= 2 ? `${sorted[0]} - ${sorted[1]}` : `${sorted[0]}`;
    }
    return val.join(' / ');
  }
  return String(val);
}

function getStepConfig(step: string) {
  const s = step.toLowerCase();

  if (s.includes('trend')) return { icon: <TrendingUp size={12} />, label: '趋势' };
  if (s.includes('momentum')) return { icon: <Zap size={12} />, label: '动能' };
  if (s.includes('volume')) return { icon: <BarChart3 size={12} />, label: '成交量' };
  if (s.includes('history')) return { icon: <RotateCcw size={12} />, label: '历史' };
  if (s.includes('decision')) return { icon: <Target size={12} />, label: '决策' };
  if (s.includes('news') || s.includes('fundamental')) return { icon: <Newspaper size={12} />, label: '情报' };
  if (s.includes('position') || s.includes('level') || s.includes('price')) return { icon: <Crosshair size={12} />, label: '价格行为' };
  if (s.includes('context')) return { icon: <Layers size={12} />, label: '上下文' };
  if (s.includes('fund') || s.includes('capital') || s.includes('flow') || s.includes('money')) return { icon: <Hash size={12} />, label: '资金博弈' };

  return { icon: <Hash size={12} />, label: '综合研判' };
}

export function TacticalReportPoster({
  isOpen,
  onClose,
  prediction,
  stockName,
  symbol,
  targetDate,
  data,
  currentPrice,
}: TacticalReportPosterProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const actionMeta = useMemo(() => getPredictionActionMeta(prediction), [prediction]);
  const { scenarioHoldingProfit, scenarioHoldingLoss, scenarioEmpty } = useMemo(() => {
    const groups = getScenarioTacticGroups(data);
    return {
      scenarioHoldingProfit: groups.scenarioHoldingProfit.slice(0, 1),
      scenarioHoldingLoss: groups.scenarioHoldingLoss.slice(0, 1),
      scenarioEmpty: groups.scenarioEmpty.slice(0, 1),
    };
  }, [data]);
  const priceNodes = useMemo(() => getPriceNodes(data, currentPrice).slice(0, 6), [data, currentPrice]);
  const reasoningSteps = Array.isArray(data.reasoning_trace) ? data.reasoning_trace.slice(0, 5) : [];

  const { data: councilPayload } = useSWR(
    isOpen ? ['report-council', symbol, targetDate] : null,
    ([, nextSymbol, nextDate]) => fetchAICouncilData(nextSymbol, nextDate),
    { revalidateOnFocus: false, dedupingInterval: 10 * 1000 },
  );
  const councilPredictions = useMemo(() => councilPayload?.data || [], [councilPayload]);
  const councilCards = useMemo(() => buildCouncilCards(councilPredictions).slice(0, 2), [councilPredictions]);
  const councilHeadlineAction = useMemo(
    () => (councilPredictions.length > 0 ? getCouncilHeadlineAction(councilPredictions) : null),
    [councilPredictions],
  );
  const councilHeadline = councilHeadlineAction ? getCouncilActionLabel(councilHeadlineAction) : actionMeta.posterDecision;
  const councilHeadlineMeta = councilHeadlineAction ? getCouncilActionMeta(councilHeadlineAction) : actionMeta;

  const reportText = useMemo(() => {
    return `ZISO AI 投研报告｜${stockName} (${symbol})\n适用日期：${targetDate}\n当前结论：${councilHeadline}`;
  }, [councilHeadline, stockName, symbol, targetDate]);

  const generateImage = useCallback(async () => {
    if (!posterRef.current) return null;
    const { toPng } = await import('html-to-image');
    return toPng(posterRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#06070b',
      filter: (node) => !(node as HTMLElement).classList?.contains('capture-hidden'),
    });
  }, []);

  const handleDownload = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const dataUrl = await generateImage();
      if (!dataUrl) return;
      const link = document.createElement('a');
      link.download = `ZISO_AI_REPORT_${symbol}_${targetDate.replace(/-/g, '')}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsCapturing(false);
    }
  }, [generateImage, isCapturing, symbol, targetDate]);

  const handleShare = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const dataUrl = await generateImage();
      if (!dataUrl) return;

      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `ZISO_AI_REPORT_${symbol}_${targetDate.replace(/-/g, '')}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `ZISO AI 投研报告｜${stockName}`,
          text: reportText,
        });
        return;
      }

      const link = document.createElement('a');
      link.download = file.name;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsCapturing(false);
    }
  }, [generateImage, isCapturing, reportText, stockName, symbol, targetDate]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[310] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/85 backdrop-blur-xl"
        />

        <div className="relative z-10 flex h-full max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#0a0b10] shadow-[0_24px_100px_rgba(0,0,0,0.6)]">
          <div className="capture-hidden flex items-center justify-between border-b border-white/5 px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">ZISO AI</p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-white">投研报告图</h3>
            </div>
            <button
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition-colors hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#08090d] p-4">
            <motion.div
              ref={posterRef}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative mx-auto w-full max-w-md overflow-hidden rounded-[24px] border border-white/10 bg-[#06070b] shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.12),transparent_28%)] pointer-events-none" />
              <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '100% 22px' }} />

              <div className="relative z-10 px-5 pt-5 pb-7">
                <section className="px-1 pb-1">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <h1 className="text-[26px] leading-[1.05] font-black tracking-tight text-white sm:text-[28px]">{stockName}</h1>
                      <p className="mt-1 text-xs font-black uppercase tracking-[0.24em] text-slate-500">{symbol}</p>
                    </div>
                    <div className="text-left sm:pt-0.5 sm:text-right">
                      <p className={`text-[22px] leading-none font-black tracking-tight ${councilHeadlineMeta.textClass} sm:text-[28px]`}>
                        {councilHeadline}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 sm:mt-4 sm:gap-5">
                    <div className="flex items-center gap-2">
                      <span className="text-white">{targetDate}</span>
                    </div>
                    <div className="h-3.5 w-px bg-white/10" />
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">把握 {(prediction.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[18px] border border-indigo-500/12 bg-indigo-500/[0.05] p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-indigo-300" />
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300/80">摘要</p>
                    </div>
                    <p className="mt-2.5 text-[14px] font-medium leading-6 text-slate-100">{normalizeLegacyTerms(data.summary)}</p>
                  </div>
                </section>

                <section className="mt-5 border-t border-white/5 pt-5">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <h2 className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">投研决议</h2>
                  </div>
                  <div className="grid gap-2.5">
                    {councilCards.length > 0 ? (
                      councilCards.map((card) => (
                        <div key={card.key} className={`rounded-[18px] border p-3.5 ${card.isPrimary ? 'border-indigo-500/16 bg-indigo-500/[0.06]' : 'border-white/4 bg-white/[0.015]'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {card.avatarSeeds.length === 1 ? (
                                <div className={`h-8 w-8 shrink-0 overflow-hidden rounded-full border ${card.isPrimary ? 'bg-indigo-500/8 border-indigo-500/20' : 'bg-white/5 border-white/10'}`}>
                                  <Multiavatar name={card.avatarSeeds[0]} className="h-full w-full" />
                                </div>
                              ) : (
                                <div className="relative h-8 w-10 shrink-0">
                                  <div className={`absolute left-3 top-0 h-8 w-8 overflow-hidden rounded-full border z-10 ${card.isPrimary ? 'bg-indigo-500/8 border-indigo-500/20' : 'bg-white/5 border-white/10'}`}>
                                    <Multiavatar name={card.avatarSeeds[1]} className="h-full w-full" />
                                  </div>
                                  <div className="absolute left-0 top-0 h-8 w-8 overflow-hidden rounded-full border border-white/10 bg-white/5 z-20">
                                    <Multiavatar name={card.avatarSeeds[0]} className="h-full w-full" />
                                  </div>
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className={`truncate text-sm font-black ${card.isPrimary ? 'text-indigo-100' : 'text-white'}`}>{card.title}</p>
                                <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">{card.role}</p>
                              </div>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${getActionChipClass(card.actionKey)}`}>
                              {getCouncilActionLabel(card.actionKey)}
                            </span>
                          </div>
                          <p className="mt-2.5 text-xs leading-5 text-slate-300/95">{card.summary}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-white/5 bg-white/[0.02] p-4 text-sm text-slate-500">
                        投研决议正在调阅中，生成图片时会自动带上当前摘要与策略结构。
                      </div>
                    )}
                  </div>
                </section>

                <section className="mt-5 border-t border-white/5 pt-5">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <h2 className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">推演过程</h2>
                  </div>
                  <div className="relative space-y-3.5 before:absolute before:left-[8px] before:top-2 before:bottom-2 before:w-px before:bg-white/5">
                    {reasoningSteps.map((step, idx) => (
                      <div key={`${step.step}-${idx}`} className="relative pl-7">
                        <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border border-indigo-500/20 bg-[#0f1120] flex items-center justify-center text-indigo-300">
                          {getStepConfig(step.step).icon}
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                              <span>{getStepConfig(step.step).label}</span>
                            </p>
                            <p className="mt-1 text-[12px] font-medium leading-5 text-slate-100/92">{normalizeLegacyTerms(step.data)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mt-5 border-t border-white/5 pt-5">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    <h2 className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">操作建议</h2>
                  </div>
                  <div className="space-y-3">
                    {[
                      { title: '持仓盈利', tone: 'border-emerald-500/15 bg-emerald-500/[0.05]', badge: '盈利中', items: scenarioHoldingProfit },
                      { title: '持仓亏损', tone: 'border-rose-500/15 bg-rose-500/[0.05]', badge: '亏损中', items: scenarioHoldingLoss },
                      { title: '空仓等待', tone: 'border-indigo-500/15 bg-indigo-500/[0.05]', badge: '等待入场', items: scenarioEmpty },
                    ].map((group) => (
                      <div key={group.title} className={`rounded-[18px] border p-4 ${group.tone}`}>
                        <div className="mb-2.5 flex items-center justify-between">
                          <p className="text-sm font-black text-white">场景：{group.title}</p>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black text-slate-400">{group.badge}</span>
                        </div>
                        <div className="space-y-0 divide-y divide-white/5">
                          {group.items.map((item, idx) => (
                            <div key={`${group.title}-${idx}`} className="py-3 first:pt-1 last:pb-0">
                              <div className="flex items-center gap-2">
                                <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-black text-white">{item.priority}</span>
                                <p className="text-sm font-black text-white">{normalizeActionLabel(item.action)}</p>
                              </div>
                              <p className="mt-2 text-xs leading-5 text-slate-300">触发：{normalizeLegacyTerms(item.trigger)}</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {item.target_price && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300">目标 {formatPrice(item.target_price)}</span>}
                                {item.stop_advance_price && <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-300">移动止盈 {formatPrice(item.stop_advance_price, true)}</span>}
                                {item.stop_loss_price && <span className="rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-black text-rose-300">止损价 {formatPrice(item.stop_loss_price, true)}</span>}
                                {item.buy_zone_price && <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-[10px] font-black text-indigo-300">买入区 {formatPrice(item.buy_zone_price, true)}</span>}
                              </div>
                              <p className="mt-2 text-xs leading-5 text-slate-500">理由：{normalizeLegacyTerms(item.reason)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mt-5 border-t border-white/5 pt-5">
                  <div>
                    <div className="mb-4 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      <h2 className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">关键点位</h2>
                    </div>
                    <div className="overflow-hidden rounded-[18px] border border-white/5 bg-white/[0.02]">
                      {priceNodes.map((node) => (
                      <div key={node.id} className="grid grid-cols-[1fr_auto] gap-3 border-t border-white/5 px-3 py-3 first:border-t-0">
                        <div className="min-w-0">
                            <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${node.kind === 'current' ? 'text-slate-300' : 'text-slate-500'}`}>{node.label}</p>
                            <p className={`mt-1 line-clamp-1 text-[11px] leading-5 ${node.kind === 'current' ? 'text-slate-500' : 'text-slate-600'}`}>{node.description}</p>
                          </div>
                          <p className={`${node.kind === 'current' ? 'text-[2rem]' : 'text-[10px] uppercase tracking-[0.16em]'} font-black text-white`}>{node.price}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="mt-5 border-t border-white/5 px-1 pt-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500">
                      <span className="text-[10px] font-black uppercase tracking-[0.24em]">- ZISO AI -</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">{targetDate}</span>
                  </div>
                </section>
              </div>
            </motion.div>
          </div>

          <div className="capture-hidden flex gap-3 border-t border-white/5 bg-[#0a0b10] px-4 py-4">
            <button
              onClick={handleShare}
              disabled={isCapturing}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-black font-black transition-transform active:scale-95 disabled:opacity-50"
            >
              {isCapturing ? <Loader2 className="animate-spin" size={18} /> : <Share2 size={18} />}
              分享报告
            </button>
            <button
              onClick={handleDownload}
              disabled={isCapturing}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition-transform active:scale-95 disabled:opacity-50"
            >
              {isCapturing ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
            </button>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
}
