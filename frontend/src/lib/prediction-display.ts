import {
    DECISION_ALIAS_DEFENSE,
    DECISION_ALIAS_LONG,
    DECISION_ALIAS_NO_SIGNAL,
    DECISION_ALIAS_WATCH,
} from '@/lib/semantic-registry';

export const NOISE_THRESHOLD_PERCENT = 1.0;

function sqlQuote(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}

function sqlIn(values: readonly string[]): string {
    return values.map(sqlQuote).join(', ');
}

export const EFFECTIVE_SIGNAL_SQL = `
    CASE
        WHEN dlog.decision_semantic IN (${sqlIn(DECISION_ALIAS_LONG)}) THEN 'Long'
        WHEN dlog.decision_semantic IN (${sqlIn(DECISION_ALIAS_DEFENSE)}) THEN 'Short'
        WHEN dlog.decision_semantic IN (${sqlIn([...DECISION_ALIAS_WATCH, ...DECISION_ALIAS_NO_SIGNAL])}) THEN 'Side'
        ELSE p.signal
    END
`;

export const EFFECTIVE_LAYER1_STATUS_SQL = `
    CASE
        WHEN dlog.decision_semantic IN (${sqlIn(DECISION_ALIAS_LONG)}) THEN 'TriggeredLong'
        WHEN dlog.decision_semantic IN (${sqlIn(DECISION_ALIAS_DEFENSE)}) THEN 'RiskOff'
        WHEN dlog.decision_semantic IN (${sqlIn(DECISION_ALIAS_NO_SIGNAL)}) THEN 'NoSetup'
        WHEN dlog.decision_semantic IN (${sqlIn(DECISION_ALIAS_WATCH)}) THEN 'Watch'
        ELSE p.layer1_status
    END
`;

export const EFFECTIVE_DECISION_SEMANTIC_SQL = `
    CASE
        WHEN dlog.decision_semantic IN (${sqlIn(DECISION_ALIAS_NO_SIGNAL.slice(1))}) THEN '暂无信号'
        WHEN dlog.decision_semantic IN (${sqlIn(DECISION_ALIAS_DEFENSE.slice(1))}) THEN '建议防守'
        WHEN dlog.decision_semantic IN (${sqlIn(DECISION_ALIAS_WATCH.slice(1))}) THEN '建议观察'
        WHEN dlog.decision_semantic IN (${sqlIn(DECISION_ALIAS_LONG.slice(1))}) THEN '建议看多'
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
