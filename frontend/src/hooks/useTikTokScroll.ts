'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { StockData } from '@/lib/types';

export function useTikTokScroll(stocks: StockData[]) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [yScrollPosition, setYScrollPosition] = useState(0);
    const [backToTopCounter, setBackToTopCounter] = useState(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const searchParams = useSearchParams();
    const targetSymbol = searchParams.get('symbol');
    const hasAutoScrolled = useRef(false);

    // 处理横向滚动 (切股)
    const handleScroll = () => {
        if (!scrollRef.current) return;
        const scrollLeft = scrollRef.current.scrollLeft;
        const width = scrollRef.current.clientWidth;
        const newIndex = Math.round(scrollLeft / width);
        if (newIndex !== currentIndex) {
            setCurrentIndex(newIndex);
        }
    };

    // 处理纵向滚动 (复盘)
    const handleVerticalScroll = useCallback((top: number) => {
        setYScrollPosition(top);
    }, []);

    // 触发回到当前股票的“今天”界面
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
    }, [targetSymbol, stocks.length]);

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
