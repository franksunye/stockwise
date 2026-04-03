'use client';

import { useEffect, useState } from 'react';
import { useLocale } from '@/context/LocaleContext';
import type { AIPrediction, StockData } from '@/lib/types';
import { appLocaleToPredictionContentLocale } from '@/lib/prediction-content-locale';
import { getCurrentUser } from '@/lib/user';
import {
    normalizeStockProfileHistoryResponse,
    readStockProfileHistoryCache,
    resolveStockProfileHistory,
    writeStockProfileHistoryCache,
} from '@/lib/stock-profile-history';

const STOCK_PROFILE_FETCH_DELAY_MS = 400;

export function useStockProfileHistory(stock: StockData) {
    const { locale: appLocale } = useLocale();
    const predictionContentLocale = appLocaleToPredictionContentLocale(appLocale);
    const [fullHistory, setFullHistory] = useState<AIPrediction[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const cached = readStockProfileHistoryCache(stock.symbol, predictionContentLocale);
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
                    fetch(
                        `/api/predictions?symbol=${encodeURIComponent(stock.symbol)}&limit=30&locale=${predictionContentLocale}`,
                        {
                            cache: 'no-store',
                        },
                    )
                )
                .then(response => response.json())
                .then(payload => {
                    if (cancelled) {
                        return;
                    }

                    const predictions = normalizeStockProfileHistoryResponse(payload);
                    setFullHistory(predictions);
                    writeStockProfileHistoryCache(stock.symbol, predictions, predictionContentLocale);
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
    }, [stock.symbol, predictionContentLocale]);

    return {
        fullHistory,
        loadingHistory,
        historyToUse: resolveStockProfileHistory(fullHistory, stock.history),
    };
}
