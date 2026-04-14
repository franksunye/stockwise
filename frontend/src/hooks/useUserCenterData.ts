'use client';

import { useCallback, useEffect, useState } from 'react';
import { useGlobalT, useLocale } from '@/context/LocaleContext';
import { getCurrentUser } from '@/lib/user';
import {
    isPushSupported,
    registerServiceWorker,
    subscribeUserToPush,
} from '@/lib/notifications';
import { shouldEnableHighPerformance } from '@/lib/device-utils';
import {
    DEFAULT_NOTIFICATION_SETTINGS,
    normalizeNotificationSettings,
    readCachedUserCenterMode,
    type NotificationSettings,
    type UserCenterModeSummary,
} from '@/lib/user-center-data';
import type { UserProfile } from '@/hooks/useUserProfile';

type RefreshProfile = (options?: { watchlist?: string[]; force?: boolean }) => Promise<UserProfile | null>;

type UseUserCenterDataArgs = {
    isOpen: boolean;
    refreshProfile: RefreshProfile;
};

export function useUserCenterData({ isOpen, refreshProfile }: UseUserCenterDataArgs) {
    const tGlobal = useGlobalT();
    const { locale } = useLocale();
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [pushSupported, setPushSupported] = useState(false);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [testingPush, setTestingPush] = useState(false);
    const [testingRemotePush, setTestingRemotePush] = useState(false);
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
    const [isHighPerformance, setIsHighPerformance] = useState(false);
    const [showAndroidPushWarning, setShowAndroidPushWarning] = useState(false);
    const [currentMode, setCurrentMode] = useState<UserCenterModeSummary | null>(null);

    useEffect(() => {
        setIsHighPerformance(shouldEnableHighPerformance());
        const isAndroidDevice = /android/i.test(navigator.userAgent);

        if (!isAndroidDevice) {
            setShowAndroidPushWarning(false);
            return;
        }

        let cancelled = false;
        void fetch('/api/ux-experiment/ping', { cache: 'no-store' })
            .then((res) => (res.ok ? res.json() : null))
            .then((data: { region?: string } | null) => {
                if (cancelled) return;
                setShowAndroidPushWarning(String(data?.region || '').toUpperCase() === 'CN');
            })
            .catch(() => {
                if (!cancelled) {
                    setShowAndroidPushWarning(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const loadCurrentMode = useCallback(async () => {
        const cachedMode = readCachedUserCenterMode(localStorage.getItem('stockwise:investment-mode-card'));
        if (cachedMode) {
            setCurrentMode(cachedMode);
        }

        try {
            const res = await fetch('/api/user/mode/summary', { cache: 'no-store' });
            const data = await res.json();
            if (data.mode) {
                setCurrentMode(data.mode);
            }
        } catch (error) {
            console.error('Failed to load investment mode summary', error);
        }
    }, []);

    const loadNotificationSettings = useCallback(async () => {
        try {
            await getCurrentUser();
            const res = await fetch('/api/user/notification-settings');
            if (!res.ok) return;
            const data = await res.json();
            if (data.settings) {
                setNotificationSettings(normalizeNotificationSettings(data.settings));
            }
        } catch (error) {
            console.error('Failed to load notification settings', error);
        }
    }, []);

    const refreshPushStatus = useCallback(async () => {
        const supported = isPushSupported();
        setPushSupported(supported);
        if (!supported) {
            setIsSubscribed(false);
            setNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS);
            return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);

        if (subscription) {
            await loadNotificationSettings();
        }
    }, [loadNotificationSettings]);

    useEffect(() => {
        if (!isOpen) return;

        void refreshProfile({ force: true });
        void refreshPushStatus();
        void loadCurrentMode();
    }, [isOpen, loadCurrentMode, refreshProfile, refreshPushStatus]);

    const handleEnableNotifications = async () => {
        setIsSubscribing(true);
        try {
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            if (!vapidKey) {
                return { success: false, message: tGlobal('user.push.vapidMissing') };
            }

            const registration = await registerServiceWorker();
            if (!registration) {
                return { success: false, message: tGlobal('user.push.swRegisterFailed') };
            }

            let permission = Notification.permission;
            if (permission !== 'granted') {
                permission = await Notification.requestPermission();
            }
            if (permission !== 'granted') {
                return { success: false, message: tGlobal('user.push.permissionDenied') };
            }

            const swRegistration = await navigator.serviceWorker.ready;
            let subscription = await swRegistration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await subscribeUserToPush(vapidKey);
            }

            if (!subscription) {
                return { success: false, message: tGlobal('user.push.noSubscription') };
            }

            const response = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: subscription.toJSON() }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                return {
                    success: false,
                    message: tGlobal('user.push.saveFailed', {
                        detail: String((data as { error?: string }).error || response.status),
                    }),
                };
            }

            setIsSubscribed(true);
            await loadNotificationSettings();
            return { success: true, message: tGlobal('user.push.success') };
        } catch (error) {
            console.error(error);
            return { success: false, message: tGlobal('user.push.enableFailed') };
        } finally {
            setIsSubscribing(false);
        }
    };

    const handleDisableNotifications = async () => {
        setIsSubscribing(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                await fetch('/api/notifications/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                });
            }
            setIsSubscribed(false);
            return true;
        } catch (error) {
            console.error(error);
            return false;
        } finally {
            setIsSubscribing(false);
        }
    };

    const handleTestPush = async () => {
        if (testingPush) return false;
        setTestingPush(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            if (!registration) return false;
            const timeStr = new Date().toLocaleTimeString(locale === 'en' ? 'en-US' : 'zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });
            await registration.showNotification(tGlobal('user.push.testNotificationTitle'), {
                body: tGlobal('user.push.testNotificationBody', { time: timeStr }),
                icon: '/logo.png',
                badge: '/logo.png',
                data: { url: '/dashboard' },
            });
            return true;
        } catch (error) {
            console.error(error);
            return false;
        } finally {
            setTestingPush(false);
        }
    };

    const handleTestRemotePush = async () => {
        if (testingRemotePush) {
            return { success: false, message: tGlobal('user.push.testRemotePushSending') };
        }

        setTestingRemotePush(true);
        try {
            const response = await fetch('/api/notifications/test-remote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const detail = String((data as { error?: string }).error || response.status);
                return {
                    success: false,
                    message: tGlobal('user.push.testRemotePushFailed', { detail }),
                };
            }

            return {
                success: true,
                message: tGlobal('user.push.testRemotePushSuccess'),
            };
        } catch (error) {
            console.error(error);
            return {
                success: false,
                message: tGlobal('user.push.testRemotePushFailed', { detail: 'network' }),
            };
        } finally {
            setTestingRemotePush(false);
        }
    };

    const updateNotificationSetting = async (
        key: keyof NotificationSettings['types'],
        enabled: boolean,
    ) => {
        const newSettings = normalizeNotificationSettings({
            ...notificationSettings,
            types: {
                ...notificationSettings.types,
                [key]: {
                    ...notificationSettings.types[key],
                    enabled,
                },
            },
        });

        setNotificationSettings(newSettings);
        try {
            await fetch('/api/user/notification-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: newSettings }),
            });
        } catch (error) {
            console.error(error);
        }
    };

    return {
        currentMode,
        handleDisableNotifications,
        handleEnableNotifications,
        handleTestPush,
        handleTestRemotePush,
        isHighPerformance,
        isSubscribed,
        isSubscribing,
        notificationSettings,
        pushSupported,
        showAndroidPushWarning,
        testingPush,
        testingRemotePush,
        updateNotificationSetting,
    };
}
