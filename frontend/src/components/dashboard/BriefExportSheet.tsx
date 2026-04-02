'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, FileText } from 'lucide-react';

interface BriefExportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAlmanac: () => void;
  onOpenReport: () => void;
  showAlmanac?: boolean;
}

export function BriefExportSheet({
  isOpen,
  onClose,
  onOpenAlmanac,
  onOpenReport,
  showAlmanac = true,
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
            className="relative w-full max-w-md rounded-t-[28px] border border-white/10 bg-[#0c0c12] px-6 pt-3 pb-7 shadow-[0_-24px_60px_rgba(0,0,0,0.45)]"
          >
            <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-white/15" />

            <div className="flex items-start justify-center gap-8">
              {showAlmanac && (
                <button
                  onClick={onOpenAlmanac}
                  className="group flex w-[104px] flex-col items-center text-center transition-transform active:scale-[0.96]"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-indigo-500/10 bg-indigo-500/10 text-indigo-300 transition-colors group-hover:bg-indigo-500/14 group-hover:text-indigo-200">
                    <Calendar size={26} />
                  </div>
                  <span className="mt-3 text-[12px] font-bold tracking-[0.02em] text-slate-400 transition-colors group-hover:text-white">
                    个股黄历
                  </span>
                </button>
              )}

              <button
                onClick={onOpenReport}
                className="group flex w-[104px] flex-col items-center text-center transition-transform active:scale-[0.96]"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/5 bg-white/[0.04] text-slate-200 transition-colors group-hover:bg-white/[0.07] group-hover:text-white">
                  <FileText size={26} />
                </div>
                <span className="mt-3 text-[12px] font-bold tracking-[0.02em] text-slate-400 transition-colors group-hover:text-white">
                  投研报告
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
