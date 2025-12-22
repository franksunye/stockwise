'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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

  useEffect(() => {
    if (isOpen) {
      const rule = getRule(symbol);
      setSupport(rule?.support_price?.toString() || '');
      setPressure(rule?.pressure_price?.toString() || '');
    }
  }, [isOpen, symbol]);

  const handleSave = () => {
    saveRule(symbol, {
      support_price: support ? parseFloat(support) : null,
      pressure_price: pressure ? parseFloat(pressure) : null,
    });
    onSave();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
      <div className="w-full max-w-md bg-[#12121a] rounded-t-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">风控设置</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#1e1e2e] rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted">止损位 *</label>
            <input
              type="number"
              step="0.01"
              value={support}
              onChange={(e) => setSupport(e.target.value)}
              placeholder="14.50"
              className="w-full mt-1 px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg mono text-lg focus:outline-none focus:border-[#f43f5e]"
            />
          </div>
          <div>
            <label className="text-xs text-muted">压力位</label>
            <input
              type="number"
              step="0.01"
              value={pressure}
              onChange={(e) => setPressure(e.target.value)}
              placeholder="16.00"
              className="w-full mt-1 px-3 py-2 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg mono text-lg focus:outline-none focus:border-[#10b981]"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!support}
          className="w-full mt-6 py-3 bg-white text-black font-medium rounded-lg disabled:opacity-30"
        >
          保存
        </button>
      </div>
    </div>
  );
}
