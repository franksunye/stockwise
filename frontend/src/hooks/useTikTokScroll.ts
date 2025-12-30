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
    const [yScrollPosition, setYScrollPosition] = useState(0);
    const [backToTopCounter, setBackToTopCounter] = useState(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();
    const targetSymbol = searchParams.get('symbol');
    const hasAutoScrolled = useRef(false);

    // 边缘过滑检测
    const touchStartX = useRef<number>(0);
    const isAtRightEdge = useRef<boolean>(false);
    const isAtLeftEdge = useRef<boolean>(true);  // 默认在左边缘

    // 处理横向滚动 (切股)
    const handleScroll = () => {
        if (!scrollRef.current) return;
        const scrollLeft = scrollRef.current.scrollLeft;
        const width = scrollRef.current.clientWidth;
        const scrollWidth = scrollRef.current.scrollWidth;
        const newIndex = Math.round(scrollLeft / width);

        if (newIndex !== currentIndex) {
            setCurrentIndex(newIndex);
        }

        // 检测是否已滑到最右边（最后一个股票）
        const maxScrollLeft = scrollWidth - width;
        isAtRightEdge.current = scrollLeft >= maxScrollLeft - 5; // 5px 容差

        // 检测是否在最左边（第一个股票）
        isAtLeftEdge.current = scrollLeft <= 5; // 5px 容差
    };

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
    const handleVerticalScroll = useCallback((top: number) => {
        setYScrollPosition(top);
    }, []);

    // 触发回到当前股票的"今天"界面
    const scrollToToday = () => {
        setBackToTopCounter(prev => prev + 1);
    };

    // 处理从股票池跳转过来的定位逻辑
    useEffect(() => {
        if (targetSymbol && stocks.length > 0 && scrollRef.current && !hasAutoScrolled.current) {
            const index = stocks.findIndex(s => s.symbol === targetSymbol);
            if (index !== -1) {
                hasAutoScrolled.current = true;
                setCurrentIndex(index);
                const container = scrollRef.current;
                const timer = setTimeout(() => {
                    container.scrollTo({
                        left: index * container.clientWidth,
                        behavior: 'instant'
                    });
                }, 50);
                return () => clearTimeout(timer);
            }
        }
    }, [targetSymbol, stocks.length, stocks]);

    return {
        currentIndex,
        setCurrentIndex,
        scrollRef,
        handleScroll,
        yScrollPosition,
        handleVerticalScroll,
        backToTopCounter,
        scrollToToday
    };
}

