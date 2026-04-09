'use client';

/**
 * useAnalytics - Centralized hook for firing tracking events to GA4 and Clarity.
 * 
 * Usage:
 *   const { trackEvent, setIdentifier } = useAnalytics();
 *   trackEvent('sign_up', { method: 'invite' });
 */
export function useAnalytics() {
  
  /**
   * Tracks a custom event in GA4 and Clarity.
   */
  const trackEvent = (eventName: string, params?: Record<string, any>) => {
    if (typeof window === 'undefined') return;

    // 1. Google Analytics 4
    if ('gtag' in window) {
      const gtag = (window as any).gtag;
      gtag('event', eventName, params);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Analytics] GA4 Event: ${eventName}`, params);
      }
    }

    // 2. Microsoft Clarity (using setTag for custom events)
    if ('clarity' in window) {
      const clarity = (window as any).clarity;
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          clarity('set', key, String(value));
        });
      }
      // Clarity doesn't have a direct 'event' API like GA4, 
      // but 'set' can be used to tag the session for subsequent recording filtering.
      clarity('set', 'last_event', eventName);
    }
  };

  /**
   * Sets the user identifier for cross-device tracking.
   */
  const setIdentifier = (userId: string) => {
    if (typeof window === 'undefined') return;

    if ('gtag' in window) {
      (window as any).gtag('set', 'user_id', userId);
    }

    if ('clarity' in window) {
      (window as any).clarity('identify', userId);
    }
  };

  return { trackEvent, setIdentifier };
}
