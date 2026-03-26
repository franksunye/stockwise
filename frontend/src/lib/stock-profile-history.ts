import type { AIPrediction } from './types';

export const STOCK_PROFILE_HISTORY_CACHE_TTL_MS = 30 * 1000;

type StockProfileHistoryCacheEntry = {
    data: AIPrediction[];
    timestamp: number;
};

const historyCache = new Map<string, StockProfileHistoryCacheEntry>();

export function readStockProfileHistoryCache(
    symbol: string,
    now: number = Date.now()
): AIPrediction[] | null {
    const cached = historyCache.get(symbol);
    if (!cached) {
        return null;
    }

    if (now - cached.timestamp >= STOCK_PROFILE_HISTORY_CACHE_TTL_MS) {
        historyCache.delete(symbol);
        return null;
    }

    return cached.data;
}

export function writeStockProfileHistoryCache(
    symbol: string,
    predictions: AIPrediction[],
    now: number = Date.now()
): AIPrediction[] {
    historyCache.set(symbol, {
        data: predictions,
        timestamp: now,
    });
    return predictions;
}

export function clearStockProfileHistoryCache(symbol?: string): void {
    if (typeof symbol === 'string') {
        historyCache.delete(symbol);
        return;
    }

    historyCache.clear();
}

export function normalizeStockProfileHistoryResponse(
    payload: unknown
): AIPrediction[] {
    if (
        payload &&
        typeof payload === 'object' &&
        'predictions' in payload &&
        Array.isArray(payload.predictions)
    ) {
        return payload.predictions as AIPrediction[];
    }

    return [];
}

export function resolveStockProfileHistory(
    fullHistory: AIPrediction[],
    fallbackHistory: AIPrediction[]
): AIPrediction[] {
    return fullHistory.length > 0 ? fullHistory : fallbackHistory;
}
