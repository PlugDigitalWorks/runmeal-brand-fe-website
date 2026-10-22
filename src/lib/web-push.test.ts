import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/push.service', () => ({
    pushService: {
        getPublicKey: vi.fn(),
        register: vi.fn(),
        remove: vi.fn(),
    },
}));

import { pushService } from '@/services/push.service';
import {
    enableWebPush,
    isWebPushSupported,
    removeWebPushSubscription,
    syncWebPushSubscription,
    urlBase64ToUint8Array,
} from './web-push';

// "AQID" is base64url for the bytes [1, 2, 3].
const PUBLIC_KEY = 'AQID';
const SUBSCRIPTION_JSON = {
    endpoint: 'https://push.example.com/send/abc',
    expirationTime: null,
    keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
};

const apiError = (status: number, code: string) => ({ response: { status, data: { statusCode: status, code } } });

function fakeSubscription(keyBytes: number[]) {
    return {
        endpoint: SUBSCRIPTION_JSON.endpoint,
        options: { applicationServerKey: Uint8Array.from(keyBytes).buffer },
        toJSON: vi.fn(() => SUBSCRIPTION_JSON),
        unsubscribe: vi.fn(async () => true),
    };
}

let existing: ReturnType<typeof fakeSubscription> | null;
let created: ReturnType<typeof fakeSubscription>;
let registration: { pushManager: { getSubscription: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> } };
let requestPermission: ReturnType<typeof vi.fn>;

function installBrowser({ push = true, userAgent }: { push?: boolean; userAgent?: string } = {}) {
    registration = {
        pushManager: {
            getSubscription: vi.fn(async () => existing),
            subscribe: vi.fn(async () => created),
        },
    };
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            register: vi.fn(async () => registration),
            ready: Promise.resolve(registration),
            getRegistration: vi.fn(async () => registration),
        },
    });
    if (push) Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
    else delete (window as { PushManager?: unknown }).PushManager;
    requestPermission = vi.fn(async () => 'granted');
    Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: { permission: 'default', requestPermission },
    });
    if (userAgent) Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent });
}

beforeEach(() => {
    existing = null;
    created = fakeSubscription([1, 2, 3]);
    installBrowser();
    vi.mocked(pushService.getPublicKey).mockResolvedValue(PUBLIC_KEY);
    vi.mocked(pushService.register).mockResolvedValue(undefined);
    vi.mocked(pushService.remove).mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    delete (navigator as { userAgent?: string }).userAgent;
    vi.restoreAllMocks();
});

describe('isWebPushSupported', () => {
    it('is true with a service worker, PushManager and Notification', () => {
        expect(isWebPushSupported()).toBe(true);
    });

    it('is false without PushManager', () => {
        installBrowser({ push: false });
        expect(isWebPushSupported()).toBe(false);
    });

    it('is false on iPhone Safari outside the home-screen app', () => {
        installBrowser({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1' });
        expect(isWebPushSupported()).toBe(false);
    });
});

describe('urlBase64ToUint8Array', () => {
    it('decodes base64url, padding included', () => {
        expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
        expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255]);
    });
});

describe('enableWebPush', () => {
    it('asks for permission, subscribes with the public key and registers toJSON()', async () => {
        const result = await enableWebPush();

        expect(requestPermission).toHaveBeenCalledTimes(1);
        expect(registration.pushManager.subscribe).toHaveBeenCalledWith({
            userVisibleOnly: true,
            applicationServerKey: expect.any(Uint8Array),
        });
        const key = registration.pushManager.subscribe.mock.calls[0][0].applicationServerKey as Uint8Array;
        expect(Array.from(key)).toEqual([1, 2, 3]);
        expect(pushService.register).toHaveBeenCalledWith(SUBSCRIPTION_JSON);
        expect(result).toEqual({ status: 'subscribed' });
    });

    it('stops when the customer blocks the prompt', async () => {
        requestPermission.mockResolvedValue('denied');

        expect(await enableWebPush()).toEqual({ status: 'denied' });
        expect(pushService.getPublicKey).not.toHaveBeenCalled();
        expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    });
});

describe('syncWebPushSubscription', () => {
    it('reuses a subscription made with the same key', async () => {
        existing = fakeSubscription([1, 2, 3]);

        await syncWebPushSubscription();

        expect(existing.unsubscribe).not.toHaveBeenCalled();
        expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
        expect(pushService.register).toHaveBeenCalledWith(SUBSCRIPTION_JSON);
    });

    it('unsubscribes and subscribes again when the key changed', async () => {
        const stale = fakeSubscription([9, 9, 9]);
        existing = stale;

        await syncWebPushSubscription();

        expect(stale.unsubscribe).toHaveBeenCalled();
        expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(1);
        expect(stale.unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
            registration.pushManager.subscribe.mock.invocationCallOrder[0],
        );
        expect(pushService.register).toHaveBeenCalledWith(SUBSCRIPTION_JSON);
    });

    it('reports push as unavailable when the API has it switched off', async () => {
        vi.mocked(pushService.getPublicKey).mockRejectedValue(apiError(503, 'PUSH_NOT_CONFIGURED'));

        expect(await syncWebPushSubscription()).toEqual({ status: 'unavailable' });
        expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    });

    it('drops a subscription the API calls invalid', async () => {
        vi.mocked(pushService.register).mockRejectedValue(apiError(400, 'VALIDATION_FAILED'));

        expect(await syncWebPushSubscription()).toEqual({ status: 'error', code: 'VALIDATION_FAILED' });
        expect(created.unsubscribe).toHaveBeenCalled();
    });

    it.each(['PUSH_ENDPOINT_NOT_ALLOWED', 'PUSH_GUEST_NOT_ALLOWED'])('passes %s on for the customer', async (code) => {
        vi.mocked(pushService.register).mockRejectedValue(apiError(code === 'PUSH_GUEST_NOT_ALLOWED' ? 403 : 400, code));

        expect(await syncWebPushSubscription()).toEqual({ status: 'error', code });
    });

    it('never logs the endpoint or keys', async () => {
        vi.mocked(pushService.register).mockRejectedValue(apiError(404, 'BRAND_DOMAIN_NOT_FOUND'));

        await syncWebPushSubscription();

        const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
        expect(logged).not.toContain(SUBSCRIPTION_JSON.endpoint);
        expect(logged).not.toContain('p256dh-key');
        expect(logged).not.toContain('auth-secret');
    });
});

describe('removeWebPushSubscription', () => {
    it('tells the API to forget the endpoint, then unsubscribes the browser', async () => {
        existing = fakeSubscription([1, 2, 3]);

        await removeWebPushSubscription();

        expect(pushService.remove).toHaveBeenCalledWith(SUBSCRIPTION_JSON.endpoint);
        expect(vi.mocked(pushService.remove).mock.invocationCallOrder[0]).toBeLessThan(
            existing.unsubscribe.mock.invocationCallOrder[0],
        );
    });

    it('still unsubscribes and does not throw when the API call fails', async () => {
        existing = fakeSubscription([1, 2, 3]);
        vi.mocked(pushService.remove).mockRejectedValue(apiError(500, 'INTERNAL_ERROR'));

        await expect(removeWebPushSubscription()).resolves.toBeUndefined();
        expect(existing.unsubscribe).toHaveBeenCalled();
    });

    it('does nothing when this browser has no subscription', async () => {
        await removeWebPushSubscription();

        expect(pushService.remove).not.toHaveBeenCalled();
    });
});
