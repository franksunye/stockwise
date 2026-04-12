import type { AIPrediction } from '@/lib/types';

import { COLORS } from '@/components/dashboard/constants';

type PredictionLike = Pick<AIPrediction, 'signal' | 'layer1_status'> | null | undefined;
interface PredictionMetaOptions {
  // Product contract:
  // - v1 tiers (free/go/plus) must render from `signal` only.
  // - v2+ tiers (pro/alpha) may render from `layer1_status` first.
  useLayer1Status?: boolean;
}

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
    headline: 'triggeredLong',
    badge: 'triggeredLong',
    posterDecision: 'triggeredLong',
    color: COLORS.up,
    dotClass: 'bg-rose-500',
    iconTone: 'up',
    bgClass: 'bg-rose-500/10 border-rose-500/20',
    textClass: 'text-rose-500',
  },
  Watch: {
    headline: 'watching',
    badge: 'watching',
    posterDecision: 'watching',
    color: COLORS.hold,
    dotClass: 'bg-amber-500',
    iconTone: 'flat',
    bgClass: 'bg-amber-500/10 border-amber-500/20',
    textClass: 'text-amber-500',
  },
  RiskOff: {
    headline: 'riskOff',
    badge: 'riskOff',
    posterDecision: 'riskOff',
    color: COLORS.down,
    dotClass: 'bg-emerald-500',
    iconTone: 'down',
    bgClass: 'bg-emerald-500/10 border-emerald-500/20',
    textClass: 'text-emerald-500',
  },
  NoSetup: {
    headline: 'noSignal',
    badge: 'noSignal',
    posterDecision: 'noSignal',
    color: COLORS.muted,
    dotClass: 'bg-slate-500',
    iconTone: 'flat',
    bgClass: 'bg-slate-500/10 border-slate-500/20',
    textClass: 'text-slate-400',
  },
};

const SIGNAL_META: Record<string, PredictionActionMeta> = {
  Long: {
    headline: 'triggeredLong',
    badge: 'triggeredLong',
    posterDecision: 'triggeredLong',
    color: COLORS.up,
    dotClass: 'bg-rose-500',
    iconTone: 'up',
    bgClass: 'bg-rose-500/10 border-rose-500/20',
    textClass: 'text-rose-500',
  },
  Short: {
    headline: 'riskOff',
    badge: 'riskOff',
    posterDecision: 'riskOff',
    color: COLORS.down,
    dotClass: 'bg-emerald-500',
    iconTone: 'down',
    bgClass: 'bg-emerald-500/10 border-emerald-500/20',
    textClass: 'text-emerald-500',
  },
  Side: {
    headline: 'watching',
    badge: 'watching',
    posterDecision: 'watching',
    color: COLORS.hold,
    dotClass: 'bg-amber-500',
    iconTone: 'flat',
    bgClass: 'bg-amber-500/10 border-amber-500/20',
    textClass: 'text-amber-500',
  },
  TriggeredLong: {
    headline: 'triggeredLong',
    badge: 'triggeredLong',
    posterDecision: 'triggeredLong',
    color: COLORS.up,
    dotClass: 'bg-rose-500',
    iconTone: 'up',
    bgClass: 'bg-rose-500/10 border-rose-500/20',
    textClass: 'text-rose-500',
  },
  Watch: {
    headline: 'watching',
    badge: 'watching',
    posterDecision: 'watching',
    color: COLORS.hold,
    dotClass: 'bg-amber-500',
    iconTone: 'flat',
    bgClass: 'bg-amber-500/10 border-amber-500/20',
    textClass: 'text-amber-500',
  },
  RiskOff: {
    headline: 'riskOff',
    badge: 'riskOff',
    posterDecision: 'riskOff',
    color: COLORS.down,
    dotClass: 'bg-emerald-500',
    iconTone: 'down',
    bgClass: 'bg-emerald-500/10 border-emerald-500/20',
    textClass: 'text-emerald-500',
  },
  NoSetup: {
    headline: 'noSignal',
    badge: 'noSignal',
    posterDecision: 'noSignal',
    color: COLORS.muted,
    dotClass: 'bg-slate-500',
    iconTone: 'flat',
    bgClass: 'bg-slate-500/10 border-slate-500/20',
    textClass: 'text-slate-400',
  },
};

const FALLBACK_META: PredictionActionMeta = {
  headline: 'pending',
  badge: 'pending',
  posterDecision: 'pending',
  color: '#94a3b8',
  dotClass: 'bg-slate-500',
  iconTone: 'flat',
  bgClass: 'bg-slate-500/10 border-slate-500/20',
  textClass: 'text-slate-400',
};

export function getPredictionActionMeta(
  prediction: PredictionLike,
  options?: PredictionMetaOptions,
): PredictionActionMeta {
  // Keep default true for backward compatibility at call sites.
  // New/updated UI surfaces should pass explicit tier-gated options.
  const useLayer1Status = options?.useLayer1Status ?? true;
  const layer1Status = prediction?.layer1_status;
  if (useLayer1Status && layer1Status && layer1Status in LAYER1_META) {
    return LAYER1_META[layer1Status];
  }

  const signal = prediction?.signal;
  if (signal && signal in SIGNAL_META) {
    return SIGNAL_META[signal];
  }

  return FALLBACK_META;
}
