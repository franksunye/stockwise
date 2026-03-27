'use client';

import { useEffect, useState } from 'react';
import { preload } from 'swr';
import useSWR from 'swr';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { getCurrentUser } from '@/lib/user';
import { AIPrediction } from '@/lib/types';
import Multiavatar from '@/components/Multiavatar';

import { formatModelName } from '@/lib/model-names';
import { getTeamMemberById, resolveAnalystFromModel } from '@/lib/agent-team';
import { getPredictionActionMeta } from '@/lib/layer1-ui';
import { getFirstSentence, getTacticalConflictSummary, getTacticalSummary } from '@/lib/tactical-brief-content';

interface AICouncilProps {
  symbol: string;
  stockName?: string;
  targetDate: string;
}

interface CouncilCachePayload {
  data: AIPrediction[];
  fetchedAt: number;
}

type CouncilActionKey = 'enter' | 'observe' | 'defense' | 'empty' | 'mixed';
type CouncilCardMode = 'collab' | 'independent' | 'rule';

interface CouncilCardData {
  key: string;
  title: string;
  role: string;
  summary: string;
  actionKey: CouncilActionKey;
  confidence?: number;
  supportPrice?: number;
  isPrimary?: boolean;
  mode: CouncilCardMode;
  avatarSeeds: string[];
}

function mapCouncilMember(pred: AIPrediction) {
  const modelLike = `${pred.display_name || ''} ${pred.model || ''}`;
  const analyst = resolveAnalystFromModel(modelLike);
  if (analyst.id === 'fallback') {
    return {
      name: formatModelName(pred.display_name || pred.model),
      role: analyst.role,
      avatarSeed: analyst.avatarSeed,
    };
  }
  return { name: analyst.name, role: analyst.role, avatarSeed: analyst.avatarSeed };
}

const CACHE_TTL = 1000 * 60 * 5;
const SNAPSHOT_TTL = 1000 * 60 * 60 * 24; // 24h — predictions are daily-immutable; target_date in key handles invalidation
const SNAPSHOT_VERSION = 'v2';
const MAX_CACHE_SIZE = 50;
const LOADING_INDICATOR_DELAY_MS = 150;
const councilSnapshotCache = new Map<string, CouncilCachePayload>();

function getCouncilActionKey(pred: AIPrediction): CouncilActionKey {
  switch (pred.layer1_status) {
    case 'TriggeredLong':
      return 'enter';
    case 'Watch':
      return 'observe';
    case 'RiskOff':
      return 'defense';
    case 'NoSetup':
      return 'empty';
    default:
      break;
  }

  switch (pred.signal) {
    case 'Long':
      return 'enter';
    case 'Short':
      return 'defense';
    case 'Side':
      return 'observe';
    default:
      return 'mixed';
  }
}

function getCouncilActionKeyFromSignal(signalLike: string | undefined | null): CouncilActionKey {
  switch (signalLike) {
    case 'TriggeredLong':
    case 'Long':
      return 'enter';
    case 'Watch':
    case 'Side':
      return 'observe';
    case 'RiskOff':
    case 'Short':
      return 'defense';
    case 'NoSetup':
      return 'empty';
    default:
      return 'mixed';
  }
}

function getCouncilActionLabel(actionKey: CouncilActionKey): string {
  switch (actionKey) {
    case 'enter':
      return '建议看多';
    case 'observe':
      return '建议观察';
    case 'defense':
      return '建议防守';
    case 'empty':
      return '暂无信号';
    default:
      return '判断分歧';
  }
}

function getCouncilHeadlineAction(predictions: AIPrediction[]): CouncilActionKey {
  const primaryPrediction = predictions.find((pred) => pred.is_primary === true || pred.is_primary === 1);
  const primaryAction = primaryPrediction ? getCouncilActionKey(primaryPrediction) : 'mixed';
  if (primaryAction !== 'mixed') return primaryAction;

  const counts = new Map<CouncilActionKey, number>();
  for (const pred of predictions) {
    const actionKey = getCouncilActionKey(pred);
    counts.set(actionKey, (counts.get(actionKey) || 0) + 1);
  }

  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return 'mixed';
  if (ranked.length === 1) return ranked[0][0];
  if (ranked[0][1] === ranked[1][1]) return 'mixed';
  return ranked[0][0];
}

function buildCollabSummary(pred: AIPrediction, analystName: string): string {
  const actionLabel = getCouncilActionLabel(
    getCouncilActionKeyFromSignal(pred.layer1_signal || pred.layer1_status || pred.canonical_signal || pred.signal)
  );
  const conflict = getFirstSentence(getTacticalConflictSummary(pred.llm_reasoning || pred.ai_reasoning));
  if (conflict) return conflict;

  const summary = getFirstSentence(getTacticalSummary(pred.llm_reasoning || pred.ai_reasoning));
  if (summary) {
    return `当前结论为${actionLabel}，${analystName}复核后认为：${summary}`;
  }
  return `${analystName}复核后，当前结论维持${actionLabel}。`;
}

