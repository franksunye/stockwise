'use client';

import { useEffect } from 'react';

/**
 * PerformanceOptimizer
 * 
 * 这是一个静默组件，负责检测当前运行平台。
 * 如果是 Android 设备，它会在 document.body 上添加 'is-android' 类，
 * 用于全局 CSS 和组件层面的性能降级。
 */
export function PerformanceOptimizer() {
    useEffect(() => {
        const ua = navigator.userAgent;
        const isAndroid = /Android/i.test(ua);
        
        if (isAndroid) {
            document.body.classList.add('is-android');
            console.log('🚀 StockWise AI: Android detected, enabling high performance mode.');
        } else {
            document.body.classList.remove('is-android');
        }
    }, []);

    return null;
}
