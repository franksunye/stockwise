'use client';

import { useMemo } from 'react';

import { Zap, Target, ShieldCheck, ChevronDown, Clock } from 'lucide-react';
import { StockData, TacticalData, AIPrediction } from '@/lib/types';

import { getMarketScene, getPredictionTitle, getClosePriceLabelFromData, getValidationLabelFromData, isTradingDay, getMarketFromSymbol, getLastTradingDay, getHKTime } from '@/lib/date-utils';
import { COLORS } from './constants';

interface StockDashboardCardProps {
  data: StockData;
  onShowTactics: (prediction: AIPrediction) => void;
}

export function StockDashboardCard({ data, onShowTactics }: StockDashboardCardProps) {


  const scene = getMarketScene();
  const isPostMarket = scene === 'post_market';
  const isPreMarket = scene === 'pre_market';
  
  // 统一使用 HK 时间进行日期判定，避免客户端时区差异
  const today = getHKTime();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // 核心预测数据选择逻辑 (Strict Mode V2):
  // 1. 寻找今日预测
  const todayPrediction = [data.prediction, data.previousPrediction].find(
    p => p?.target_date === todayStr
  );
  
  // 2. 确定数据有效性阈值 (Threshold)
  // - 交易中/盘前 (Active): 必须是 T (今日) 的数据。过期数据无效。
  // - 盘后/休市 (Closed): 允许 T (今日) 或 T-x (上一交易日) 的数据，方便周末复盘。
  const marketType = getMarketFromSymbol(data.symbol);
  let thresholdDateStr = todayStr;

  if (isPostMarket) {
      // 在盘后或周末，即使今天是周日，我们也能接受周五(上一交易日)的数据作为"最新状态"
      const lastTrading = getLastTradingDay(undefined, marketType);
      const y = lastTrading.getFullYear();
      const m = String(lastTrading.getMonth() + 1).padStart(2, '0');
      const d = String(lastTrading.getDate()).padStart(2, '0');
      thresholdDateStr = `${y}-${m}-${d}`;
  }

  // 3. 筛选候选数据 (Strict Mode V2.1)
  // - 盘后 (Post-Market): 优先显示最新的预测 (通常是下一交易日的)，因为今日已成事实。
  // - 盘中/盘前: 优先显示特定的"今日建议"，防止数据抢跑。
  const candidate = (isPostMarket) ? data.prediction : (todayPrediction || data.prediction);
  
  // 4. 应用阈值过滤
  // 只有当数据日期 >= 阈值日期时，才认为是有效数据。
  // 这解决了"僵尸复活"显示3天前无效数据的问题，同时保留了周末查看周五数据的能力。
  const displayPrediction = (candidate && candidate.target_date >= thresholdDateStr) 
      ? candidate 
      : null;
  
  // Optimization: Memoize the heavy JSON parsing operation
  const tacticalData = useMemo(() => {
    try {
      return JSON.parse(displayPrediction?.ai_reasoning || '') as TacticalData;
    } catch {
      return null;
    }
  }, [displayPrediction?.ai_reasoning]);

  if (data.loading || !data.price) return (
    <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
      <div className="w-20 h-20 rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center">
        <Zap className="w-8 h-8 text-indigo-500 animate-pulse fill-indigo-500/20" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-black italic tracking-tighter text-white">{data.name}</h2>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">核心数据同步中...</p>
      </div>
    </div>
  );


  
  // 数据新鲜度检测：判断数据是否过时
  // - 交易中/盘前：如果没有找到 target_date = 今天 的预测，则数据过时
  // - 收市后：数据通常都是"明日预测"，不存在过时问题
  const isDataStale = (scene === 'trading' || isPreMarket) && !todayPrediction;
  
  const isTriggered = displayPrediction?.support_price && data.price.close < displayPrediction.support_price;

  // 1. 智能标题文案：优先从实际数据推断，而非仅依赖交易日历
  // 这确保标题与内容一致
  const getSmartTitle = () => {
    if (!displayPrediction?.target_date) return getPredictionTitle(scene, getMarketFromSymbol(data.symbol));
    
    const targetDate = displayPrediction.target_date;
    
    // 如果 target_date = 今天，显示"今日建议"
    if (targetDate === todayStr) return '今日建议';
    
    // 如果数据过时（target_date < 今天），显示带日期的标题
    if (targetDate < todayStr) {
      const [, m, d] = targetDate.split('-');
      return `${parseInt(m)}/${parseInt(d)} 建议`;
    }
    
    // target_date > 今天，使用日历推算的标题
    return getPredictionTitle(scene, getMarketFromSymbol(data.symbol));
  };
  
  const mainTitle = getSmartTitle();
  
  // 2. 信号文案简化展示 (Strict Mode)
  const getSignalText = (signal?: string) => {
    switch(signal) {
      case 'Long': return '建议做多';
      case 'Short': return '建议避险';
      case 'Side': return '建议观望'; // 明确的 AI 观望建议
      default: return '等待分析';     // 数据为空时的系统状态
    }
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-4 snap-start pt-32 pb-32">
      <div className="w-full max-w-md space-y-5 mx-auto">
        {/* 1. AI 顶层核心结论 */}
        <section className="text-center space-y-1 py-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-1">
            {isDataStale ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[10px] font-bold text-amber-500/80 tracking-wider uppercase">{mainTitle} · 数据待同步</span>
              </>
            ) : !displayPrediction ? (
               // New: 针对全然无数据的新股
               <>
                 <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                 <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">初始数据构建中</span>
               </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{mainTitle}</span>
              </>
            )}
          </div>
          <h2 className="text-4xl font-black tracking-tighter" style={{ 
            color: displayPrediction?.signal === 'Long' ? COLORS.up : 
                   displayPrediction?.signal === 'Short' ? COLORS.down : 
                   displayPrediction?.signal === 'Side' ? COLORS.hold : 
                   '#94a3b8' // Slate-400 for 'Waiting/Null'
          }}>
            {getSignalText(displayPrediction?.signal)}
          </h2>
          <div className="flex items-center justify-center gap-3 text-[10px] font-bold text-slate-600">
            {displayPrediction ? (
                <span className="flex items-center gap-1 uppercase tracking-widest"><Target className="w-3 h-3" /> 把握 {((displayPrediction?.confidence || 0) * 100).toFixed(0)}%</span>
            ) : (
                <span className="flex items-center gap-1 uppercase tracking-widest italic">AI 引擎即将介入</span>
            )}
          </div>
        </section>

        {/* 2. AI 理由与动态价格区块 */}
        <section 
          onClick={() => displayPrediction && onShowTactics(displayPrediction)}
          className={`glass-card relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all hover:bg-white/[0.04] ${isTriggered ? 'warning-pulse' : ''}`}
        >
          <div className="relative z-10 px-5 py-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-md bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30 ai-pulse">
                  <Zap className="w-2.5 h-2.5 text-indigo-400 fill-indigo-400/20" />
                </div>
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  AI 深度洞察 
                  {displayPrediction?.model && (
                    <span className="ml-2 text-indigo-500/60 font-black italic">
                      · {displayPrediction.model.toLowerCase().includes('deepseek') ? 'DeepSeek' : 
                         displayPrediction.model.toLowerCase().includes('gemini') ? 'Gemini' : 
                         displayPrediction.model}
                    </span>
                  )}
                </h3>
              </div>
              
              <div className="space-y-4">
                {(() => {
                  if (tacticalData) {
                    const userPos = data.rule?.position === 'holding' ? 'holding' : 'empty';
                    const rawTactics = tacticalData.tactics?.[userPos];
                    const tacticsArr = Array.isArray(rawTactics) ? rawTactics : (rawTactics ? [rawTactics] : []);
                    const p1 = tacticsArr[0];
                    return (
                      <>
                        <p className="text-sm leading-relaxed text-slate-300 font-medium italic pl-1 border-l-2 border-indigo-500/20">
                          &quot;{tacticalData.summary || displayPrediction?.ai_reasoning}&quot;
                        </p>
                        {p1 && <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 w-full overflow-hidden">
                          <span className="text-[10px] font-black bg-indigo-500 text-white px-1 py-0.5 rounded italic shrink-0">{p1.priority}</span>
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[10px] font-bold text-indigo-400 shrink-0">{p1.action}:</span>
                            <span className="text-xs text-slate-400 font-medium truncate">{p1.trigger}</span>
                          </div>
                        </div>}
                      </>
                    );
                  } else {
                    // Fallback for No Data
                    const pendingText = !displayPrediction 
                        ? "该股票刚刚加入核心监控池。AI 量化引擎正在排队处理历史数据，预计将在下一个市场窗口（盘前或收盘后）生成深度策略。"
                        : (displayPrediction?.ai_reasoning || '正在评估行情...');
                    
                    return <p className="text-sm leading-relaxed text-slate-400 font-medium italic pl-1 border-l-2 border-slate-500/20">&quot;{pendingText}&quot;</p>;
                  }
                })()}
              </div>
            </div>

            {/* AI 脑图卡片下方原本的成交价与验证已移至底部【事实区】 */}
          </div>
        </section>

        {/* 3. 底部信息区：事实与履约 (Fact & Reality) */}
        <section className="grid grid-cols-2 gap-4 pb-2">
           {/* 左侧：市场事实 (Market Reality) */}
           <div className="glass-card p-4 flex flex-col justify-between overflow-hidden">
              {(() => {
                const isMarketOpenSoon = isTradingDay() && isPreMarket;
                return (
                  <>
                    <div className="relative group">
                      <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest block mb-1 transition-colors group-hover:text-slate-400">
                        {isMarketOpenSoon ? '今日成交价' : getClosePriceLabelFromData(scene, data.price.date)}
                      </span>
                      {isMarketOpenSoon ? (
                        <div className="flex items-baseline gap-1.5 h-7">
                          <span className="text-xl font-black mono tracking-tight text-white/20 animate-pulse">--</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1.5 overflow-hidden">
                          <span className="text-xl font-black mono tracking-tight text-slate-100">{data.price.close.toFixed(2)}</span>
                          <span className="text-[10px] font-bold" style={{ color: data.price.change_percent >= 0 ? COLORS.up : COLORS.down }}>
                            {data.price.change_percent >= 0 ? '+' : ''}{data.price.change_percent.toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* RSI 仅在事实已发生时显示 */}
                    {isTradingDay() && !isPreMarket && (
                      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-slate-600 font-bold uppercase">RSI</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full bg-white/5 ${
                          data.price.rsi > 70 ? 'text-rose-500' : data.price.rsi < 30 ? 'text-emerald-500' : 'text-slate-500'
                        }`}>
                          {data.price.rsi.toFixed(0)} · {data.price.rsi > 70 ? '超买' : data.price.rsi < 30 ? '超卖' : '稳定'}
                        </span>
                      </div>
                    )}
                    
                    {/* 周一盘前显示一条微弱的提示线 */}
                    {isMarketOpenSoon && (
                      <div className="mt-2 pt-2 border-t border-dashed border-white/5">
                        <span className="text-[10px] text-slate-700 font-bold italic">等待 09:30 事实流入</span>
                      </div>
                    )}
                  </>
                );
              })()}
           </div>
           
           {/* 右侧：验证结果 (Validation) */}
           <div className="glass-card p-4 flex flex-col justify-between relative">
              {(() => {
                // 验证区独立逻辑：
                // - 交易中/盘前：验证的是"今日预测" (Target=Today) -> 显示"待收盘验证"
                // - 收市后：验证的是"今日表现" (Target=Today) -> 也就是 validationPrediction 应该是那个 Target=Today 的预测
                //   注意：在 Post-Market，data.prediction 已经是"明日预测"了，所以我们需要找 Target=Today 的。
                //   如果 data.prediction.target_date == Today (说明还没生成明日的)，那就用它。
                //   如果 data.prediction.target_date > Today (说明生成了明日的)，那就用 data.previousPrediction (Target=Today)。
                
                let validationPrediction = todayPrediction; // 默认尝试找 target=today 的

                if (isPostMarket) {
                    // 收盘后，主卡片显示的是明日建议。验证卡片需要显示对今日的验证。
                    // 尝试从 previousPrediction 中找，或者如果 prediction 还没更新，它可能就是今日的。
                    const latestIsTomorrow = data.prediction?.target_date && data.prediction.target_date > todayStr;
                    if (latestIsTomorrow) {
                        // 如果最新的是明天的，那验证用的就是前一个 (理论上是今天的)
                        validationPrediction = data.previousPrediction;
                    } else {
                        // 如果最新的就是今天的 (数据还没更新)，那就验证它
                        validationPrediction = data.prediction;
                    }
                }

                const validationDate = validationPrediction?.target_date;
                const status = validationPrediction?.validation_status;

                return (
                  <>
                    <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest absolute top-4 left-4">
                      {getValidationLabelFromData(validationDate || '')}
                    </span>
                    
                    <div className="flex-1 flex flex-col items-center justify-center pt-4">
                      {!validationPrediction ? (
                        <p className="text-xs font-bold text-slate-600 italic">暂无历史验证</p>
                      ) : (
                        <>
                           {status === 'Correct' ? (
                             <div className="flex flex-col items-center gap-2">
                               <ShieldCheck size={28} className="text-emerald-500" />
                               <span className="text-xs font-black text-emerald-500 tracking-wide">预测准确</span>
                             </div>
                           ) : status === 'Incorrect' ? (
                             <div className="flex flex-col items-center gap-2">
                               <div className="text-rose-500 text-2xl font-black leading-none">❌</div>
                               <span className="text-xs font-black text-rose-500 tracking-wide">产生偏差</span>
                             </div>
                           ) : (
                             <div className="flex flex-col items-center gap-2">
                               <Clock size={24} className="text-slate-700" />
                               <span className="text-[10px] font-bold text-slate-500 italic">待收盘验证</span>
                             </div>
                           )}
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
           </div>
        </section>

        {data.history.length > 1 && (
          <div className="flex flex-col items-center gap-1.5 pt-2 opacity-20">
            <span className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">上划追溯历史轨迹</span>
            <ChevronDown size={14} className="animate-bounce" />
          </div>
        )}
      </div>
    </div>
  );
}