function buildRuleSummary(pred: AIPrediction): string {
  const summary = getFirstSentence(getTacticalSummary(pred.llm_reasoning || pred.ai_reasoning));
  if (summary) return summary;
  const actionLabel = getCouncilActionLabel(
    getCouncilActionKeyFromSignal(pred.layer1_signal || pred.layer1_status || pred.canonical_signal || pred.signal)
  );
  return `规则侧当前判断为${actionLabel}。`;
}

function getActionChipClass(actionKey: CouncilActionKey): string {
  return getCouncilActionMeta(actionKey).bgClass.replace('border-rose-500/20', '').replace('border-emerald-500/20', '').replace('border-amber-500/20', '').replace('border-slate-500/20', '').trim();
}

function getCouncilActionMeta(actionKey: CouncilActionKey) {
  switch (actionKey) {
    case 'enter':
      return getPredictionActionMeta({ signal: 'Long', layer1_status: 'TriggeredLong' });
    case 'observe':
      return getPredictionActionMeta({ signal: 'Side', layer1_status: 'Watch' });
    case 'defense':
      return getPredictionActionMeta({ signal: 'Short', layer1_status: 'RiskOff' });
    case 'empty':
      return getPredictionActionMeta({ signal: 'Side', layer1_status: 'NoSetup' });
    default:
      return getPredictionActionMeta(null);
  }
}

function buildCouncilCards(predictions: AIPrediction[]): CouncilCardData[] {
  const shenCe = getTeamMemberById('shen_ce');
  const guShen = getTeamMemberById('gu_shen');
  const linXu = getTeamMemberById('lin_xu');
  const chengJu = getTeamMemberById('cheng_ju');

  const deepseekPred = predictions.find((pred) => resolveAnalystFromModel(`${pred.display_name || ''} ${pred.model || ''}`).id === 'gu_shen');
  const linxuPred = predictions.find((pred) => resolveAnalystFromModel(`${pred.display_name || ''} ${pred.model || ''}`).id === 'lin_xu');
  const rulePred = predictions.find((pred) => resolveAnalystFromModel(`${pred.display_name || ''} ${pred.model || ''}`).id === 'cheng_ju');

  const cards: CouncilCardData[] = [];

  if (deepseekPred) {
    const collabAction = getCouncilActionKeyFromSignal(
      deepseekPred.layer1_signal || deepseekPred.layer1_status || deepseekPred.canonical_signal || deepseekPred.signal
    );
    cards.push({
      key: 'shen-ce-gu-shen-collab',
      title: `${shenCe.name} × ${guShen.name}`,
      role: '主结论复核',
      summary: buildCollabSummary(deepseekPred, guShen.name),
      actionKey: collabAction,
      confidence: deepseekPred.confidence,
      supportPrice: deepseekPred.support_price,
      isPrimary: true,
      mode: 'collab',
      avatarSeeds: [shenCe.avatarSeed, guShen.avatarSeed],
    });
    cards.push({
      key: 'gu-shen-independent',
      title: guShen.name,
      role: '独立视角',
      summary: getTacticalSummary(deepseekPred.llm_reasoning || deepseekPred.ai_reasoning),
      actionKey: getCouncilActionKeyFromSignal(deepseekPred.llm_signal || deepseekPred.signal),
      confidence: deepseekPred.confidence,
      supportPrice: deepseekPred.support_price,
      mode: 'independent',
      avatarSeeds: [guShen.avatarSeed],
    });
  }

  if (linxuPred) {
    cards.push({
      key: 'lin-xu-independent',
      title: linXu.name,
      role: '独立视角',
      summary: getTacticalSummary(linxuPred.llm_reasoning || linxuPred.ai_reasoning),
      actionKey: getCouncilActionKeyFromSignal(linxuPred.llm_signal || linxuPred.signal),
      confidence: linxuPred.confidence,
      supportPrice: linxuPred.support_price,
      mode: 'independent',
      avatarSeeds: [linXu.avatarSeed],
    });
  }

  if (rulePred) {
    const ruleAction = getCouncilActionKeyFromSignal(
      rulePred.layer1_signal || rulePred.layer1_status || rulePred.canonical_signal || rulePred.signal
    );
    cards.push({
      key: 'shen-ce-cheng-ju-rule',
      title: `${shenCe.name} × ${chengJu.name}`,
      role: '规则视角',
      summary: buildRuleSummary(rulePred),
      actionKey: ruleAction,
      confidence: rulePred.confidence,
      supportPrice: rulePred.support_price,
      mode: 'rule',
      avatarSeeds: [shenCe.avatarSeed, chengJu.avatarSeed],
    });
  }

  if (cards.length > 0) return cards;

  return predictions.map((pred, idx) => {
    const member = mapCouncilMember(pred);
    return {
      key: `fallback-${idx}`,
      title: member.name,
      role: member.role,
      summary: getTacticalSummary(pred.ai_reasoning),
      actionKey: getCouncilActionKey(pred),
      confidence: pred.confidence,
      supportPrice: pred.support_price,
      mode: 'independent',
      avatarSeeds: [member.avatarSeed],
    };
  });
}

