import type { AIPrediction } from './types';

export function getStockProfileStats(history: AIPrediction[]) {
    const winCount = history.filter(item => item.validation_status === 'Correct').length;
    const totalCount = history.filter(
        item =>
            item.validation_status === 'Correct' ||
            item.validation_status === 'Incorrect'
    ).length;
    const winRate = totalCount > 0 ? Math.round((winCount / totalCount) * 100) : 0;

    return {
        winCount,
        totalCount,
        winRate,
    };
}

export function formatStockProfileHistoryLabel(targetDate: string): string {
    return targetDate.split('-').slice(1).join('/');
}
