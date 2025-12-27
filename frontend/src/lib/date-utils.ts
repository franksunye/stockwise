
export type MarketScene = 'pre_market' | 'trading' | 'post_market';

/**
 * 港股 2025 年休市日 (不含周末)
 * 数据来源: 香港交易所官网
 * 维护说明: 每年年初更新一次
 */
const HK_HOLIDAYS_2025: string[] = [
    '2025-01-01', // 元旦
    '2025-01-29', // 农历新年
    '2025-01-30', // 农历年初二
    '2025-01-31', // 农历年初三
    '2025-04-04', // 清明节
    '2025-04-18', // 耶稣受难日
    '2025-04-21', // 复活节星期一
    '2025-05-01', // 劳动节
    '2025-05-05', // 佛诞
    '2025-07-01', // 香港特区成立纪念日
    '2025-10-01', // 国庆日
    '2025-10-07', // 重阳节
    '2025-12-25', // 圣诞节
    '2025-12-26', // 圣诞节翌日
];

/**
 * 港股 2026 年休市日 (不含周末) - 预填，待官方确认后更新
 */
const HK_HOLIDAYS_2026: string[] = [
    '2026-01-01', // 元旦
    '2026-02-17', // 农历新年 (预估)
    '2026-02-18',
    '2026-02-19',
    '2026-04-03', // 清明节 (预估)
    '2026-04-06', // 复活节星期一
    '2026-05-01', // 劳动节
    '2026-05-24', // 佛诞 (预估)
    '2026-07-01', // 香港特区成立纪念日
    '2026-10-01', // 国庆日
    '2026-10-25', // 重阳节 (预估)
    '2026-12-25', // 圣诞节
];

const ALL_HOLIDAYS = new Set([...HK_HOLIDAYS_2025, ...HK_HOLIDAYS_2026]);

/**
 * 获取香港时间
 */
