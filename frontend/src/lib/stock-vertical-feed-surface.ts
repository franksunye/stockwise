import type { AIPrediction, StockData } from './types';
import type { VerticalLayerState } from '@/hooks/useTikTokScroll';

export interface StockFeedCard {
    kind: 'today' | 'history';
    prediction: AIPrediction | null;
}

export function getStockFeedCards(stock: StockData): StockFeedCard[] {
    const cards: StockFeedCard[] = [{ kind: 'today', prediction: stock.prediction }];
    stock.history.slice(1).forEach((item) => {
        cards.push({ kind: 'history', prediction: item });
    });
    return cards;
}

export function resolveClosestHistoryIndex(history: AIPrediction[], targetDate: string): number {
    const historyCards = history.slice(1);
    if (historyCards.length === 0) return 0;

    const exactIndex = historyCards.findIndex((item) => item.target_date === targetDate);
    if (exactIndex !== -1) return exactIndex + 1;

    const targetTime = new Date(`${targetDate}T00:00:00`).getTime();
    let earlierMatchIndex: number | null = null;
    let earlierMatchTime = Number.NEGATIVE_INFINITY;
    let nearestIndex = 1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    historyCards.forEach((item, itemIndex) => {
        const candidateTime = new Date(`${item.target_date}T00:00:00`).getTime();
        const distance = Math.abs(candidateTime - targetTime);

        if (candidateTime <= targetTime && candidateTime > earlierMatchTime) {
            earlierMatchTime = candidateTime;
            earlierMatchIndex = itemIndex + 1;
        }

        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = itemIndex + 1;
        }
    });

    return earlierMatchIndex ?? nearestIndex;
}

export function getVerticalLayerState(history: AIPrediction[], index: number): VerticalLayerState {
    if (index <= 0) {
        return { type: 'today', date: null };
    }

    return {
        type: 'history',
        date: history[index]?.target_date || null,
    };
}
