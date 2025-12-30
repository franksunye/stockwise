/**
 * StockWise 会员体系配置
 * 集中管理邀请奖励、会员等级等业务配置
 */

export const MEMBERSHIP_CONFIG = {
    // 邀请奖励配置
    referral: {
        /** 被邀请人获得的 Pro 试用天数 */
        refereeDays: 7,
        /** 邀请人获得的 Pro 奖励天数 */
        referrerDays: 7,
    },

    // 会员等级配置
    tiers: {
        free: {
            maxStocks: 3,
            analysisMode: 'rule' as const,
        },
        pro: {
            maxStocks: 10,
            analysisMode: 'ai' as const,
        },
    },
};
