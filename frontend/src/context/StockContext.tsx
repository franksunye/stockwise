'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useWatchlist, WatchlistItem } from '@/hooks/useWatchlist';
import { StockData, MarketAlmanacData } from '@/lib/types';

interface StockContextType {
    stocks: StockData[];
    watchlist: WatchlistItem[];
    loadingPool: boolean;
    loadingList: boolean;
    loadMoreHistory: (symbol: string, offset: number) => Promise<void>;
    addStock: (symbol: string, name: string) => Promise<boolean>;
    removeStock: (symbol: string) => Promise<boolean>;
    almanac: MarketAlmanacData | null;
}

const StockContext = createContext<StockContextType | undefined>(undefined);

export function StockProvider({ children }: { children: ReactNode }) {
    const { watchlist, loading: loadingList, addStock, removeStock } = useWatchlist();
    const { stocks, almanac, loadingPool, loadMoreHistory } = useDashboardData(watchlist, loadingList);

    const value = useMemo(() => ({
        stocks,
        loadingPool,
        loadMoreHistory,
        watchlist,
        loadingList,
        addStock,
        removeStock,
        almanac
    }), [stocks, loadingPool, loadMoreHistory, watchlist, loadingList, addStock, removeStock, almanac]);

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
