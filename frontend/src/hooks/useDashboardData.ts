'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentUser } from '@/lib/user';
import { StockData, MarketAlmanacData } from '@/lib/types';
import { getRule } from '@/lib/storage';
import { getMarketScene } from '@/lib/date-utils';
import { WatchlistItem } from './useWatchlist';

// 动态刷新间隔：交易时段5分钟，非交易时段10分钟
const TRADING_REFRESH_INTERVAL = 5 * 60 * 1000;   // 5分钟
const DEFAULT_REFRESH_INTERVAL = 10 * 60 * 1000;  // 10分钟
const CACHE_KEY = 'stockwise_dashboard_cache_v1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时过期
const RESUME_REFRESH_THRESHOLD = 30 * 1000; // iOS PWA 回前台后 30s 以上即尝试刷新

function getRefreshInterval(): number {
    const scene = getMarketScene();
    return scene === 'trading' ? TRADING_REFRESH_INTERVAL : DEFAULT_REFRESH_INTERVAL;
}

function formatRefreshError(error: unknown, sessionRecoveryAttempted: boolean): string {
    if (error instanceof DOMException && error.name === 'AbortError') {
        return '请求超时';
    }

    if (error instanceof Error) {
        if (error.message.includes('Batch API failed: 401')) {
            return sessionRecoveryAttempted ? '401 会话恢复失败' : '401 未授权';
        }
        if (error.message.includes('Batch API failed: 403')) {
            return '403 无权限';
        }
        if (error.message.includes('Batch API failed: 5')) {
            return '服务端错误';
        }
        if (error.message.includes('Failed to fetch') || error.message.includes('Load failed')) {
            return '网络失败';
        }
        if (error.message.trim()) {
            return error.message;
        }
    }

    return '未知错误';
}

