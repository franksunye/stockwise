'use client';

import { useState, useEffect } from 'react';
import { X, Shield, TrendingUp } from 'lucide-react';
import { getRule, saveRule } from '@/lib/storage';

interface Props {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function SettingsModal({ symbol, isOpen, onClose, onSave }: Props) {
  const [support, setSupport] = useState('');
  const [pressure, setPressure] = useState('');
  const [position, setPosition] = useState<'holding' | 'empty' | 'none'>('none');

  useEffect(() => {
    if (isOpen) {
      const rule = getRule(symbol);
      setSupport(rule?.support_price?.toString() || '');
      setPressure(rule?.pressure_price?.toString() || '');
      setPosition(rule?.position || 'none');
    }
  }, [isOpen, symbol]);

  const handleSave = () => {
    saveRule(symbol, {
      support_price: support ? parseFloat(support) : null,
      pressure_price: pressure ? parseFloat(pressure) : null,
      position,
    });
    onSave();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-[#0a0a0f] border-t border-white/10 rounded-t-[32px] p-8 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-10 duration-500">
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">锚点参数配置</span>
            <h2 className="text-xl font-black italic tracking-tighter text-white">风控中心 <span className="text-indigo-500">CORE</span></h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">当前持仓状态 (影响智能建议文案)</label>
            <div className="grid grid-cols-3 gap-2 p-1.5 bg-white/5 rounded-2xl">
              {[
                { id: 'holding', label: '已持仓' },
                { id: 'empty', label: '未建仓' },
                { id: 'none', label: '通用/不指定' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setPosition(opt.id as any)}
                  className={`py-2 rounded-xl text-[10px] font-bold transition-all ${
                    position === opt.id 
                      ? 'bg-indigo-600 text-white shadow-lg' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-3 h-3 text-rose-500" />
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">关键止损位 (必填)</label>
            </div>
            <input
              type="number"
              step="0.01"
              value={support}
              onChange={(e) => setSupport(e.target.value)}
              placeholder="14.50"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 mono text-xl focus:outline-none focus:border-rose-500/50 transition-all"
            />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">目标压力位</label>
            </div>
            <input
              type="number"
              step="0.01"
              value={pressure}
              onChange={(e) => setPressure(e.target.value)}
              placeholder="16.00"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 mono text-xl focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
        </div>

        <div className="mt-10 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl font-black italic text-sm text-slate-500 border border-white/5 hover:bg-white/5 transition-all"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black italic text-sm text-white shadow-[0_10px_20px_rgba(79,70,229,0.3)] transition-all active:scale-95 transition-all"
          >
            同步参数
          </button>
        </div>
      </div>
    </div>
  );
}
