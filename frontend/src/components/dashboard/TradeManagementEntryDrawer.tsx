'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X as CloseIcon } from 'lucide-react';

interface TradeManagementEntryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  symbol: string;
  stockName?: string;
}

export function TradeManagementEntryDrawer({
  isOpen,
  onClose,
  onCreated,
  symbol,
  stockName,
}: TradeManagementEntryDrawerProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [entryDate, setEntryDate] = useState(today);
  const [entryPrice, setEntryPrice] = useState('');
  const [positionSize, setPositionSize] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setEntryDate(today);
    setEntryPrice('');
    setPositionSize('');
    setNote('');
  }, [isOpen, today]);

  const handleSubmit = async () => {
    const price = Number(entryPrice);
    const size = Number(positionSize);

    if (!entryDate) {
      setError('请选择建仓日期');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError('请输入有效的建仓价格');
      return;
    }
    if (!Number.isFinite(size) || size <= 0) {
      setError('请输入有效的持仓数量');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/user/trade-management/positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          symbol,
          entry_date: entryDate,
          entry_price: price,
          position_size: size,
          note: note.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || '建立持仓失败');
      }

      onCreated();
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '建立持仓失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[220] flex items-end justify-center">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            className="relative z-10 flex h-[72vh] w-full max-w-md flex-col overflow-hidden rounded-t-[32px] border-t border-white/10 bg-[#0a0a0f] shadow-[0_-20px_50px_rgba(0,0,0,0.45)]"
          >
            <div className="flex justify-center pb-1 pt-3 shrink-0">
              <div className="h-1 w-12 rounded-full bg-white/20" />
            </div>

            <header className="shrink-0 border-b border-white/5 bg-[#0a0a0f]/80 px-5 py-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">建立管理</p>
                  <h3 className="mt-1 text-xl font-black italic tracking-tighter text-white">{stockName || symbol}</h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <CloseIcon size={18} />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                <p className="text-xs font-bold text-slate-200">最小录入即可开始</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">先记录建仓日期、成本和数量，后续再补录更多执行事件。</p>
              </div>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300">建仓日期</span>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(event) => setEntryDate(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-indigo-400/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300">建仓价格</span>
                  <input
                    inputMode="decimal"
                    value={entryPrice}
                    onChange={(event) => setEntryPrice(event.target.value)}
                    placeholder="例如 39.25"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-indigo-400/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300">持仓数量</span>
                  <input
                    inputMode="numeric"
                    value={positionSize}
                    onChange={(event) => setPositionSize(event.target.value)}
                    placeholder="例如 1000"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-indigo-400/50"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300">备注，可选</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="例如：手工补录历史持仓"
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-indigo-400/50"
                  />
                </label>
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-white/5 px-6 py-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-300 transition-colors hover:bg-white/[0.07] hover:text-white"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 rounded-2xl bg-indigo-500 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-[0_10px_20px_rgba(99,102,241,0.25)] transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      提交中
                    </span>
                  ) : (
                    '开始管理'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
