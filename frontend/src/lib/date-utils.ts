
export type MarketScene = 'pre_market' | 'trading' | 'post_market';

/**
 * 根据当前时间判断市场场景 (港股)
 * S1: 开市前 (00:00 - 09:30)
 * S2: 交易中 (09:30 - 16:00)
 * S3: 收市后 (16:00 - 24:00)
 */
export function getMarketScene(): MarketScene {
    const now = new Date();
    // 转换为 UTC+8 (香港时间)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const hkTime = new Date(utc + (3600000 * 8));

    const hours = hkTime.getHours();
    const minutes = hkTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // 收市后 (>= 16:00 = 960m)
    if (totalMinutes >= 960) return 'post_market';

    // 开市前 (< 09:30 = 570m)
    if (totalMinutes < 570) return 'pre_market';

    // 交易中 (09:30 - 16:00)
    return 'trading';
}
