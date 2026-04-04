/**
 * Global Stripe Price ID Strategy — Source of Truth
 * Dual-market (Domestic CNY / International USD) configuration.
 */
export const STRIPE_PRICE_IDS = {
    // Domestic (CNY)
    PRO_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_MONTHLY || 'price_1Su1zqS3fDFObThpZbYXr2GG',
    PRO_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_YEARLY || 'price_1Su1zqS3fDFObThp7iG6X6bK',
    
    // International (USD)
    GO_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_GO_MONTHLY || 'price_1TI91aS3fDFObThpM9Y6A6YE',
    GO_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_GO_YEARLY || 'price_1TI91aS3fDFObThpgSKgQss6',
} as const;

export const STRIPE_PRICE_ID_WHITELIST = Object.values(STRIPE_PRICE_IDS) as string[];

export function isSupportedPriceId(id: string | null | undefined): id is string {
    return !!id && STRIPE_PRICE_ID_WHITELIST.includes(id);
}
