
export type MarketScene = 'pre_market' | 'trading' | 'post_market';
export type MarketType = 'HK' | 'CN' | 'US';

export interface I18nLabel {
    key: string;
    params?: Record<string, string | number>;
}

// ============ 港股 (HK) 交易日历 ============
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

const HK_HOLIDAYS_2026: string[] = [
    '2026-01-01', // 元旦
    '2026-02-16', // 农历新年补假 (Added)
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

let HK_HOLIDAYS = new Set([...HK_HOLIDAYS_2025, ...HK_HOLIDAYS_2026]);

// ============ A股 (CN) 交易日历 ============
// 数据来源: 中国证监会官方公告
const CN_HOLIDAYS_2025: string[] = [
    '2025-01-01', // 元旦
    '2025-01-28', // 春节 (1/28 - 2/4)
    '2025-01-29',
    '2025-01-30',
    '2025-01-31',
    '2025-02-01',
    '2025-02-02',
    '2025-02-03',
    '2025-02-04',
    '2025-04-04', // 清明节 (4/4 - 4/6)
    '2025-04-05',
    '2025-04-06',
    '2025-05-01', // 劳动节 (5/1 - 5/5)
    '2025-05-02',
    '2025-05-03',
    '2025-05-04',
    '2025-05-05',
    '2025-05-31', // 端午节 (5/31 - 6/2)
    '2025-06-01',
    '2025-06-02',
    '2025-10-01', // 国庆+中秋 (10/1 - 10/8)
    '2025-10-02',
    '2025-10-03',
    '2025-10-04',
    '2025-10-05',
    '2025-10-06',
    '2025-10-07',
    '2025-10-08',
];

const CN_HOLIDAYS_2026: string[] = [
    '2026-01-01', // 元旦 (预估)
    '2026-01-02',
    '2026-02-15', // 春节 (预估)
    '2026-02-16', // 春节补假 (Added)
    '2026-02-17',
    '2026-02-18',
    '2026-02-19',
    '2026-02-20',
    '2026-02-21',
    '2026-02-22',
    '2026-02-23',
    '2026-04-05', // 清明节 (预估)
    '2026-04-06',
    '2026-05-01', // 劳动节 (预估)
    '2026-05-02',
    '2026-05-03',
    '2026-06-19', // 端午节 (预估)
    '2026-06-20',
    '2026-06-21',
    '2026-10-01', // 国庆节 (预估)
    '2026-10-02',
    '2026-10-03',
    '2026-10-04',
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
];

let CN_HOLIDAYS = new Set([...CN_HOLIDAYS_2025, ...CN_HOLIDAYS_2026]);

// ============ 美股 (US) 交易日历 ============
// NYSE/Nasdaq full close days
const US_HOLIDAYS_2025: string[] = [
    '2025-01-01',
    '2025-01-20',
    '2025-02-17',
    '2025-04-18',
    '2025-05-26',
    '2025-06-19',
    '2025-07-04',
    '2025-09-01',
    '2025-11-27',
    '2025-12-25',
];

const US_HOLIDAYS_2026: string[] = [
    '2026-01-01',
    '2026-01-19',
    '2026-02-16',
    '2026-04-03',
    '2026-05-25',
    '2026-06-19',
    '2026-07-03',
    '2026-09-07',
    '2026-11-26',
    '2026-12-25',
];

const US_HOLIDAYS = new Set([...US_HOLIDAYS_2025, ...US_HOLIDAYS_2026]);

/**
 * Update holiday lists from remote source (Database/API)
 * Call this on app initialization to sync valid holidays.
 */
export function updateHolidays(holidays: { HK: string[], CN: string[] }) {
    HK_HOLIDAYS = new Set(Array.isArray(holidays.HK) ? holidays.HK : []);
    CN_HOLIDAYS = new Set(Array.isArray(holidays.CN) ? holidays.CN : []);
}

/**
 * 根据股票代码判断市场类型
 */
export function getMarketFromSymbol(symbol?: string): MarketType {
    if (!symbol) return 'HK';
    const sym = String(symbol).trim();
    if (sym.startsWith('sh') || sym.startsWith('sz') || sym.startsWith('bj')) return 'CN';
    if (sym.length === 5 && /^\d+$/.test(sym)) return 'HK';
    if (sym.length === 6 && /^\d+$/.test(sym)) return 'CN';
    return 'US';
}

/**
 * 获取指定市场的假期列表
 */
function getHolidays(market: MarketType): Set<string> {
    if (market === 'HK') return HK_HOLIDAYS;
    if (market === 'US') return US_HOLIDAYS;
    return CN_HOLIDAYS;
}

/**
 * 获取香港/北京时间 (UTC+8)
 */
export function getHKTime(date?: Date): Date {
    const d = date || new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 8));
}

