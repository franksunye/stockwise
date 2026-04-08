'use client';

import { useMemo, memo } from 'react';

import { Zap, Target, ShieldCheck, ChevronDown, Clock } from 'lucide-react';
import { StockData, AIPrediction } from '@/lib/types';

import { getMarketScene, getPredictionTitle, getClosePriceLabelFromData, getValidationLabelFromData, isTradingDay, getMarketFromSymbol, getLastTradingDay, getHKTime, normalizeToTradingDate } from '@/lib/date-utils';
import { COLORS } from './constants';

import { formatModelName } from '@/lib/model-names';
import { getPredictionActionMeta } from '@/lib/layer1-ui';
import { getValidationWindowLabel, parseValidationData } from '@/lib/prediction-display';
import { getStockDashboardCardSurface, getStockDashboardCardTitle } from '@/lib/stock-dashboard-card-surface';
import { formatBriefActionLabel, normalizeLegacyTerms } from '@/lib/tactical-brief-surface';
import { useT, useGlobalT, useLocale } from '@/context/LocaleContext';
import { getLocalizedStockName } from '@/lib/stock-name';
import type { FullMessageKey, MessageKey } from '@/lib/i18n';
import { useUserProfile } from '@/hooks/useUserProfile';

interface StockDashboardCardProps {
  data: StockData;
  onShowTactics: (prediction: AIPrediction) => void;
  isLocaleSwitching?: boolean;
}

