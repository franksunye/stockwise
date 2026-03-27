import type { AIPrediction } from './types';

interface BaseSnapshot {
    basePrice: number | null | undefined;
    baseChange: number;
}

interface ParsedValidationData {
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

export interface HistoricalCardValidationStyle {
    color: string;
    bg: string;
    label: string;
    iconName: 'correct' | 'incorrect' | 'verifying' | 'pending';
}

export interface HistoricalCardSurface {
    displayReason: string;
    basePrice: number | null | undefined;
    baseChange: number;
    validationData: ParsedValidationData | null;
    windowLabel: string;
    validationStyle: HistoricalCardValidationStyle;
}

function parseValidationData(raw: unknown): ParsedValidationData | null {
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

function getValidationWindowLabel(windowDays: number | null | undefined): string {
    if (!windowDays || windowDays <= 1) return '收盘验证';
    return `${windowDays}日回看`;
}

function parseBaseSnapshot(data: AIPrediction): BaseSnapshot {
    let basePrice = data.close_price;
    let baseChange = 0;

    try {
        if (data.layer1_payload) {
            const payload = typeof data.layer1_payload === 'string'
                ? JSON.parse(data.layer1_payload)
                : data.layer1_payload;
            basePrice = payload.close || basePrice;
            baseChange = payload.change_percent || 0;
        }
    } catch {
        return { basePrice, baseChange };
    }

    return { basePrice, baseChange };
}

function parseDisplayReason(reasoning: string): string {
    try {
        const parsed = JSON.parse(reasoning);
        return parsed.summary || reasoning;
    } catch {
        return reasoning;
    }
}

function getValidationStyle(data: AIPrediction, windowLabel: string): HistoricalCardValidationStyle {
    switch (data.validation_status) {
        case 'Correct':
            return { iconName: 'correct', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20', label: `${windowLabel}通过` };
        case 'Incorrect':
            return { iconName: 'incorrect', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/20', label: `${windowLabel}偏离` };
        case 'Verifying':
            return { iconName: 'verifying', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', label: `${windowLabel}中` };
        default:
            return { iconName: 'pending', color: 'text-slate-500', bg: 'bg-slate-500/10 border-slate-500/20', label: '待回看' };
    }
}

export function getHistoricalCardSurface(data: AIPrediction): HistoricalCardSurface {
    const validationData = parseValidationData(data.validation_data);
    const windowLabel = getValidationWindowLabel(validationData?.window);
    const { basePrice, baseChange } = parseBaseSnapshot(data);

    return {
        displayReason: parseDisplayReason(data.ai_reasoning),
        basePrice,
        baseChange,
        validationData,
        windowLabel,
        validationStyle: getValidationStyle(data, windowLabel),
    };
}

export function formatHistoricalCardDate(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[1]}/${parts[2]}`;
    }
    return dateStr;
}