export function getHKTime(date?: Date): Date {
    const d = date || new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 8));
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDateStr(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 判断指定日期是否为港股休市日 (周末或假期)
 */
export function isMarketClosed(date: Date): boolean {
    const dayOfWeek = date.getDay();
    // 周六(6)或周日(0)
    if (dayOfWeek === 0 || dayOfWeek === 6) return true;
    // 检查假期列表
    return ALL_HOLIDAYS.has(formatDateStr(date));
}

/**
 * 判断今天是否为交易日
 */
export function isTradingDay(date?: Date): boolean {
    const hkDate = getHKTime(date);
    return !isMarketClosed(hkDate);
}

/**
 * 获取下一个交易日
 * @param from 从哪一天开始计算（默认今天）
 * @returns 下一个交易日的 Date 对象（香港时间）
 */
export function getNextTradingDay(from?: Date): Date {
    const hkNow = getHKTime(from);
    const next = new Date(hkNow);
    next.setDate(next.getDate() + 1);

    // 循环跳过所有休市日
    while (isMarketClosed(next)) {
        next.setDate(next.getDate() + 1);
    }
    return next;
}

/**
 * 计算两个日期之间的天数差
 */
function getDaysDiff(from: Date, to: Date): number {
    const fromDate = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const toDate = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 生成智能的预测标题
 * 根据下一交易日与今天的间隔，返回用户友好的文案
 * 
 * 规则:
 * - 间隔 1 天 → "明日建议"
 * - 间隔 2-3 天且是下周一 → "下周一建议"
 * - 间隔 2-7 天 → "M/D 建议" (如 "12/30 建议")
 * - 间隔 > 7 天 → "下一交易日 (M/D) 建议"
 */
export function getPredictionTitle(scene: MarketScene): string {
    const hkNow = getHKTime();

    // 交易中或开市前：显示"今日建议"
    if (scene !== 'post_market') {
        return '今日建议';
    }

    // 收市后：计算下一交易日
    const nextDay = getNextTradingDay();
    const daysDiff = getDaysDiff(hkNow, nextDay);
    const nextMonth = nextDay.getMonth() + 1;
    const nextDate = nextDay.getDate();
    const nextDayOfWeek = nextDay.getDay();

    if (daysDiff === 1) {
        return '明日建议';
    }

    // 如果是下周一（间隔2-3天，跨越周末）
    if (daysDiff <= 3 && nextDayOfWeek === 1) {
        return '下周一建议';
    }

    // 间隔在一周内
    if (daysDiff <= 7) {
        return `${nextMonth}/${nextDate} 建议`;
    }

    // 长假期（如春节）
    return `下一交易日 (${nextMonth}/${nextDate}) 建议`;
}

/**
 * 获取上一个交易日
 * @param from 从哪一天开始往前算（默认今天）
 * @returns 上一个交易日的 Date 对象（香港时间）
 */
export function getLastTradingDay(from?: Date): Date {
    const hkNow = getHKTime(from);
    const prev = new Date(hkNow);
    prev.setDate(prev.getDate() - 1);

    // 循环跳过所有休市日
    while (isMarketClosed(prev)) {
        prev.setDate(prev.getDate() - 1);
    }
    return prev;
}

/**
 * 获取上一交易日的友好标签
 * 规则:
 * - 如果今天是交易日 → "今日"
 * - 如果上一交易日是昨天 → "昨日"
 * - 如果上一交易日是上周五（周末查看）→ "周五"
 * - 其他情况 → "M/D"（如 "12/24"）
 */
export function getLastTradingDayLabel(): string {
    const hkNow = getHKTime();
    const todayIsTradingDay = !isMarketClosed(hkNow);

    // 如果今天是交易日，显示"今日"
    if (todayIsTradingDay) {
        return '今日';
    }

    // 计算上一交易日
    const lastDay = getLastTradingDay();
    const daysDiff = getDaysDiff(lastDay, hkNow);
    const lastDayOfWeek = lastDay.getDay();

    // 昨天
    if (daysDiff === 1) {
        return '昨日';
    }

    // 周末查看，上一交易日是周五
    if (daysDiff <= 3 && lastDayOfWeek === 5) {
        return '周五';
    }

    // 其他情况显示日期
    const month = lastDay.getMonth() + 1;
    const date = lastDay.getDate();
    return `${month}/${date}`;
}

/**
 * 获取收盘价标签（根据当前时间动态调整）
 * - 交易中 → "当前成交价"
 * - 今日收市后 → "今日收盘价"
 * - 周末/假期 → "周五收盘价" / "12/24 收盘价"
 */
export function getClosePriceLabel(scene: MarketScene): string {
    if (scene === 'trading') {
        return '当前成交价';
    }

    const label = getLastTradingDayLabel();
    return `${label}收盘价`;
}

/**
 * 获取验证结果标签
 * - 交易日收市后 → "今日验证"
 * - 周末/假期 → "周五验证" / "12/24 验证"
 */
export function getValidationLabel(): string {
    const label = getLastTradingDayLabel();
    return `${label}验证`;
}

/**
 * 根据后端返回的实际数据日期生成友好标签
 * 优先使用实际数据日期，确保显示与数据一致
 * 
 * @param dataDateStr 后端返回的日期字符串，格式如 "2025-12-24" 或 "2025/12/24"
 * @returns 如 "今日" / "昨日" / "周五" / "12/24"
 */
export function formatDataDateLabel(dataDateStr: string): string {
    if (!dataDateStr) return getLastTradingDayLabel(); // 无数据时降级到推算

    // 解析日期字符串
    const normalized = dataDateStr.replace(/\//g, '-');
    const [year, month, day] = normalized.split('-').map(Number);
    const dataDate = new Date(year, month - 1, day);

    const hkNow = getHKTime();
    const today = new Date(hkNow.getFullYear(), hkNow.getMonth(), hkNow.getDate());
    const daysDiff = getDaysDiff(dataDate, today);

    // 今天
    if (daysDiff === 0) return '今日';

    // 昨天
    if (daysDiff === 1) return '昨日';

    // 前天是周五（周末查看）
    const dataDayOfWeek = dataDate.getDay();
    if (daysDiff <= 3 && dataDayOfWeek === 5) return '周五';

    // 其他情况显示日期
    return `${month}/${day}`;
}

/**
 * 获取收盘价标签（基于实际数据日期）
 */
export function getClosePriceLabelFromData(scene: MarketScene, dataDateStr?: string): string {
    if (scene === 'trading') {
        return '当前成交价';
    }

    const label = dataDateStr ? formatDataDateLabel(dataDateStr) : getLastTradingDayLabel();
    return `${label}收盘价`;
}

/**
 * 获取验证结果标签（基于实际数据日期）
 */
export function getValidationLabelFromData(dataDateStr?: string): string {
    const label = dataDateStr ? formatDataDateLabel(dataDateStr) : getLastTradingDayLabel();
    return `${label}验证`;
}

/**
 * 根据当前时间判定市场场景 (港股)
 * 逻辑增强：非交易日统一判定为 post_market (展示既定事实)
 */
export function getMarketScene(): MarketScene {
    const now = new Date();
    // 转换为 UTC+8 (香港时间)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const hkTime = new Date(utc + (3600000 * 8));

    // 如果今天不是交易日，无论几点，都视为上一周期的 post_market 状态
    if (isMarketClosed(hkTime)) {
        return 'post_market';
    }

    const hours = hkTime.getHours();
    const minutes = hkTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // 交易日收市后 (>= 16:00 = 960m)
    if (totalMinutes >= 960) return 'post_market';

    // 交易日开市前 (< 09:30 = 570m)
    if (totalMinutes < 570) return 'pre_market';

    // 交易日交易中 (09:30 - 16:00)
    return 'trading';
}

/**
 * 格式化股票代码，根据代码特征添加市场后缀
 */
export function formatStockSymbol(symbol: string): string {
    if (!symbol) return "";

    // 港股通常是 5 位 (如 01398, 00700)
    if (symbol.length === 5) {
        return `${symbol}.HK`;
    }

    // A 股通常是 6 位
    if (symbol.length === 6) {
        if (symbol.startsWith('6')) return `${symbol}.SH`;
        return `${symbol}.SZ`;
    }

    return symbol;
}