function getCouncilSnapshot(key: string): CouncilCachePayload | undefined {
  const cached = councilSnapshotCache.get(key);
  if (!cached) return undefined;

  councilSnapshotCache.delete(key);
  councilSnapshotCache.set(key, cached);
  return cached;
}

function setCouncilSnapshot(key: string, payload: CouncilCachePayload): void {
  if (councilSnapshotCache.has(key)) {
    councilSnapshotCache.delete(key);
  }
  councilSnapshotCache.set(key, payload);

  if (councilSnapshotCache.size > MAX_CACHE_SIZE) {
    const oldestKey = councilSnapshotCache.keys().next().value;
    if (oldestKey) councilSnapshotCache.delete(oldestKey);
  }
}

function buildSessionSnapshotKey(symbol: string, targetDate: string): string {
  return `ziso:ai-council:${SNAPSHOT_VERSION}:${symbol}:${targetDate}`;
}

function pruneStaleSnapshots(): void {
  if (typeof window === 'undefined') return;
  try {
    const today = new Date().toISOString().split('T')[0];
    const storage = window.localStorage;
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || !key.startsWith('ziso:ai-council:')) continue;
      const datePart = key.split(':').pop();
      if (datePart && datePart < today) keysToRemove.push(key);
    }
    for (const key of keysToRemove) storage.removeItem(key);
  } catch {
    // best-effort
  }
}

let _pruned = false;

function readSessionSnapshot(symbol: string, targetDate: string): CouncilCachePayload | null {
  if (typeof window === 'undefined') return null;
  if (!_pruned) { _pruned = true; pruneStaleSnapshots(); }
  try {
    const raw = window.localStorage.getItem(buildSessionSnapshotKey(symbol, targetDate));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CouncilCachePayload>;
    if (!parsed || !Array.isArray(parsed.data) || typeof parsed.fetchedAt !== 'number') {
      return null;
    }
    if (Date.now() - parsed.fetchedAt > SNAPSHOT_TTL) {
      return null;
    }
    return parsed as CouncilCachePayload;
  } catch {
    return null;
  }
}

function writeSessionSnapshot(symbol: string, targetDate: string, payload: CouncilCachePayload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(buildSessionSnapshotKey(symbol, targetDate), JSON.stringify(payload));
  } catch {
    // best-effort — quota exceeded or private mode
  }
}

async function fetchCouncilData([
  ,
  symbol,
  targetDate,
]: readonly [string, string, string]): Promise<CouncilCachePayload> {
  let res = await fetch(`/api/predictions?symbol=${symbol}&limit=10&mode=full&targetDate=${targetDate}`);
  if (res.status === 401) {
    await getCurrentUser();
    res = await fetch(`/api/predictions?symbol=${symbol}&limit=10&mode=full&targetDate=${targetDate}`);
  }
  if (!res.ok) throw new Error('Failed to fetch council data');

  const data = await res.json();
  const allPreds = data.predictions as AIPrediction[];
  const relevantPreds = allPreds.filter((pred) => pred.target_date === targetDate);
  return {
    data: relevantPreds,
    fetchedAt: Date.now(),
  };
}

export function preloadAICouncil(symbol: string, targetDate: string): void {
  if (!symbol || !targetDate) return;
  preload(['ai-council', symbol, targetDate] as const, fetchCouncilData);
}

export function AICouncil({ symbol, stockName, targetDate }: AICouncilProps) {
  const snapshotKey = `${symbol}_${targetDate}`;
  const memoryPayload = getCouncilSnapshot(snapshotKey);
  const sessionPayload = !memoryPayload && symbol && targetDate
    ? readSessionSnapshot(symbol, targetDate)
    : null;
  const fallbackPayload = memoryPayload || sessionPayload || undefined;
  const hasSessionSnapshot = !!sessionPayload;

  const swrKey = symbol && targetDate
    ? (['ai-council', symbol, targetDate] as const)
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
      setCouncilSnapshot(snapshotKey, nextPayload);
      if (symbol && targetDate) {
        writeSessionSnapshot(symbol, targetDate, nextPayload);
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
