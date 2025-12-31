'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StockData } from '@/lib/types';
import { getCurrentUser } from '@/lib/user';
import { getRule } from '@/lib/storage';
import { getMarketScene } from '@/lib/date-utils';

// 动态刷新间隔：交易时段5分钟，非交易时段10分钟
const TRADING_REFRESH_INTERVAL = 5 * 60 * 1000;   // 5分钟
const DEFAULT_REFRESH_INTERVAL = 10 * 60 * 1000;  // 10分钟

function getRefreshInterval(): number {
    const scene = getMarketScene();
    return scene === 'trading' ? TRADING_REFRESH_INTERVAL : DEFAULT_REFRESH_INTERVAL;
}

export function useDashboardData() {
    const [stocks, setStocks] = useState<StockData[]>([]);
    const [loadingPool, setLoadingPool] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
    const [nextRefreshIn, setNextRefreshIn] = useState<number>(getRefreshInterval());

    const lastFetchTimeRef = useRef<number>(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadAllData = useCallback(async (silent = false) => {
        const user = await getCurrentUser();
        if (!user) return;

        // 防抖：如果距离上次刷新不到30秒，跳过（除非是首次加载）
        const now = Date.now();
        if (lastFetchTimeRef.current && now - lastFetchTimeRef.current < 30000) {
            return;
        }
        lastFetchTimeRef.current = now;

        if (!silent) {
            setIsRefreshing(true);
        }

        try {
            const poolRes = await fetch(`/api/stock-pool?userId=${user.userId}`, { cache: 'no-store' });
            const poolData = await poolRes.json();
            const watchlist = poolData.stocks || [{ symbol: '02171', name: '科济药业' }];

            // 如果是静默刷新且已有数据，不重置为loading状态
            if (!silent || stocks.length === 0) {
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
            }
            setLoadingPool(false);

            // 并行请求每只股票的数据
            const stockPromises = watchlist.map(async (stock: { symbol: string; name: string }) => {
                try {
                    const [stockRes, historyRes] = await Promise.all([
                        fetch(`/api/stock?symbol=${stock.symbol}`, { cache: 'no-store' }),
                        fetch(`/api/predictions?symbol=${stock.symbol}&limit=15`, { cache: 'no-store' })
                    ]);
                    const sData = await stockRes.json();
                    const hData = await historyRes.json();

                    return {
                        symbol: stock.symbol,
                        name: stock.name,
                        price: sData.price,
                        prediction: sData.prediction,
                        previousPrediction: sData.previousPrediction,
                        lastUpdated: sData.last_update_time || '--:--',
                        history: hData.predictions || [],
                        rule: getRule(stock.symbol),
                        loading: false,
                        justUpdated: silent // 标记刚刚更新，用于触发UI动画
                    };
                } catch (e) {
                    console.error(`Failed to load ${stock.symbol}`, e);
                    return null;
                }
            });

            const results = await Promise.all(stockPromises);
            const validResults = results.filter(Boolean) as StockData[];

            setStocks(validResults);
            setLastRefreshTime(new Date());
            setNextRefreshIn(getRefreshInterval());

            // 2秒后清除 justUpdated 标记
            if (silent) {
                setTimeout(() => {
                    setStocks(prev => prev.map(s => ({ ...s, justUpdated: false })));
                }, 2000);
            }
        } catch (e) {
            console.error(e);
            setLoadingPool(false);
        } finally {
            setIsRefreshing(false);
        }
    }, [stocks.length]);

    // 页面可见性检测：当用户切回页面时刷新数据
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // 页面变为可见时，检查是否需要刷新
                const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
                // 如果距离上次刷新超过2分钟，静默刷新
                if (timeSinceLastFetch > 2 * 60 * 1000) {
                    loadAllData(true);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [loadAllData]);

    // 窗口获得焦点时刷新（处理从其他应用切回的情况）
    useEffect(() => {
        const handleFocus = () => {
            const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
            if (timeSinceLastFetch > 2 * 60 * 1000) {
                loadAllData(true);
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [loadAllData]);

    // 定时刷新
    useEffect(() => {
        loadAllData();
        intervalRef.current = setInterval(() => loadAllData(true), getRefreshInterval());
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [loadAllData]);

    // 倒计时更新
    useEffect(() => {
        countdownRef.current = setInterval(() => {
            setNextRefreshIn(prev => Math.max(0, prev - 1000));
        }, 1000);
        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, []);

    // 手动刷新函数
    const manualRefresh = useCallback(() => {
        lastFetchTimeRef.current = 0; // 重置防抖
        return loadAllData(false);
    }, [loadAllData]);

    return {
        stocks,
        setStocks,
        loadingPool,
        isRefreshing,
        lastRefreshTime,
        nextRefreshIn,
        refresh: manualRefresh
    };
}
