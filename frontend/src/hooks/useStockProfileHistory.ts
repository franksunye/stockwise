'use client';

import { useEffect, useState } from 'react';
import type { AIPrediction, StockData } from '@/lib/types';
import { getCurrentUser } from '@/lib/user';
import {
    normalizeStockProfileHistoryResponse,
    readStockProfileHistoryCache,
    resolveStockProfileHistory,
    writeStockProfileHistoryCache,
} from '@/lib/stock-profile-history';

const STOCK_PROFILE_FETCH_DELAY_MS = 400;

export function useStockProfileHistory(stock: StockData) {
    const [fullHistory, setFullHistory] = useState<AIPrediction[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const cached = readStockProfileHistoryCache(stock.symbol);
        if (cached) {
            setFullHistory(cached);
            setLoadingHistory(false);
            return;
        }

        setFullHistory([]);

        const timer = setTimeout(() => {
            setLoadingHistory(true);

            getCurrentUser()
                .then(() =>
                    fetch(`/api/predictions?symbol=${stock.symbol}&limit=30`, {
                        cache: 'no-store',
                    })
                )
                .then(response => response.json())
                .then(payload => {
                    if (cancelled) {
                        return;
                    }

                    const predictions = normalizeStockProfileHistoryResponse(payload);
                    setFullHistory(predictions);
                    writeStockProfileHistoryCache(stock.symbol, predictions);
                })
                .catch(error => {
                    if (!cancelled) {
                        console.error(error);
                    }
                })
                .finally(() => {
                    if (!cancelled) {
                        setLoadingHistory(false);
                    }
                });
        }, STOCK_PROFILE_FETCH_DELAY_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [stock.symbol]);

    return {
        fullHistory,
        loadingHistory,
        historyToUse: resolveStockProfileHistory(fullHistory, stock.history),
    };
}
