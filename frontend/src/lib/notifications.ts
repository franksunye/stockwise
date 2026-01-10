
/**
 * Converts a base64 string to a Uint8Array for VAPID key usage.
 */
export function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Checks if Push API is supported
 */
export function isPushSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Registers the service worker
 */
export async function registerServiceWorker() {
    if (!isPushSupported()) return null;

    try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('🔔 [SW] Registered:', registration);

        // 强制触发更新检查
        registration.update().catch(err => console.warn('🔔 [SW] Update check failed:', err));

        // 监听新 SW 的发现
        registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed') {
                        if (navigator.serviceWorker.controller) {
                            console.log('🔔 [SW] New content is available; please refresh.');
                            // 可以在这里触发 UI 提醒或者自动刷新
                        } else {
                            console.log('🔔 [SW] Content is cached for offline use.');
                        }
                    }
                };
            }
        };

        return registration;
    } catch (error) {
        console.error('🔔 [SW] Registration failed:', error);
        return null;
    }
}

/**
 * Subscribes the user to push notifications
 */
export async function subscribeUserToPush(vapidPublicKey: string) {
    if (!isPushSupported()) return null;

    const registration = await navigator.serviceWorker.ready;
    if (!registration) return null;

    try {
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

        return subscription;
    } catch (error) {
        console.error('Failed to subscribe the user: ', error);
        return null;
    }
}
