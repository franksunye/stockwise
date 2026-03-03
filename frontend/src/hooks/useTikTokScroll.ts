'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { StockData } from '@/lib/types';

interface UseTikTokScrollOptions {
    onOverscrollRight?: () => void;  // 在最后一个股票继续左滑时触发
    onOverscrollLeft?: () => void;   // 在第一个股票继续右滑时触发
}

export function useTikTokScroll(stocks: StockData[], options?: UseTikTokScrollOptions) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [yPositions, setYPositions] = useState<{ [index: number]: number }>({});
    const [backToTopCounter, setBackToTopCounter] = useState(0);
    const [isSnapped, setIsSnapped] = useState(true);
    const isReturningToTop = useRef(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();
    const targetSymbol = searchParams.get('symbol');
    const hasAutoScrolled = useRef(false);

    // 边缘过滑检测
    const touchStartX = useRef<number>(0);
    const isAtRightEdge = useRef<boolean>(false);
    const isAtLeftEdge = useRef<boolean>(true);  // 默认在左边缘

    // 处理横向滚动 (切股)
    const handleScroll = useCallback(() => {
        if (!scrollRef.current) return;
        const scrollLeft = scrollRef.current.scrollLeft;
        const width = scrollRef.current.clientWidth;
        const scrollWidth = scrollRef.current.scrollWidth;

        if (width <= 0) return;

        // 1. 索引切换逻辑：增加阈值，避免在 50% 位置反复横跳，并严格限制边界防止 iOS 橡皮筋效应导致越界 (-1 或超过长度)
        const fractionalIndex = scrollLeft / width;
        const newIndex = Math.max(0, Math.min(Math.round(fractionalIndex), stocks.length - 1));

        if (newIndex !== currentIndex) {
            setCurrentIndex(newIndex);
        }

        // 2. 稳定态（吸附）检测：只要偏离中心超过 2px，就认为是在滑动中
        const offset = Math.abs((scrollLeft % width + width + width / 2) % width - width / 2);
        const stable = offset < 2;
        if (stable !== isSnapped) {
            setIsSnapped(stable);
        }

        // 3. 边界检测
        const maxScrollLeft = scrollWidth - width;
        isAtRightEdge.current = scrollLeft >= maxScrollLeft - 5;
        isAtLeftEdge.current = scrollLeft <= 5;
    }, [currentIndex, isSnapped, stocks.length]);

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
    const handleVerticalScroll = useCallback((top: number, index: number) => {
        // 如果正在回弹过程中，且高度还没归零，则忽略更新以防止按钮闪烁
        if (isReturningToTop.current) {
            if (top <= 0) isReturningToTop.current = false;
            return;
        }

        setYPositions(prev => {
            if (prev[index] === top) return prev;
            return { ...prev, [index]: top };
        });
    }, []);

    // 触发回到当前股票的"今天"界面
    const scrollToToday = () => {
        isReturningToTop.current = true; // 开启回弹锁
        setBackToTopCounter(prev => prev + 1);
        setYPositions(prev => ({ ...prev, [currentIndex]: 0 }));
    };

    // 处理从股票池跳转过来的定位逻辑
    useEffect(() => {
        const container = scrollRef.current;
        if (targetSymbol && stocks.length > 0 && container && !hasAutoScrolled.current) {
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
    }, [targetSymbol, stocks.filter(s => s.symbol).length, stocks]);

    return {
        currentIndex,
        setCurrentIndex,
        scrollRef,
        handleScroll,
        // 关键：只有在吸附状态且滚动超过阈值时，才认为 yScrollPosition 有效
        yScrollPosition: isSnapped ? (yPositions[currentIndex] || 0) : 0,
        handleVerticalScroll,
        backToTopCounter,
        scrollToToday
    };
}

