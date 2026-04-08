'use client';

import { useEffect } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';

/**
 * AnalyticsTracker - Synchronizes user identity and tier with tracking tools.
 * 
 * Supports:
 * - Google Analytics 4 (gtag)
 * - Microsoft Clarity (identify + setTag)
 */
export function AnalyticsTracker() {
    const { userId, tier } = useUserProfile();

    useEffect(() => {
        if (!userId) return;

        // 1. Tag Microsoft Clarity
        if (typeof window !== 'undefined' && (window as any).clarity) {
            const clarity = (window as any).clarity;
            
            // Identify the unique user
            clarity('identify', userId);
            
            // Set custom tags for filtering recordings
            clarity('set', 'tier', tier);
        }

        // 2. Tag Google Analytics 4
        if (typeof window !== 'undefined' && (window as any).gtag) {
            const gtag = (window as any).gtag;
            
            // Set User ID for cross-device tracking
            gtag('set', 'user_id', userId);
            
            // Set custom user property (requires GA4 custom dimension setup)
            gtag('set', 'user_properties', {
                user_tier: tier,
            });
        }
    }, [userId, tier]);

    return null; // This is a headless logic component
}
