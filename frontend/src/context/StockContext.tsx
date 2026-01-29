'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useWatchlist, WatchlistItem } from '@/hooks/useWatchlist';
import { StockData } from '@/lib/types';

interface StockContextType {
    stocks: StockData[];
    watchlist: WatchlistItem[];
    loadingPool: boolean;
    loadingList: boolean;
    isRefreshing: boolean;
    lastRefreshTime: Date | null;
    nextRefreshIn: number;
    refresh: () => Promise<void>;
    loadMoreHistory: (symbol: string, offset: number) => Promise<void>;
    addStock: (symbol: string, name: string) => Promise<boolean>;
    removeStock: (symbol: string) => Promise<boolean>;
}

const StockContext = createContext<StockContextType | undefined>(undefined);

export function StockProvider({ children }: { children: ReactNode }) {
    const { watchlist, loading: loadingList, addStock, removeStock } = useWatchlist();
    const stockData = useDashboardData(watchlist, loadingList);

    const value = {
        ...stockData,
        watchlist,
        loadingList,
        addStock,
        removeStock
    };

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
