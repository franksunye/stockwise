'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { getCurrentUser } from '@/lib/user';
import { StockData, MarketAlmanacData } from '@/lib/types';
import { getRule } from '@/lib/storage';
import { getMarketScene } from '@/lib/date-utils';
import { WatchlistItem } from './useWatchlist';

const TRADING_REFRESH_INTERVAL = 5 * 60 * 1000;
const DEFAULT_REFRESH_INTERVAL = 10 * 60 * 1000;
const CACHE_KEY = 'stockwise_dashboard_cache_v1';
const CACHE_TTL = 24 * 60 * 60 * 1000;

interface DashboardSnapshot {
    data: StockData[];
    almanac?: MarketAlmanacData | null;
    almanacs?: MarketAlmanacData[];
    timestamp: number;
}

interface DashboardBatchStock {
    symbol: string;
    price: StockData['price'];
    prediction: StockData['prediction'];
    previousPrediction: StockData['previousPrediction'];
    lastUpdated?: string;
    history?: StockData['history'];
    shortMetrics?: StockData['shortMetrics'];
}

interface DashboardBatchResponse {
    stocks?: DashboardBatchStock[];
    almanac?: MarketAlmanacData | null;
    almanacs?: MarketAlmanacData[];
    error?: string;
}

function getRefreshInterval(): number {
    const scene = getMarketScene();
    return scene === 'trading' ? TRADING_REFRESH_INTERVAL : DEFAULT_REFRESH_INTERVAL;
}

function readDashboardSnapshot(): DashboardSnapshot | null {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const parsed = JSON.parse(cached) as Partial<DashboardSnapshot>;
        if (!parsed || typeof parsed.timestamp !== 'number' || !Array.isArray(parsed.data)) {
            return null;
        }

        if (Date.now() - parsed.timestamp >= CACHE_TTL) {
            return null;
        }

        return {
            data: parsed.data as StockData[],
            almanac: parsed.almanac ?? null,
            almanacs: Array.isArray(parsed.almanacs) ? parsed.almanacs : [],
            timestamp: parsed.timestamp,
        };
    } catch (e) {
        console.error('Cache load error', e);
        return null;
    }
}

function writeDashboardSnapshot(snapshot: DashboardSnapshot): void {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
    } catch (e) {
        console.error('Cache save error', e);
    }
}

function toFallbackStock(item: WatchlistItem, existing?: StockData): StockData {
    return existing || {
        symbol: item.symbol,
        name: item.name,
        price: null,
        change: 0,
        lastUpdated: '...',
        history: [],
        prediction: null,
        previousPrediction: null,
        rule: null,
        loading: false,
    } as StockData;
}

function mapBatchToStocks(
    watchlist: WatchlistItem[],
    batchData: DashboardBatchResponse | undefined,
    existingStocks: StockData[]
): StockData[] {
    return watchlist.map(item => {
        const stockData = batchData?.stocks?.find((stock) => stock.symbol === item.symbol);
        const existing = existingStocks.find((stock) => stock.symbol === item.symbol);

        if (!stockData) {
            return toFallbackStock(item, existing);
        }

        return {
            symbol: item.symbol,
            name: item.name,
            price: stockData.price,
            prediction: stockData.prediction,
            previousPrediction: stockData.previousPrediction,
            lastUpdated: stockData.lastUpdated || '--:--',
            history: stockData.history || [],
            shortMetrics: stockData.shortMetrics || null,
            rule: getRule(item.symbol),
            loading: false,
        } as StockData;
    });
}

async function fetchDashboardBatch([, symbols]: readonly [string, string]): Promise<DashboardBatchResponse> {
    let response = await fetch(`/api/stock/batch?symbols=${symbols}&historyLimit=15`, {
        cache: 'no-store',
    });

    if (response.status === 401) {
        await getCurrentUser();
        response = await fetch(`/api/stock/batch?symbols=${symbols}&historyLimit=15`, {
            cache: 'no-store',
        });
    }

    const payload = await response.json();
    if (!response.ok || payload?.error) {
        throw new Error(payload?.error || 'Dashboard batch fetch failed');
    }

    return payload as DashboardBatchResponse;
}

