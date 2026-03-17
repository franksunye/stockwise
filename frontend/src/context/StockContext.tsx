'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useWatchlist, WatchlistItem } from '@/hooks/useWatchlist';
import { StockData, MarketAlmanacData } from '@/lib/types';

const LITE_HISTORY_LIMIT = 1;
const FULL_HISTORY_LIMIT = 5;

interface StockContextType {
    stocks: StockData[];
    watchlist: WatchlistItem[];
    loadingPool: boolean;
    loadingList: boolean;
    isRefreshing: boolean;
    lastRefreshTime: Date | null;
    lastRefreshError: string | null;
    refresh: () => Promise<boolean>;
    loadMoreHistory: (symbol: string, offset: number) => Promise<void>;
    addStock: (symbol: string, name: string) => Promise<boolean>;
    removeStock: (symbol: string) => Promise<boolean>;
    almanac: MarketAlmanacData | null;
    almanacs: MarketAlmanacData[];
}

const StockContext = createContext<StockContextType | undefined>(undefined);

export function StockProvider({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isStockPool = pathname === '/dashboard/stock-pool';
    const historyLimit = isStockPool ? LITE_HISTORY_LIMIT : FULL_HISTORY_LIMIT;

    const { watchlist, loading: loadingList, addStock, removeStock } = useWatchlist();
    const {
        stocks,
        almanac,
        almanacs,
        loadingPool,
        isRefreshing,
        lastRefreshTime,
        lastRefreshError,
        refresh,
        loadMoreHistory
    } = useDashboardData(watchlist, loadingList, historyLimit, isStockPool);

    const value = useMemo(() => ({
        stocks,
        loadingPool,
        isRefreshing,
        lastRefreshTime,
        lastRefreshError,
        refresh,
        loadMoreHistory,
        watchlist,
        loadingList,
        addStock,
        removeStock,
        almanac,
        almanacs
    }), [stocks, loadingPool, isRefreshing, lastRefreshTime, lastRefreshError, refresh, loadMoreHistory, watchlist, loadingList, addStock, removeStock, almanac, almanacs]);

    return (
        <StockContext.Provider value={value}>
            {children}
        </StockContext.Provider>
    );
}

export function useStocks() {
    const context = useContext(StockContext);
    if (context === undefined) {
        throw new Error('useStocks must be used within a StockProvider');
    }
    return context;
}
