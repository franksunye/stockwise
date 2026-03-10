'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, RotateCw } from 'lucide-react';
import { getCurrentUser } from '@/lib/user';
import { AIPrediction } from '@/lib/types';
import Multiavatar from '@/components/Multiavatar';

import { formatModelName } from '@/lib/model-names';
import { resolveAnalystFromModel } from '@/lib/agent-team';
import { getPredictionActionMeta } from '@/lib/layer1-ui';

interface AICouncilProps {
  symbol: string;
  stockName?: string;
  targetDate: string;
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

// 世界级前沿缓存层：带自动过期静默更新 (SWR) 和限制最大容量 (防内存泄漏)
interface CacheEntry {
  data: AIPrediction[];
  timestamp: number;
}
const councilCache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 5; // 5分钟有效，超过五分钟采取静默加载 (Stale-While-Revalidate)
const MAX_CACHE_SIZE = 50; // 最多缓存50只股票，防止 SPA 无限运行导致内存 OOM

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


function setCache(key: string, data: AIPrediction[]) {
  if (councilCache.size >= MAX_CACHE_SIZE) {
    // 简易冷门淘汰：删除第一个插入的条目（可近似于 LRU/FIFO）
    const firstKey = councilCache.keys().next().value;
    if (firstKey) councilCache.delete(firstKey);
  }
  councilCache.set(key, { data, timestamp: Date.now() });
}

export function AICouncil({ symbol, stockName, targetDate }: AICouncilProps) {
  const cacheKey = `${symbol}_${targetDate}`;

  // 1. 同步取缓存（无论是否过期，只要有数据就给到视图，达成 Zero UI Flash 的秒开体验）
  const [predictions, setPredictions] = useState<AIPrediction[]>(() => {
    return councilCache.get(cacheKey)?.data || [];
  });
  
  // 2. Loading 设定：如果这是第一次请求（没有老缓存），则 loading
  const [loading, setLoading] = useState<boolean>(() => !councilCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true; // 隔离异步竞争条件

    async function fetchCouncilData() {
      const cached = councilCache.get(cacheKey);
      const isFresh = cached && (Date.now() - cached.timestamp < CACHE_TTL);

      if (isFresh) {
         // 数据依然极度新鲜，直接跳过所有网络请求
         if (isMounted) setLoading(false);
         return; 
      }

      // 【核心体验优化】即使数据陈旧，如果缓存里有旧数据，也不要设定 Loading=true。
      // 它会在后台继续发起 fetch，用户可以在查阅旧数据的同时享受后台的自动更新。
      if (!cached && isMounted) {
         setLoading(true);
      }

      try {
        await getCurrentUser();
        const res = await fetch(`/api/predictions?symbol=${symbol}&limit=10&mode=full&targetDate=${targetDate}`);
        if (!res.ok) throw new Error('Failed to fetch council data');
        
        const data = await res.json();
        const allPreds = data.predictions as AIPrediction[];
        const relevantPreds = allPreds.filter(p => p.target_date === targetDate);
        
        setCache(cacheKey, relevantPreds);

        // 如果用户仍然停留在这个界面，则平滑替换最新的数据（如无变化则 React 内部有机制削减重绘）
        if (isMounted) {
            setPredictions(relevantPreds);
            setLoading(false);
            setError(null);
        }
      } catch (err: unknown) {
        console.error('Fetch council data error:', err);
        if (isMounted && !cached) setError('无法连接投研决议'); 
        if (isMounted) setLoading(false);
      }
    }

    if (symbol && targetDate) {
      fetchCouncilData();
    }

    return () => {
       // 清理机制，防止用户在请求途中秒切 Tab 引起的 React 内存泄漏警告与覆盖污染
       isMounted = false;
    };
  }, [symbol, targetDate, cacheKey]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3">
        <RotateCw className="animate-spin text-indigo-500" size={24} />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">正在调阅投研决议...</p>
      </div>
    );
  }

  if (error || predictions.length === 0) {
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
  
  let consensusColor = 'text-slate-400';
  let consensusText = '判断分歧';
  let consensusSubtext = '不同投研视角暂未形成一致支持。';
  
  const total = predictions.length;
  if (enterCount === total) {
    consensusColor = 'text-emerald-400';
    consensusText = '一致支持建议进场';
    consensusSubtext = '当前投研决议对主结论形成一致支持。';
  } else if (observeCount === total) {
    consensusColor = 'text-amber-400';
    consensusText = '一致支持建议观察';
    consensusSubtext = '当前投研决议对主结论形成一致支持。';
  } else if (defenseCount === total) {
    consensusColor = 'text-rose-400';
    consensusText = '一致支持建议防守';
    consensusSubtext = '当前投研决议对主结论形成一致支持。';
  } else if (emptyCount === total) {
    consensusColor = 'text-slate-300';
    consensusText = '一致支持暂无信号';
    consensusSubtext = '当前投研决议对主结论形成一致支持。';
  } else if (enterCount > observeCount && enterCount > defenseCount && enterCount > emptyCount) {
    consensusText = '更多支持建议进场';
    consensusColor = 'text-emerald-400/80';
    consensusSubtext = '当前投研决议更偏向支持主结论，但仍有分歧。';
  } else if (observeCount > enterCount && observeCount > defenseCount && observeCount > emptyCount) {
    consensusText = '更多支持建议观察';
    consensusColor = 'text-amber-400/80';
    consensusSubtext = '当前投研决议更偏向支持主结论，但仍有分歧。';
  } else if (defenseCount > enterCount && defenseCount > observeCount && defenseCount > emptyCount) {
    consensusText = '更多支持建议防守';
    consensusColor = 'text-rose-400/80';
    consensusSubtext = '当前投研决议更偏向支持主结论，但仍有分歧。';
  } else if (emptyCount > enterCount && emptyCount > observeCount && emptyCount > defenseCount) {
    consensusText = '更多支持暂无信号';
    consensusColor = 'text-slate-300/80';
    consensusSubtext = '当前投研决议更偏向支持主结论，但仍有分歧。';
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Consensus Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
        <div>
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{symbol}</p>
           <h3 className="text-xl font-black tracking-tight text-white">{stockName || '未知股票'}</h3>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{predictions.length}席 投研决议</p>
           <h3 className={`text-xl font-black tracking-tight ${consensusColor} flex items-center justify-end gap-2`}>
              {consensusText}
              {(enterCount === total || observeCount === total || defenseCount === total || emptyCount === total) && <ShieldCheck size={18} />}
           </h3>
           <p className="mt-1 text-[11px] text-slate-500 leading-5">{consensusSubtext}</p>
        </div>
      </div>

      {/* Model List */}
      <div className="space-y-3">
        {predictions.map((pred, idx) => {
           const isPrimary = typeof pred.is_primary === 'number' ? pred.is_primary === 1 : pred.is_primary === true;
           const member = mapCouncilMember(pred);
           const actionMeta = getPredictionActionMeta(pred);
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
                   {/* Try to parse if it's JSON or use raw */}
                   {(() => {
                      try {
                          const parsed = JSON.parse(pred.ai_reasoning);
                          return parsed.summary || parsed.analysis || pred.ai_reasoning;
                      } catch {
                          return pred.ai_reasoning;
                      }
                   })()}
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