/**
 * 获取美东时间（用于 US 市场会话判定）
 */
export function getUSEasternTime(date?: Date): Date {
    const d = date || new Date();
    return new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDateStr(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 判断指定日期是否为休市日 (周末或假期)
 * @param date 日期
 * @param market 市场类型，默认 HK
 */
export function isMarketClosed(date: Date, market: MarketType = 'HK'): boolean {
    const dayOfWeek = date.getDay();
    // 周六(6)或周日(0)
    if (dayOfWeek === 0 || dayOfWeek === 6) return true;
    // 检查假期列表
    return getHolidays(market).has(formatDateStr(date));
}

/**
 * 判断今天是否为交易日
 * @param date 日期（可选）
 * @param market 市场类型，默认 HK
 */
export function isTradingDay(date?: Date, market: MarketType = 'HK'): boolean {
    const localDate = market === 'US' ? getUSEasternTime(date) : getHKTime(date);
    return !isMarketClosed(localDate, market);
}

/**
 * 获取下一个交易日
 * @param from 从哪一天开始计算（默认今天）
 * @param market 市场类型，默认 HK
 * @returns 下一个交易日的 Date 对象
 */
export function getNextTradingDay(from?: Date, market: MarketType = 'HK'): Date {
    const localNow = market === 'US' ? getUSEasternTime(from) : getHKTime(from);
    const next = new Date(localNow);
    next.setDate(next.getDate() + 1);

    // 循环跳过所有休市日
    while (isMarketClosed(next, market)) {
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
export function getPredictionTitle(scene: MarketScene, market: MarketType = 'HK'): I18nLabel {
    const localNow = market === 'US' ? getUSEasternTime() : getHKTime();

    // 交易中或开市前：显示"今日建议"
    if (scene !== 'post_market') {
        return { key: 'dashboard.date.todayAdvice' };
    }

    // 收市后：计算下一交易日（根据市场类型）
    const nextDay = getNextTradingDay(undefined, market);
    const daysDiff = getDaysDiff(localNow, nextDay);
    const nextMonth = nextDay.getMonth() + 1;
    const nextDate = nextDay.getDate();
    const nextDayOfWeek = nextDay.getDay();

    // 如果是下周一（间隔3天内，跨越周末）
    // 优先判读：避免周日时显示"明日建议"（虽然物理上正确，但在深夜/周末语境下容易造成"明日是周日"的误解）
    if (daysDiff <= 3 && nextDayOfWeek === 1) {
        return { key: 'dashboard.date.mondayAdvice' };
    }

    if (daysDiff === 1) {
        return { key: 'dashboard.date.tomorrowAdvice' };
    }

    // 间隔在 3 天内（普通周末）
    if (daysDiff <= 3) {
        return { key: 'dashboard.date.tradingDayAdvice', params: { date: `${nextMonth}/${nextDate}` } };
    }

    // 长假期（如春节、国庆）
    return { key: 'dashboard.date.nextTradingDayAdvice', params: { date: `${nextMonth}/${nextDate}` } };
}

/**
 * 获取上一个交易日
 * @param from 从哪一天开始往前算（默认今天）
 * @param market 市场类型，默认 HK
 * @returns 上一个交易日的 Date 对象
 */
export function getLastTradingDay(from?: Date, market: MarketType = 'HK'): Date {
    const localNow = market === 'US' ? getUSEasternTime(from) : getHKTime(from);
    const prev = new Date(localNow);
    prev.setDate(prev.getDate() - 1);

    // 循环跳过所有休市日
    while (isMarketClosed(prev, market)) {
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
export function getLastTradingDayLabel(market: MarketType = 'HK'): I18nLabel {
    const localNow = market === 'US' ? getUSEasternTime() : getHKTime();
    const todayIsTradingDay = !isMarketClosed(localNow, market);

    // 如果今天是交易日，显示"今日"
    if (todayIsTradingDay) {
        return { key: 'dashboard.date.today' };
    }

    // 计算上一交易日
    const lastDay = getLastTradingDay(undefined, market);
    const daysDiff = getDaysDiff(lastDay, localNow);
    const lastDayOfWeek = lastDay.getDay();

    // 昨天
    if (daysDiff === 1) {
        return { key: 'dashboard.date.yesterday' };
    }

    // 周末查看，上一交易日是周五
    if (daysDiff <= 3 && lastDayOfWeek === 5) {
        return { key: 'dashboard.date.friday' };
    }

    // 其他情况显示日期
    const month = lastDay.getMonth() + 1;
    const date = lastDay.getDate();
    return { key: '', params: { date: `${month}/${date}` } }; // Empty key indicates literal date
}

/**
 * 获取收盘价标签（根据当前时间动态调整）
 * - 交易中 → "当前成交价"
 * - 今日收市后 → "今日收盘价"
 * - 周末/假期 → "周五收盘价" / "12/24 收盘价"
 */
export function getClosePriceLabel(scene: MarketScene): I18nLabel {
    if (scene === 'trading') {
        return { key: 'dashboard.date.currentPrice' };
    }
    return { key: 'dashboard.date.todayClose' };
}

/**
 * 获取验证结果标签
 * - 交易日收市后 → "今日验证"
 * - 周末/假期 → "周五验证" / "12/24 验证"
 */
export function getValidationLabel(): I18nLabel {
    return { key: 'dashboard.date.todayVerify' };
}

/**
 * 根据后端返回的实际数据日期生成友好标签
 * 优先使用实际数据日期，确保显示与数据一致
 * 
 * @param dataDateStr 后端返回的日期字符串，格式如 "2025-12-24" 或 "2025/12/24"
 * @returns 如 "今日" / "昨日" / "周五" / "12/24"
 */
export function formatDataDateLabel(dataDateStr: string, market: MarketType = 'HK'): I18nLabel {
    if (!dataDateStr) return getLastTradingDayLabel(market); // 无数据时降级到推算

    // 解析日期字符串
    const normalized = dataDateStr.replace(/\//g, '-');
    const [year, month, day] = normalized.split('-').map(Number);
    const dataDate = new Date(year, month - 1, day);

    const localNow = market === 'US' ? getUSEasternTime() : getHKTime();
    const today = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate());
    const daysDiff = getDaysDiff(dataDate, today);

    // 今天
    if (daysDiff === 0) return { key: 'dashboard.date.today' };

    // 昨天
    if (daysDiff === 1) return { key: 'dashboard.date.yesterday' };

    // 前天是周五（周末查看）
    const dataDayOfWeek = dataDate.getDay();
    if (daysDiff <= 3 && dataDayOfWeek === 5) return { key: 'dashboard.date.friday' };

    // 其他情况显示日期
    return { key: '', params: { date: `${month}/${day}` } };
}

/**
 * Normalize a date string to the next trading day for the given market.
 * Useful when historical predictions were generated before holiday calendar updates.
 */
export function normalizeToTradingDate(dataDateStr?: string, market: MarketType = 'HK'): string {
    if (!dataDateStr) return '';

    const normalized = dataDateStr.replace(/\//g, '-');
    const parts = normalized.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return dataDateStr;

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);

    while (isMarketClosed(date, market)) {
        date.setDate(date.getDate() + 1);
    }

    return formatDateStr(date);
}

/**
 * 获取收盘价标签（基于实际数据日期）
 */
export function getClosePriceLabelFromData(scene: MarketScene, dataDateStr?: string, market: MarketType = 'HK'): I18nLabel {
    if (scene === 'trading') {
        return { key: 'dashboard.date.currentPrice' };
    }

    const labelObj = dataDateStr ? formatDataDateLabel(dataDateStr, market) : getLastTradingDayLabel(market);
    if (!labelObj.key) return { key: 'dashboard.date.closePrice', params: { label: labelObj.params?.date || '' } };
    return { key: 'dashboard.date.todayClose' };
}

/**
 * 获取验证结果标签（基于实际数据日期）
 */
export function getValidationLabelFromData(dataDateStr?: string, market: MarketType = 'HK'): I18nLabel {
    const labelObj = dataDateStr ? formatDataDateLabel(dataDateStr, market) : getLastTradingDayLabel(market);
    if (!labelObj.key) return { key: 'dashboard.date.verification', params: { date: labelObj.params?.date || '' } };
    return { key: 'dashboard.date.todayVerify' };
}

/**
 * 根据当前时间判定市场场景
 * 逻辑增强：
 * 1. 区分市场收盘时间：A股 15:00，港股 16:00
 * 2. 非交易日统一判定为 post_market (展示既定事实)
 */
export function getMarketScene(market: MarketType = 'HK'): MarketScene {
    const now = market === 'US' ? getUSEasternTime() : getHKTime();

    // 如果今天不是交易日，无论几点，都视为上一周期的 post_market 状态
    if (isMarketClosed(now, market)) {
        return 'post_market';
    }

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // 不同市场的收盘判定
    // CN: 15:00, HK: 16:00, US(ET): 16:00
    const closeThreshold = market === 'CN' ? 900 : 960;

    // 交易日收市后
    if (totalMinutes >= closeThreshold) return 'post_market';

    // 交易日开市前 (< 09:30 = 570m)
    if (totalMinutes < 570) return 'pre_market';

    // 交易日交易中
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

    // A 股通常是 6 位，遵循用户需求不再显示 .SH/.SZ
    return symbol;
}

/**
 * 获取用于"数据完整性校验"的预期日期 (Expected Content Date)
 * 
 * 设计原则：
 * 1. 日线数据只有在收盘后才是"完整"的
 * 2. 开盘前/盘中，预期的完整日线仍是上一交易日
 * 3. 实时行情由独立的价格推送系统处理，不在此函数职责范围内
 * 
 * 使用场景：
 * - On-Demand Sync：判断是否需要为新加入的股票补充历史数据
 * - 数据自愈：检测数据库中的日线是否落后
 * 
 * @param market 市场类型 ('HK' | 'CN')
 * @returns YYYY-MM-DD 格式的日期字符串
 */
export function getExpectedLatestDataDate(market: MarketType = 'HK'): string {
    const localNow = market === 'US' ? getUSEasternTime() : getHKTime();

    // 非交易日 → 预期为上一交易日
    if (isMarketClosed(localNow, market)) {
        const lastTradingDay = getLastTradingDay(localNow, market);
        return formatDateStr(lastTradingDay);
    }

    // 交易日：根据当前时间判断
    const totalMinutes = localNow.getHours() * 60 + localNow.getMinutes();

    // 收盘阈值：A股 15:00 (900分), 港股/美股常规收盘 16:00 (960分)
    const closeThreshold = market === 'CN' ? 900 : 960;

    // 收盘后 → 期待今日完整日线
    if (totalMinutes >= closeThreshold) {
        return formatDateStr(localNow);
    }

    // 开盘前或盘中 → 期待上一交易日的完整日线
    // 注意：盘中实时价格由实时行情 API 单独处理，与日线数据补全是两套机制
    const lastTradingDay = getLastTradingDay(localNow, market);
    return formatDateStr(lastTradingDay);
}
