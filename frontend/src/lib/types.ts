// 股票价格数据类型
export interface DailyPrice {
    symbol: string;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change_percent: number;
    ma5: number;
    ma10: number;
    ma20: number;
    ma60: number;
    macd: number;
    macd_signal: number;
    macd_hist: number;
    boll_upper: number;
    boll_mid: number;
    boll_lower: number;
    rsi: number;
    kdj_k: number;
    kdj_d: number;
    kdj_j: number;
    ai_summary: string | null;
}

// 用户规则类型
export interface UserRule {
    support_price: number | null;
    pressure_price: number | null;
    min_volume: number | null;
    last_updated: number;
}
