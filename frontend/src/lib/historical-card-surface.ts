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
    __i18n?: {
        key: string;
        params?: Record<string, string | number | boolean>;
    };
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
    if (!windowDays || windowDays <= 1) return 'closeVerify';
    return 'windowVerify';
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

function getValidationStyle(data: AIPrediction, windowKey: string, validationData: ParsedValidationData | null): HistoricalCardValidationStyle {
    const maxPerf = validationData?.max_cum_change || 0;
    const isGoldMedal = maxPerf >= 8.0;
    const windowDays = validationData?.window || 0;

    switch (data.validation_status) {
        case 'Correct':
            if (isGoldMedal) {
                return { 
                    iconName: 'correct', 
                    color: 'text-amber-950 font-black', 
                    bg: 'bg-gradient-to-r from-amber-300 to-yellow-400 border-amber-400/50 shadow-[0_2px_10px_rgba(245,158,11,0.2)]', 
                    label: isGoldMedal ? 'goldMedal' : 'passed',
                    __i18n: {
                        key: isGoldMedal ? 'goldMedal' : 'passed',
                        params: { perf: maxPerf.toFixed(1) }
                    }
                };
            }
            return { 
                iconName: 'correct', 
                color: 'text-emerald-500', 
                bg: 'bg-emerald-500/10 border-emerald-500/20', 
                label: 'passed',
                __i18n: {
                    key: 'passed',
                    params: { perf: maxPerf.toFixed(1), showPerf: maxPerf > 0 }
                }
            };
        case 'Incorrect':
            return { 
                iconName: 'incorrect', 
                color: 'text-rose-500', 
                bg: 'bg-rose-500/10 border-rose-500/20', 
                label: 'deviated',
                __i18n: {
                    key: 'deviated',
                    params: { window: windowDays }
                }
            };
        case 'Verifying':
            return { 
                iconName: 'verifying', 
                color: 'text-indigo-400', 
                bg: 'bg-indigo-500/10 border-indigo-500/20', 
                label: 'verifying',
                __i18n: {
                    key: 'verifying',
                    params: { window: windowDays }
                }
            };
        default:
            return { 
                iconName: 'pending', 
                color: 'text-slate-500', 
                bg: 'bg-slate-500/10 border-slate-500/20', 
                label: 'waiting',
                __i18n: {
                    key: 'waiting'
                }
            };
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
        validationStyle: getValidationStyle(data, windowLabel, validationData),
    };
}

export function formatHistoricalCardDate(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[1]}/${parts[2]}`;
    }
    return dateStr;
}
