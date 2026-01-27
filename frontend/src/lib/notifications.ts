
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
        console.log('Service Worker registered:', registration);
        return registration;
    } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
    }
}

/**
 * Subscribes the user to push notifications
 */
export async function subscribeUserToPush(vapidPublicKey: string) {
    console.log('🔔 [subscribeUserToPush] Starting...');

    if (!isPushSupported()) {
        console.warn('🔔 [subscribeUserToPush] Push not supported');
        return null;
    }

    console.log('🔔 [subscribeUserToPush] Waiting for service worker ready...');
    const registration = await navigator.serviceWorker.ready;
    console.log('🔔 [subscribeUserToPush] Service worker ready:', !!registration);

    if (!registration) {
        console.warn('🔔 [subscribeUserToPush] No registration');
        return null;
    }

    try {
        console.log('🔔 [subscribeUserToPush] Calling pushManager.subscribe...');
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });
        console.log('🔔 [subscribeUserToPush] Subscription success:', !!subscription);

        return subscription;
    } catch (error) {
        console.error('🔔 [subscribeUserToPush] Failed to subscribe:', error);
        throw error; // Propagate error to caller for UI display
    }
}
