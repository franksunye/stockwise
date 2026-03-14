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
    p.validation_status
`;

export interface ParsedValidationData {
    window?: number;
    days_evaluated?: number;
    trajectory?: Array<{ date: string; change: number; cum_change: number; close?: number }>;
    t1_change?: number;
    cum_change?: number;
    max_cum_change?: number;
    min_cum_change?: number;
    semantic_verdict?: string;
    outcome_verdict?: string;
    reason_code?: string;
}

export function parseValidationData(raw: unknown): ParsedValidationData | null {
    if (!raw) return null;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw) as ParsedValidationData;
        } catch {
            return null;
        }
    }
    if (typeof raw === 'object') {
        return raw as ParsedValidationData;
    }
    return null;
}

export function getValidationWindowLabel(windowDays: number | null | undefined): string {
    if (!windowDays || windowDays <= 1) return '收盘验证';
    return `${windowDays}日回看`;
}
