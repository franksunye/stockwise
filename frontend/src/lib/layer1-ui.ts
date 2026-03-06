import type { AIPrediction } from '@/lib/types';

import { COLORS } from '@/components/dashboard/constants';

type PredictionLike = Pick<AIPrediction, 'signal' | 'layer1_status'> | null | undefined;

export interface PredictionActionMeta {
  headline: string;
  badge: string;
  posterDecision: string;
  color: string;
  dotClass: string;
  iconTone: 'up' | 'down' | 'flat';
  bgClass: string;
  textClass: string;
}

const LAYER1_META: Record<NonNullable<AIPrediction['layer1_status']>, PredictionActionMeta> = {
  TriggeredLong: {
    headline: '建议进场',
    badge: 'Layer-1 · 进场窗口',
    posterDecision: '建议进场',
    color: COLORS.up,
    dotClass: 'bg-rose-500',
    iconTone: 'up',
    bgClass: 'bg-rose-500/10 border-rose-500/20',
    textClass: 'text-rose-500',
  },
  Watch: {
    headline: '建议观察',
    badge: 'Layer-1 · 继续观察',
    posterDecision: '建议观察',
    color: COLORS.hold,
    dotClass: 'bg-amber-500',
    iconTone: 'flat',
    bgClass: 'bg-amber-500/10 border-amber-500/20',
    textClass: 'text-amber-500',
  },
  RiskOff: {
    headline: '建议防守',
    badge: 'Layer-1 · 风险收缩',
    posterDecision: '建议防守',
    color: COLORS.down,
    dotClass: 'bg-emerald-500',
    iconTone: 'down',
    bgClass: 'bg-emerald-500/10 border-emerald-500/20',
    textClass: 'text-emerald-500',
  },
  NoSetup: {
    headline: '建议空仓',
    badge: 'Layer-1 · 暂无结构',
    posterDecision: '建议空仓',
    color: COLORS.muted,
    dotClass: 'bg-slate-500',
    iconTone: 'flat',
    bgClass: 'bg-slate-500/10 border-slate-500/20',
    textClass: 'text-slate-400',
  },
};

const SIGNAL_META: Record<string, PredictionActionMeta> = {
  Long: {
    headline: '建议做多',
    badge: 'AI · 做多',
    posterDecision: '看多',
    color: COLORS.up,
    dotClass: 'bg-rose-500',
    iconTone: 'up',
    bgClass: 'bg-rose-500/10 border-rose-500/20',
    textClass: 'text-rose-500',
  },
  Short: {
    headline: '建议避险',
    badge: 'AI · 避险',
    posterDecision: '避险',
    color: COLORS.down,
    dotClass: 'bg-emerald-500',
    iconTone: 'down',
    bgClass: 'bg-emerald-500/10 border-emerald-500/20',
    textClass: 'text-emerald-500',
  },
  Side: {
    headline: '建议观望',
    badge: 'AI · 观望',
    posterDecision: '观望',
    color: COLORS.hold,
    dotClass: 'bg-amber-500',
    iconTone: 'flat',
    bgClass: 'bg-amber-500/10 border-amber-500/20',
    textClass: 'text-amber-500',
  },
};

const FALLBACK_META: PredictionActionMeta = {
  headline: '等待分析',
  badge: 'AI · 等待分析',
  posterDecision: '等待分析',
  color: '#94a3b8',
  dotClass: 'bg-slate-500',
  iconTone: 'flat',
  bgClass: 'bg-slate-500/10 border-slate-500/20',
  textClass: 'text-slate-400',
};

export function getPredictionActionMeta(prediction: PredictionLike): PredictionActionMeta {
  const layer1Status = prediction?.layer1_status;
  if (layer1Status && layer1Status in LAYER1_META) {
    return LAYER1_META[layer1Status];
  }

  const signal = prediction?.signal;
  if (signal && signal in SIGNAL_META) {
    return SIGNAL_META[signal];
  }

  return FALLBACK_META;
}
