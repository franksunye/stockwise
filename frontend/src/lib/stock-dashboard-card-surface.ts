import type { AIPrediction, TacticalData, Tactic } from './types';
import { I18nLabel } from './date-utils';
import { normalizeLegacyTerms } from './tactical-brief-surface';

interface StockDashboardCardSurfaceOptions {
    displayPrediction: AIPrediction | null;
    position?: 'holding' | 'empty' | 'none';
}

interface StockDashboardCardTitleOptions {
    displayPrediction: AIPrediction | null;
    todayStr: string;
    fallbackTitle: I18nLabel;
    normalizeTargetDate: (targetDate?: string) => string;
}

export interface StockDashboardCardSurface {
    tacticalData: TacticalData | null;
    summaryText: string;
    topTactic: Tactic | null;
    pendingKey: string;
}

function parseTacticalData(reasoning: string | undefined): TacticalData | null {
    if (!reasoning) return null;
    try {
        return JSON.parse(reasoning) as TacticalData;
    } catch {
        return null;
    }
}

export function getStockDashboardCardTitle({
    displayPrediction,
    todayStr,
    fallbackTitle,
    normalizeTargetDate,
}: StockDashboardCardTitleOptions): I18nLabel {
    if (!displayPrediction?.target_date) return fallbackTitle;

    const targetDate = normalizeTargetDate(displayPrediction.target_date);

    if (targetDate === todayStr) return { key: 'dashboard.date.todayAdvice' };
    if (targetDate < todayStr) {
        const [, month, day] = targetDate.split('-');
        return { key: 'dashboard.date.tradingDayAdvice', params: { date: `${parseInt(month, 10)}/${parseInt(day, 10)}` } };
    }
    return fallbackTitle;
}

export function getStockDashboardCardSurface({
    displayPrediction,
    position = 'empty',
}: StockDashboardCardSurfaceOptions): StockDashboardCardSurface {
    const tacticalData = parseTacticalData(displayPrediction?.ai_reasoning);
    const tactics = tacticalData?.tactics;
    const bucket = position === 'holding'
        ? tactics?.holding || tactics?.holding_profit
        : tactics?.empty || tactics?.general || tactics?.holding_profit;
    const tacticList = Array.isArray(bucket) ? bucket : bucket ? [bucket] : [];
    const topTactic = tacticList[0] || null;
    const summaryText = normalizeLegacyTerms(tacticalData?.summary || displayPrediction?.ai_reasoning || '');
    /** Full bundle keys for `createGlobalTranslator` / `useGlobalT` (not for nested `useT` + namespace prefix). */
    const pendingKey = !displayPrediction ? 'common.noData' : 'dashboard.signal.pending';

    return {
        tacticalData,
        summaryText,
        topTactic,
        pendingKey,
    };
}
