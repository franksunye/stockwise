'use client';

import { useEffect } from 'react';

/**
 * Failsafe: hide #app-splash after the intended mobile splash window.
 * This must not override root-bootstrap's immediate/4s decision on mount.
 */
export function SplashDismiss() {
    useEffect(() => {
        const timer = window.setTimeout(() => {
            const splash = document.getElementById('app-splash');
            if (!splash) return;
            splash.style.opacity = '0';
            splash.style.pointerEvents = 'none';
        }, 4500);
        return () => window.clearTimeout(timer);
    }, []);
    return null;
}
