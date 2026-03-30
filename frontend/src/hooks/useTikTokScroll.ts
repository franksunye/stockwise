'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { StockData } from '@/lib/types';
import { clearDashboardNavIntentSymbol, readDashboardNavIntentSymbol, resolveDashboardPreferredSymbol } from '@/lib/dashboard-symbol-navigation';

export interface VerticalLayerState {
    type: 'today' | 'history';
    date: string | null;
}

export interface VerticalPositionRequest {
    nonce: number;
    type: 'today' | 'history';
    date: string | null;
}

interface UseTikTokScrollOptions {
    onOverscrollRight?: () => void;  // 在最后一个股票继续左滑时触发
    onOverscrollLeft?: () => void;   // 在第一个股票继续右滑时触发
    preferredSymbol?: string | null;
}

export function useTikTokScroll(stocks: StockData[], options?: UseTikTokScrollOptions) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [yPositions, setYPositions] = useState<Record<string, number>>({});
    const [layerStates, setLayerStates] = useState<Record<string, VerticalLayerState>>({});
    const [positionRequests, setPositionRequests] = useState<Record<string, VerticalPositionRequest>>({});
    const [backToTopCounter, setBackToTopCounter] = useState(0);
    const [isSnapped, setIsSnapped] = useState(true);
    const isReturningToTop = useRef(false);
    const previousIndexRef = useRef(0);
    const positionNonceRef = useRef(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const pageOffsetsRef = useRef<number[]>([]);
    const viewportWidthRef = useRef(0);
    const maxScrollLeftRef = useRef(0);
    const navIntentSymbol = useRef<string | null | undefined>(undefined);
    const hasAutoScrolled = useRef(false);
    const isInteracting = useRef(false); // 新增：记录用户是否正在交互
    const stockCount = stocks.length;
    const preferredSymbol = options && 'preferredSymbol' in options ? (options as UseTikTokScrollOptions & { preferredSymbol?: string | null }).preferredSymbol : null;

    // 边缘过滑检测
    const touchStartX = useRef<number>(0);
    const isAtRightEdge = useRef<boolean>(false);
    const isAtLeftEdge = useRef<boolean>(true);  // 默认在左边缘

    const refreshHorizontalMetrics = useCallback(() => {
        const container = scrollRef.current;
        if (!container) {
            pageOffsetsRef.current = [];
            viewportWidthRef.current = 0;
            maxScrollLeftRef.current = 0;
            return;
        }

        const children = Array.from(container.children) as HTMLElement[];
        pageOffsetsRef.current = children.map(child => child.offsetLeft);
        viewportWidthRef.current = container.clientWidth;
        maxScrollLeftRef.current = Math.max(container.scrollWidth - container.clientWidth, 0);
    }, []);

    const getNearestIndex = useCallback((scrollLeft: number) => {
        const offsets = pageOffsetsRef.current;
        const width = viewportWidthRef.current;

        if (offsets.length === 0) return 0;
        if (width <= 0) return 0;

        // Start from the ideal page index, then only compare nearby cached pages.
        const approximateIndex = Math.max(0, Math.min(Math.round(scrollLeft / width), offsets.length - 1));
        let nearestIndex = approximateIndex;
        let nearestDistance = Math.abs(offsets[approximateIndex] - scrollLeft);

        for (let index = Math.max(0, approximateIndex - 1); index <= Math.min(offsets.length - 1, approximateIndex + 1); index += 1) {
            const distance = Math.abs(offsets[index] - scrollLeft);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        }

        return nearestIndex;
    }, []);

    useEffect(() => {
        refreshHorizontalMetrics();

        const container = scrollRef.current;
        if (!container || typeof ResizeObserver === 'undefined') return;

        const observer = new ResizeObserver(() => {
            refreshHorizontalMetrics();
        });

        observer.observe(container);
        Array.from(container.children).forEach(child => observer.observe(child));

        return () => observer.disconnect();
    }, [refreshHorizontalMetrics, stockCount]);

    // 处理横向滚动 (切股)
    const handleScroll = useCallback(() => {
        const container = scrollRef.current;
        if (!container) return;
        const scrollLeft = container.scrollLeft;
        const width = viewportWidthRef.current || container.clientWidth;

        if (width <= 0) return;

        // 1. 索引切换逻辑：仍按真实页偏移计算，但只读取预缓存布局，避免 scroll 中同步 layout thrash。
        const newIndex = Math.max(0, Math.min(getNearestIndex(scrollLeft), stocks.length - 1));

        if (newIndex !== currentIndex) {
            setCurrentIndex(newIndex);
        }

        // 2. 稳定态（吸附）检测：同样基于缓存的目标页偏移。
        const targetLeft = pageOffsetsRef.current[newIndex] ?? (newIndex * width);
        const stable = Math.abs(scrollLeft - targetLeft) < 2;
        if (stable !== isSnapped) {
            setIsSnapped(stable);
        }

        // 3. 边界检测
        const maxScrollLeft = maxScrollLeftRef.current || Math.max(container.scrollWidth - width, 0);
        isAtRightEdge.current = scrollLeft >= maxScrollLeft - 5;
        isAtLeftEdge.current = scrollLeft <= 5;
    }, [currentIndex, getNearestIndex, isSnapped, stocks.length]);

    // 处理触摸开始
    const handleTouchStart = useCallback((e: TouchEvent) => {
        isInteracting.current = true;
        touchStartX.current = e.touches[0].clientX;
    }, []);

    // 处理触摸结束 - 检测过滑
    const handleTouchEnd = useCallback((e: TouchEvent) => {
        isInteracting.current = false;
        const touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchStartX.current - touchEndX;

        // 如果在右边缘继续左滑超过 80px，触发回调（打开个人中心）
        if (isAtRightEdge.current && options?.onOverscrollRight && deltaX > 80) {
            options.onOverscrollRight();
            return;
        }

        // 如果在左边缘继续右滑超过 80px，触发回调（打开添加股票）
        if (isAtLeftEdge.current && options?.onOverscrollLeft && deltaX < -80) {
            options.onOverscrollLeft();
            return;
        }
    }, [options]);

    // 绑定触摸事件
    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        container.addEventListener('touchstart', handleTouchStart, { passive: true });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchEnd]);

    // 处理纵向滚动 (复盘)
    const handleVerticalScroll = useCallback((top: number, symbol: string) => {
        // 如果正在回弹过程中，且高度还没归零，则忽略更新以防止按钮闪烁
        if (isReturningToTop.current) {
            if (top <= 0) isReturningToTop.current = false;
            return;
        }

        setYPositions(prev => {
            if (prev[symbol] === top) return prev;
            return { ...prev, [symbol]: top };
        });
    }, []);

    const handleVerticalLayerChange = useCallback((symbol: string, layer: VerticalLayerState) => {
        setLayerStates(prev => {
            const current = prev[symbol];
            if (current?.type === layer.type && current?.date === layer.date) {
                return prev;
            }
            return { ...prev, [symbol]: layer };
        });
    }, []);

    // 触发回到当前股票的"今天"界面
    const scrollToToday = () => {
        isReturningToTop.current = true; // 开启回弹锁
        setBackToTopCounter(prev => prev + 1);
        const currentSymbol = stocks[currentIndex]?.symbol;
        if (!currentSymbol) return;
        setYPositions(prev => ({ ...prev, [currentSymbol]: 0 }));
        setLayerStates(prev => ({ ...prev, [currentSymbol]: { type: 'today', date: null } }));
    };

    useEffect(() => {
        const previousIndex = previousIndexRef.current;
        if (previousIndex === currentIndex) return;

        const previousStock = stocks[previousIndex] as StockData & { isAlmanac?: boolean };
        const currentStock = stocks[currentIndex] as StockData & { isAlmanac?: boolean };

        previousIndexRef.current = currentIndex;

        if (currentStock?.isAlmanac) return;
        if (!currentStock?.symbol) return;

        const sourceLayer: VerticalLayerState = previousStock?.isAlmanac
            ? { type: 'today', date: null }
            : (layerStates[previousStock?.symbol || ''] || { type: 'today', date: null });

        const nextRequest: VerticalPositionRequest = {
            nonce: ++positionNonceRef.current,
            type: sourceLayer.type,
            date: sourceLayer.date
        };

        setPositionRequests(prev => ({ ...prev, [currentStock.symbol]: nextRequest }));
    }, [currentIndex, layerStates, stocks]);

    // 处理从股票池跳转过来的定位逻辑
    // 使用 ref 而非 useState 读取 sessionStorage，避免 SSR/hydration 状态不一致：
    // Server 端无 window → null，Client 端 hydration 可能读到 symbol → mismatch。
    // ref 不参与 React 渲染树比对，彻底消除跨平台 hydration 风险。
    useLayoutEffect(() => {
        if (navIntentSymbol.current === undefined) {
            navIntentSymbol.current = readDashboardNavIntentSymbol();
        }

        const target = resolveDashboardPreferredSymbol({
            searchSymbol: preferredSymbol,
            navIntentSymbol: navIntentSymbol.current,
            availableSymbols: stocks.map(stock => stock.symbol),
        });
        const container = scrollRef.current;
        if (target && stockCount > 0 && container && !hasAutoScrolled.current) {
            const index = stocks.findIndex(s => s.symbol === target || s.symbol.endsWith(target));
            if (index !== -1) {
                hasAutoScrolled.current = true;

                setCurrentIndex(index);
                clearDashboardNavIntentSymbol();

                const width = container.clientWidth || window.innerWidth;
                container.scrollTo({
                    left: index * width,
                    behavior: 'instant'
                });

                const timer = setTimeout(() => {
                    if (container.scrollLeft !== index * container.clientWidth) {
                        container.scrollTo({
                            left: index * container.clientWidth,
                            behavior: 'instant'
                        });
                    }
                }, 0);

                return () => clearTimeout(timer);
            }
        }
    }, [preferredSymbol, stockCount, stocks]);

    return {
        currentIndex,
        setCurrentIndex,
        scrollRef,
        handleScroll,
        // 关键：只有在吸附状态且滚动超过阈值时，才认为 yScrollPosition 有效
        yScrollPosition: isSnapped ? (yPositions[stocks[currentIndex]?.symbol || ''] || 0) : 0,
        handleVerticalScroll,
        handleVerticalLayerChange,
        backToTopCounter,
        scrollToToday,
        isInteracting: isInteracting.current,
        positionRequest: positionRequests[stocks[currentIndex]?.symbol || ''] || null
    };
}
