'use client';

import { useState, useEffect, useCallback } from 'react';
import { StockData } from '@/lib/types';
import { getCurrentUser } from '@/lib/user';
import { getRule } from '@/lib/storage';

export function useDashboardData() {
    const [stocks, setStocks] = useState<StockData[]>([]);
    const [loadingPool, setLoadingPool] = useState(true);

    const loadAllData = useCallback(async () => {
        const user = await getCurrentUser();
        if (!user) return;

        try {
            const poolRes = await fetch(`/api/stock-pool?userId=${user.userId}`);
            const poolData = await poolRes.json();
            const watchlist = poolData.stocks || [{ symbol: '02171', name: '科济药业' }];

            const initialStocks = watchlist.map((s: { symbol: string; name: string }) => ({
                symbol: s.symbol,
                name: s.name,
                price: null,
                prediction: null,
                previousPrediction: null,
                history: [],
                lastUpdated: '--:--',
                rule: getRule(s.symbol),
                loading: true
            }));
            setStocks(initialStocks);
            setLoadingPool(false);

            // 并行请求每只股票的数据
            initialStocks.forEach(async (stock: StockData) => {
                try {
                    const [stockRes, historyRes] = await Promise.all([
                        fetch(`/api/stock?symbol=${stock.symbol}`),
                        fetch(`/api/predictions?symbol=${stock.symbol}&limit=5`)
                    ]);
                    const sData = await stockRes.json();
                    const hData = await historyRes.json();

                    setStocks(prev => prev.map(p => p.symbol === stock.symbol ? {
                        ...p,
                        price: sData.price,
                        prediction: sData.prediction,
                        previousPrediction: sData.previousPrediction,
                        lastUpdated: sData.last_update_time || '--:--',
                        history: hData.predictions || [],
                        loading: false
                    } : p));
                } catch (e) {
                    console.error(`Failed to load ${stock.symbol}`, e);
                }
            });
        } catch (e) {
            console.error(e);
            setLoadingPool(false);
        }
    }, []);

    useEffect(() => {
        loadAllData();
        const interval = setInterval(loadAllData, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, [loadAllData]);

    return { stocks, setStocks, loadingPool, refresh: loadAllData };
}