export function useDashboardData(watchlist: WatchlistItem[], loadingWatchlist: boolean) {
    // Watchlist passed from props to avoid redundant hook calls in unified context

    const [stocks, setStocks] = useState<StockData[]>([]);
    const [almanac, setAlmanac] = useState<MarketAlmanacData | null>(null);
    const [almanacs, setAlmanacs] = useState<MarketAlmanacData[]>([]);
    const [loadingPool, setLoadingPool] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
    const [lastRefreshError, setLastRefreshError] = useState<string | null>(null);

    const lastFetchTimeRef = useRef<number>(0);
    const stocksRef = useRef<StockData[]>(stocks);

    // Sync ref with state
    useEffect(() => {
        stocksRef.current = stocks;
    }, [stocks]);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const getEffectiveWatchlist = useCallback((): WatchlistItem[] => {
        if (watchlist.length > 0) return watchlist;
        if (stocksRef.current.length === 0) return [];

        return stocksRef.current.map((stock, index) => ({
            symbol: stock.symbol,
            name: stock.name,
            addedAt: index
        }));
    }, [watchlist]);

    // 1. 初始化：尝试从本地缓存读取，实现【秒开】
    useEffect(() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                const { data, timestamp } = parsed;
                const age = Date.now() - timestamp;

                // 只有未过期的缓存才使用 (24小时)
                if (age < CACHE_TTL && Array.isArray(data) && data.length > 0) {
                    console.log(`🚀 Loaded ${data.length} stocks from local cache (${Math.round(age / 60000)}m ago)`);
                    setStocks(data);
                    setLastRefreshTime(new Date(timestamp));

                    // 兼容性尝试性加载：即便缓存是 v1 版本的（没有 almanac），也不影响 stocks 的展示
                    if (parsed.almanac) setAlmanac(parsed.almanac);
                    if (parsed.almanacs) setAlmanacs(parsed.almanacs);

                    // 【核心回归】只要股票恢复了，立即关掉骨架屏进入 App
                    setLoadingPool(false);
                }
            }
        } catch (e) {
            console.error('Cache load error', e);
        }
    }, []);

    const loadAllData = useCallback(async (silent = false, ignoreDebounce = false): Promise<boolean> => {
        const effectiveWatchlist = getEffectiveWatchlist();

        // 如果 watchlist 还在加载中，跳过
        if (loadingWatchlist && effectiveWatchlist.length === 0) {
            setLastRefreshError('等待自选池恢复');
            return false;
        }

        // 如果没有股票，清空 (但不能 return，因为仍然需要去拉取公共的 Market Almanac)
        if (effectiveWatchlist.length === 0) {
            if (!loadingWatchlist) {
                setStocks([]);
            }
            setLastRefreshError('无可刷新标的');
        }

        const now = Date.now();
        // 防抖: 30s内的重复刷新跳过 (除非 silent=true 或 ignoreDebounce=true)
        if (lastFetchTimeRef.current && now - lastFetchTimeRef.current < 30000 && !silent && !ignoreDebounce) {
            // [Critical Fix] Even if we debounce the Network Request, 
            // we MUST re-map the stocks if the watchlist itself has changed (e.g. user added/removed item).
            // Current `stocks` might be stale compared to `watchlist`.
            // Check if we need a quick local sync without network
            if (effectiveWatchlist.length !== stocksRef.current.length) {
                // Fallback: Local re-map using existing data + new placeholder
                const remapped = effectiveWatchlist.map(item => {
                    const existing = stocksRef.current.find(s => s.symbol === item.symbol);
                    if (existing) return existing;
                    return {
                        symbol: item.symbol, name: item.name, price: null,
                        change: 0, lastUpdated: '...', history: [], loading: true,
                        prediction: null, previousPrediction: null, rule: null
                    } as StockData; // Placeholder
                });
                setStocks(remapped);
                return false;
            }
            return false;
        }

        lastFetchTimeRef.current = now;

        if (!silent) {
            setIsRefreshing(true);
            setLastRefreshError(null);
        }

        try {
            const startTime = performance.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort('请求超时 (12s)'), 12000); // 12s timeout

            // Step 1: Ensure User Identity in background (Don't await to avoid blocking critical data fetch)
            getCurrentUser().catch(err => console.error('Background user sync error:', err));

            // Step 2: 拿着 watchlist 去 CDN 拉取公共数据 (公有API)
            const symbols = effectiveWatchlist.map(w => w.symbol).join(',');
            // 如果是非静默刷新（手动点击或初始化），增加一个 cache-buster 扰动缓存
            const url = `/api/stock/batch?symbols=${symbols}&historyLimit=15${!silent ? `&t=${Date.now()}` : ''}`;

            const fetchOptions: RequestInit = {
                signal: controller.signal,
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            };

            let batchRes = await fetch(url, fetchOptions);
            if (batchRes.status === 401) {
                await getCurrentUser({ forceSessionSync: true });
                batchRes = await fetch(url, fetchOptions);
            }
            clearTimeout(timeoutId);

            if (!batchRes.ok) {
                throw new Error(`Batch API failed: ${batchRes.status}`);
            }

            const batchData = await batchRes.json();

            if (batchData.error) { throw new Error(batchData.error); }
            if (batchData.almanacs) {
                setAlmanacs(batchData.almanacs);
            }
            if (batchData.almanac) {
                setAlmanac(batchData.almanac);
            }

            const fetchTime = Math.round(performance.now() - startTime);
            console.log(`📊 Dashboard loaded: ${effectiveWatchlist.length} stocks in ${fetchTime}ms`);

            // Merge Watchlist with Batch Data
            const validResults = effectiveWatchlist.map(item => {
                const stockData = (batchData.stocks || []).find((s: { symbol: string }) => s.symbol === item.symbol);
                const base = stockData || {
                    symbol: item.symbol,
                    price: null,
                    prediction: null,
                    previousPrediction: null,
                    history: [],
                    shortMetrics: null
                };

                return {
                    symbol: item.symbol,
                    name: item.name,
                    price: base.price,
                    prediction: base.prediction,
                    previousPrediction: base.previousPrediction,
                    lastUpdated: base.lastUpdated || '--:--',
                    history: base.history || [],
                    shortMetrics: base.shortMetrics || null,
                    rule: getRule(item.symbol),
                    loading: false,
                    justUpdated: silent
                } as StockData;
            });

            setStocks(validResults);
            setLoadingPool(false);
            setLastRefreshTime(new Date());
            setLastRefreshError(null);

            // 💾 写入本地缓存 (后台静默)
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    data: validResults,
                    almanac: batchData.almanac,
                    almanacs: batchData.almanacs,
                    timestamp: Date.now()
                }));
            } catch (e) { console.error('Cache save error', e); }

            // 2秒后清除 justUpdated 标记
            if (silent) {
                setTimeout(() => {
                    setStocks(prev => prev.map(s => ({ ...s, justUpdated: false })));
                }, 2000);
            }
            return true;
        } catch (e) {
            console.error('Dashboard fetch error:', e);
            const sessionRecoveryAttempted =
                e instanceof Error && e.message.includes('401');
            setLastRefreshError(formatRefreshError(e, sessionRecoveryAttempted));
            // [Fix] Even on error, we should ensure UI reflects the watchlist
            // If network fails, at least show the items in watchlist with error state
            if (effectiveWatchlist.length > 0) {
                const fallback = effectiveWatchlist.map(item => {
                    const existing = stocksRef.current.find(s => s.symbol === item.symbol);
                    return existing || {
                        symbol: item.symbol, name: item.name, price: null, loading: false,
                        change: 0, lastUpdated: '...', history: [],
                        prediction: null, previousPrediction: null, rule: null
                    } as StockData;
                });
                setStocks(fallback);
            }
            setLoadingPool(false);
            return false;
        } finally {
            setIsRefreshing(false);
        }
    }, [getEffectiveWatchlist, loadingWatchlist]); // Important: depends on watchlist

    // Watchlist 变更时，强制触发一次刷新 (Ignore Debounce)
    useEffect(() => {
        if (!loadingWatchlist && watchlist.length > 0) {
            loadAllData(false, true); // silent=false, ignoreDebounce=true
        } else if (watchlist.length === 0 && !loadingWatchlist) {
            setStocks([]);
        }
    }, [watchlist, loadingWatchlist, loadAllData]);

    // 页面可见性检测：当用户切回页面时刷新数据
    useEffect(() => {
        const refreshOnResume = () => {
            const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
            if (timeSinceLastFetch > RESUME_REFRESH_THRESHOLD) {
                loadAllData(true);
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshOnResume();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', refreshOnResume);
        window.addEventListener('pageshow', refreshOnResume);
        window.addEventListener('online', refreshOnResume);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', refreshOnResume);
            window.removeEventListener('pageshow', refreshOnResume);
            window.removeEventListener('online', refreshOnResume);
        };
    }, [loadAllData]);

    // 定时刷新
    useEffect(() => {
        loadAllData();
        intervalRef.current = setInterval(() => loadAllData(true), getRefreshInterval());
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [loadAllData]);

    // 手动刷新函数
    const manualRefresh = useCallback((): Promise<boolean> => {
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
            await getCurrentUser();
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
        almanac,
        almanacs,
        setStocks,
        loadingPool,
        isRefreshing,
        lastRefreshTime,
        lastRefreshError,
        refresh: manualRefresh,
        loadMoreHistory
    };
}
