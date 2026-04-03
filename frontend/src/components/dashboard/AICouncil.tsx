'use client';

import { useEffect, useState } from 'react';
import { preload } from 'swr';
import useSWR from 'swr';
import { AlertTriangle, RotateCw } from 'lucide-react';
import Multiavatar from '@/components/Multiavatar';

import { useLocale } from '@/context/LocaleContext';
import { type PredictionContentLocale, appLocaleToPredictionContentLocale } from '@/lib/prediction-content-locale';
import {
  buildCouncilCards,
  fetchAICouncilData,
  getAICouncilSWRKey,
  getActionChipClass,
  getCouncilActionLabel,
  getCouncilActionMeta,
  getCouncilHeadlineAction,
  getCouncilMemorySnapshot,
  readCouncilSessionSnapshot,
  setCouncilMemorySnapshot,
  type CouncilCachePayload,
  writeCouncilSessionSnapshot,
} from '@/lib/ai-council-surface';

interface AICouncilProps {
  symbol: string;
  stockName?: string;
  targetDate: string;
}

const CACHE_TTL = 1000 * 60 * 5;
const LOADING_INDICATOR_DELAY_MS = 150;

async function fetchCouncilData([
  ,
  symbol,
  targetDate,
  predictionContentLocale,
]: readonly [string, string, string, PredictionContentLocale]): Promise<CouncilCachePayload> {
  return fetchAICouncilData(symbol, targetDate, predictionContentLocale);
}

export function preloadAICouncil(symbol: string, targetDate: string, predictionContentLocale: PredictionContentLocale): void {
  if (!symbol || !targetDate) return;
  preload(['ai-council', symbol, targetDate, predictionContentLocale] as const, fetchCouncilData);
}

export function AICouncil({ symbol, stockName, targetDate }: AICouncilProps) {
  const { locale: appLocale } = useLocale();
  const predictionLocale = appLocaleToPredictionContentLocale(appLocale);
  const snapshotKey = `${symbol}_${targetDate}_${predictionLocale}`;
  const memoryPayload = getCouncilMemorySnapshot(snapshotKey);
  const sessionPayload = !memoryPayload && symbol && targetDate
    ? readCouncilSessionSnapshot(symbol, targetDate, predictionLocale)
    : null;
  const fallbackPayload = memoryPayload || sessionPayload || undefined;
  const hasSessionSnapshot = !!sessionPayload;

  const swrKey = symbol && targetDate
    ? getAICouncilSWRKey(symbol, targetDate, predictionLocale)
    : null;
  const isFreshMemory = memoryPayload
    ? Date.now() - memoryPayload.fetchedAt < CACHE_TTL
    : false;
  const shouldRevalidateOnMount = !hasSessionSnapshot && !isFreshMemory;
  const shouldRevalidateIfStale = shouldRevalidateOnMount;

  const {
    data: payload,
    error,
    isLoading,
  } = useSWR(swrKey, fetchCouncilData, {
    fallbackData: fallbackPayload,
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateIfStale: shouldRevalidateIfStale,
    revalidateOnMount: shouldRevalidateOnMount,
    dedupingInterval: 10 * 1000,
    onSuccess: (nextPayload) => {
      setCouncilMemorySnapshot(snapshotKey, nextPayload);
      if (symbol && targetDate) {
        writeCouncilSessionSnapshot(symbol, targetDate, predictionLocale, nextPayload);
      }
    },
  });

  const predictions = payload?.data || [];
  const loading = isLoading && predictions.length === 0;
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
  const councilCards = buildCouncilCards(predictions);

  useEffect(() => {
    if (!loading) {
      setShowLoadingIndicator(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowLoadingIndicator(true);
    }, LOADING_INDICATOR_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading]);

  if (loading && !showLoadingIndicator) {
    return <div className="min-h-[88px]" aria-hidden="true" />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3">
        <RotateCw className="animate-spin text-indigo-500" size={24} />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">正在调阅投研决议...</p>
      </div>
    );
  }

  if ((error && predictions.length === 0) || predictions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-2 text-center">
        <AlertTriangle className="text-slate-600 mb-2" size={24} />
        <p className="text-sm font-bold text-slate-400">暂无更多顾问意见</p>
        <p className="text-xs text-slate-600">该标的目前仅由主模型覆盖</p>
      </div>
    );
  }

  const headlineActionKey = getCouncilHeadlineAction(predictions);
  const actionLabel = getCouncilActionLabel(headlineActionKey);
  const consensusColor =
    headlineActionKey === 'mixed'
      ? 'text-slate-400'
      : getCouncilActionMeta(headlineActionKey).textClass;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Council Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
        <div>
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{symbol}</p>
           <h3 className="text-xl font-black tracking-tight text-white">{stockName || '未知股票'}</h3>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              {predictions.length}席 当前结论
           </p>
           <h3 className={`text-xl font-black tracking-tight ${consensusColor} flex items-center justify-end gap-2`}>
              {actionLabel}
           </h3>
        </div>
      </div>

      {/* Model List */}
      <div className="space-y-3">
        {councilCards.map((card) => {
           const chipClass = getActionChipClass(card.actionKey);
           const chipText = getCouncilActionLabel(card.actionKey);
           return (
             <div key={card.key} className={`p-4 rounded-xl border ${card.isPrimary ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-white/[0.02] border-white/5'}`}>
                <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-2">
                      {card.avatarSeeds.length === 1 ? (
                        <div className={`w-7 h-7 rounded-full border overflow-hidden ${card.isPrimary ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/5 border-white/10'}`}>
                           <Multiavatar name={card.avatarSeeds[0]} className="w-full h-full" />
                        </div>
                      ) : (
                        <div className="relative w-11 h-7">
                          <div className={`absolute left-0 top-0 w-7 h-7 rounded-full border overflow-hidden bg-white/5 border-white/10 z-10`}>
                            <Multiavatar name={card.avatarSeeds[0]} className="w-full h-full" />
                          </div>
                          <div className={`absolute left-4 top-0 w-7 h-7 rounded-full border overflow-hidden ${card.isPrimary ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/5 border-white/10'} z-20`}>
                            <Multiavatar name={card.avatarSeeds[1]} className="w-full h-full" />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-black tracking-wide ${card.isPrimary ? 'text-indigo-300' : 'text-slate-300'}`}>{card.title}</p>
                        <p className="text-[10px] text-slate-500/80 font-bold">| {card.role}</p>
                      </div>
                    </div>
                   <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide ${chipClass}`}>
                       {chipText}
                   </div>
                </div>
                
                <p className="text-xs text-slate-300 leading-relaxed font-medium line-clamp-2">
                   {card.summary}
                </p>

                <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500 font-bold">
                   {typeof card.confidence === 'number' && <span>把握: {(card.confidence * 100).toFixed(0)}%</span>}
                   {card.supportPrice && <span>支撑位: {card.supportPrice}</span>}
                </div>
             </div>
           );
        })}
        <p className="px-1 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
          主结论复核基于系统结果生成，独立视角保留分析师原始判断
        </p>
      </div>
    </div>
  );
}
