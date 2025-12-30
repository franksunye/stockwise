'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, ShieldCheck, Target, Clock } from 'lucide-react';
import { getCurrentUser } from '@/lib/user';

// Fallback data for the reveal step
const DEFAULT_REVEAL_DATA = { 
  name: '您选择的股票', 
  price: 100.00, 
  change: 2.5, 
  signal: 'Long', 
  confidence: 0.85, 
  reason: '多头排列形态完整，量能配合理想，上涨空间打开。', 
  support: 95.00 
};

interface RecommendedStock {
  symbol: string;
  name: string;
  market: string;
}

export function OnboardingOverlay() { 
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [persona, setPersona] = useState<string | null>(null);

  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [selectedStockName, setSelectedStockName] = useState<string | null>(null);
  const [analyzingStage, setAnalyzingStage] = useState(0); // 0: None, 1: Connecting, 2: Flows, 3: AI
  const [revealData, setRevealData] = useState(DEFAULT_REVEAL_DATA);
  const [recommendedStocks, setRecommendedStocks] = useState<RecommendedStock[]>([]);

  useEffect(() => {
    checkOnboardingStatus();
    fetchRecommendedStocks();
  }, []);

  const fetchRecommendedStocks = async () => {
    try {
      const res = await fetch('/api/user/onboarding/stocks');
      const data = await res.json();
      if (data.stocks && data.stocks.length > 0) {
        setRecommendedStocks(data.stocks);
      }
    } catch (e) {
      console.error("Fetch recommended stocks failed", e);
    }
  };

  const checkOnboardingStatus = async () => {
    // 1. Check LocalStorage first to avoid flicker
    const localHasOnboarded = localStorage.getItem('STOCKWISE_HAS_ONBOARDED');
    if (localHasOnboarded) return;

    // 2. Double check with API (in case user cleared cache but is old user)
    const user = await getCurrentUser();
    try {
        const res = await fetch('/api/user/profile', {
            method: 'POST',
            body: JSON.stringify({ userId: user.userId })
        });
        const data = await res.json();
        if (!data.hasOnboarded) {
             setIsVisible(true);
        } else {
             localStorage.setItem('STOCKWISE_HAS_ONBOARDED', 'true');
        }
    } catch (e) {
        console.error("Check onboarding failed", e);
    }
  };

  const handleComplete = async () => {
    const user = await getCurrentUser();
    try {
         await fetch('/api/user/onboarding/complete', {
            method: 'POST',
            body: JSON.stringify({ userId: user.userId, selectedStock })
        });
        localStorage.setItem('STOCKWISE_HAS_ONBOARDED', 'true');
        setIsVisible(false);
        // Reload to refresh state (simple way to ensure UI updates to Pro)
        window.location.reload();
    } catch (e) {
        console.error("Completion failed", e);
        setIsVisible(false); // Close anyway
    }
  };

  const startAnalysis = async (symbol: string, name?: string) => {
    setSelectedStock(symbol);
    setSelectedStockName(name || symbol);
    setAnalyzingStage(1);
    
    // Fetch real stock data
    try {
      const res = await fetch(`/api/stock?symbol=${symbol}`);
      const data = await res.json();
      
      if (data.price || data.prediction) {
        // Parse ai_reasoning JSON to get summary (same logic as Dashboard)
        let reasoningSummary = '基于近期市场表现和技术指标的综合分析结论。';
        try {
          const tacticalData = JSON.parse(data.prediction?.ai_reasoning || '');
          reasoningSummary = tacticalData?.summary || data.prediction?.ai_reasoning || reasoningSummary;
        } catch {
          // If parsing fails, use raw ai_reasoning or default
          reasoningSummary = data.prediction?.ai_reasoning || reasoningSummary;
        }
        
        setRevealData({
          name: name || symbol,
          price: data.price?.close || 0,
          change: data.price?.change_percent || 0,
          signal: data.prediction?.signal || 'Side',
          confidence: data.prediction?.confidence || 0.7,
          reason: reasoningSummary,
          support: data.prediction?.support_price || (data.price?.close ? (data.price.close * 0.95) : 95)
        });
      }
    } catch (e) {
      console.error('Fetch stock data failed', e);
      // Use default data on error
      setRevealData({
        ...DEFAULT_REVEAL_DATA,
        name: name || symbol
      });
    }

    // Simulate Steps
    setTimeout(() => setAnalyzingStage(2), 1500);
    setTimeout(() => setAnalyzingStage(3), 3000);
    setTimeout(() => {
        setStep(4);
    }, 4500);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-black text-white overflow-hidden flex flex-col items-center justify-center">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[#050508]">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 flex flex-col h-full max-h-[800px]">
        
        {/* Step Indicator */}
        <div className="flex gap-1 pt-8 mb-8 justify-center">
            {[1, 2, 3, 4, 5].map(s => (
                <div key={s} className={`h-1 rounded-full transition-all duration-500 ${s <= step ? 'w-8 bg-indigo-500' : 'w-2 bg-white/10'}`} />
            ))}
        </div>

        <div className="flex-1 flex flex-col justify-center">
            <AnimatePresence mode='wait'>
                
                {/* STEP 1: WELCOME */}
                {step === 1 && (
                    <motion.div 
                        key="step1"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="text-center space-y-8"
                    >
                        <div className="relative inline-block">
                             <div className="absolute inset-0 bg-indigo-500 blur-[40px] opacity-40 rounded-full" />
                             <Zap className="w-24 h-24 text-white relative z-10" />
                        </div>
                        <div className="space-y-4">
                            <h1 className="text-4xl font-black italic tracking-tighter">
                                Trade Smarter,<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Not Harder.</span>
                            </h1>
                            <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-xs mx-auto">
                                让 AI 处理复杂的市场分析，<br/>您只需要负责做决定。
                            </p>
                        </div>
                        <button onClick={() => setStep(2)} className="w-full py-4 bg-white text-black font-black text-lg rounded-2xl active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)]">
                            开启旅程
                        </button>
                    </motion.div>
                )}

                {/* STEP 2: PERSONA */}
                {step === 2 && (
                    <motion.div 
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                    >
                        <div className="space-y-2 text-center">
                            <h2 className="text-2xl font-bold">您的交易风格是?</h2>
                            <p className="text-slate-400 text-sm">帮助 AI 更好地为您适配策略</p>
                        </div>

                        <div className="space-y-3">
                            {[
                                { id: 'steady', icon: '🐢', title: '稳健型', desc: '长期持有，价值投资，厌恶风险' },
                                { id: 'balanced', icon: '🦅', title: '平衡型', desc: '成长与安全并重，波段操作' },
                                { id: 'aggressive', icon: '🐅', title: '激进型', desc: '短线博弈，追求高爆发' },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setPersona(item.id)}
                                    className={`w-full p-5 rounded-2xl border text-left transition-all flex items-center gap-4 group ${
                                        persona === item.id 
                                        ? 'bg-indigo-600 border-indigo-500 shadow-xl scale-[1.02]' 
                                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                                    }`}
                                >
                                    <span className="text-3xl filter grayscale group-hover:grayscale-0 transition-all">{item.icon}</span>
                                    <div>
                                        <div className={`font-bold text-lg ${persona === item.id ? 'text-white' : 'text-slate-200'}`}>{item.title}</div>
                                        <div className={`text-xs ${persona === item.id ? 'text-indigo-200' : 'text-slate-500'}`}>{item.desc}</div>
                                    </div>
                                    {persona === item.id && <Check className="ml-auto text-indigo-200" />}
                                </button>
                            ))}
                        </div>

                        <button 
                            disabled={!persona}
                            onClick={() => setStep(3)} 
                            className="w-full py-4 bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-2xl active:scale-95 transition-all"
                        >
                            继续
                        </button>
                    </motion.div>
                )}

                {/* STEP 3: INTERACTIVE INPUT */}
                {step === 3 && (
                    <motion.div 
                        key="step3"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        className="space-y-8 text-center"
                    >
                        {analyzingStage === 0 ? (
                            <>
                                <h2 className="text-2xl font-bold">选择一只股票体验</h2>
                                <p className="text-slate-400 text-sm">从热门标的中选择，我们将<br/><span className="text-indigo-400 font-bold">完全解锁</span>它的 AI 深度分析。</p>
                                
                                {/* Curated Stock List - Only stocks with AI predictions */}
                                <div className="space-y-3 text-left">
                                    {(recommendedStocks.length > 0 ? recommendedStocks : [
                                        { symbol: '00700', name: '腾讯控股', market: 'HK' },
                                        { symbol: '600519', name: '贵州茅台', market: 'CN' },
                                        { symbol: '01398', name: '工商银行', market: 'HK' },
                                        { symbol: '688981', name: '中芯国际', market: 'CN' },
                                    ]).map(item => {
                                        const isHK = item.market === 'HK';
                                        const suffix = isHK ? '.HK' : (item.symbol.startsWith('6') && item.symbol.length === 6 ? '.SH' : '.SZ');
                                        return (
                                            <button 
                                                key={item.symbol} 
                                                onClick={() => startAnalysis(item.symbol, item.name)} 
                                                className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 hover:border-indigo-500/30 transition-all active:scale-[0.98]"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xs font-black ${isHK ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                                        {isHK ? '港股' : 'A股'}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-base font-bold text-white">{item.name}</p>
                                                        <p className="text-[10px] text-slate-500 mono uppercase tracking-wider">{item.symbol}{suffix}</p>
                                                    </div>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                                                    <Zap size={14} className="text-indigo-400" />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                
                                <p className="text-[10px] text-slate-600 italic">* 正式使用后，您可以添加任意港股或A股到监控池</p>
                            </>
                        ) : (
                            <div className="py-12 space-y-8">
                                <div className="relative w-32 h-32 mx-auto">
                                    <svg className="w-full h-full animate-spin-slow" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" fill="none" className="text-white/10" />
                                        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" fill="none" className="text-indigo-500" strokeDasharray="283" strokeDashoffset="100" />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Zap className="w-10 h-10 text-indigo-400 animate-pulse" />
                                    </div>
                                </div>
                                <div className="space-y-2 h-16">
                                    <motion.p 
                                        key={analyzingStage}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-lg font-bold text-white tracking-wide"
                                    >
                                        {analyzingStage === 1 && "正在连接全球市场数据..."}
                                        {analyzingStage === 2 && "正在追踪机构资金流向..."}
                                        {analyzingStage === 3 && "AI 正在生成深度决策逻辑..."}
                                    </motion.p>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* STEP 4: REVEAL (THE WOW MOMENT) */}
                {step === 4 && (
                    <motion.div 
                        key="step4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="relative"
                    >
                        <div className="absolute -top-10 left-0 right-0 text-center mb-4">
                            <span className="inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 uppercase tracking-widest animate-pulse">
                                Pro Feature Unlocked
                            </span>
                        </div>

                        {/* HERO CARD UI */}
                        <div className="bg-[#1a1a24] border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                           {/* Decorative Glow */}
                           <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br opacity-20 blur-[60px] rounded-full pointer-events-none ${
                               revealData.signal === 'Long' ? 'from-emerald-500' : 'from-rose-500'
                           }`} />

                           <div className="relative z-10 space-y-6">
                                {/* Header */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-3xl font-black italic text-white tracking-tighter">{revealData.name}</h3>
                                        <p className="text-xs font-bold text-slate-500 tracking-[0.2em] uppercase mt-1">AI 深度全维分析报告</p>
                                    </div>
                                    <div className={`flex flex-col items-end ${revealData.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        <span className="text-2xl font-black mono">{revealData.price.toFixed(2)}</span>
                                        <span className="text-xs font-bold">{revealData.change >= 0 ? '+' : ''}{revealData.change.toFixed(2)}%</span>
                                    </div>
                                </div>

                                {/* Core Signal */}
                                <div className="py-4 text-center border-y border-white/5 bg-black/20 rounded-xl relative overflow-hidden">
                                     <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${
                                         revealData.signal === 'Long' ? 'text-emerald-500' : revealData.signal === 'Short' ? 'text-rose-500' : 'text-amber-500'
                                     }`}>
                                         AI 建议
                                     </div>
                                     <div className={`text-3xl font-black tracking-tighter ${
                                         revealData.signal === 'Long' ? 'text-emerald-400' : revealData.signal === 'Short' ? 'text-rose-400' : 'text-amber-400'
                                     }`}>
                                         {revealData.signal === 'Long' ? '建议做多' : revealData.signal === 'Short' ? '建议避险' : '建议观望'}
                                     </div>
                                </div>

                                {/* Deep Insight (Usually Blurred) */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-indigo-400">
                                        <Zap className="w-4 h-4 fill-current" />
                                        <span className="text-xs font-bold uppercase tracking-wider">AI 核心逻辑</span>
                                    </div>
                                    <p className="text-sm font-medium text-slate-300 leading-relaxed border-l-2 border-indigo-500/50 pl-3">
                                        &quot;{revealData.reason}&quot;
                                    </p>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/5 rounded-xl p-3 flex flex-col justify-between">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                                            <Target className="w-3 h-3" /> 胜率置信度
                                        </div>
                                        <span className="text-xl font-bold text-white mt-1">{(revealData.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3 flex flex-col justify-between">
                                        <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3" /> 支撑位
                                        </div>
                                        <span className="text-xl font-bold text-white mt-1">{revealData.support.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Prompt */}
                                <div className="pt-2">
                                     <p className="text-[10px] text-center text-slate-500 italic">
                                        * 普通用户通常无法查看到“核心逻辑”与“支撑位”数据。<br/>此特权已为您临时解锁。
                                     </p>
                                </div>
                           </div>
                        </div>

                        <div className="mt-8 space-y-3">
                             <button onClick={() => setStep(5)} className="w-full py-4 bg-indigo-600 text-white font-bold text-lg rounded-2xl active:scale-95 transition-all shadow-lg hover:bg-indigo-500">
                                收下这份洞察
                             </button>
                        </div>
                    </motion.div>
                )}

                {/* STEP 5: COMPLETION */}
                {step === 5 && (
                    <motion.div 
                        key="step5"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-8"
                    >
                         <div className="relative inline-block">
                             <div className="absolute inset-0 bg-emerald-500 blur-[40px] opacity-40 rounded-full" />
                             <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center relative z-10 mx-auto shadow-2xl">
                                 <Check className="w-12 h-12 text-white" />
                             </div>
                        </div>
                        
                        <div className="space-y-4">
                            <h2 className="text-3xl font-black italic text-white">一切就绪!</h2>
                            <p className="text-slate-400">
                                <span className="text-white font-bold">{selectedStockName || selectedStock || '自选股'}</span> 已添加到您的监控列表。
                            </p>
                            
                            {/* Upsell Card */}
                            <div className="bg-gradient-to-br from-indigo-900/40 to-black border border-indigo-500/30 p-6 rounded-2xl relative overflow-hidden">
                                <div className="relative z-10">
                                     <h3 className="text-indigo-300 font-bold uppercase tracking-widest text-xs mb-2">特别礼物</h3>
                                     <p className="text-white font-bold text-lg mb-1">已激活 3 天 Pro 体验权</p>
                                     <p className="text-slate-400 text-xs">可监控 10 只股票，解锁 AI 核心逻辑与止损建议。</p>
                                </div>
                                <Clock className="absolute -bottom-4 -right-4 w-24 h-24 text-indigo-500/10" />
                            </div>
                        </div>

                        <button onClick={handleComplete} className="w-full py-4 bg-white text-black font-black text-lg rounded-2xl active:scale-95 transition-all">
                            进入控制台
                        </button>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
