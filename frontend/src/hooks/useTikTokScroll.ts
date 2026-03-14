'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { StockData } from '@/lib/types';

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
    const searchParams = useSearchParams();
    const targetSymbol = searchParams.get('symbol');
    const hasAutoScrolled = useRef(false);
    const stockCount = stocks.length;

    // 边缘过滑检测
    const touchStartX = useRef<number>(0);
    const isAtRightEdge = useRef<boolean>(false);
    const isAtLeftEdge = useRef<boolean>(true);  // 默认在左边缘

    const getNearestIndex = useCallback((container: HTMLDivElement, scrollLeft: number) => {
        const children = Array.from(container.children) as HTMLElement[];
        if (children.length === 0) return 0;

        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        children.forEach((child, index) => {
            const distance = Math.abs(child.offsetLeft - scrollLeft);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });

        return nearestIndex;
    }, []);

    // 处理横向滚动 (切股)
    const handleScroll = useCallback(() => {
        const container = scrollRef.current;
        if (!container) return;
        const scrollLeft = container.scrollLeft;
        const width = container.clientWidth;
        const scrollWidth = container.scrollWidth;

        if (width <= 0) return;

        // 1. 索引切换逻辑：不要依赖 scrollLeft / width 的理想模型。
        // Android 上在连续多页 snap 后可能出现累计偏差，改为按真实子元素 offsetLeft 找最近页。
        const newIndex = Math.max(0, Math.min(getNearestIndex(container, scrollLeft), stocks.length - 1));

        if (newIndex !== currentIndex) {
            setCurrentIndex(newIndex);
        }

        // 2. 稳定态（吸附）检测：对准最近子页的真实 offsetLeft，而不是假设每页宽度完全相等。
        const children = container.children;
        const targetLeft = children[newIndex] instanceof HTMLElement ? (children[newIndex] as HTMLElement).offsetLeft : newIndex * width;
        const stable = Math.abs(scrollLeft - targetLeft) < 2;
        if (stable !== isSnapped) {
            setIsSnapped(stable);
        }

        // 3. 边界检测
        const maxScrollLeft = scrollWidth - width;
        isAtRightEdge.current = scrollLeft >= maxScrollLeft - 5;
        isAtLeftEdge.current = scrollLeft <= 5;
    }, [currentIndex, getNearestIndex, isSnapped, stocks.length]);

    // 处理触摸开始
    const handleTouchStart = useCallback((e: TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    }, []);

    // 处理触摸结束 - 检测过滑
    const handleTouchEnd = useCallback((e: TouchEvent) => {
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

        const sourceLayer = previousStock?.isAlmanac
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
    useLayoutEffect(() => {
        const container = scrollRef.current;
        if (targetSymbol && stockCount > 0 && container && !hasAutoScrolled.current) {
            const index = stocks.findIndex(s => s.symbol === targetSymbol || s.symbol.endsWith(targetSymbol));
            if (index !== -1) {
                hasAutoScrolled.current = true;

                // 1. 同步更新索引，确保背景色等 UI 状态立即对齐
                setCurrentIndex(index);

                // 2. 立即执行物理滚动，消除 setTimeout 导致的视觉延迟
                // 在极少数情况下 clientWidth 可能由于渲染未完成为 0，添加兜底逻辑
                const width = container.clientWidth || window.innerWidth;
                container.scrollTo({
                    left: index * width,
                    behavior: 'instant'
                });

                // 3. 稳健性兜底：针对某些浏览器内核可能的渲染延迟，在下一帧再次校准
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
    }, [stockCount, targetSymbol, stocks]);

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
        positionRequest: positionRequests[stocks[currentIndex]?.symbol || ''] || null
    };
}
