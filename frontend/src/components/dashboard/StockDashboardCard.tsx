'use client';

import { Zap, Target, ShieldCheck, ChevronDown } from 'lucide-react';
import { StockData, TacticalData } from '@/lib/types';
import { getMarketScene, formatStockSymbol, getPredictionTitle, getClosePriceLabelFromData, getValidationLabelFromData, isTradingDay } from '@/lib/date-utils';
import { COLORS } from './constants';

interface StockDashboardCardProps {
  data: StockData;
  onShowTactics: () => void;
}

export function StockDashboardCard({ data, onShowTactics }: StockDashboardCardProps) {
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

  const scene = getMarketScene();
  const isPostMarket = scene === 'post_market';
  const isPreMarket = scene === 'pre_market';
  
  // 获取今天的日期字符串 (YYYY-MM-DD)
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // 核心预测数据选择逻辑（基于 target_date 匹配）：
  // - 交易中/盘前：找 target_date = 今天 的预测（今日预测）
  // - 收市后/休市日：找最新的预测（明日/下周一预测）
  const todayPrediction = [data.prediction, data.previousPrediction].find(
    p => p?.target_date === todayStr
  );
  
  const displayPrediction = (scene === 'trading' || isPreMarket)
    ? (todayPrediction || data.prediction)  // 优先使用今日预测，否则降级到最新预测
    : data.prediction;                       // 收市后使用最新预测
  
  // 数据新鲜度检测：判断数据是否过时
  // - 交易中/盘前：如果没有找到 target_date = 今天 的预测，则数据过时
  // - 收市后：数据通常都是"明日预测"，不存在过时问题
  const isDataStale = (scene === 'trading' || isPreMarket) && !todayPrediction;
  
  const isTriggered = displayPrediction?.support_price && data.price.close < displayPrediction.support_price;

  // 1. 智能标题文案：优先从实际数据推断，而非仅依赖交易日历
  // 这确保标题与内容一致
  const getSmartTitle = () => {
    if (!displayPrediction?.target_date) return getPredictionTitle(scene);
    
    const targetDate = displayPrediction.target_date;
    
    // 如果 target_date = 今天，显示"今日建议"
    if (targetDate === todayStr) return '今日建议';
    
    // 如果数据过时（target_date < 今天），显示带日期的标题
    if (targetDate < todayStr) {
      const [, m, d] = targetDate.split('-');
      return `${parseInt(m)}/${parseInt(d)} 建议`;
    }
    
    // target_date > 今天，使用日历推算的标题
    return getPredictionTitle(scene);
  };
  
  const mainTitle = getSmartTitle();
  
  // 2. 信号文案简化展示
  const getSignalText = (signal?: string) => {
    switch(signal) {
      case 'Long': return '建议做多';
      case 'Short': return '建议避险';
      case 'Side': return '建议观望';
      default: return '持仓观望';
    }
  };

  return (
    <div className="h-full w-full flex flex-col items-center justify-center px-6 snap-start pt-32 pb-32">
      <div className="w-full max-w-md space-y-5">
        {/* 1. AI 顶层核心结论 */}
        <section className="text-center space-y-1 py-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-1">
            {isDataStale ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[9px] font-bold text-amber-500/80 tracking-wider uppercase">{mainTitle} · 数据待同步</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                <span className="text-[9px] font-bold text-slate-500 tracking-wider uppercase">{mainTitle}</span>
              </>
            )}
          </div>
          <h2 className="text-4xl font-black tracking-tighter" style={{ 
            color: displayPrediction?.signal === 'Long' ? COLORS.up : displayPrediction?.signal === 'Short' ? COLORS.down : COLORS.hold 
          }}>
            {getSignalText(displayPrediction?.signal)}
          </h2>
          <div className="flex items-center justify-center gap-3 text-[10px] font-bold text-slate-600">
            <span className="flex items-center gap-1 uppercase tracking-widest"><Target className="w-3 h-3" /> 置信度 {((displayPrediction?.confidence || 0) * 100).toFixed(0)}%</span>
            <span className="w-0.5 h-0.5 rounded-full bg-slate-800" />
            <span className="uppercase tracking-widest italic">{formatStockSymbol(data.symbol)}</span>
          </div>
        </section>

        {/* 2. AI 理由与动态价格区块 */}
        <section 
          onClick={onShowTactics}
          className={`glass-card relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all hover:bg-white/[0.04] ${isTriggered ? 'warning-pulse' : ''}`}
        >
          <div className="relative z-10 p-5">
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-md bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30 ai-pulse">
                  <Zap className="w-2.5 h-2.5 text-indigo-400 fill-indigo-400/20" />
                </div>
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">AI 深度洞察</h3>
              </div>
              
              <div className="space-y-4">
                {(() => {
                  try {
                    const tData = JSON.parse(displayPrediction?.ai_reasoning || '') as TacticalData;
                    const userPos = data.rule?.position === 'holding' ? 'holding' : 'empty';
                    const p1 = tData.tactics?.[userPos]?.[0];
                    return (
                      <>
                        <p className="text-sm leading-relaxed text-slate-300 font-medium italic pl-1 border-l-2 border-indigo-500/20">
                          &quot;{tData.summary || displayPrediction?.ai_reasoning}&quot;
                        </p>
                        {p1 && <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 w-full overflow-hidden">
                          <span className="text-[9px] font-black bg-indigo-500 text-white px-1 py-0.5 rounded italic shrink-0">{p1.priority}</span>
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[10px] font-bold text-indigo-400 shrink-0">{p1.action}:</span>
                            <span className="text-[10px] text-slate-400 font-medium truncate">{p1.trigger}</span>
                          </div>
                        </div>}

                        {/* 新闻情报雷达 - 仅当有新闻时显示 */}
                        {tData.news_analysis && tData.news_analysis.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                             <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                                重点情报 (Last 48h)
                             </div>
                             <div className="space-y-1.5">
                               {tData.news_analysis.slice(0, 2).map((news, idx) => (
                                 <div key={idx} className="flex gap-2 items-start">
                                    <span className="text-[10px] mt-0.5 opacity-50">📰</span>
                                    <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">{news}</p>
                                 </div>
                               ))}
                             </div>
                          </div>
                        )}
                      </>
                    );
                  } catch {
                    return <p className="text-sm leading-relaxed text-slate-300 font-medium italic pl-1 border-l-2 border-indigo-500/20">&quot;{displayPrediction?.ai_reasoning || '正在评估行情...'}&quot;</p>;
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
                        <span className="text-[8px] text-slate-600 font-bold uppercase">RSI</span>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full bg-white/5 ${
                          data.price.rsi > 70 ? 'text-rose-500' : data.price.rsi < 30 ? 'text-emerald-500' : 'text-slate-500'
                        }`}>
                          {data.price.rsi.toFixed(0)} · {data.price.rsi > 70 ? '超买' : data.price.rsi < 30 ? '超卖' : '稳定'}
                        </span>
                      </div>
                    )}
                    
                    {/* 周一盘前显示一条微弱的提示线 */}
                    {isMarketOpenSoon && (
                      <div className="mt-2 pt-2 border-t border-dashed border-white/5">
                        <span className="text-[8px] text-slate-700 font-bold italic">等待 09:30 事实流入</span>
                      </div>
                    )}
                  </>
                );
              })()}
           </div>
           
           {/* 右侧：验证结果 (Validation) */}
           <div className="glass-card p-4 flex flex-col justify-between">
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
                    <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest">
                      {getValidationLabelFromData(validationDate || '')}
                    </span>
                    <div className="mt-1">
                      {!validationPrediction ? (
                        <p className="text-[11px] font-bold text-slate-600 italic">暂无历史验证</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 font-black text-xs leading-none">
                            {status === 'Correct' ? (
                              <span className="text-emerald-500 flex items-center gap-1"><ShieldCheck size={14} /> 预测准确</span>
                            ) : status === 'Incorrect' ? (
                              <span className="text-rose-500">❌ 产生偏差</span>
                            ) : (
                              <span className="text-slate-500 italic">待收盘验证</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
           </div>
        </section>

        {data.history.length > 1 && (
          <div className="flex flex-col items-center gap-1.5 pt-2 opacity-20">
            <span className="text-[8px] font-black tracking-[0.2em] text-slate-500 uppercase">上划追溯历史轨迹</span>
            <ChevronDown size={14} className="animate-bounce" />
          </div>
        )}
      </div>
    </div>
  );
}
