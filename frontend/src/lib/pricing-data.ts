'use client';

import { Zap, Crown, ShieldCheck, LucideIcon } from 'lucide-react';

export interface PricingPlan {
    name: string;
    enName: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    cta?: string;
    href?: string;
    priceId?: string;
    priceIdAnnual?: string;
    highlight: boolean;
    icon: LucideIcon;
    color: 'slate' | 'indigo' | 'emerald';
}

/**
 * Single Source of Truth for all pricing plans.
 * Used by both /pricing page and UserPricingView component.
 */
export const pricingPlans: PricingPlan[] = [
    {
        name: '基础版',
        enName: 'Free',
        price: '0',
        period: '永久免费',
        description: '适合刚接触 AI 投资的个人投资者',
        features: [
            'AI 趋势信号 (量化多空判断)',
            '每日市场复盘 (基础行情摘要)',
            '每日 3 次个股 AI 诊断',
            '投资者共学社区权限',
            '每日 3 次个股 AI 诊断',
            '投资者共学社区权限',
        ],
        cta: '立即开始',
        href: '/dashboard',
        highlight: false,
        icon: Zap,
        color: 'slate',
    },
    {
        name: 'Pro 会员',
        enName: 'Pro',
        price: '29.9',
        period: '每月 / ¥299 每年',
        description: '专为追求深度认知与交易纪律的进阶投资者设计',
        features: [
            'DeepSeek 深度推理 (揭示涨跌逻辑)',
            '教练式 AI 研报 (拒绝术语堆砌)',
            '10 只自选股全权托管 (覆盖主力持仓)',
            '主力情绪与资金关键指标解锁',
            '关键变盘点实时推送 (纪律提醒)',
            '⭐ 专属 Pro 身份勋章',
        ],
        priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_MONTHLY || 'price_1Su1zqS3fDFObThpZbYXr2GG',
        priceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_YEARLY || 'price_1Su1zqS3fDFObThp7iG6X6bK',
        highlight: true,
        icon: Crown,
        color: 'indigo',
    },
    {
        name: '机构/大户版',
        enName: 'Alpha',
        price: '1,999',
        period: '每年',
        description: '顶级阿尔法收益工具，实时深度监控',
        features: [
            '实时盘中突发事件 AI 分析',
            '1对1 AI 专属策略看板',
            '专属深度研报自动生成',
            'API 原始数据访问接口',
            '行业专家优先支持',
        ],
        cta: '联系我们',
        href: 'mailto:support@ziso.cc',
        highlight: false,
        icon: ShieldCheck,
        color: 'emerald',
    },
];

/**
 * Feature comparison data for the pricing table.
 */
export const featureComparison = [
    { label: 'AI 分析深度', free: '规则引擎 + 基础 AI', pro: 'DeepSeek V3 (顶级思维链模型)', highlight: true },
    { label: '复盘叙事逻辑', free: '基础数据罗列', pro: '像真人教练一样深度推演与归因', highlight: true },
    { label: '监控托管数量', free: '3 只 (尝鲜体验)', pro: '10 只 (覆盖主力持仓)', highlight: true },
    { label: '量化信号底座', free: '标准趋势判断', pro: '标准趋势判断', common: true },
    { label: '行情覆盖范围', free: 'A股 / 港股 全覆盖', pro: 'A股 / 港股 全覆盖', common: true },
    { label: '核心指标解锁', free: '仅收盘价', pro: '主力情绪、支撑压力位、量能状态', highlight: true },
    { label: '通知与纪律', free: '无', pro: '关键变盘点 / 突发异动 实时推送', highlight: true },
    { label: '数据时效性', free: '盘后同步', pro: '盘后同步', common: true },
    { label: '专属身份标识', free: '-', pro: '⭐ 专属 Pro 勋章' },
];