export const StockDashboardCard = memo(function StockDashboardCard({ data, onShowTactics, isLocaleSwitching = false }: StockDashboardCardProps) {
  const t = useT('dashboard');
  const tBrief = useT('brief');
  const tGlobal = useGlobalT();
  const tCommon = useT('common');
  const { locale } = useLocale();
  const { tier } = useUserProfile();
  // Tier-gated semantic source:
  // v1 (free/go/plus) => `signal` only, v2+ (pro/alpha) => allow `layer1_status`.
  const allowLayer1Status = tier === 'pro' || tier === 'alpha';
  const stockLocale = locale === 'en' ? 'en' : 'cn';
  const displayName = getLocalizedStockName(data, stockLocale);

  const marketType = getMarketFromSymbol(data.symbol);

  const scene = getMarketScene(marketType);
  const isPostMarket = scene === 'post_market';
  const isPreMarket = scene === 'pre_market';
  
  // 统一使用 HK 时间进行日期判定，避免客户端时区差异
  const today = getHKTime();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const normalizeTargetDate = (targetDate?: string) => normalizeToTradingDate(targetDate, marketType);
  
  // 核心预测数据选择逻辑 (Strict Mode V2):
  // 1. 寻找今日预测
  const todayPrediction = [data.prediction, data.previousPrediction].find(
    p => normalizeTargetDate(p?.target_date) === todayStr
  );
  
  // 2. 确定数据有效性阈值 (Threshold)
  // - 交易中/盘前 (Active): 必须是 T (今日) 的数据。过期数据无效。
  // - 盘后/休市 (Closed): 允许 T (今日) 或 T-x (上一交易日) 的数据，方便周末复盘。
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
  const displayPrediction = (candidate && normalizeTargetDate(candidate.target_date) >= thresholdDateStr) 
      ? candidate 
      : null;
  
  const userPosition = data.rule?.position === 'holding' ? 'holding' : 'empty';
  const { tacticalData, topTactic } = useMemo(
    () => getStockDashboardCardSurface({ displayPrediction, position: userPosition }),
    [displayPrediction, userPosition]
  );

  const summaryText = normalizeLegacyTerms(tacticalData?.summary || displayPrediction?.ai_reasoning || '');
  const reasoningFallback = !displayPrediction ? t('pendingAnalysisRationale') : t('signal.pending');

  const actionMeta = useMemo(
    // IMPORTANT: top card headline/color must match report/export semantics.
    // Do not bypass this gate with raw `layer1_status`.
    () => getPredictionActionMeta(displayPrediction, { useLayer1Status: allowLayer1Status }),
    [displayPrediction, allowLayer1Status]
  );

  if (isLocaleSwitching || data.loading || !data.price) return (
    <div className="h-full w-full flex flex-col items-center justify-center space-y-4">
      <div className="w-20 h-20 rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center">
        <Zap className="w-8 h-8 text-indigo-500 animate-pulse fill-indigo-500/20" />
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-black italic tracking-tighter text-white">{displayName}</h2>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
          {isLocaleSwitching ? (locale === 'en' ? 'Switching language...' : '正在切换语言...') : tCommon('loading')}
        </p>
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
  const mainTitleInfo = getStockDashboardCardTitle({
    displayPrediction,
    todayStr,
    fallbackTitle: getPredictionTitle(scene, marketType),
    normalizeTargetDate,
  });

  const mainTitle = tGlobal(mainTitleInfo.key as FullMessageKey, mainTitleInfo.params);
  
  return (
    // Layout Contract: one vertical feed page = one viewport.
    // Keep 100dvh + shrink-0 to prevent flex shrink stacking in StockVerticalFeed.
    <div className="h-[100dvh] min-h-[100dvh] shrink-0 w-full flex flex-col items-center justify-center px-6 snap-start snap-always pt-32 pb-32">
      <div className="w-full max-w-md space-y-5 mx-auto">
        {/* 1. AI 顶层核心结论 */}
        <section className="text-center space-y-1 py-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-1">
            {isDataStale ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[10px] font-bold text-amber-500/80 tracking-wider uppercase">{mainTitle} · {t('staleData')}</span>
              </>
            ) : !displayPrediction ? (
               // New: 针对全然无数据的新股
               <>
                 <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                 <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{t('initialData')}</span>
               </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{mainTitle}</span>
              </>
            )}
          </div>

          <h2 className="text-4xl font-black tracking-tighter" style={{ 
            color: actionMeta.color
          }}>
            {t(`signal.${actionMeta.headline}` as MessageKey<'dashboard'>)}
          </h2>
          <div className="flex items-center justify-center gap-3 text-[10px] font-bold text-slate-600">
            {displayPrediction ? (
              <span className="flex items-center gap-1 uppercase tracking-widest"><Target className="w-3 h-3" /> {t('confidence')} {((displayPrediction?.confidence || 0) * 100).toFixed(0)}%</span>
            ) : (
                <span className="flex items-center gap-1 uppercase tracking-widest italic">{t('engineIntervening')}</span>
            )}
          </div>
        </section>

        {/* 2. AI 理由与动态价格区块 */}
        <section
          data-open-tactics="true"
          data-stock-dashboard-card-symbol={data.symbol}
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
                  {t('reasoning')}
                  {displayPrediction?.model && (
                    <span className="ml-2 text-indigo-500/60 font-black italic">
                      · {formatModelName(displayPrediction.model)}
                    </span>
                  )}
                </h3>
              </div>
              
              <div className="space-y-4">
                {(() => {
                  if (tacticalData) {
                    return (
                      <>
                        <p className="text-sm leading-relaxed text-slate-300 font-medium italic pl-1 border-l-2 border-indigo-500/20">
                          &quot;{summaryText}&quot;
                        </p>
                        {topTactic && <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 w-full overflow-hidden">
                          <span className="text-[10px] font-black bg-indigo-500 text-white px-1 py-0.5 rounded italic shrink-0">{topTactic.priority}</span>
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[10px] font-bold text-indigo-400 shrink-0">
                              {`${formatBriefActionLabel(topTactic.action, (slug) =>
                                tBrief(`actions.${slug}` as MessageKey<'brief'>),
                              )}:`}
                            </span>
                            <span className="text-xs text-slate-400 font-medium truncate">
                              {topTactic.trigger.startsWith('trigger.') ? tBrief(topTactic.trigger as MessageKey<'brief'>) : normalizeLegacyTerms(topTactic.trigger)}
                            </span>
                          </div>
                        </div>}
                      </>
                    );
                  } else {
                    return <p className="text-sm leading-relaxed text-slate-400 font-medium italic pl-1 border-l-2 border-slate-500/20">&quot;{reasoningFallback}&quot;</p>;
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
                const isMarketOpenSoon = isTradingDay(undefined, marketType) && isPreMarket;
                return (
                  <>
                    <div className="relative group">
                      <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest block mb-1 transition-colors group-hover:text-slate-400">
                        {(() => {
                          const labelInfo = isMarketOpenSoon ? { key: 'dashboard.date.todayFact' } : getClosePriceLabelFromData(scene, data.price.date, marketType);
                          return tGlobal(labelInfo.key as FullMessageKey, labelInfo.params);
                        })()}
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
                    {isTradingDay(undefined, marketType) && !isPreMarket && data.price.rsi != null && (
                      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-slate-600 font-bold uppercase">RSI</span>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full bg-white/5 ${
                          data.price.rsi > 70 ? 'text-rose-500' : data.price.rsi < 30 ? 'text-emerald-500' : 'text-slate-500'
                        }`}>
                          {data.price.rsi.toFixed(0)} · {data.price.rsi > 70 ? t('rsi.overbought') : data.price.rsi < 30 ? t('rsi.oversold') : t('rsi.stable')}
                        </span>
                      </div>
                    )}


                    
                    {/* 周一盘前显示一条微弱的提示线 */}
                    {isMarketOpenSoon && (
                      <div className="mt-2 pt-2 border-t border-dashed border-white/5">
                        <span className="text-[10px] text-slate-700 font-bold italic">{t('date.waitingFact')}</span>
                      </div>
                    )}
                  </>
                );
              })()}
           </div>
           
           {/* 右侧：验证结果 (Validation) */}
           <div className="glass-card p-4 flex flex-col justify-between relative">
              {(() => {
                const isMarketOpenSoon = isTradingDay(undefined, marketType) && isPreMarket;

                // 验证区逻辑 (Strict Date-Fact Alignment):
                // 1. 锚点日期：以左侧显示的“事实日期”为准
                // 如果是盘前且将要开市，左侧强制显示为空的今日事实占位态，右侧验证也应同步锚定今日
                const anchorDate = isMarketOpenSoon ? todayStr : data.price?.date;
                
                // 2. 在全集记录中寻找目标日期匹配的预测 (今日预测可能尚在 prediction 中，未进入 history 归档)
                const allPredictions = [data.prediction, data.previousPrediction, ...(data.history || [])];
                const validationPrediction = allPredictions.find(
                    p => p && p.target_date && normalizeTargetDate(p.target_date) === anchorDate
                );

                // 3. 标签日期：如果有预测用预测日，否则用事实日进行展示
                const labelDate = validationPrediction ? normalizeTargetDate(validationPrediction.target_date) : anchorDate;
                const status = validationPrediction?.validation_status;
                const validationMeta = parseValidationData(validationPrediction?.validation_data);
                const windowLabel = getValidationWindowLabel(validationMeta?.window);

                return (
                  <>
                    <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest absolute top-4 left-4">
                      {(() => {
                        const labelInfo = getValidationLabelFromData(labelDate || '', marketType);
                        return tGlobal(labelInfo.key as FullMessageKey, labelInfo.params);
                      })()}
                    </span>
                    
                    <div className="flex-1 flex flex-col items-center justify-center pt-4">
                      {!validationPrediction ? (
                        <p className="text-xs font-bold text-slate-600 italic">{t('validation.accumulation')}</p>
                      ) : (
                        <>
                           {status === 'Correct' ? (
                             <div className="flex flex-col items-center gap-2">
                               <ShieldCheck size={28} className="text-emerald-500" />
                               <span className="text-xs font-black text-emerald-500 tracking-wide">
                                 {t('validation.passedWindow', { window: windowLabel })}
                               </span>
                             </div>
                           ) : status === 'Verifying' ? (
                             <div className="flex flex-col items-center gap-2">
                               <Clock size={24} className="text-indigo-400 animate-pulse" />
                               <div className="flex flex-col items-center">
                                 <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                   {t('validation.verifyingWindow', { window: windowLabel })}
                                 </span>
                                 <span className="text-[9px] font-bold text-slate-500 italic">{t('validation.waitingFlow')}</span>
                               </div>
                             </div>
                           ) : status === 'Incorrect' ? (
                             <div className="flex flex-col items-center gap-2">
                               <div className="text-rose-500 text-2xl font-black leading-none">❌</div>
                               <span className="text-xs font-black text-rose-500 tracking-wide">{t('validation.deviated', { label: windowLabel })}</span>
                             </div>
                           ) : (
                             <div className="flex flex-col items-center gap-2">
                               <Clock size={24} className="text-slate-700" />
                               <span className="text-[10px] font-bold text-slate-500 italic">{t('validation.waiting')}</span>
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

        <div className={`flex flex-col items-center gap-1.5 pt-2 opacity-20 transition-opacity duration-300 ${data.history.length > 1 ? 'visible' : 'invisible'}`}>
          <span className="text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">{t('traceHistory')}</span>
          <ChevronDown size={14} className="animate-bounce" />
        </div>
      </div>
    </div>
  );
});
