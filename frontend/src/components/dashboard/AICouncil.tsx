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

// ä¸–ç•Œçº§å‰æ²¿ç¼“å­˜å±‚ï¼šå¸¦è‡ªåŠ¨è¿‡æœŸé™é»˜æ›´æ–° (SWR) å’Œé™åˆ¶æœ€å¤§å®¹é‡ (é˜²å†…å­˜æ³„æ¼)
interface CacheEntry {
  data: AIPrediction[];
  timestamp: number;
}
const councilCache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 5; // 5åˆ†é’Ÿæœ‰æ•ˆï¼Œè¶…è¿‡äº”åˆ†é’Ÿé‡‡å–é™é»˜åŠ è½½ (Stale-While-Revalidate)
const MAX_CACHE_SIZE = 50; // æœ€å¤šç¼“å­˜50åªè‚¡ç¥¨ï¼Œé˜²æ­¢ SPA æ— é™è¿è¡Œå¯¼è‡´å†…å­˜ OOM

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
      return '建议空仓';
    default:
      return '判断分歧';
  }
}


function setCache(key: string, data: AIPrediction[]) {
  if (councilCache.size >= MAX_CACHE_SIZE) {
    // ç®€æ˜“å†·é—¨æ·˜æ±°ï¼šåˆ é™¤ç¬¬ä¸€ä¸ªæ’å…¥çš„æ¡ç›®ï¼ˆå¯è¿‘ä¼¼äºŽ LRU/FIFOï¼‰
    const firstKey = councilCache.keys().next().value;
    if (firstKey) councilCache.delete(firstKey);
  }
  councilCache.set(key, { data, timestamp: Date.now() });
}

export function AICouncil({ symbol, stockName, targetDate }: AICouncilProps) {
  const cacheKey = `${symbol}_${targetDate}`;

  // 1. åŒæ­¥å–ç¼“å­˜ï¼ˆæ— è®ºæ˜¯å¦è¿‡æœŸï¼Œåªè¦æœ‰æ•°æ®å°±ç»™åˆ°è§†å›¾ï¼Œè¾¾æˆ Zero UI Flash çš„ç§’å¼€ä½“éªŒï¼‰
  const [predictions, setPredictions] = useState<AIPrediction[]>(() => {
    return councilCache.get(cacheKey)?.data || [];
  });
  
  // 2. Loading è®¾å®šï¼šå¦‚æžœè¿™æ˜¯ç¬¬ä¸€æ¬¡è¯·æ±‚ï¼ˆæ²¡æœ‰è€ç¼“å­˜ï¼‰ï¼Œåˆ™ loading
  const [loading, setLoading] = useState<boolean>(() => !councilCache.has(cacheKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true; // éš”ç¦»å¼‚æ­¥ç«žæ€æ¡ä»¶

    async function fetchCouncilData() {
      const cached = councilCache.get(cacheKey);
      const isFresh = cached && (Date.now() - cached.timestamp < CACHE_TTL);

      if (isFresh) {
         // æ•°æ®ä¾ç„¶æžåº¦æ–°é²œï¼Œç›´æŽ¥è·³è¿‡æ‰€æœ‰ç½‘ç»œè¯·æ±‚
         if (isMounted) setLoading(false);
         return; 
      }

      // ã€æ ¸å¿ƒä½“éªŒä¼˜åŒ–ã€‘å³ä½¿æ•°æ®é™ˆæ—§ï¼Œå¦‚æžœç¼“å­˜é‡Œæœ‰æ—§æ•°æ®ï¼Œä¹Ÿä¸è¦è®¾å®š Loading=trueã€‚
      // å®ƒä¼šåœ¨åŽå°ç»§ç»­å‘èµ· fetchï¼Œç”¨æˆ·å¯ä»¥åœ¨æŸ¥é˜…æ—§æ•°æ®çš„åŒæ—¶äº«å—åŽå°çš„è‡ªåŠ¨æ›´æ–°ã€‚
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

        // å¦‚æžœç”¨æˆ·ä»ç„¶åœç•™åœ¨è¿™ä¸ªç•Œé¢ï¼Œåˆ™å¹³æ»‘æ›¿æ¢æœ€æ–°çš„æ•°æ®ï¼ˆå¦‚æ— å˜åŒ–åˆ™ React å†…éƒ¨æœ‰æœºåˆ¶å‰Šå‡é‡ç»˜ï¼‰
        if (isMounted) {
            setPredictions(relevantPreds);
            setLoading(false);
            setError(null);
        }
      } catch (err: unknown) {
        console.error('Fetch council data error:', err);
        if (isMounted && !cached) setError('æ— æ³•è¿žæŽ¥æŠ•ç ”å†³è®®'); 
        if (isMounted) setLoading(false);
      }
    }

    if (symbol && targetDate) {
      fetchCouncilData();
    }

    return () => {
       // æ¸…ç†æœºåˆ¶ï¼Œé˜²æ­¢ç”¨æˆ·åœ¨è¯·æ±‚é€”ä¸­ç§’åˆ‡ Tab å¼•èµ·çš„ React å†…å­˜æ³„æ¼è­¦å‘Šä¸Žè¦†ç›–æ±¡æŸ“
       isMounted = false;
    };
  }, [symbol, targetDate, cacheKey]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3">
        <RotateCw className="animate-spin text-indigo-500" size={24} />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">æ­£åœ¨è°ƒé˜…æŠ•ç ”å†³è®®...</p>
      </div>
    );
  }

  if (error || predictions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-2 text-center">
        <AlertTriangle className="text-slate-600 mb-2" size={24} />
        <p className="text-sm font-bold text-slate-400">æš‚æ— æ›´å¤šé¡¾é—®æ„è§</p>
        <p className="text-xs text-slate-600">è¯¥æ ‡çš„ç›®å‰ä»…ç”±ä¸»æ¨¡åž‹è¦†ç›–</p>
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
    consensusText = '一致支持建议空仓';
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
    consensusText = '更多支持建议空仓';
    consensusColor = 'text-slate-300/80';
    consensusSubtext = '当前投研决议更偏向支持主结论，但仍有分歧。';
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Consensus Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
        <div>
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{symbol}</p>
           <h3 className="text-xl font-black tracking-tight text-white">{stockName || 'æœªçŸ¥è‚¡ç¥¨'}</h3>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{predictions.length}å¸­ æŠ•ç ”å†³è®®</p>
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
                
                {/* ç®€è¦ç†ç”± */}
                <p className="mb-2 text-[11px] font-medium text-slate-400 leading-5">
                   {actionMeta.badge}
                </p>
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
                   <span>æŠŠæ¡: {(pred.confidence * 100).toFixed(0)}%</span>
                   {pred.support_price && <span>æ”¯æ’‘ä½: {pred.support_price}</span>}
                </div>
             </div>
           );
        })}
      </div>
    </div>
  );
}
