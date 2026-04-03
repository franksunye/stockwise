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
        name: 'pricing.free.name',
        enName: 'Free',
        price: '0',
        period: 'pricing.free.period',
        description: 'pricing.free.description',
        features: [
            'pricing.features.aiTrend',
            'pricing.features.dailyBrief',
            'pricing.features.almanac',
            '3 Actionable Insights / day',
            'Community access',
        ],
        cta: 'pricing.free.cta',
        href: process.env.NEXT_PUBLIC_APP_URL || 'https://app.ziso.cc',
        highlight: false,
        icon: Zap,
        color: 'slate',
    },
    {
        name: 'pricing.go.name',
        enName: 'Go',
        price: '29.9',
        period: 'pricing.go.period',
        description: 'pricing.go.description',
        features: [
            'pricing.features.deepseek',
            '10 Actionable Insights / day',
            'Full Real-time Notifications',
            'pricing.features.indicators',
            'pricing.features.realtime',
            'pricing.features.badge',
        ],
        priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_MONTHLY || 'price_1Su1zqS3fDFObThpZbYXr2GG',
        priceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_YEARLY || 'price_1Su1zqS3fDFObThp7iG6X6bK',
        highlight: true,
        icon: Crown,
        color: 'indigo',
    },
    {
        name: 'pricing.plus.name',
        enName: 'Plus',
        price: '69', // Strategy price
        period: 'pricing.plus.period',
        description: 'pricing.plus.description',
        features: [
            'DeepSeek + Gemini consensus',
            '10 Actionable Insights / day',
            'Full Real-time Notifications',
            'Advanced priority analytics',
            'Premium expert support',
        ],
        cta: 'pricing.plus.cta', // Will be "Join Waiting List"
        href: 'mailto:hi@ziso.cc?subject=Join%20StockWise%20Plus%20Waiting%20List',
        highlight: false,
        icon: ShieldCheck,
        color: 'emerald',
    },
];

/**
 * Feature comparison data for the pricing table.
 * Grouped by category as per user request.
 */
export const featureComparison = [
    // --- Actionable Insights / 逻辑研判 ---
    { label: 'actionableInsights.group', isGroup: true },
    { label: 'actionableInsights.model', free: 'Hunyuan Lite', go: 'DeepSeek (推理)', plus: 'DeepSeek + Gemini', highlight: true },
    { label: 'actionableInsights.dailyLimit', free: '3 / day', go: '10 / day', plus: '10 / day', highlight: true },
    { label: 'actionableInsights.monthlyLimit', free: '60 / mo', go: '200 / mo', plus: '200 / mo' },
    { label: 'actionableInsights.signals', free: '✅', go: '✅', plus: '✅' },
    { label: 'actionableInsights.levels', free: '✅', go: '✅', plus: '✅' },
    { label: 'actionableInsights.reasoning', free: '✅', go: '✅', plus: '✅' },
    { label: 'actionableInsights.markets', free: 'US / HK / CN', go: 'US / HK / CN', plus: 'US / HK / CN' },
    { label: 'actionableInsights.sharing', free: 'Unlimited', go: 'Unlimited', plus: 'Unlimited' },

    // --- Notifications / 系统通知 ---
    { label: 'notifications.group', isGroup: true },
    { label: 'notifications.realtime', free: 'Limited', go: 'Full Real-time', plus: 'Full Real-time', highlight: true },
    { label: 'notifications.types', free: 'Basic', go: 'All Categories', plus: 'All Categories' },

    // --- Academy / 知守学院 ---
    { label: 'academy.group', isGroup: true },
    { label: 'academy.content', free: 'All Access', go: 'All Access', plus: 'All Access' },
    { label: 'academy.masters', free: '✅', go: '✅', plus: '✅' },
];
