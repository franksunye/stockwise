'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { isStandalone, isWeChat, isIOSSafari, isAndroidChromium, getCNBrowserBrand, type CNBrowserBrand } from '@/lib/device-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The consolidated install-prompt state exposed to UI components. */
export interface InstallPromptState {
    /** What kind of install guidance to show. `null` = no guidance needed. */
    guide:
    | 'wechat'           // User is inside WeChat → must open in external browser
    | 'ios-safari'       // iOS Safari → Share → Add to Home Screen
    | 'android-native'   // Android Chromium → one-click native install prompt
    | 'android-manual'   // Android non-Chromium OEM browser → manual guide
    | null;

    /** For 'android-manual': which OEM browser brand was detected */
    cnBrowser: CNBrowserBrand;

    /** Whether the native prompt is available (Android Chromium only) */
    canPrompt: boolean;

    /** Whether the app is already installed as PWA */
    isInstalled: boolean;

    /** Trigger the native install prompt (Android Chromium only) */
    promptInstall: () => Promise<void>;

    /** User explicitly dismissed the guide */
    dismiss: () => void;

    /** Whether the guide is currently visible */
    visible: boolean;
}

// Extend Window with the non-standard beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    prompt(): Promise<void>;
}

// Persistent key to remember user dismissal for this session
const DISMISS_KEY = 'ziso_install_guide_dismissed';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInstallPrompt(): InstallPromptState {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

    // --- Detect installed state ---
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Check standalone mode
        if (isStandalone()) {
            setIsInstalled(true);
            return;
        }

        // Check session dismissal
        if (sessionStorage.getItem(DISMISS_KEY)) {
            setDismissed(true);
        }

        // Listen for the Android `beforeinstallprompt` event
        const handler = (e: Event) => {
            e.preventDefault(); // Prevent Chrome's default mini-infobar
            const event = e as BeforeInstallPromptEvent;
            promptRef.current = event;
            setDeferredPrompt(event);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Listen for app actually being installed
        const installedHandler = () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
            promptRef.current = null;
        };
        window.addEventListener('appinstalled', installedHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installedHandler);
        };
    }, []);

    // --- Determine which guide to show ---
    const computeGuide = (): InstallPromptState['guide'] => {
        if (typeof window === 'undefined') return null;
        if (isInstalled) return null;

        // Priority 1: WeChat/WxWork  →  must escape first
        if (isWeChat()) return 'wechat';

        // Priority 2: iOS Safari  →  manual Add to Home Screen
        if (isIOSSafari()) return 'ios-safari';

        // Priority 3: Android Chromium with deferred prompt  →  native one-click
        if (isAndroidChromium() && deferredPrompt) return 'android-native';

        // Priority 4: Android other browsers → manual guide with brand detection
        if (getCNBrowserBrand()) return 'android-manual';

        return null;
    };

    const guide = computeGuide();
    const cnBrowser = typeof window !== 'undefined' ? getCNBrowserBrand() : null;

    // --- Actions ---
    const promptInstall = useCallback(async () => {
        const prompt = promptRef.current;
        if (!prompt) return;
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
            setIsInstalled(true);
        }
        setDeferredPrompt(null);
        promptRef.current = null;
    }, []);

    const dismiss = useCallback(() => {
        setDismissed(true);
        sessionStorage.setItem(DISMISS_KEY, '1');
    }, []);

    return {
        guide,
        cnBrowser,
        canPrompt: !!deferredPrompt,
        isInstalled,
        promptInstall,
        dismiss,
        visible: guide !== null && !dismissed && !isInstalled,
    };
}
