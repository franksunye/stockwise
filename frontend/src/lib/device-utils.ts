/**
 * 设备与性能探测工具
 */

export const isAndroid = (): boolean => {
    if (typeof window === 'undefined') return false;
    return /Android/i.test(navigator.userAgent);
};

export const isIOS = (): boolean => {
    if (typeof window === 'undefined') return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/**
 * 判断是否应开启高性能模式（即降低视觉效果）
 * 目前逻辑：Android 设备默认开启高性能模式
 */
export const shouldEnableHighPerformance = (): boolean => {
    return isAndroid();
};
