'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, BriefcaseBusiness, Loader2, RefreshCw, ChevronDown, List } from 'lucide-react';

import { TradeManagementEntryDrawer } from './TradeManagementEntryDrawer';
import { TradeManagementEventDrawer } from './TradeManagementEventDrawer';
import { useTradeManagementSurface } from '@/hooks/useTradeManagementSurface';
import {
  formatPrice,
  formatQuantity,
  formatTradeDateLabel,
  formatTradeDateTimeLabel,
  getManagementActionLabel,
  getManagementCardSections,
  getManagementDetailLines,
  getManagementFactLines,
  getManagementPolicyLabel,
  getManagementStateLabel,
  getTradeEventLabel,
} from '@/lib/trade-management-surface';

interface TradeManagementTabProps {
  isActive: boolean;
  isOpen: boolean;
  symbol: string;
  stockName?: string;
}

export function TradeManagementTab({
  isActive,
  isOpen,
  symbol,
  stockName,
}: TradeManagementTabProps) {
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [isEventOpen, setIsEventOpen] = useState(false);
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const { payload, error, isLoading, isValidating, mutate: mutateSurface } = useTradeManagementSurface({
    symbol,
    enabled: isOpen && isActive,
  });

  const position = payload?.position || null;
  const advice = payload?.advice || null;
  const recentEvents = payload?.recent_events || [];
  const stateLabel = useMemo(() => getManagementStateLabel(advice), [advice]);
  const actionLabel = useMemo(() => getManagementActionLabel(advice), [advice]);
  const detailLines = useMemo(() => getManagementDetailLines(advice), [advice]);
  const factLines = useMemo(() => getManagementFactLines(advice), [advice]);
  const detailSections = useMemo(() => getManagementCardSections(advice), [advice]);
  const hasManagementContent = !!position;
  const isInitialLoading = isLoading && !payload;

  const handleRefresh = async () => {
    await mutateSurface();
  };

  const handleCreated = async () => {
    await mutateSurface();
  };

  const cardBaseClass = 'rounded-2xl border border-white/5 bg-white/[0.02]';
  const metricCardClass = 'rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3';
  const sectionLabelClass = 'text-[11px] font-bold text-slate-500 uppercase tracking-wider';
  const sectionTitleClass = 'flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500';

  const renderSectionHeading = (title: string) => (
    <div>
      <p className={sectionTitleClass}>
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400/80" />
        {title}
      </p>
    </div>
  );

  if (isInitialLoading) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center space-y-3 pb-8 pt-10">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">正在调取持仓管理...</p>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-200">
          <AlertTriangle size={18} />
        </div>
        <p className="text-sm font-bold text-rose-100">管理信息暂时不可用</p>
        <p className="mt-1 text-xs leading-relaxed text-rose-200/80">当前不影响择时阅读，你稍后再试即可。</p>
        <button
          type="button"
          onClick={handleRefresh}
          className="mt-4 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-white/[0.08]"
        >
          重试
        </button>
      </div>
    );
  }

  if (!hasManagementContent) {
    return (
      <>
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{symbol}</p>
              <h3 className="text-xl font-black tracking-tight text-white">{stockName || symbol}</h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">交易管理状态</p>
              <h3 className="text-xl font-black tracking-tight text-slate-300">待建立</h3>
            </div>
          </div>

          <div className="mt-2 rounded-2xl border border-white/5 bg-white/[0.01] py-10 px-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.03] text-slate-500">
              <BriefcaseBusiness size={18} strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-black tracking-tight text-slate-300">尚无管理记录</h3>
            <p className="mx-auto mt-2 max-w-[240px] text-xs leading-relaxed text-slate-500">
              录入实盘成本与仓位信息，系统将为你定制专属的移动止盈与止损策略。
            </p>

            <button
              type="button"
              onClick={() => setIsEntryOpen(true)}
              className="mt-6 rounded-full border border-white/10 bg-white/[0.03] px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white active:scale-95"
            >
              录入持仓
            </button>
          </div>
        </div>

        <TradeManagementEntryDrawer
          isOpen={isEntryOpen}
          onClose={() => setIsEntryOpen(false)}
          onCreated={handleCreated}
          symbol={symbol}
          stockName={stockName}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{symbol}</p>
            <h3 className="text-xl font-black tracking-tight text-white">{stockName || position?.stock_name || symbol}</h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">交易管理状态</p>
            <h3 className="text-xl font-black tracking-tight text-emerald-300">{stateLabel}</h3>
          </div>
        </div>

        <section className="mt-6">
          <div className="mb-4">
            {renderSectionHeading('交易管理建议')}
          </div>
          
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/15 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
            <h3 className="text-xl font-black text-white tracking-tight">{actionLabel}</h3>
            <p className="mt-2.5 text-sm leading-relaxed font-medium text-slate-300">
              {getManagementPolicyLabel(advice)}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <p className={sectionLabelClass}>下次观察</p>
              <p className="mt-1.5 truncate text-[15px] font-black tracking-tight text-slate-300">{formatTradeDateLabel(advice?.next_trade_date)}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
              <p className={sectionLabelClass}>更新时间</p>
              <p className="mt-1.5 truncate text-[15px] font-black tracking-tight text-slate-300">{formatTradeDateTimeLabel(advice?.updated_at)}</p>
            </div>
          </div>

          {factLines.length > 0 ? (
            <div className="mt-4 space-y-2 rounded-xl border border-white/5 bg-black/30 px-4 py-4">
              {factLines.slice(0, 3).map((line) => (
                <p key={line} className="flex items-start gap-2 text-sm leading-relaxed text-slate-400">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500/40" />
                  <span>{line}</span>
                </p>
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-start justify-between gap-3">
            {renderSectionHeading('仓位结构')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={`${metricCardClass} min-w-0`}>
              <p className={sectionLabelClass}>剩余仓位</p>
              <div className="mt-1.5 flex items-baseline gap-1 overflow-hidden">
                <p className="truncate text-[17px] font-black text-white">{formatQuantity(position?.remaining_size)}</p>
                <p className="truncate text-xs font-bold text-slate-500">/ {formatQuantity(position?.position_size)}</p>
              </div>
            </div>
            <div className={`${metricCardClass} min-w-0`}>
              <p className={sectionLabelClass}>成本价</p>
              <p className="mt-1.5 truncate text-[17px] font-black text-white">{formatPrice(position?.entry_price)}</p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            {renderSectionHeading('执行闭环')}
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded-full border border-white/10 bg-white/[0.05] p-2 text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white"
              aria-label="刷新管理建议"
            >
              <RefreshCw size={14} className={isValidating ? 'animate-spin' : ''} />
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setIsDetailExpanded(!isDetailExpanded)}
              className="group flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-2">
                <List size={14} className="text-slate-500" />
                <span className="text-xs font-bold text-slate-300">详细推演依据</span>
              </div>
              <motion.div
                animate={{ rotate: isDetailExpanded ? 180 : 0 }}
                className="text-slate-500 transition-colors group-hover:text-slate-400"
              >
                <ChevronDown size={14} />
              </motion.div>
            </button>

            <AnimatePresence initial={false}>
              {isDetailExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3">
                    {detailSections.length > 0 ? (
                      detailSections.map((section, index) => (
                        <div
                          key={section.title}
                          className={`rounded-xl border px-4 py-3 ${
                            index === 0
                              ? 'border-indigo-500/20 bg-indigo-500/5'
                              : 'border-white/5 bg-white/[0.02]'
                          }`}
                        >
                          <p className={sectionTitleClass}>
                            <span className={`h-1.5 w-1.5 rounded-full ${index === 0 ? 'bg-indigo-400/90' : 'bg-slate-500'}`} />
                            {section.title}
                          </p>
                          <div className="mt-2 space-y-2">
                            {section.lines.slice(0, 2).map((line) => (
                              <p key={line} className="flex items-start gap-2 text-sm leading-relaxed text-slate-300">
                                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                                <span>{line}</span>
                              </p>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                        <p className={sectionTitleClass}>
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400/80" />
                          管理依据
                        </p>
                        <div className="mt-2 space-y-2">
                          {detailLines.length > 0 ? (
                            detailLines.slice(0, 3).map((line) => (
                              <p key={line} className="flex items-start gap-2 text-sm leading-relaxed text-slate-300">
                                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
                                <span>{line}</span>
                              </p>
                            ))
                          ) : (
                            <p className="text-sm leading-relaxed text-slate-400">
                              当前先开放摘要层，完整管理历史会在后续阶段继续补齐。
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                        <p className={sectionLabelClass}>当前建议日</p>
                        <p className="mt-1.5 text-base font-black text-slate-200">{formatTradeDateLabel(advice?.latest_trade_date)}</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                        <p className={sectionLabelClass}>最近事件</p>
                        <p className="mt-1.5 text-base font-black text-slate-200">
                          {recentEvents[0]?.event_type
                            ? getTradeEventLabel(recentEvents[0].event_type)
                            : position?.latest_event_type
                              ? getTradeEventLabel(position.latest_event_type)
                              : '暂无'}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                      <p className={sectionTitleClass}>
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400/80" />
                        近期执行
                      </p>
                      <div className="mt-2 space-y-2">
                        {recentEvents.length > 0 ? (
                          recentEvents.slice(0, 3).map((event) => (
                            <div key={event.event_id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-200">
                                  {getTradeEventLabel(event.event_type)} · {formatQuantity(event.quantity)}
                                </p>
                                <p className="mt-0.5 text-xs text-slate-500">
                                  {formatTradeDateLabel(event.event_date)}
                                  {event.price != null ? ` · ${formatPrice(event.price)}` : ''}
                                </p>
                              </div>
                              {event.note ? (
                                <span className="max-w-[120px] truncate text-[11px] text-slate-500">{event.note}</span>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm leading-relaxed text-slate-400">还没有记录执行动作。完成后可以点底部按钮留痕。</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => setIsEventOpen(true)}
            className="mt-4 w-full flex items-center justify-center rounded-2xl bg-indigo-500 px-5 py-3.5 text-[13px] font-black uppercase tracking-widest text-white shadow-[0_8px_20px_rgba(99,102,241,0.25)] transition-all active:scale-95 hover:bg-indigo-400"
          >
            完成并记录执行结果
          </button>
        </section>
      </div>

      <TradeManagementEntryDrawer
        isOpen={isEntryOpen}
        onClose={() => setIsEntryOpen(false)}
        onCreated={handleCreated}
        symbol={symbol}
        stockName={stockName}
      />
      {position ? (
        <TradeManagementEventDrawer
          isOpen={isEventOpen}
          onClose={() => setIsEventOpen(false)}
          onCreated={handleCreated}
          positionId={position.position_id}
          symbol={symbol}
          stockName={stockName}
          actionSummary={advice?.action_summary}
        />
      ) : null}
    </>
  );
}
