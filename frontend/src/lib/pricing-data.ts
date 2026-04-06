'use client';

import { Crown, ShieldCheck, LucideIcon, User } from 'lucide-react';
import { STRIPE_PRICE_IDS } from './stripe-constants';

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
 * getPricingPlans — Returns the appropriate pricing plans based on locale.
 */
export function getPricingPlans(locale: string): PricingPlan[] {
    const isCN = locale === 'cn';
    
    return [
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
            price: isCN ? '29.9' : '4.99',
            period: 'pricing.go.period',
            description: 'pricing.go.description',
            features: [
                'pricing.features.insights|10',
                'pricing.features.model|DeepSeek',
                'pricing.features.notifications_full',
                'pricing.features.academy',
                'pricing.features.badge_go',
            ],
            priceId: isCN ? STRIPE_PRICE_IDS.PRO_MONTHLY : STRIPE_PRICE_IDS.GO_MONTHLY,
            priceIdAnnual: isCN ? STRIPE_PRICE_IDS.PRO_YEARLY : STRIPE_PRICE_IDS.GO_YEARLY,
            highlight: true,
            icon: Crown,
            color: 'indigo',
        },
        {
            name: 'pricing.plus.name',
            enName: 'Plus',
            price: isCN ? '69.9' : '9.9',
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
}

/**
 * DEPRECATED: Use getPricingPlans(locale) instead.
 * Kept for backward compatibility during migration.
 */
export const pricingPlans = getPricingPlans('cn');

export interface FeatureComparisonRow {
    isGroup?: boolean;
    label: string;
    free?: string;
    go?: string;
    plus?: string;
    highlight?: boolean;
}

/**
 * Feature comparison data for the pricing table.
 * Grouped by category as per user request.
 */
export const featureComparison: FeatureComparisonRow[] = [
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
