export const CANONICAL_SIGNAL_STATES = ['TriggeredLong', 'Watch', 'NoSetup', 'RiskOff'] as const;
export const LEGACY_SIGNAL_STATES = ['Long', 'Short', 'Side'] as const;
export const ALL_SIGNAL_STATES = [...CANONICAL_SIGNAL_STATES, ...LEGACY_SIGNAL_STATES] as const;

export type SignalState = typeof CANONICAL_SIGNAL_STATES[number];
export type LegacySignalState = typeof LEGACY_SIGNAL_STATES[number];
export type AnySignalState = typeof ALL_SIGNAL_STATES[number];

export const CANONICAL_DECISION_SEMANTICS = ['建议看多', '建议观察', '建议防守', '暂无信号'] as const;
export type DecisionSemantic = typeof CANONICAL_DECISION_SEMANTICS[number];

export const ACTION_DECISIONS = ['ENTER_LONG', 'WATCH', 'DEFEND', 'NO_SIGNAL'] as const;
export const ACTION_SEMANTICS = CANONICAL_DECISION_SEMANTICS;

export const DECISION_SEMANTIC_ALIASES = {
    建议进场: '建议看多',
    进场: '建议看多',
    空仓: '暂无信号',
    建议空仓: '暂无信号',
    防守: '建议防守',
    观察: '建议观察',
} as const satisfies Record<string, DecisionSemantic>;

export const DECISION_ALIAS_LONG = ['建议看多', '建议进场', '进场'] as const;
export const DECISION_ALIAS_WATCH = ['建议观察', '观察'] as const;
export const DECISION_ALIAS_DEFENSE = ['建议防守', '防守'] as const;
export const DECISION_ALIAS_NO_SIGNAL = ['暂无信号', '建议空仓', '空仓'] as const;

export function normalizeDecisionSemantic(value: unknown, fallback: DecisionSemantic = '暂无信号'): DecisionSemantic | string {
    const raw = String(value ?? '').trim();
    if (!raw) return fallback;
    if ((CANONICAL_DECISION_SEMANTICS as readonly string[]).includes(raw)) return raw as DecisionSemantic;
    return DECISION_SEMANTIC_ALIASES[raw as keyof typeof DECISION_SEMANTIC_ALIASES] ?? raw;
}
