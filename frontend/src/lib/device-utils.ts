/**
 * 设备与性能探测工具
 */

export const isAndroid = (): boolean => {
    if (typeof window === 'undefined') return false;
    return /Android/i.test(navigator.userAgent);
};

/**
 * 检测是否在微信/企业微信内置浏览器中
 */
export const isWeChat = (): boolean => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent;
    return /MicroMessenger/i.test(ua) || /WxWork/i.test(ua);
};

/**
 * 检测是否已经以 PWA standalone 模式运行（已添加到桌面）
 */
export const isStandalone = (): boolean => {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as unknown as Record<string, unknown>).standalone === true
    );
};

/**
 * 检测是否在 iOS Safari 中（非 standalone，非 Chrome/Edge/Firefox on iOS）
 */
export const isIOSSafari = (): boolean => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent;
    const isIOSDevice = /iPhone|iPad|iPod/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
    return isIOSDevice && isSafari && !isWeChat();
};

/**
 * 检测是否在 Android Chrome/Edge 中（支持 beforeinstallprompt 的浏览器）
 */
export const isAndroidChromium = (): boolean => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent;
    return isAndroid() && /Chrome|Edg/i.test(ua) && !/MicroMessenger|UCBrowser|HuaweiBrowser|MiuiBrowser|MQQBrowser|QQBrowser/i.test(ua);
};

/**
 * 获取中国市场的浏览器品牌标识
 * 返回 null 表示无法识别为主流国产浏览器
 */
export type CNBrowserBrand = 'huawei' | 'xiaomi' | 'uc' | 'quark' | 'qq' | 'sogou' | 'baidu' | null;
export const getCNBrowserBrand = (): CNBrowserBrand => {
    if (typeof window === 'undefined') return null;
    const ua = navigator.userAgent;
    if (/HuaweiBrowser/i.test(ua)) return 'huawei';
    if (/MiuiBrowser/i.test(ua)) return 'xiaomi';
    if (/UCBrowser/i.test(ua)) return 'uc';
    if (/Quark/i.test(ua)) return 'quark';
    if (/MQQBrowser|QQBrowser/i.test(ua)) return 'qq';
    if (/SogouMobileBrowser/i.test(ua)) return 'sogou';
    if (/baiduboxapp|baidubrowser/i.test(ua)) return 'baidu';
    return null;
};

export const isIOS = (): boolean => {
    if (typeof window === 'undefined') return false;
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

/**
 * 检测是否为低端 iOS 设备（iPhone 8 及更早，无 A12 芯片）
 * 这些设备对 spring 动画和 drag 物理计算敏感
 */
const isLowEndIOS = (): boolean => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent;

    // 检测 iPhone 型号 (iPhone X 及更早的型号可能是低端)
    // iPhone X = iPhone10,3/6, iPhone 8 = iPhone10,1/4, etc.
    // 这里使用 devicePixelRatio 和 screen 尺寸来推断
    if (/iPhone/i.test(ua)) {
        const dpr = window.devicePixelRatio || 1;
        const screenHeight = window.screen.height;

        // iPhone 8 及更早: 667px @ 2x 或 736px @ 3x (Plus models)
        // iPhone X+: 812px+ @ 3x
        if (screenHeight <= 736 && dpr <= 3) {
            return true; // 可能是老款设备
        }
    }

    return false;
};

/**
 * 判断是否应开启高性能模式（即降低视觉效果）
 * 逻辑：
 * 1. Android 设备（普遍动画性能较差）
 * 2. 低端 iOS 设备（老款 iPhone）
 * 3. 低内存设备（deviceMemory < 4GB）
 */
export const shouldEnableHighPerformance = (): boolean => {
    if (typeof window === 'undefined') return false;

    // Android 通常需要简化动画
    if (isAndroid()) return true;

    // 老款 iOS 设备
    if (isLowEndIOS()) return true;

    // 使用 Device Memory API 检测低内存设备（Chrome/Edge 支持）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if (nav.deviceMemory && nav.deviceMemory < 4) {
        return true;
    }

    return false;
};
