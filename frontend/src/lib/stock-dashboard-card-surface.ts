import type { AIPrediction, TacticalData, Tactic } from './types';

interface StockDashboardCardSurfaceOptions {
    displayPrediction: AIPrediction | null;
    position?: 'holding' | 'empty' | 'none';
}

interface StockDashboardCardTitleOptions {
    displayPrediction: AIPrediction | null;
    todayStr: string;
    fallbackTitle: string;
    normalizeTargetDate: (targetDate?: string) => string;
}

export interface StockDashboardCardSurface {
    tacticalData: TacticalData | null;
    summaryText: string;
    topTactic: Tactic | null;
    pendingText: string;
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
}: StockDashboardCardTitleOptions): string {
    if (!displayPrediction?.target_date) return fallbackTitle;

    const targetDate = normalizeTargetDate(displayPrediction.target_date);

    if (targetDate === todayStr) return '今日建议';
    if (targetDate < todayStr) {
        const [, month, day] = targetDate.split('-');
        return `${parseInt(month, 10)}/${parseInt(day, 10)} 建议`;
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
    const summaryText = tacticalData?.summary || displayPrediction?.ai_reasoning || '正在评估行情...';
    const pendingText = !displayPrediction
        ? '该股票刚刚加入自选池。AI 量化引擎正在排队处理历史数据，预计将在下一个市场窗口（盘前或收盘后）生成深度策略。'
        : displayPrediction.ai_reasoning || '正在评估行情...';

    return {
        tacticalData,
        summaryText,
        topTactic,
        pendingText,
    };
}
