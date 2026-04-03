'use client';

import { Zap, Crown, ShieldCheck, LucideIcon, User } from 'lucide-react';

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
            'pricing.features.insights|3',
            'pricing.features.model|Hunyuan Lite',
            'pricing.features.notifications_basic',
            'pricing.features.academy',
        ],
        highlight: false,
        icon: User,
        color: 'slate',
        href: 'https://app.ziso.cc',
    },
    {
        name: 'pricing.go.name',
        enName: 'Go',
        price: '29.9',
        period: 'pricing.go.period',
        description: 'pricing.go.description',
        features: [
            'pricing.features.insights|10',
            'pricing.features.model|DeepSeek',
            'pricing.features.notifications_full',
            'pricing.features.academy',
            'pricing.features.badge_go',
        ],
        priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_GO_MONTHLY || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_MONTHLY || 'price_1Su1zqS3fDFObThpZbYXr2GG',
        priceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_GO_YEARLY || process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_YEARLY || 'price_1Su1zqS3fDFOb7iG6X6bK',
        highlight: true,
        icon: Crown,
        color: 'indigo',
    },
    {
        name: 'pricing.plus.name',
        enName: 'Plus',
        price: '---',
        period: 'pricing.plus.period',
        description: 'pricing.plus.description',
        features: [
            'pricing.features.insights|10',
            'pricing.features.model|DeepSeek + Gemini',
            'pricing.features.notifications_full',
            'pricing.features.academy',
            'pricing.features.badge_plus',
        ],
        highlight: false,
        icon: ShieldCheck,
        color: 'emerald',
        href: 'mailto:hi@ziso.cc',
    },
];

/**
 * Feature comparison data for the pricing table.
 * Grouped by category as per user request.
 */
export const featureComparison = [
    // --- Actionable Insights ---
    { isGroup: true, label: 'pricing.groups.insights' },
    { label: 'pricing.rows.model', free: 'Hunyuan Lite', go: 'DeepSeek', plus: 'DeepSeek + Gemini', highlight: true },
    { label: 'pricing.rows.quota', free: '3 只', go: '10 只', plus: '10 只', highlight: true },
    { label: 'pricing.rows.quotaMonthly', free: '60份 / 月', go: '200份 / 月', plus: '200份 / 月' },
    { label: 'pricing.rows.market', free: 'US / HK / CN', go: 'US / HK / CN', plus: 'US / HK / CN' },
    { label: 'pricing.rows.signalsTactical', free: '✅', go: '✅', plus: '✅' },
    { label: 'pricing.rows.levelsShort', free: '✅', go: '✅', plus: '✅' },
    { label: 'pricing.rows.reasoningReflection', free: '❌', go: '✅', plus: '✅' },
    { label: 'pricing.rows.conflict', free: '❌', go: '✅', plus: '✅' },
    { label: 'pricing.rows.sharing', free: '❌', go: '无限制', plus: '无限制' },
    
    // --- Notifications ---
    { isGroup: true, label: 'pricing.groups.notifications' },
    { label: 'pricing.rows.realtime', free: '受限', go: '全量实时', plus: '全量实时', highlight: true },
    { label: 'pricing.rows.categories', free: '基础通知', go: '全品类通知', plus: '全品类通知' },

    // --- Academy ---
    { isGroup: true, label: 'pricing.groups.academy' },
    { label: 'pricing.rows.academy101', free: '✅', go: '✅', plus: '✅' },
    { label: 'pricing.rows.masterLogics', free: '✅', go: '✅', plus: '✅' },
    { label: 'pricing.rows.upcoming', free: '✅', go: '✅', plus: '✅' },
];
