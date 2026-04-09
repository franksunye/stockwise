'use client';

/**
 * Global tracking type definitions to avoid 'any' usage.
 */
type GTagEvent = (action: 'event', eventName: string, params?: Record<string, unknown>) => void;
type GTagSet = (action: 'set', name: string, value: string | boolean) => void;
type GTag = GTagEvent & GTagSet;

type ClarityAction = (action: 'set' | 'identify', ...args: string[]) => void;

interface AnalyticsWindow extends Window {
  gtag?: GTag;
  clarity?: ClarityAction;
}

/**
 * useAnalytics - Centralized hook for firing tracking events to GA4 and Clarity.
 */
export function useAnalytics() {
  
  const trackEvent = (eventName: string, params?: Record<string, unknown>) => {
    if (typeof window === 'undefined') return;

    const analyticsWindow = window as unknown as AnalyticsWindow;

    // 1. Google Analytics 4
    if (analyticsWindow.gtag) {
      analyticsWindow.gtag('event', eventName, params);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Analytics] GA4 Event: ${eventName}`, params);
      }
    }

    // 2. Microsoft Clarity
    if (analyticsWindow.clarity) {
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          analyticsWindow.clarity?.('set', key, String(value));
        });
      }
      analyticsWindow.clarity('set', 'last_event', eventName);
    }
  };

  const setIdentifier = (userId: string) => {
    if (typeof window === 'undefined') return;
    
    const analyticsWindow = window as unknown as AnalyticsWindow;

    if (analyticsWindow.gtag) {
      analyticsWindow.gtag('set', 'user_id', userId);
    }

    if (analyticsWindow.clarity) {
      analyticsWindow.clarity('identify', userId);
    }
  };

  return { trackEvent, setIdentifier };
}
