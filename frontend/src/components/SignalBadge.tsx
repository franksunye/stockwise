'use client';

import { DailyPrice, UserRule } from '@/lib/types';
import { AlertTriangle, TrendingUp, Minus, Settings } from 'lucide-react';

interface Props {
  price: DailyPrice;
  rule: UserRule | null;
  onOpenSettings: () => void;
}

type Signal = 'buy' | 'sell' | 'hold' | 'none';

const COLORS = { up: '#10b981', down: '#f43f5e', hold: '#f59e0b', muted: '#6b7280' };

function getSignal(price: DailyPrice, rule: UserRule | null): Signal {
  if (!rule?.support_price) return 'none';
  if (price.close < rule.support_price) return 'sell';
  if (rule.pressure_price && price.close > rule.pressure_price) return 'buy';
  return 'hold';
}

const config = {
  buy: { color: COLORS.up, icon: TrendingUp, label: '突破压力位' },
  sell: { color: COLORS.down, icon: AlertTriangle, label: '跌破止损位' },
  hold: { color: COLORS.hold, icon: Minus, label: '观望' },
  none: { color: COLORS.muted, icon: Settings, label: '未设置规则' },
};

export function SignalBadge({ price, rule, onOpenSettings }: Props) {
  const signal = getSignal(price, rule);
  const { color, icon: Icon, label } = config[signal];
  const hasRule = signal !== 'none';

  return (
    <button 
      onClick={hasRule ? undefined : onOpenSettings}
      className={`card w-full flex items-center justify-between text-left ${!hasRule ? 'cursor-pointer hover:bg-[#1a1a24]' : ''}`}
      style={{ borderColor: color }}
      disabled={hasRule}
    >
      <div>
        <p className="text-xs" style={{ color: COLORS.muted }}>信号</p>
        <p className="text-lg font-medium" style={{ color }}>{label}</p>
        {hasRule && rule?.support_price && (
          <p className="text-xs mt-1" style={{ color: COLORS.muted }}>
            止损: {rule.support_price} {rule.pressure_price && `| 压力: ${rule.pressure_price}`}
          </p>
        )}
        {!hasRule && (
          <p className="text-xs mt-1" style={{ color: COLORS.muted }}>点击设置止损位</p>
        )}
      </div>
      <Icon className="w-8 h-8" style={{ color }} />
    </button>
  );
}
