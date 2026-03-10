export const NOISE_THRESHOLD_PERCENT = 1.0;

export const EFFECTIVE_SIGNAL_SQL = `
    CASE
        WHEN dlog.decision_semantic = '建议进场' OR dlog.decision_semantic = '进场' THEN 'Long'
        WHEN dlog.decision_semantic = '建议防守' OR dlog.decision_semantic = '防守' THEN 'Short'
        WHEN dlog.decision_semantic IN ('建议观察', '观察', '暂无信号', '建议空仓', '空仓') THEN 'Side'
        ELSE p.signal
    END
`;

export const EFFECTIVE_LAYER1_STATUS_SQL = `
    CASE
        WHEN dlog.decision_semantic = '建议进场' OR dlog.decision_semantic = '进场' THEN 'TriggeredLong'
        WHEN dlog.decision_semantic = '建议防守' OR dlog.decision_semantic = '防守' THEN 'RiskOff'
        WHEN dlog.decision_semantic IN ('暂无信号', '建议空仓', '空仓') THEN 'NoSetup'
        WHEN dlog.decision_semantic = '建议观察' OR dlog.decision_semantic = '观察' THEN 'Watch'
        ELSE p.layer1_status
    END
`;

export const EFFECTIVE_DECISION_SEMANTIC_SQL = `
    CASE
        WHEN dlog.decision_semantic IN ('建议空仓', '空仓') THEN '暂无信号'
        WHEN dlog.decision_semantic = '防守' THEN '建议防守'
        WHEN dlog.decision_semantic = '观察' THEN '建议观察'
        WHEN dlog.decision_semantic = '进场' THEN '建议进场'
        ELSE dlog.decision_semantic
    END
`;

export const EFFECTIVE_VALIDATION_STATUS_SQL = `
    CASE
        WHEN p.actual_change IS NULL THEN p.validation_status
        WHEN p.validation_status IN ('Pending', 'Verifying') THEN p.validation_status
        WHEN ${EFFECTIVE_SIGNAL_SQL} = 'Long'
            THEN CASE WHEN p.actual_change > 0 THEN 'Correct' ELSE 'Incorrect' END
        WHEN ${EFFECTIVE_SIGNAL_SQL} = 'Short'
            THEN CASE WHEN p.actual_change < 0 THEN 'Correct' ELSE 'Incorrect' END
        WHEN ${EFFECTIVE_SIGNAL_SQL} = 'Side'
            THEN CASE WHEN ABS(p.actual_change) <= ${NOISE_THRESHOLD_PERCENT} THEN 'Correct' ELSE 'Incorrect' END
        ELSE p.validation_status
    END
`;

export function deriveValidationStatus(
    signal: string | null | undefined,
    actualChange: number | null | undefined,
    currentStatus: string | null | undefined
): string | null | undefined {
    if (actualChange == null) return currentStatus;
    if (currentStatus === 'Pending' || currentStatus === 'Verifying') return currentStatus;

    if (signal === 'Long') {
        return actualChange > 0 ? 'Correct' : 'Incorrect';
    }
    if (signal === 'Short') {
        return actualChange < 0 ? 'Correct' : 'Incorrect';
    }
    if (signal === 'Side') {
        return Math.abs(actualChange) <= NOISE_THRESHOLD_PERCENT ? 'Correct' : 'Incorrect';
    }
    return currentStatus;
}
