/**
 * ZISO AI 会员体系配置
 * 集中管理运营开关、邀请奖励、会员等级等业务配置
 */

export const MEMBERSHIP_CONFIG = {
    // ==========================================
    // 🎛️ 运营开关 (Marketing Switches)
    // ==========================================
    switches: {
        /** 
         * 邀请墙开关
         * true: 必须有激活码或被邀请才能进入系统（内测期）
         * false: 所有人都可以进入，默认为免费用户（公测/正式期）
         */
        requireInvite: true,

        /**
         * 邀请奖励开关
         * true: 邀请链接有效，双方可获得 Pro 试用
         * false: 邀请链接无效，不发放任何奖励
         */
        enableReferralReward: true,

        /**
         * 激活码兑换开关
         * true: 允许用激活码兑换 Pro
         * false: 禁用激活码功能（如已切换到正式付费系统）
         */
        enableRedemption: true,
    },

    // ==========================================
    // 📅 邀请奖励配置
    // ==========================================
    referral: {
        /** 被邀请人获得的 Pro 试用天数 */
        refereeDays: 5,
        /** 邀请人获得的 Pro 奖励天数 */
        referrerDays: 5,
    },

    // ==========================================
    // 🎁 新用户引导 (Onboarding)
    // ==========================================
    onboarding: {
        /** 新用户完成 OB 后获得的 Pro 试用天数 */
        trialDays: 3,
    },

    // ==========================================
    // 📊 会员等级配置
    // ==========================================
    tiers: {
        free: {
            maxStocks: 3,
            analysisMode: 'ai' as const,
            allowedModels: ['hunyuan-lite'],
            sqlFilter: "p.model_id = 'hunyuan-lite'"
        },
        go: {
            maxStocks: 10,
            analysisMode: 'ai' as const,
            allowedModels: ['deepseek-v3', 'deepseek-v3.2-exp', 'deepseek-aliyun'],
            sqlFilter: "p.is_primary = 1 AND p.model_id LIKE 'deepseek-%'"
        },
        plus: {
            maxStocks: 10,
            analysisMode: 'ai' as const,
            allowedModels: ['deepseek-v3', 'deepseek-v3.2-exp', 'deepseek-aliyun', 'gemini-3-flash'],
            sqlFilter: "p.is_primary = 1 AND (p.model_id LIKE 'deepseek-%' OR p.model_id LIKE 'gemini-%')"
        },
        pro: {
            maxStocks: 10,
            analysisMode: 'ai' as const,
            allowedModels: ['deepseek-v3', 'hunyuan-lite', 'rule-engine'],
            sqlFilter: "p.is_primary = 1" // Pro 始终看到最高优先级模型
        },
        alpha: {
            maxStocks: 10,
            analysisMode: 'ai' as const,
            allowedModels: ['deepseek-v3', 'hunyuan-lite', 'rule-engine'],
            sqlFilter: "p.is_primary = 1"
        },
    } as const,
};

/**
 * 根据等级获取 SQL 过滤片段
 */
export function getModelSqlFilter(tier: string = 'free'): string {
    const normalized = String(tier || 'free').toLowerCase();
    const t = (normalized in MEMBERSHIP_CONFIG.tiers
        ? normalized
        : 'free') as keyof typeof MEMBERSHIP_CONFIG.tiers;
    return MEMBERSHIP_CONFIG.tiers[t].sqlFilter;
}
