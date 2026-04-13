'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentUser } from '@/lib/user';
import { StockData, MarketAlmanacData } from '@/lib/types';
import { getRule } from '@/lib/storage';
import { getMarketScene, isTradingDay, getHKTime, getUSEasternTime, formatDateStr, getMarketFromSymbol, type MarketType } from '@/lib/date-utils';
import { getDashboardRefreshPlan, type DashboardRefreshEvent } from '@/lib/dashboard-refresh-contract';
import { useLocale } from '@/context/LocaleContext';
import { appLocaleToPredictionContentLocale } from '@/lib/prediction-content-locale';
import { WatchlistItem } from './useWatchlist';
import { useUserProfile } from '@/hooks/useUserProfile';
import { getDashboardCacheStorageKey } from '@/lib/dashboard-bootstrap';

// 价格层刷新间隔：盘中 1 分钟，非交易时段 10 分钟
const TRADING_PRICE_REFRESH_INTERVAL = 1 * 60 * 1000;
const DEFAULT_PRICE_REFRESH_INTERVAL = 10 * 60 * 1000;
const BROADCAST_FAILURE_THRESHOLD = 3;
const BROADCAST_CIRCUIT_BREAKER_MS = 5 * 60 * 1000;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时过期
const PREDICTION_VERSION_CHECK_KEY = 'stockwise_prediction_version_check_v1';
const PREDICTION_VERSION_CHECK_INTERVAL = 10 * 60 * 1000;

type LocaleSwitchEventType =
    | 'locale_switch_start'
    | 'locale_switch_cache_hit'
    | 'locale_switch_cache_miss'
    | 'locale_switch_stale_drop'
    | 'locale_switch_finish'
    | 'locale_switch_error';

function reportLocaleSwitchEvent(
    eventType: LocaleSwitchEventType,
    payload: Record<string, unknown> = {}
): void {
    try {
        const event = {
            eventType,
            ts: new Date().toISOString(),
            ...payload,
        };
        console.info('[DashboardLocaleSync]', event);
    } catch {
        // no-op
    }
}

function getTodayByMarket(market: MarketType): string {
    const now = market === 'US' ? getUSEasternTime() : getHKTime();
    return formatDateStr(now);
}

function isPredictionFreshForToday(stock: StockData): boolean {
    const market = getMarketFromSymbol(stock.symbol);
    const today = getTodayByMarket(market);
    return stock.prediction?.date === today;
}

function getMarketsFromStocks(stocks: StockData[]): MarketType[] {
    const markets = new Set<MarketType>();
    for (const s of stocks) markets.add(getMarketFromSymbol(s.symbol));
    return Array.from(markets);
}

function hasPostMarketOpenForAny(stocks: StockData[]): boolean {
    const markets = getMarketsFromStocks(stocks);
    return markets.some((m) => getMarketScene(m) === 'post_market' && isTradingDay(undefined, m));
}

function arePredictionsFreshForToday(stocks: StockData[]): boolean {
    return stocks.length > 0 && stocks.every(isPredictionFreshForToday);
}

function shouldPollBatch(stocks: StockData[]): boolean {
    if (!hasPostMarketOpenForAny(stocks)) return false;
    return !arePredictionsFreshForToday(stocks);
}

