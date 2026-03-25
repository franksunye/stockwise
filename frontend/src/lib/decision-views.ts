import {
    normalizeAnySignal,
    normalizeDecisionSemantic,
    normalizeLayer1Status,
    normalizeOverlaySignal,
    type ActionDecision,
    type AnySignalState,
    type DecisionSemantic,
    type LegacySignalState,
    type SignalState,
} from '@/lib/semantic-registry';

export interface ProducerOutcomeView {
    producer_id: string;
    producer_type: 'AI';
    role_type: 'primary' | 'secondary';
    outcome_kind: 'prediction';
    signal_state: AnySignalState;
    decision_semantic: DecisionSemantic;
    confidence: number | null;
    reasoning_payload: string | null;
    run_id: string | null;
    version: string | null;
}

export interface ModeActionDecisionView {
    mode_id: string | null;
    action_decision: ActionDecision;
    action_semantic: DecisionSemantic;
    layer1_status: SignalState;
    confidence: number | null;
    reasoning_snapshot: string | null;
}

export interface ArbitrationResultView {
    arbitration_source: 'mode_overlay_v1';
    effective_signal: LegacySignalState;
    effective_layer1_status: SignalState;
    effective_decision_semantic: DecisionSemantic;
    base_signal: AnySignalState;
    base_layer1_status: SignalState;
}

function toNullableString(value: unknown): string | null {
    if (value == null) return null;
    const raw = String(value).trim();
    return raw ? raw : null;
}

function toNullableNumber(value: unknown): number | null {
    if (value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function toActionDecision(semantic: DecisionSemantic): ActionDecision {
    if (semantic === '建议看多') return 'ENTER_LONG';
    if (semantic === '建议防守') return 'DEFEND';
    if (semantic === '建议观察') return 'WATCH';
    return 'NO_SIGNAL';
}

function isPrimary(value: unknown): boolean {
    if (value === true || value === 1 || value === '1') return true;
    return false;
}

function deriveDecisionSemantic(row: Record<string, unknown>): DecisionSemantic {
    const rawDecision = toNullableString(row.decision_semantic);
    if (rawDecision) return normalizeDecisionSemantic(rawDecision);

    const layer1 = normalizeLayer1Status(row.layer1_status ?? row.layer1_signal);
    if (layer1 === 'TriggeredLong') return '建议看多';
    if (layer1 === 'RiskOff') return '建议防守';
    if (layer1 === 'Watch') return '建议观察';
    return '暂无信号';
}

export function withDecisionViews<T extends Record<string, unknown>>(
    row: T
): T & {
    producer_outcome_view: ProducerOutcomeView;
    mode_action_decision_view: ModeActionDecisionView;
    arbitration_result_view: ArbitrationResultView;
} {
    const decisionSemantic = deriveDecisionSemantic(row);
    const effectiveSignal = normalizeOverlaySignal(row.signal);
    const effectiveLayer1 = normalizeLayer1Status(row.layer1_status);
    const baseSignal = normalizeAnySignal(row.canonical_signal ?? row.signal);
    const baseLayer1 = normalizeLayer1Status(row.layer1_signal ?? row.layer1_status);

    const producerOutcomeView: ProducerOutcomeView = {
        producer_id: toNullableString(row.model) || 'unknown_producer',
        producer_type: 'AI',
        role_type: isPrimary(row.is_primary) ? 'primary' : 'secondary',
        outcome_kind: 'prediction',
        signal_state: baseSignal,
        decision_semantic: decisionSemantic,
        confidence: toNullableNumber(row.confidence),
        reasoning_payload: toNullableString(row.ai_reasoning),
        run_id: null,
        version: toNullableString(row.layer1_strategy_version),
    };

    const modeActionDecisionView: ModeActionDecisionView = {
        mode_id: toNullableString(row.mode_id),
        action_decision: toActionDecision(decisionSemantic),
        action_semantic: decisionSemantic,
        layer1_status: effectiveLayer1,
        confidence: toNullableNumber(row.confidence),
        reasoning_snapshot: toNullableString(row.reasoning_snapshot),
    };

    const arbitrationResultView: ArbitrationResultView = {
        arbitration_source: 'mode_overlay_v1',
        effective_signal: effectiveSignal,
        effective_layer1_status: effectiveLayer1,
        effective_decision_semantic: decisionSemantic,
        base_signal: baseSignal,
        base_layer1_status: baseLayer1,
    };

    return {
        ...row,
        producer_outcome_view: producerOutcomeView,
        mode_action_decision_view: modeActionDecisionView,
        arbitration_result_view: arbitrationResultView,
    };
}
