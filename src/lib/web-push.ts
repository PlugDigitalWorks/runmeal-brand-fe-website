import { getApiErrorDetails } from '@/lib/api-errors';
import { pushService } from '@/services/push.service';

/** Served from the site root, so its scope covers every page of every brand domain. */
export const SERVICE_WORKER_URL = '/sw.js';

/**
 * Where enabling push ended up:
 * - `subscribed`: this browser receives the customer's notifications.
 * - `unavailable`: the API has push switched off (or not deployed); hide the option.
 * - `denied` / `dismissed`: the browser prompt was refused or closed.
 * - `error`: anything else; `code` is the API error code when there was one.
 */
export type PushSyncResult =
    | { status: 'subscribed' }
    | { status: 'unavailable' }
    | { status: 'denied' }
    | { status: 'dismissed' }
    | { status: 'error'; code: string | null };

const isAppleMobile = () => {
    const { userAgent, platform, maxTouchPoints } = navigator;
    // iPadOS reports itself as a Mac; touch points tell them apart.
    return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
};

const isStandalone = () =>
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true;

/**
 * Whether this browser can take web push. iPhone and iPad Safari only allow it
 * once the site is opened from the home screen, so there it is offered only then.
 */
export function isWebPushSupported(): boolean {
    if (typeof window === 'undefined') return false;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false;
    if (isAppleMobile() && !isStandalone()) return false;
    return true;
}

/** The VAPID public key arrives base64url-encoded; `subscribe()` wants the raw bytes. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const bytes = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return bytes;
}

function sameKey(current: ArrayBuffer | null | undefined, next: Uint8Array) {
    if (!current) return false;
    const bytes = new Uint8Array(current);
    return bytes.length === next.length && bytes.every((byte, index) => byte === next[index]);
}

async function getRegistration() {
    await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/' });
    // subscribe() needs an active worker, which `ready` waits for.
    return navigator.serviceWorker.ready;
}

/** Codes the API answers when push is switched off; a 404 means the endpoints are not deployed here yet. */
const isPushOff = (statusCode: number | undefined, code: string | null) =>
    code === 'PUSH_NOT_CONFIGURED' || statusCode === 503 || (statusCode === 404 && code !== 'BRAND_DOMAIN_NOT_FOUND');

/**
 * Binds this browser's push subscription to the signed-in customer. Run it
 * once permission is granted, on every sign-in and every app start: it keeps
 * the subscription on the current user and stops the API pruning it after
 * 180 idle days. Never logs the endpoint or keys.
 */
export async function syncWebPushSubscription(): Promise<PushSyncResult> {
    let publicKey: string;
    try {
        publicKey = await pushService.getPublicKey();
    } catch (error) {
        const { statusCode, code } = getApiErrorDetails(error);
        if (isPushOff(statusCode, code)) return { status: 'unavailable' };
        console.error('[push] Could not load the public key', code ?? statusCode);
        return { status: 'error', code };
    }

    let subscription: PushSubscription;
    try {
        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        const registration = await getRegistration();
        const existing = await registration.pushManager.getSubscription();
        // A rotated key makes the old subscription useless: start over.
        if (existing && !sameKey(existing.options.applicationServerKey, applicationServerKey)) {
            await existing.unsubscribe();
        }
        subscription =
            existing && sameKey(existing.options.applicationServerKey, applicationServerKey)
                ? existing
                : await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    } catch (error) {
        console.error('[push] The browser refused the subscription', error instanceof Error ? error.name : '');
        return { status: 'error', code: null };
    }

    try {
        await pushService.register(subscription.toJSON());
        return { status: 'subscribed' };
    } catch (error) {
        const { statusCode, code } = getApiErrorDetails(error);
        if (isPushOff(statusCode, code)) return { status: 'unavailable' };
        if (code === 'VALIDATION_FAILED') {
            // The subscription object is broken: drop it, the next sign-in subscribes afresh.
            await subscription.unsubscribe().catch(() => undefined);
        } else if (code === 'BRAND_DOMAIN_NOT_FOUND') {
            console.error('[push] This site is not a known brand domain', code);
        }
        return { status: 'error', code };
    }
}

/** Asks the browser for permission (after the site has explained why), then subscribes. */
export async function enableWebPush(): Promise<PushSyncResult> {
    const permission = await Notification.requestPermission();
    if (permission === 'denied') return { status: 'denied' };
    if (permission !== 'granted') return { status: 'dismissed' };
    return syncWebPushSubscription();
}

/**
 * Detaches this browser before signing out, so whoever uses it next does not
 * get the previous customer's notifications: the API forgets the endpoint,
 * then the browser drops the subscription. Never throws — signing out must
 * go on even when this fails.
 */
export async function removeWebPushSubscription(): Promise<void> {
    try {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
        const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
        const subscription = await registration?.pushManager?.getSubscription();
        if (!subscription) return;

        try {
            await pushService.remove(subscription.endpoint);
        } catch (error) {
            console.error('[push] Could not detach the subscription', getApiErrorDetails(error).code);
        }
        await subscription.unsubscribe();
    } catch (error) {
        console.error('[push] Could not unsubscribe', error instanceof Error ? error.name : '');
    }
}