function shouldCheckPredictionVersions(stocks: StockData[]): boolean {
    if (stocks.length === 0) return false;
    if (!hasPostMarketOpenForAny(stocks)) return false;
    return arePredictionsFreshForToday(stocks);
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
        if (error.message.includes('Batch API failed: 500')) {
            return error.message.replace('Batch API failed: 500', '500');
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

function buildBatchUrl(symbols: string, historyLimit: number, predictionContentLocale: string): string {
    const params = new URLSearchParams({
        symbols,
        historyLimit: String(historyLimit),
        locale: predictionContentLocale,
        _t: String(Date.now())
    });

    return `/api/stock/batch?${params.toString()}`;
}

const DEFAULT_HISTORY_LIMIT = 5;

export function useDashboardData(
    watchlist: WatchlistItem[],
    loadingWatchlist: boolean,
    historyLimit: number = DEFAULT_HISTORY_LIMIT,
    priceOnlyRefresh = false,
    enableAlmanac = true
) {
    const { locale: appLocale } = useLocale();
    const { userId } = useUserProfile();
    const predictionContentLocale = appLocaleToPredictionContentLocale(appLocale);
    const dashboardCacheStorageKey = getDashboardCacheStorageKey(userId, predictionContentLocale);

    const [stocks, setStocks] = useState<StockData[]>([]);
    const [almanac, setAlmanac] = useState<MarketAlmanacData | null>(null);
    const [almanacs, setAlmanacs] = useState<MarketAlmanacData[]>([]);
    const [loadingPool, setLoadingPool] = useState(true);
    const [isLocaleSwitching, setIsLocaleSwitching] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
    const [lastRefreshError, setLastRefreshError] = useState<string | null>(null);

    const lastFetchTimeRef = useRef<number>(0);
    const fetchGenRef = useRef<number>(0);
    const activeLocaleRef = useRef<string>(predictionContentLocale);
    const predictionVersionCheckInFlightRef = useRef(false);
    const stocksRef = useRef<StockData[]>(stocks);
    const almanacRef = useRef<MarketAlmanacData | null>(almanac);
    const almanacsRef = useRef<MarketAlmanacData[]>(almanacs);

    // Sync ref with state
    useEffect(() => {
        stocksRef.current = stocks;
    }, [stocks]);

    useEffect(() => {
        almanacRef.current = almanac;
    }, [almanac]);

    useEffect(() => {
        almanacsRef.current = almanacs;
    }, [almanacs]);

    const priceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastPriceRefreshTimeRef = useRef<number>(0);
    const broadcastFailureStreakRef = useRef<number>(0);
    const broadcastCircuitOpenUntilRef = useRef<number>(0);
    const lastFallbackEventAtRef = useRef<number>(0);
    const lastRecoveryEventAtRef = useRef<number>(0);

    const shouldThrottlePredictionVersionCheck = useCallback(() => {
        const now = Date.now();
        try {
            const lastCheckAt = Number(localStorage.getItem(PREDICTION_VERSION_CHECK_KEY) || '0');
            if (lastCheckAt > 0 && now - lastCheckAt < PREDICTION_VERSION_CHECK_INTERVAL) {
                return true;
            }
            localStorage.setItem(PREDICTION_VERSION_CHECK_KEY, String(now));
            return false;
        } catch {
            return false;
        }
    }, []);

    const checkPredictionVersionDrift = useCallback(async (): Promise<boolean> => {
        if (predictionVersionCheckInFlightRef.current) return false;
        if (!shouldCheckPredictionVersions(stocksRef.current)) return false;
        if (watchlist.length === 0) return false;
        if (shouldThrottlePredictionVersionCheck()) return false;

        predictionVersionCheckInFlightRef.current = true;
        try {
            const params = new URLSearchParams({
                symbols: watchlist.map((w) => w.symbol).join(','),
                _t: String(Date.now()),
            });
            const res = await fetch(`/api/stock/prediction-versions?${params.toString()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (!res.ok) return false;

            const body = await res.json() as {
                items?: Array<{ symbol?: string; date?: string; target_date?: string; updated_at?: string }>;
            };
            const remoteMap = new Map(
                (body.items || [])
                    .filter((item): item is { symbol: string; date?: string; target_date?: string; updated_at?: string } => typeof item?.symbol === 'string')
                    .map((item) => [item.symbol, item])
            );

            return stocksRef.current.some((stock) => {
                const localPrediction = stock.prediction;
                const remotePrediction = remoteMap.get(stock.symbol);
                if (!localPrediction || !remotePrediction) return false;

                return (
                    localPrediction.date !== remotePrediction.date ||
                    localPrediction.target_date !== remotePrediction.target_date ||
                    (localPrediction.updated_at || '') !== (remotePrediction.updated_at || '')
                );
            });
        } catch (error) {
            console.warn('[Dashboard] Prediction version check failed:', error);
            return false;
        } finally {
            predictionVersionCheckInFlightRef.current = false;
        }
    }, [shouldThrottlePredictionVersionCheck, watchlist]);

    const hydrateFromCache = useCallback((storageKey: string, locale: string): boolean => {
        try {
            const cached = localStorage.getItem(storageKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                const { data, timestamp } = parsed;
                if (typeof parsed.contentLocale === 'string' && parsed.contentLocale !== locale) {
                    return false;
                }
                const age = Date.now() - timestamp;

                // 只有未过期的缓存才使用 (24小时)
                if (age < CACHE_TTL && Array.isArray(data) && data.length > 0) {
                    console.log(`🚀 Loaded ${data.length} stocks from local cache (${Math.round(age / 60000)}m ago)`);
                    setStocks(data);
                    setLastRefreshTime(new Date(timestamp));

                    // 兼容性尝试性加载：即便缓存是 v1 版本的（没有 almanac），也不影响 stocks 的展示
                    if (enableAlmanac) {
                        if (parsed.almanac) setAlmanac(parsed.almanac);
                        if (parsed.almanacs) setAlmanacs(parsed.almanacs);
                    }

                    // 【核心回归】只要股票恢复了，立即关掉骨架屏进入 App
                    setLoadingPool(false);
                    reportLocaleSwitchEvent('locale_switch_cache_hit', {
                        locale,
                        userId: userId || 'anonymous',
                        stocks: data.length,
                        cacheAgeMs: age,
                    });
                    return true;
                }
            }
            reportLocaleSwitchEvent('locale_switch_cache_miss', { locale });
        } catch (e) {
            console.error('Cache load error', e);
            reportLocaleSwitchEvent('locale_switch_cache_miss', { locale, reason: 'cache_parse_error' });
        }
        return false;
    }, [enableAlmanac, userId]);

    // 1. 初始化：尝试从本地缓存读取，实现【秒开】
    useEffect(() => {
        void hydrateFromCache(dashboardCacheStorageKey, predictionContentLocale);
    }, [dashboardCacheStorageKey, hydrateFromCache, predictionContentLocale]);

    // stock-pool 上的 name / name_en 为权威；缓存秒开或乐观 add 可能缺 name_en，随 watchlist 修正
    useEffect(() => {
        if (watchlist.length === 0) return;
        setStocks((prev) => {
            const w = new Map(watchlist.map((i) => [i.symbol, i]));
            let changed = false;
            const next = prev.map((s) => {
                const item = w.get(s.symbol);
                if (!item) return s;
                const nameNext = item.name;
                const nameEnNext = item.name_en !== undefined ? item.name_en ?? null : s.name_en;
                if (s.name === nameNext && s.name_en === nameEnNext) return s;
                changed = true;
                return { ...s, name: nameNext, name_en: nameEnNext };
            });
            return changed ? next : prev;
        });
    }, [watchlist]);

    useEffect(() => {
        if (!enableAlmanac) {
            setAlmanac(null);
            setAlmanacs([]);
        }
    }, [enableAlmanac]);

    const remapStocksToWatchlist = useCallback((sourceStocks: StockData[] = stocksRef.current) => {
        if (watchlist.length === 0) {
            if (!loadingWatchlist) {
                setStocks([]);
            }
            return;
        }

        const remapped = watchlist.map(item => {
            const existing = sourceStocks.find(s => s.symbol === item.symbol);
            if (existing) return existing;
            return {
                symbol: item.symbol,
                name: item.name,
                name_en: item.name_en,
                price: null,
                change: 0,
                lastUpdated: '...',
                history: [],
                loading: true,
                prediction: null,
                previousPrediction: null,
                rule: null
            } as StockData;
        });

        setStocks(remapped);
    }, [loadingWatchlist, watchlist]);

    const hasMissingWatchlistSymbols = useCallback(() => {
        const watchSymbols = new Set(watchlist.map((item) => item.symbol));
        const stockSymbols = new Set((stocksRef.current || []).map((stock) => stock.symbol));

        for (const symbol of watchSymbols) {
            if (!stockSymbols.has(symbol)) {
                return true;
            }
        }

        return false;
    }, [watchlist]);

    const isHistorySatisfied = useCallback(() => {
        return (stocksRef.current || []).every((stock) => (stock.history?.length || 0) >= historyLimit);
    }, [historyLimit]);

    const loadAllData = useCallback(async (silent = false, ignoreDebounce = false): Promise<boolean> => {
        // 如果 watchlist 还在加载中，跳过
        if (loadingWatchlist && watchlist.length === 0) {
            setLastRefreshError('等待自选池恢复');
            return false;
        }

        // 如果没有股票，清空 (但不能 return，因为仍然需要去拉取公共的 Market Almanac)
        if (watchlist.length === 0) {
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
            if (watchlist.length !== stocksRef.current.length) {
                // Fallback: Local re-map using existing data + new placeholder
                const remapped = watchlist.map(item => {
                    const existing = stocksRef.current.find(s => s.symbol === item.symbol);
                    if (existing) return existing;
                    return {
                        symbol: item.symbol, name: item.name, name_en: item.name_en, price: null,
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
        const gen = ++fetchGenRef.current;
        const requestLocale = predictionContentLocale;

        if (!silent) {
            setIsRefreshing(true);
            setLastRefreshError(null);
        }

        try {
            const startTime = performance.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort('请求超时 (12s)'), 12000); // 12s timeout

            // Step 1: Fetch Shared Almanac context (Stage 1, pro/alpha only)
            const fetchAlmanac = async () => {
                if (!enableAlmanac) return null;
                const almanacController = new AbortController();
                const almanacTimeoutId = setTimeout(() => almanacController.abort(), 3000);
                try {
                    const res = await fetch('/api/shared/almanac', {
                        signal: almanacController.signal,
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.almanacs) setAlmanacs(data.almanacs);
                        if (data.almanac) setAlmanac(data.almanac);
                        return data;
                    }
                } catch (e) {
                    console.warn('[Dashboard] Shared Almanac fetch failed, continuing...', e);
                } finally {
                    clearTimeout(almanacTimeoutId);
                }
                return null;
            };

            // Step 2: Ensure User Identity in background
            getCurrentUser().catch(err => console.error('Background user sync error:', err));

            // Step 3: Fetch Batch Stock Data (Stage 2)
            const symbols = watchlist.map(w => w.symbol).join(',');
            const url = buildBatchUrl(symbols, historyLimit, requestLocale);

            const fetchOptions: RequestInit = {
                signal: controller.signal,
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            };

            // Execute Stage 1 in background so Almanac failure/latency never blocks stocks.
            if (enableAlmanac) {
                void fetchAlmanac();
            }

            let batchRes = await fetch(url, fetchOptions);
            if (batchRes.status === 401) {
                await getCurrentUser({ forceSessionSync: true });
                batchRes = await fetch(buildBatchUrl(symbols, historyLimit, requestLocale), fetchOptions);
            }
            clearTimeout(timeoutId);

            if (!batchRes.ok) {
                let errorDetail = '';
                try {
                    const errorBody = await batchRes.json();
                    const code = typeof errorBody?.debugCode === 'string' ? errorBody.debugCode : null;
                    const requestId = typeof errorBody?.requestId === 'string' ? errorBody.requestId : null;
                    const message = typeof errorBody?.debugMessage === 'string' ? errorBody.debugMessage : null;
                    const parts = [code, message, requestId].filter(Boolean);
                    if (parts.length > 0) {
                        errorDetail = ` (${parts.join(' | ')})`;
                    }
                } catch {
                    const headerRequestId = batchRes.headers.get('X-Stockwise-Request-Id');
                    if (headerRequestId) {
                        errorDetail = ` (${headerRequestId})`;
                    }
                }
                throw new Error(`Batch API failed: ${batchRes.status}${errorDetail}`);
            }

            const batchData = await batchRes.json();
            if (batchData.error) { throw new Error(batchData.error); }

            const fetchTime = Math.round(performance.now() - startTime);
            console.log(`📊 Dashboard loaded: ${watchlist.length} stocks in ${fetchTime}ms`);

            // Merge Watchlist with Batch Data
            const validResults = watchlist.map(item => {
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
                    name_en: item.name_en,
                    price: base.price,
                    prediction: base.prediction,
                    previousPrediction: base.previousPrediction,
                    lastUpdated: base.lastUpdated || '--:--',
                    history: base.history || [],
                    hasMoreHistory: base.hasMoreHistory ?? undefined,
                    shortMetrics: base.shortMetrics || null,
                    rule: getRule(item.symbol),
                    loading: false,
                    justUpdated: silent
                } as StockData;
            });

            // Discard stale response: a newer loadAllData was triggered while
            // this one was in flight (e.g. lite→full historyLimit transition).
            if (gen !== fetchGenRef.current || requestLocale !== activeLocaleRef.current) {
                reportLocaleSwitchEvent('locale_switch_stale_drop', {
                    requestLocale,
                    activeLocale: activeLocaleRef.current,
                    reason: 'response_guard',
                });
                return false;
            }

            setStocks(validResults);
            setLoadingPool(false);
            setLastRefreshTime(new Date());
            setLastRefreshError(null);
            reportLocaleSwitchEvent('locale_switch_finish', {
                locale: requestLocale,
                stocks: validResults.length,
                fetchMs: fetchTime,
            });

            // 💾 写入本地缓存 (后台静默)
            try {
                localStorage.setItem(dashboardCacheStorageKey, JSON.stringify({
                    data: validResults,
                    almanac: enableAlmanac ? almanacRef.current : null,
                    almanacs: enableAlmanac ? almanacsRef.current : [],
                    timestamp: Date.now(),
                    contentLocale: requestLocale,
                    userId: userId || null,
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
            if (gen !== fetchGenRef.current || requestLocale !== activeLocaleRef.current) {
                reportLocaleSwitchEvent('locale_switch_stale_drop', {
                    requestLocale,
                    activeLocale: activeLocaleRef.current,
                    reason: 'error_guard',
                });
                return false;
            }
            console.error('Dashboard fetch error:', e);
            reportLocaleSwitchEvent('locale_switch_error', {
                locale: requestLocale,
                reason: e instanceof Error ? e.message : 'unknown',
            });
            const sessionRecoveryAttempted =
                e instanceof Error && e.message.includes('401');
            setLastRefreshError(formatRefreshError(e, sessionRecoveryAttempted));
            // [Fix] Even on error, we should ensure UI reflects the watchlist
            // If network fails, at least show the items in watchlist with error state
            if (watchlist.length > 0) {
                const fallback = watchlist.map(item => {
                    const existing = stocksRef.current.find(s => s.symbol === item.symbol);
                    return existing || {
                        symbol: item.symbol, name: item.name, name_en: item.name_en, price: null, loading: false,
                        change: 0, lastUpdated: '...', history: [],
                        prediction: null, previousPrediction: null, rule: null
                    } as StockData;
                });
                setStocks(fallback);
            }
            setLoadingPool(false);
            return false;
        } finally {
            if (gen === fetchGenRef.current && requestLocale === activeLocaleRef.current) {
                setIsRefreshing(false);
                setIsLocaleSwitching(false);
            }
        }
    }, [watchlist, loadingWatchlist, historyLimit, enableAlmanac, predictionContentLocale, dashboardCacheStorageKey, userId]);

    const isFirstPredictionLocaleEffectRef = useRef(true);
    const prevPredictionContentLocaleRef = useRef(predictionContentLocale);
    useEffect(() => {
        if (isFirstPredictionLocaleEffectRef.current) {
            isFirstPredictionLocaleEffectRef.current = false;
            activeLocaleRef.current = predictionContentLocale;
            prevPredictionContentLocaleRef.current = predictionContentLocale;
            return;
        }
        if (prevPredictionContentLocaleRef.current === predictionContentLocale) {
            return;
        }
        prevPredictionContentLocaleRef.current = predictionContentLocale;
        if (loadingWatchlist && watchlist.length === 0) return;
        if (watchlist.length === 0) return;
        activeLocaleRef.current = predictionContentLocale;
        fetchGenRef.current += 1;
        reportLocaleSwitchEvent('locale_switch_start', {
            locale: predictionContentLocale,
            watchlistSize: watchlist.length,
        });
        lastFetchTimeRef.current = 0;
        setIsLocaleSwitching(true);
        setLoadingPool(true);
        setStocks([]);
        if (enableAlmanac) {
            setAlmanac(null);
            setAlmanacs([]);
        }
        void hydrateFromCache(dashboardCacheStorageKey, predictionContentLocale);
        void loadAllData(false, true);
    }, [predictionContentLocale, loadingWatchlist, watchlist.length, loadAllData, enableAlmanac, hydrateFromCache, dashboardCacheStorageKey]);

    interface PriceSnapshot {
        symbol: string;
        date: string | null;
        close: number | null;
        change_percent: number | null;
        lastUpdated: string;
    }

    interface BroadcastPriceSnapshot {
        symbol: string;
        lastPrice: number | null;
        changePct: number | null;
        updatedAt: string | null;
    }

    const refreshPrices = useCallback(async (symbols: string[]): Promise<void> => {
        if (symbols.length === 0) return;
        const now = Date.now();
        // 价格层轻量节流：5 秒内的重复刷新跳过，避免首屏/可见性事件叠加导致重复请求
        if (now - lastPriceRefreshTimeRef.current < 5000) {
            return;
        }
        lastPriceRefreshTimeRef.current = now;
        try {
            const shouldUseLegacyOnly = now < broadcastCircuitOpenUntilRef.current;
            const reportBroadcastEvent = async (
                eventType: 'broadcast_circuit_open' | 'legacy_fallback_used' | 'broadcast_recovered',
                reason: string,
                failureStreak: number,
            ): Promise<void> => {
                try {
                    await fetch('/api/ops/broadcast/events', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            eventType,
                            market: 'all',
                            reason,
                            failureStreak,
                            circuitOpenUntil: broadcastCircuitOpenUntilRef.current > 0
                                ? new Date(broadcastCircuitOpenUntilRef.current).toISOString()
                                : null,
                            clientTime: new Date().toISOString(),
                        }),
                    });
                } catch (err) {
                    console.warn('[Dashboard] Failed to report broadcast event:', err);
                }
            };

            const fetchBroadcast = async (): Promise<Map<string, PriceSnapshot> | null> => {
                // 广播端点默认走 all 市场，前端按 watchlist 本地过滤，兼容双市场自选池。
                const res = await fetch('/api/stock/prices/all?market=all', {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' }
                });
                if (!res.ok) return null;
                const data = await res.json() as { items?: BroadcastPriceSnapshot[] };
                if (!data.items || !Array.isArray(data.items)) return null;

                const map = new Map<string, PriceSnapshot>();
                for (const p of data.items) {
                    if (p && typeof p.symbol === 'string') {
                        map.set(p.symbol, {
                            symbol: p.symbol,
                            date: p.updatedAt,
                            close: p.lastPrice,
                            change_percent: p.changePct,
                            lastUpdated: p.updatedAt || '--:--'
                        });
                    }
                }
                return map;
            };

            const fetchLegacy = async (): Promise<Map<string, PriceSnapshot> | null> => {
                const params = new URLSearchParams({ symbols: symbols.join(',') });
                const res = await fetch(`/api/stock/prices?${params.toString()}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' }
                });
                if (!res.ok) return null;
                const data = await res.json() as { prices?: PriceSnapshot[] };
                if (!data.prices || !Array.isArray(data.prices)) return null;
                const map = new Map<string, PriceSnapshot>();
                for (const p of data.prices) {
                    if (p && typeof p.symbol === 'string') {
                        map.set(p.symbol, p);
                    }
                }
                return map;
            };

            let map: Map<string, PriceSnapshot> | null = null;

            if (!shouldUseLegacyOnly) {
                map = await fetchBroadcast();
                if (map && map.size > 0) {
                    // 广播恢复成功，清空失败计数与熔断状态。
                    if (
                        broadcastFailureStreakRef.current > 0 &&
                        now - lastRecoveryEventAtRef.current > 60_000
                    ) {
                        lastRecoveryEventAtRef.current = now;
                        void reportBroadcastEvent('broadcast_recovered', 'broadcast_fetch_ok', broadcastFailureStreakRef.current);
                    }
                    broadcastFailureStreakRef.current = 0;
                    broadcastCircuitOpenUntilRef.current = 0;
                } else {
                    broadcastFailureStreakRef.current += 1;
                    if (broadcastFailureStreakRef.current >= BROADCAST_FAILURE_THRESHOLD) {
                        broadcastCircuitOpenUntilRef.current = Date.now() + BROADCAST_CIRCUIT_BREAKER_MS;
                        console.warn(
                            `[Dashboard] Broadcast circuit open for ${BROADCAST_CIRCUIT_BREAKER_MS / 1000}s after ${broadcastFailureStreakRef.current} failures`,
                        );
                        if (now - lastFallbackEventAtRef.current > 60_000) {
                            lastFallbackEventAtRef.current = now;
                            void reportBroadcastEvent('broadcast_circuit_open', 'broadcast_empty_or_failed', broadcastFailureStreakRef.current);
                        }
                    }
                    map = await fetchLegacy();
                    if (broadcastFailureStreakRef.current > 0 && now - lastFallbackEventAtRef.current > 60_000) {
                        lastFallbackEventAtRef.current = now;
                        void reportBroadcastEvent('legacy_fallback_used', 'broadcast_fetch_failed', broadcastFailureStreakRef.current);
                    }
                }
            } else {
                map = await fetchLegacy();
                if (now - lastFallbackEventAtRef.current > 60_000) {
                    lastFallbackEventAtRef.current = now;
                    void reportBroadcastEvent('legacy_fallback_used', 'broadcast_circuit_open', broadcastFailureStreakRef.current);
                }
            }

            if (!map || map.size === 0) return;

            setStocks(prev => prev.map(s => {
                const p = map.get(s.symbol);
                if (!p) return s;

                const existingPrice = s.price;

                // 仅在已有价格快照的基础上更新 close / change_percent，避免构造不完整的 DailyPrice。
                if (!existingPrice) {
                    return {
                        ...s,
                        lastUpdated: p.lastUpdated || s.lastUpdated
                    };
                }

                const close = typeof p.close === 'number'
                    ? p.close
                    : existingPrice.close;
                const changePercent = typeof p.change_percent === 'number'
                    ? p.change_percent
                    : (existingPrice as unknown as { change_percent?: number }).change_percent ?? existingPrice.change_percent;

                const nextPrice = {
                    ...existingPrice,
                    close,
                    change_percent: changePercent
                };

                return {
                    ...s,
                    price: nextPrice,
                    lastUpdated: p.lastUpdated || s.lastUpdated
                };
            }));
        } catch (e) {
            console.warn('[Dashboard] Price refresh failed:', e);
        }
    }, []);

    const runRefreshEvent = useCallback(async (event: DashboardRefreshEvent): Promise<void> => {
        const plan = getDashboardRefreshPlan(event, {
            hasWatchlist: watchlist.length > 0,
            loadingWatchlist,
            hasMissingSymbols: hasMissingWatchlistSymbols(),
            shouldPollBatch: shouldPollBatch(stocksRef.current),
            shouldCheckPredictionDrift: shouldCheckPredictionVersions(stocksRef.current),
            historySatisfied: isHistorySatisfied(),
            priceOnlyRefresh,
        });

        if (plan.dashboard === 'force') {
            await loadAllData(false, true);
        } else if (plan.dashboard === 'silent') {
            await loadAllData(true);
        } else if (plan.dashboard === 'remap') {
            remapStocksToWatchlist();
        }

        if (plan.checkPredictionDrift) {
            const hasDrift = await checkPredictionVersionDrift();
            if (hasDrift) {
                await loadAllData(true, true);
            }
        }

        if (plan.prices === 'refresh') {
            const symbols = watchlist.map((item) => item.symbol);
            if (symbols.length > 0) {
                await refreshPrices(symbols);
            }
        }
    }, [
        checkPredictionVersionDrift,
        hasMissingWatchlistSymbols,
        isHistorySatisfied,
        loadAllData,
        loadingWatchlist,
        priceOnlyRefresh,
        refreshPrices,
        remapStocksToWatchlist,
        watchlist,
    ]);

    // 价格层定时刷新（高频）
    // 首次价格数据由 batch 端点返回，无需在 mount 时额外调用 refreshPrices。
    // 仅启动周期定时器，首次独立价格刷新在第一个 interval 后触发。
    useEffect(() => {
        const symbols = watchlist.map(w => w.symbol);
        if (symbols.length === 0) {
            if (priceIntervalRef.current) {
                clearInterval(priceIntervalRef.current);
                priceIntervalRef.current = null;
            }
            return;
        }

        if (priceIntervalRef.current) {
            clearInterval(priceIntervalRef.current);
        }
        const markets = watchlist.map((w) => getMarketFromSymbol(w.symbol));
        const isAnyMarketTrading = markets.some((m) => getMarketScene(m) === 'trading');
        const interval = isAnyMarketTrading
            ? TRADING_PRICE_REFRESH_INTERVAL
            : DEFAULT_PRICE_REFRESH_INTERVAL;
        priceIntervalRef.current = setInterval(() => {
            refreshPrices(symbols);
        }, interval);

        return () => {
            if (priceIntervalRef.current) {
                clearInterval(priceIntervalRef.current);
                priceIntervalRef.current = null;
            }
        };
    }, [watchlist, refreshPrices]);

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
            const hp = new URLSearchParams({
                symbol,
                offset: String(offset),
                limit: '10',
                locale: predictionContentLocale,
            });
            const res = await fetch(`/api/history?${hp.toString()}`);
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
    }, [predictionContentLocale]);

    return {
        stocks,
        almanac,
        almanacs,
        setStocks,
        runRefreshEvent,
        loadingPool,
        isLocaleSwitching,
        isRefreshing,
        lastRefreshTime,
        lastRefreshError,
        refresh: manualRefresh,
        loadMoreHistory
    };
}
