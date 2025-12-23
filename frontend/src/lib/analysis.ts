import { DailyPrice } from './types';

export interface IndicatorReview {
    label: string;
    value: string;
    status: 'up' | 'down' | 'hold';
    desc: string;
}

export function getIndicatorReviews(price: DailyPrice): IndicatorReview[] {
    const reviews: IndicatorReview[] = [];

    // KDJ
    let kdjDesc = '趋势不明';
    let kdjStatus: 'up' | 'down' | 'hold' = 'hold';
    if (price.kdj_j < price.kdj_k && price.kdj_k < price.kdj_d) {
        kdjDesc = '空头排列 (J<K<D)';
        kdjStatus = 'down';
    } else if (price.kdj_j > price.kdj_k && price.kdj_k > price.kdj_d) {
        kdjDesc = '多头排列 (J>K>D)';
        kdjStatus = 'up';
    }
    reviews.push({ label: 'KDJ', value: `${price.kdj_k.toFixed(1)}`, status: kdjStatus, desc: kdjDesc });

    // RSI
    let rsiDesc = '中性';
    let rsiStatus: 'up' | 'down' | 'hold' = 'hold';
    if (price.rsi < 30) {
        rsiDesc = '超卖, 存在反弹需求';
        rsiStatus = 'up';
    } else if (price.rsi < 50) {
        rsiDesc = '偏弱';
        rsiStatus = 'down';
    } else if (price.rsi > 70) {
        rsiDesc = '超买, 注意风险';
        rsiStatus = 'down';
    } else {
        rsiDesc = '走强';
        rsiStatus = 'up';
    }
    reviews.push({ label: 'RSI', value: `${price.rsi.toFixed(1)}`, status: rsiStatus, desc: rsiDesc });

    // MACD
    let macdDesc = '不明';
    let macdStatus: 'up' | 'down' | 'hold' = 'hold';
    if (price.macd_hist > 0) {
        macdDesc = '红柱区间, 多头占优';
        macdStatus = 'up';
    } else {
        macdDesc = '绿柱区间, 寻找支撑';
        macdStatus = 'down';
    }
    reviews.push({ label: 'MACD', value: `${price.macd_hist.toFixed(2)}`, status: macdStatus, desc: macdDesc });

    // BOLL
    let bollDesc = '中轨盘整';
    let bollStatus: 'up' | 'down' | 'hold' = 'hold';
    if (price.close > price.boll_upper) {
        bollDesc = '触及上轨, 压力较大';
        bollStatus = 'down';
    } else if (price.close < price.boll_lower) {
        bollDesc = '跌破下轨, 乖离率大';
        bollStatus = 'up';
    } else if (price.close > price.boll_mid) {
        bollDesc = '位于中轨上方, 偏强';
        bollStatus = 'up';
    } else {
        bollDesc = '位于中轨下方, 偏弱';
        bollStatus = 'down';
    }
    reviews.push({ label: 'BOLL', value: '轨道分析', status: bollStatus, desc: bollDesc });

    return reviews;
}
