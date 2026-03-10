'use client';

import useSWR from 'swr';
import { ShieldCheck, AlertTriangle, RotateCw } from 'lucide-react';
import { getCurrentUser } from '@/lib/user';
import { AIPrediction } from '@/lib/types';
import Multiavatar from '@/components/Multiavatar';

import { formatModelName } from '@/lib/model-names';
import { resolveAnalystFromModel } from '@/lib/agent-team';

interface AICouncilProps {
  symbol: string;
  stockName?: string;
  targetDate: string;
}

interface CouncilCachePayload {
  data: AIPrediction[];
  fetchedAt: number;
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
const councilSnapshotCache = new Map<string, CouncilCachePayload>();

type CouncilActionKey = 'enter' | 'observe' | 'defense' | 'empty' | 'mixed';

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

function getCouncilSummary(reasoning: string): string {
  try {
    const parsed = JSON.parse(reasoning);
    return parsed.summary || parsed.analysis || reasoning;
  } catch {
    return reasoning;
  }
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
  await getCurrentUser();
  const res = await fetch(`/api/predictions?symbol=${symbol}&limit=10&mode=full&targetDate=${targetDate}`);
  if (!res.ok) throw new Error('Failed to fetch council data');

  const data = await res.json();
  const allPreds = data.predictions as AIPrediction[];
  const relevantPreds = allPreds.filter((pred) => pred.target_date === targetDate);
  return {
    data: relevantPreds,
    fetchedAt: Date.now(),
  };
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
  if (actionLabel.includes('进场')) consensusColor = 'text-emerald-400';
  else if (actionLabel.includes('观察')) consensusColor = 'text-amber-400';
  else if (actionLabel.includes('防守')) consensusColor = 'text-rose-400';
  else if (actionLabel.includes('暂无')) consensusColor = 'text-slate-300';

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
        {predictions.map((pred, idx) => {
           const isPrimary = typeof pred.is_primary === 'number' ? pred.is_primary === 1 : pred.is_primary === true;
           const member = mapCouncilMember(pred);
           const actionKey = getCouncilActionKey(pred);
           const chipClass = actionKey === 'enter'
             ? 'bg-emerald-500/20 text-emerald-400'
             : actionKey === 'defense'
               ? 'bg-rose-500/20 text-rose-400'
               : actionKey === 'empty'
                 ? 'bg-slate-500/20 text-slate-300'
                 : 'bg-amber-500/20 text-amber-400';
           const chipText = getCouncilActionLabel(actionKey);
           return (
             <div key={idx} className={`p-4 rounded-xl border ${isPrimary ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-white/[0.02] border-white/5'}`}>
                <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full border overflow-hidden ${isPrimary ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/5 border-white/10'}`}>
                         <Multiavatar name={member.avatarSeed} className="w-full h-full" />
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-black tracking-wide ${isPrimary ? 'text-indigo-300' : 'text-slate-300'}`}>{member.name}</p>
                        <p className="text-[10px] text-slate-500/80 font-bold">| {member.role}</p>
                      </div>
                    </div>
                   <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide ${chipClass}`}>
                       {chipText}
                   </div>
                </div>
                
                <p className="text-xs text-slate-300 leading-relaxed font-medium line-clamp-2">
                   {getCouncilSummary(pred.ai_reasoning)}
                </p>

                <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500 font-bold">
                   <span>把握: {(pred.confidence * 100).toFixed(0)}%</span>
                   {pred.support_price && <span>支撑位: {pred.support_price}</span>}
                </div>
             </div>
           );
        })}
      </div>
    </div>
  );
}