export function useDashboardData(watchlist: WatchlistItem[], loadingWatchlist: boolean) {
    const [stocks, setStocks] = useState<StockData[]>([]);
    const [almanac, setAlmanac] = useState<MarketAlmanacData | null>(null);
    const [almanacs, setAlmanacs] = useState<MarketAlmanacData[]>([]);
    const [loadingPool, setLoadingPool] = useState(true);
    const [snapshotReady, setSnapshotReady] = useState(false);
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);

    const stocksRef = useRef<StockData[]>(stocks);
    const manualRefreshRef = useRef(false);

    useEffect(() => {
        stocksRef.current = stocks;
    }, [stocks]);

    useEffect(() => {
        const snapshot = readDashboardSnapshot();
        if (snapshot) {
            console.log(`🚀 Loaded ${snapshot.data.length} stocks from local cache (${Math.round((Date.now() - snapshot.timestamp) / 60000)}m ago)`);
            setStocks(snapshot.data);
            setAlmanac(snapshot.almanac || null);
            setAlmanacs(snapshot.almanacs || []);
            setLoadingPool(false);
        }
        setSnapshotReady(true);
    }, []);

    const symbols = watchlist.map((item) => item.symbol).join(',');
    const shouldFetch = snapshotReady && !loadingWatchlist && watchlist.length > 0;
    const dashboardKey = useMemo(
        () => (shouldFetch ? (['dashboard-batch', symbols] as const) : null),
        [shouldFetch, symbols]
    );

    const {
        data: batchData,
        error,
        isLoading,
        isValidating,
        mutate,
    } = useSWR(dashboardKey, fetchDashboardBatch, {
        keepPreviousData: true,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        focusThrottleInterval: 2 * 60 * 1000,
        refreshInterval: () => getRefreshInterval(),
        dedupingInterval: 30 * 1000,
    });

    useEffect(() => {
        if (!snapshotReady || loadingWatchlist) return;

        if (watchlist.length === 0) {
            setStocks([]);
            setLoadingPool(false);
            return;
        }

        if (batchData) {
            const nextStocks = mapBatchToStocks(watchlist, batchData, stocksRef.current);
            setStocks(nextStocks);
            setAlmanac(batchData.almanac || null);
            setAlmanacs(batchData.almanacs || []);
            setLoadingPool(false);
            setLastRefreshTime(new Date());

            writeDashboardSnapshot({
                data: nextStocks,
                almanac: batchData.almanac || null,
                almanacs: batchData.almanacs || [],
                timestamp: Date.now(),
            });
            return;
        }

        if (error) {
            console.error('Dashboard fetch error:', error);
            setStocks(watchlist.map(item => toFallbackStock(
                item,
                stocksRef.current.find((stock) => stock.symbol === item.symbol)
            )));
            setLoadingPool(false);
            return;
        }

        if (!isLoading) {
            setLoadingPool(false);
        }
    }, [batchData, error, isLoading, loadingWatchlist, snapshotReady, watchlist]);

    const manualRefresh = useCallback(() => {
        if (!dashboardKey) return Promise.resolve(undefined);
        manualRefreshRef.current = true;
        return mutate();
    }, [dashboardKey, mutate]);

    useEffect(() => {
        if (!isValidating) {
            manualRefreshRef.current = false;
        }
    }, [isValidating]);

    const loadMoreHistory = useCallback(async (symbol: string, offset: number) => {
        setStocks(prev => prev.map(s => {
            if (s.symbol === symbol) {
                return { ...s, loadingMore: true };
            }
            return s;
        }));

        try {
            await getCurrentUser();
            const res = await fetch(`/api/history?symbol=${symbol}&offset=${offset}&limit=10`);
            const data = await res.json();

            if (data.predictions) {
                setStocks(prev => prev.map(s => {
                    if (s.symbol === symbol) {
                        const existingDates = new Set(s.history.map(h => h.date));
                        const newItems = (data.predictions as import('@/lib/types').AIPrediction[])
                            .filter(p => !existingDates.has(p.date));

                        const newHistory = [...s.history, ...newItems]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                        return {
                            ...s,
                            history: newHistory,
                            loadingMore: false,
                            hasMoreHistory: data.predictions.length >= 10
                        };
                    }
                    return s;
                }));
            }
        } catch (e) {
            console.error('Failed to load history', e);
            setStocks(prev => prev.map(s => s.symbol === symbol ? { ...s, loadingMore: false } : s));
        }
    }, []);

    return {
        stocks,
        almanac,
        almanacs,
        setStocks,
        loadingPool,
        isRefreshing: isValidating && manualRefreshRef.current,
        lastRefreshTime,
        refresh: manualRefresh,
        loadMoreHistory
    };
}
