'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Zap, RotateCw } from 'lucide-react';
import { AIPrediction } from '@/lib/types';

interface AICouncilProps {
  symbol: string;
  targetDate: string;
}

export function AICouncil({ symbol, targetDate }: AICouncilProps) {
  const [predictions, setPredictions] = useState<AIPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCouncilData() {
      try {
        setLoading(true);
        // Request detailed mode=full to get all models
        const res = await fetch(`/api/predictions?symbol=${symbol}&limit=10&mode=full&targetDate=${targetDate}`);
        if (!res.ok) throw new Error('Failed to fetch council data');
        
        const data = await res.json();
        const allPreds = data.predictions as AIPrediction[];
        
        // Filter for the specific target date we are looking at
        // If data is stale, this might return empty, so be careful.
        // The dashboard usually shows the *latest* prediction.
        // We really want "predictions for the same target_date as the main card"
        const relevantPreds = allPreds.filter(p => p.target_date === targetDate);
        
        setPredictions(relevantPreds);
      } catch (err: unknown) {
        console.error('Fetch council data error:', err);
        setError('无法连接 AI 智囊团');
      } finally {
        setLoading(false);
      }
    }

    if (symbol && targetDate) {
      fetchCouncilData();
    }
  }, [symbol, targetDate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-3">
        <RotateCw className="animate-spin text-indigo-500" size={24} />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">正在召集 AI 顾问...</p>
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
  const signals = predictions.map(p => p.signal);
  const longCount = signals.filter(s => s === 'Long').length;
  const shortCount = signals.filter(s => s === 'Short').length;
  const sideCount = signals.filter(s => s === 'Side').length;
  
  let consensusColor = 'text-slate-400';
  let consensusText = '分歧';
  
  const total = predictions.length;
  if (longCount === total) { consensusColor = 'text-emerald-400'; consensusText = '做多共振'; }
  else if (shortCount === total) { consensusColor = 'text-rose-400'; consensusText = '做空共振'; }
  else if (sideCount === total) { consensusColor = 'text-amber-400'; consensusText = '观望共振'; }
  else if (longCount > shortCount && longCount > sideCount) { consensusText = '倾向做多'; consensusColor = 'text-emerald-400/80'; }
  else if (shortCount > longCount && shortCount > sideCount) { consensusText = '倾向做空'; consensusColor = 'text-rose-400/80'; }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Consensus Header */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
        <div>
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">AI 智囊团结论</p>
           <h3 className={`text-xl font-black tracking-tight ${consensusColor} flex items-center gap-2`}>
              {consensusText}
              {(longCount === total || shortCount === total || sideCount === total) && <ShieldCheck size={18} />}
           </h3>
        </div>
        <div className="text-right">
           <p className="text-2xl font-black text-slate-200">{predictions.length}<span className="text-sm text-slate-500 font-bold ml-1">席</span></p>
           <p className="text-[9px] font-bold text-slate-600 uppercase">参议模型</p>
        </div>
      </div>

      {/* Model List */}
      <div className="space-y-3">
        {predictions.map((pred, idx) => {
           const isPrimary = typeof pred.is_primary === 'number' ? pred.is_primary === 1 : pred.is_primary === true;
           return (
             <div key={idx} className={`p-4 rounded-xl border ${isPrimary ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-white/[0.02] border-white/5'}`}>
                <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${isPrimary ? 'bg-indigo-500/20' : 'bg-slate-700/30'}`}>
                         <Zap size={12} className={isPrimary ? 'text-indigo-400' : 'text-slate-400'} />
                      </div>
                       <span className={`text-xs font-black uppercase tracking-wider ${isPrimary ? 'text-indigo-300' : 'text-slate-400'}`}>
                          {pred.display_name || pred.model || 'Legacy Model'}
                       </span>
                    </div>
                   <div className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide
                      ${pred.signal === 'Long' ? 'bg-emerald-500/20 text-emerald-400' : 
                        pred.signal === 'Short' ? 'bg-rose-500/20 text-rose-400' : 
                        'bg-amber-500/20 text-amber-400'}`}>
                       {pred.signal === 'Long' ? '做多' : pred.signal === 'Short' ? '做空' : '观望'}
                   </div>
                </div>
                
                {/* 简要理由 */}
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
