/**
 * Global Stripe Price ID Strategy — Source of Truth
 * Dual-market (Domestic CNY / International USD) configuration.
 */
export const STRIPE_PRICE_IDS = {
    /**
     * Domestic (CNY) - Using CN_GO nomenclature
     */
    CN_GO_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_CN_GO_MONTHLY || 
                   process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_MONTHLY || 
                   'price_1TJtsmS3fDFObThpyi0k4Mya',
    CN_GO_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_CN_GO_YEARLY || 
                  process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PRO_YEARLY || 
                  'price_1TJttdS3fDFObThp9Hx4UASp',
    
    /**
     * International (USD) - Using USD_GO / USD_PLUS nomenclature
     */
    USD_GO_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_USD_GO_MONTHLY || 
                    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_GO_MONTHLY || 
                    'price_1TI91aS3fDFObThpM9Y6A6YE',
    USD_GO_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_USD_GO_YEARLY || 
                   process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_GO_YEARLY || 
                   'price_1TI91aS3fDFObThpgSKgQss6',

    USD_PLUS_MONTHLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_USD_PLUS_MONTHLY || '', // Future expansion
    USD_PLUS_YEARLY: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_USD_PLUS_YEARLY || '',   // Future expansion
} as const;

// DEPRECATED: Standardizing on CN_GO / USD_GO nomenclature above.
// Kept temporarily for smooth transition if needed in other modules.
export const PRO_MONTHLY = STRIPE_PRICE_IDS.CN_GO_MONTHLY;
export const PRO_YEARLY = STRIPE_PRICE_IDS.CN_GO_YEARLY;
export const GO_MONTHLY = STRIPE_PRICE_IDS.USD_GO_MONTHLY;
export const GO_YEARLY = STRIPE_PRICE_IDS.USD_GO_YEARLY;

export const STRIPE_PRICE_ID_WHITELIST = Object.values(STRIPE_PRICE_IDS) as string[];

export function isSupportedPriceId(id: string | null | undefined): id is string {
    return !!id && STRIPE_PRICE_ID_WHITELIST.includes(id);
}
