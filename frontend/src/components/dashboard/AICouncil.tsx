'use client';

import { useEffect, useState } from 'react';
import { preload } from 'swr';
import useSWR from 'swr';
import { ShieldCheck, AlertTriangle, RotateCw } from 'lucide-react';
import { getCurrentUser } from '@/lib/user';
import { AIPrediction } from '@/lib/types';
import Multiavatar from '@/components/Multiavatar';

import { formatModelName } from '@/lib/model-names';
import { getTeamMemberById, resolveAnalystFromModel } from '@/lib/agent-team';
import { getPredictionActionMeta } from '@/lib/layer1-ui';

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
      return '建议进场';
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

function parseReasoning(reasoning: string | undefined): Record<string, unknown> | null {
  if (!reasoning) return null;
  try {
    return JSON.parse(reasoning) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getCouncilSummary(reasoning: string): string {
  const parsed = parseReasoning(reasoning);
  if (!parsed) return reasoning;
  return String(parsed.summary || parsed.analysis || reasoning);
}

function getConflictSummary(reasoning: string | undefined): string | null {
  const parsed = parseReasoning(reasoning);
  if (!parsed) return null;
  const conflict = parsed.conflict_resolution;
  return typeof conflict === 'string' && conflict.trim() ? conflict.trim() : null;
}

function getFirstSentence(text: string | null | undefined): string | null {
  if (!text) return null;
  const normalized = text.trim();
  if (!normalized) return null;
  const match = normalized.match(/^.+?[。！？!?]/);
  return match ? match[0] : normalized;
}

function buildCollabSummary(pred: AIPrediction, analystName: string): string {
  const actionLabel = getCouncilActionLabel(
    getCouncilActionKeyFromSignal(pred.layer1_signal || pred.layer1_status || pred.canonical_signal || pred.signal)
  );
  const conflict = getFirstSentence(getConflictSummary(pred.llm_reasoning || pred.ai_reasoning));
  if (conflict) return conflict;

  const summary = getFirstSentence(getCouncilSummary(pred.llm_reasoning || pred.ai_reasoning));
  if (summary) {
    return `基于量化模型当前${actionLabel}结论，${analystName}复核后给出协同汇报：${summary}`;
  }
  return `基于量化模型当前${actionLabel}结论，${analystName}复核后维持协同判断。`;
}

function buildRuleSummary(pred: AIPrediction): string {
  const summary = getFirstSentence(getCouncilSummary(pred.llm_reasoning || pred.ai_reasoning));
  if (summary) return summary;
  const actionLabel = getCouncilActionLabel(
    getCouncilActionKeyFromSignal(pred.layer1_signal || pred.layer1_status || pred.canonical_signal || pred.signal)
  );
  return `规则侧当前给出${actionLabel}判断，继续以量化模型结论作为纪律锚点。`;
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
      role: '协同观点',
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
      role: '独立判断',
      summary: getCouncilSummary(deepseekPred.llm_reasoning || deepseekPred.ai_reasoning),
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
      role: '独立判断',
      summary: getCouncilSummary(linxuPred.llm_reasoning || linxuPred.ai_reasoning),
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
      role: '协同观点',
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
      summary: getCouncilSummary(pred.ai_reasoning),
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
  const fallbackPayload = getCouncilSnapshot(snapshotKey);
  const swrKey = symbol && targetDate
    ? (['ai-council', symbol, targetDate] as const)
    : null;
  const isFresh = fallbackPayload
    ? Date.now() - fallbackPayload.fetchedAt < CACHE_TTL
    : false;

  const {
    data: payload,
    error,
    isLoading,
  } = useSWR(swrKey, fetchCouncilData, {
    fallbackData: fallbackPayload,
    keepPreviousData: true,
    revalidateOnFocus: false,
    revalidateIfStale: !isFresh,
    revalidateOnMount: !isFresh,
    dedupingInterval: 10 * 1000,
    onSuccess: (nextPayload) => {
      setCouncilSnapshot(snapshotKey, nextPayload);
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

  // Calculate Consensus
  const actionKeys = predictions.map(getCouncilActionKey);
  const enterCount = actionKeys.filter((k) => k === 'enter').length;
  const observeCount = actionKeys.filter((k) => k === 'observe').length;
  const defenseCount = actionKeys.filter((k) => k === 'defense').length;
  const emptyCount = actionKeys.filter((k) => k === 'empty').length;
  
  let consensusLevel = '更多支持';
  let actionLabel = '暂无信号';
  let consensusColor = 'text-slate-400';
  
  const total = predictions.length;
  const isUnanimous = enterCount === total || observeCount === total || defenseCount === total || emptyCount === total;
  
  if (isUnanimous) {
    consensusLevel = '一致支持';
    if (enterCount === total) actionLabel = '建议进场';
    else if (observeCount === total) actionLabel = '建议观察';
    else if (defenseCount === total) actionLabel = '建议防守';
    else actionLabel = '暂无信号';
  } else {
    // Determine majority
    const counts = [
      { key: 'enter', count: enterCount, label: '建议进场' },
      { key: 'observe', count: observeCount, label: '建议观察' },
      { key: 'defense', count: defenseCount, label: '建议防守' },
      { key: 'empty', count: emptyCount, label: '暂无信号' }
    ];
    counts.sort((a, b) => b.count - a.count);
    
    if (counts[0].count > counts[1].count) {
      consensusLevel = '更多支持';
      actionLabel = counts[0].label;
    } else {
      consensusLevel = '判断分歧';
      actionLabel = '意见不一';
    }
  }

  // Set color based on action
  if (actionLabel.includes('进场')) consensusColor = getCouncilActionMeta('enter').textClass;
  else if (actionLabel.includes('观察')) consensusColor = getCouncilActionMeta('observe').textClass;
  else if (actionLabel.includes('防守')) consensusColor = getCouncilActionMeta('defense').textClass;
  else if (actionLabel.includes('暂无')) consensusColor = getCouncilActionMeta('empty').textClass;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Consensus Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
        <div>
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{symbol}</p>
           <h3 className="text-xl font-black tracking-tight text-white">{stockName || '未知股票'}</h3>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              {predictions.length}席 {consensusLevel}
           </p>
           <h3 className={`text-xl font-black tracking-tight ${consensusColor} flex items-center justify-end gap-2`}>
              {actionLabel}
              {isUnanimous && <ShieldCheck size={18} />}
           </h3>
        </div>
      </div>

      {/* Model List */}
      <div className="space-y-3">
        {councilCards.map((card) => {
           const actionMeta = getCouncilActionMeta(card.actionKey);
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
          协同观点基于量化模型底座生成，独立判断保留分析师原始观点
        </p>
      </div>
    </div>
  );
}
