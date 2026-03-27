'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, FileText, Share2 } from 'lucide-react';

interface BriefExportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAlmanac: () => void;
  onOpenReport: () => void;
}

export function BriefExportSheet({
  isOpen,
  onClose,
  onOpenAlmanac,
  onOpenReport,
}: BriefExportSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[260] flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="relative w-full max-w-md rounded-t-[28px] border border-white/10 bg-[#0c0c12] px-5 pt-3 pb-6 shadow-[0_-24px_60px_rgba(0,0,0,0.45)]"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/15" />
            <div className="mb-4 px-1">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">导出当前分析</p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-white">选择一种输出方式</h3>
            </div>

            <div className="space-y-3">
              <button
                onClick={onOpenAlmanac}
                className="w-full rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-4 text-left transition-all active:scale-[0.98] hover:border-white/10 hover:bg-white/[0.05]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/10">
                    <Calendar size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white">个股黄历</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">延续当前意境海报能力，用于轻量分享和转发。</p>
                  </div>
                </div>
              </button>

              <button
                onClick={onOpenReport}
                className="w-full rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-4 text-left transition-all active:scale-[0.98] hover:border-white/10 hover:bg-white/[0.05]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-slate-200 border border-white/5">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white">投研报告图</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">将策略内参完整排版成一页专业分析报告长图。</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-5 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              <Share2 size={12} />
              高级导出入口
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
