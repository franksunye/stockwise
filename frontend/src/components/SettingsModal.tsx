'use client';

import { useState, useEffect } from 'react';
import { X, User, Briefcase, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRule, saveRule } from '@/lib/storage';

interface Props {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

/**
 * 简化后的设置面板
 * 仅保留持仓状态切换，止损/压力位由 AI 自动计算
 */
export function SettingsModal({ symbol, isOpen, onClose, onSave }: Props) {
  const [position, setPosition] = useState<'holding' | 'empty' | 'none'>('none');

  useEffect(() => {
    if (isOpen) {
      const rule = getRule(symbol);
      setPosition(rule?.position || 'none');
    }
  }, [isOpen, symbol]);

  const handleSave = () => {
    saveRule(symbol, {
      support_price: null,  // 由 AI 决定
      pressure_price: null, // 由 AI 决定
      position,
    });
    onSave();
    onClose();
  };

  const positionOptions = [
    { 
      id: 'holding', 
      label: '已持仓', 
      icon: Briefcase,
      description: 'AI 将提供止损和减仓建议',
      color: 'emerald'
    },
    { 
      id: 'empty', 
      label: '未建仓', 
      icon: Eye,
      description: 'AI 将提供入场和试错建议',
      color: 'blue'
    },
    { 
      id: 'none', 
      label: '观望中', 
      icon: User,
      description: 'AI 将提供通用决策参考',
      color: 'slate'
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm pointer-events-auto overflow-hidden">
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 150) onClose();
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full max-w-md bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden pointer-events-auto"
          >
            {/* 顶部视觉拉手 */}
            <div className="w-full flex justify-center pt-3 pb-1">
               <div className="w-12 h-1 rounded-full bg-white/20" />
            </div>

            <div className="p-8 pt-4 flex flex-col">
              <header className="flex items-center justify-between mb-8">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">个人化配置</span>
                  <h2 className="text-xl font-black italic tracking-tighter text-white">持仓状态 <span className="text-indigo-500">STATUS</span></h2>
                </div>
                <button onClick={onClose} className="p-2.5 rounded-full bg-white/5 border border-white/10 active:scale-90 transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </header>

              <div className="space-y-3">
                <p className="text-xs text-slate-500 mb-4">
                  选择你当前的持仓状态，AI 将据此提供更精准的操作建议
                </p>
                
                {positionOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = position === opt.id;
                  const colorMap: Record<string, string> = {
                    emerald: 'border-emerald-500/30 bg-emerald-500/10',
                    blue: 'border-blue-500/30 bg-blue-500/10',
                    slate: 'border-slate-500/30 bg-slate-500/10'
                  };
                  const iconColorMap: Record<string, string> = {
                    emerald: 'text-emerald-400',
                    blue: 'text-blue-400',
                    slate: 'text-slate-400'
                  };
                  
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setPosition(opt.id as 'holding' | 'empty' | 'none')}
                      className={`w-full p-4 rounded-2xl border transition-all flex items-center gap-4 text-left ${
                        isSelected 
                          ? `${colorMap[opt.color]} border-2` 
                          : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSelected ? colorMap[opt.color] : 'bg-white/5'}`}>
                        <Icon className={`w-5 h-5 ${isSelected ? iconColorMap[opt.color] : 'text-slate-500'}`} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {opt.label}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {opt.description}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-4 rounded-2xl font-black italic text-sm text-slate-500 border border-white/5 hover:bg-white/5 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black italic text-sm text-white shadow-[0_10px_20px_rgba(79,70,229,0.3)] active:scale-95 transition-all"
                >
                  保存设置
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
