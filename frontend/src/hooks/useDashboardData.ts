'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StockData } from '@/lib/types';
import { getCurrentUser } from '@/lib/user';
import { getRule } from '@/lib/storage';
import { getMarketScene } from '@/lib/date-utils';

// 动态刷新间隔：交易时段5分钟，非交易时段10分钟
const TRADING_REFRESH_INTERVAL = 5 * 60 * 1000;   // 5分钟
const DEFAULT_REFRESH_INTERVAL = 10 * 60 * 1000;  // 10分钟
const CACHE_KEY = 'stockwise_dashboard_cache_v1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时过期

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

    // 1. 初始化：尝试从本地缓存读取，实现【秒开】
    useEffect(() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                const age = Date.now() - timestamp;

                // 只有未过期的缓存才使用 (24小时)
                if (age < CACHE_TTL && Array.isArray(data) && data.length > 0) {
                    console.log(`🚀 Loaded ${data.length} stocks from local cache (${Math.round(age / 60000)}m ago)`);
                    setStocks(data);
                    setLoadingPool(false); // 立即关闭骨架屏
                }
            }
        } catch (e) {
            console.error('Cache load error', e);
        }
    }, []);

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
            // 🚀 使用批量 API，将原来的 41 个请求合并为 1 个
            const startTime = performance.now();

            // 添加 10 秒超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const dashboardRes = await fetch(`/api/dashboard?userId=${user.userId}&historyLimit=15`, {
                cache: 'no-store',
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const dashboardData = await dashboardRes.json();

            if (dashboardData.error) {
                console.error('Dashboard API error:', dashboardData.error);
                setLoadingPool(false);
                return;
            }

            const fetchTime = Math.round(performance.now() - startTime);
            console.log(`📊 Dashboard loaded: ${dashboardData.stocks?.length || 0} stocks in ${fetchTime}ms (server: ${dashboardData.queryTime}ms)`);

            // 组装前端需要的数据格式
            const validResults = (dashboardData.stocks || []).map((stock: {
                symbol: string;
                name: string;
                price: unknown;
                prediction: unknown;
                previousPrediction: unknown;
                history: unknown[];
                lastUpdated: string;
            }) => ({
                symbol: stock.symbol,
                name: stock.name,
                price: stock.price,
                prediction: stock.prediction,
                previousPrediction: stock.previousPrediction,
                lastUpdated: stock.lastUpdated || '--:--',
                history: stock.history || [],
                rule: getRule(stock.symbol),
                loading: false,
                justUpdated: silent
            })) as StockData[];

            setStocks(validResults);
            setLoadingPool(false);
            setLastRefreshTime(new Date());
            setNextRefreshIn(getRefreshInterval());

            // 💾 写入本地缓存 (后台静默)
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    data: validResults,
                    timestamp: Date.now()
                }));
            } catch (e) { console.error('Cache save error', e); }

            // 2秒后清除 justUpdated 标记
            if (silent) {
                setTimeout(() => {
                    setStocks(prev => prev.map(s => ({ ...s, justUpdated: false })));
                }, 2000);
            }
        } catch (e) {
            console.error('Dashboard fetch error:', e);
            setLoadingPool(false);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

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

    // 加载更多历史
    const loadMoreHistory = useCallback(async (symbol: string, offset: number) => {
        // 乐观更新：设置 loading 状态
        setStocks(prev => prev.map(s => {
            if (s.symbol === symbol) {
                return { ...s, loadingMore: true };
            }
            return s;
        }));

        try {
            const res = await fetch(`/api/history?symbol=${symbol}&offset=${offset}&limit=10`);
            const data = await res.json();

            if (data.predictions) {
                setStocks(prev => prev.map(s => {
                    if (s.symbol === symbol) {
                        // 过滤重复数据 (以防万一)
                        const existingDates = new Set(s.history.map(h => h.date));
                        const newItems = (data.predictions as import('@/lib/types').AIPrediction[])
                            .filter(p => !existingDates.has(p.date));

                        const newHistory = [...s.history, ...newItems]
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                        return {
                            ...s,
                            history: newHistory,
                            loadingMore: false,
                            // 如果返回少于10条，说明没有更多了
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
        setStocks,
        loadingPool,
        isRefreshing,
        lastRefreshTime,
        nextRefreshIn,
        refresh: manualRefresh,
        loadMoreHistory
    };
}
