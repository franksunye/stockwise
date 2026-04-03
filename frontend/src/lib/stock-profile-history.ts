import type { AIPrediction } from './types';

export const STOCK_PROFILE_HISTORY_CACHE_TTL_MS = 30 * 1000;

type StockProfileHistoryCacheEntry = {
    data: AIPrediction[];
    timestamp: number;
};

const historyCache = new Map<string, StockProfileHistoryCacheEntry>();

function profileHistoryCacheKey(symbol: string, contentLocale: string): string {
    return `${symbol}:${contentLocale}`;
}

export function readStockProfileHistoryCache(
    symbol: string,
    contentLocale: string,
    now: number = Date.now()
): AIPrediction[] | null {
    const cached = historyCache.get(profileHistoryCacheKey(symbol, contentLocale));
    if (!cached) {
        return null;
    }

    if (now - cached.timestamp >= STOCK_PROFILE_HISTORY_CACHE_TTL_MS) {
        historyCache.delete(profileHistoryCacheKey(symbol, contentLocale));
        return null;
    }

    return cached.data;
}

export function writeStockProfileHistoryCache(
    symbol: string,
    predictions: AIPrediction[],
    contentLocale: string,
    now: number = Date.now()
): AIPrediction[] {
    historyCache.set(profileHistoryCacheKey(symbol, contentLocale), {
        data: predictions,
        timestamp: now,
    });
    return predictions;
}

export function clearStockProfileHistoryCache(symbol?: string, contentLocale?: string): void {
    if (typeof symbol === 'string' && typeof contentLocale === 'string') {
        historyCache.delete(profileHistoryCacheKey(symbol, contentLocale));
        return;
    }
    if (typeof symbol === 'string') {
        for (const key of historyCache.keys()) {
            if (key.startsWith(`${symbol}:`)) historyCache.delete(key);
        }
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
