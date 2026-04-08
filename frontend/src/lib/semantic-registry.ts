export const CANONICAL_SIGNAL_STATES = ['TriggeredLong', 'Watch', 'NoSetup', 'RiskOff'] as const;
export const LEGACY_SIGNAL_STATES = ['Long', 'Short', 'Side'] as const;
export const ALL_SIGNAL_STATES = [...CANONICAL_SIGNAL_STATES, ...LEGACY_SIGNAL_STATES] as const;

export type SignalState = typeof CANONICAL_SIGNAL_STATES[number];
export type LegacySignalState = typeof LEGACY_SIGNAL_STATES[number];
export type AnySignalState = typeof ALL_SIGNAL_STATES[number];

export const CANONICAL_DECISION_SEMANTICS = ['建议看多', '建议观察', '建议防守', '暂无信号'] as const;
export type DecisionSemantic = typeof CANONICAL_DECISION_SEMANTICS[number];

/**
 * Mapping between Backend Logic Tags and i18n Keys (dashboard.signal.*)
 */
export const SIGNAL_I18N_MAP = {
    '建议看多': 'triggeredLong',
    '建议观察': 'watching',
    '建议防守': 'riskOff',
    '暂无信号': 'noSignal',
    'triggeredLong': 'triggeredLong', // Support for direct canonical state
    'watching': 'watching',
    'riskOff': 'riskOff',
    'noSignal': 'noSignal',
    'Watch': 'watching',
    'RiskOff': 'riskOff',
    'TriggeredLong': 'triggeredLong',
    'NoSetup': 'noSignal',
    // Council specific mappings
    'enter': 'triggeredLong',
    'observe': 'watching',
    'defense': 'riskOff',
    'empty': 'noSignal',
    'mixed': 'mixed',
} as const;

export const ACTION_DECISIONS = ['ENTER_LONG', 'WATCH', 'DEFEND', 'NO_SIGNAL'] as const;
export const ACTION_SEMANTICS = CANONICAL_DECISION_SEMANTICS;
export type ActionDecision = typeof ACTION_DECISIONS[number];

export const DECISION_SEMANTIC_ALIASES = {
    建议进场: '建议看多',
    进场: '建议看多',
    Long: '建议看多',
    TriggeredLong: '建议看多',
    空仓: '暂无信号',
    建议空仓: '暂无信号',
    Side: '暂无信号',
    NoSetup: '暂无信号',
    防守: '建议防守',
    Short: '建议防守',
    RiskOff: '建议防守',
    观察: '建议观察',
    Watch: '建议观察',
} as const satisfies Record<string, DecisionSemantic>;

export const DECISION_ALIAS_LONG = ['建议看多', '建议进场', '进场'] as const;
export const DECISION_ALIAS_WATCH = ['建议观察', '观察'] as const;
export const DECISION_ALIAS_DEFENSE = ['建议防守', '防守'] as const;
export const DECISION_ALIAS_NO_SIGNAL = ['暂无信号', '建议空仓', '空仓'] as const;

const LEGACY_SIGNAL_SET = new Set<string>(LEGACY_SIGNAL_STATES);
const CANONICAL_SIGNAL_SET = new Set<string>(CANONICAL_SIGNAL_STATES);

export function normalizeDecisionSemantic(value: unknown, fallback: DecisionSemantic = '暂无信号'): DecisionSemantic {
    const raw = String(value ?? '').trim();
    if (!raw) return fallback;
    if ((CANONICAL_DECISION_SEMANTICS as readonly string[]).includes(raw)) return raw as DecisionSemantic;
    return DECISION_SEMANTIC_ALIASES[raw as keyof typeof DECISION_SEMANTIC_ALIASES] ?? fallback;
}

export function normalizeLayer1Status(value: unknown, fallback: SignalState = 'NoSetup'): SignalState {
    const raw = String(value ?? '').trim();
    if (CANONICAL_SIGNAL_SET.has(raw)) return raw as SignalState;
    return fallback;
}

export function normalizeOverlaySignal(value: unknown, fallback: LegacySignalState = 'Side'): LegacySignalState {
    const raw = String(value ?? '').trim();
    if (LEGACY_SIGNAL_SET.has(raw)) return raw as LegacySignalState;
    if (raw === 'TriggeredLong') return 'Long';
    if (raw === 'RiskOff') return 'Short';
    if (raw === 'Watch' || raw === 'NoSetup') return 'Side';
    return fallback;
}

export function normalizeAnySignal(value: unknown, fallback: AnySignalState = 'Side'): AnySignalState {
    const raw = String(value ?? '').trim();
    if (CANONICAL_SIGNAL_SET.has(raw)) return raw as SignalState;
    if (LEGACY_SIGNAL_SET.has(raw)) return raw as LegacySignalState;
    if (!raw) return fallback;
    const legacyFallback: LegacySignalState =
        fallback === 'TriggeredLong' ? 'Long' :
            fallback === 'RiskOff' ? 'Short' :
                'Side';
    return normalizeOverlaySignal(raw, legacyFallback);
}
/**
 * Safely resolve a database/backend value to an i18n key for the signal label.
 */
export function getSignalI18nKey(value: unknown): string {
    const normalized = normalizeDecisionSemantic(value);
    const key = SIGNAL_I18N_MAP[normalized as keyof typeof SIGNAL_I18N_MAP] ||
                SIGNAL_I18N_MAP[value as keyof typeof SIGNAL_I18N_MAP];
    return key || 'noSignal';
}

/**
 * Get i18n key for the signal's badge/description.
 */
export function getSignalBadgeI18nKey(value: unknown): string {
    const key = getSignalI18nKey(value);
    return key; // Same key used in "badge" namespace
}
