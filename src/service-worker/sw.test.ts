import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const workerSource = readFileSync(path.join(__dirname, '../../public/sw.js'), 'utf8');
const ORIGIN = 'https://order.example.com';

type Listener = (event: unknown) => void;

interface FakeClient {
    url: string;
    focus: ReturnType<typeof vi.fn>;
    navigate: ReturnType<typeof vi.fn>;
}

function loadWorker(windows: FakeClient[] = []) {
    const listeners: Record<string, Listener> = {};
    const fakeSelf = {
        addEventListener: (type: string, listener: Listener) => {
            listeners[type] = listener;
        },
        skipWaiting: vi.fn(),
        location: new URL(`${ORIGIN}/sw.js`),
        registration: { showNotification: vi.fn<(title: string, options?: { silent?: boolean }) => Promise<void>>(async () => undefined) },
        clients: {
            claim: vi.fn(async () => undefined),
            matchAll: vi.fn(async () => windows),
            openWindow: vi.fn(async () => null),
        },
    };
    new Function('self', workerSource)(fakeSelf);
    return { fakeSelf, listeners };
}

const fakeClient = (url: string): FakeClient => {
    const client: FakeClient = { url, focus: vi.fn(), navigate: vi.fn(async () => null) };
    client.focus.mockImplementation(async () => client);
    return client;
};

async function click(listeners: Record<string, Listener>, data: unknown) {
    const waits: Promise<unknown>[] = [];
    const notification = { close: vi.fn(), data };
    listeners.notificationclick({ notification, waitUntil: (promise: Promise<unknown>) => waits.push(promise) });
    await Promise.all(waits);
    return notification;
}

describe('service worker', () => {
    it('shows a push as a notification, tagged with its id and keeping its path', async () => {
        const { fakeSelf, listeners } = loadWorker();
        const waits: Promise<unknown>[] = [];

        listeners.push({
            data: { json: () => ({ id: 'n-1', title: '<b>Siparişin yolda</b>', body: 'Kuryen çıktı.', path: '/orders/o-1' }) },
            waitUntil: (promise: Promise<unknown>) => waits.push(promise),
        });
        await Promise.all(waits);

        expect(fakeSelf.registration.showNotification).toHaveBeenCalledWith('<b>Siparişin yolda</b>', {
            body: 'Kuryen çıktı.',
            tag: 'n-1',
            data: { path: '/orders/o-1' },
        });
    });

    it('opens the notification path in a new window when no tab of the site is open', async () => {
        const { fakeSelf, listeners } = loadWorker([fakeClient('https://other.example.com/')]);

        const notification = await click(listeners, { path: '/notifications' });

        expect(notification.close).toHaveBeenCalled();
        expect(fakeSelf.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/notifications`);
    });

    it('focuses an open tab of the site and sends it to the path', async () => {
        const tab = fakeClient(`${ORIGIN}/menu`);
        const { fakeSelf, listeners } = loadWorker([tab]);

        await click(listeners, { path: '/orders/o-1' });

        expect(tab.focus).toHaveBeenCalled();
        expect(tab.navigate).toHaveBeenCalledWith(`${ORIGIN}/orders/o-1`);
        expect(fakeSelf.clients.openWindow).not.toHaveBeenCalled();
    });

    it.each(['//evil.example.com/x', 'https://evil.example.com/', 'javascript:alert(1)', '/\\evil.example.com', undefined])(
        'opens the home page for an unsafe path (%s)',
        async (badPath) => {
            const { fakeSelf, listeners } = loadWorker();

            await click(listeners, { path: badPath });

            expect(fakeSelf.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
        },
    );

    /** An open tab of the site that answers the sound request with `played`. */
    const ringingTab = (url: string, played: boolean | null, extra: Record<string, unknown> = {}) => ({
        ...fakeClient(url),
        ...extra,
        postMessage: vi.fn((message: { type: string }, ports?: MessagePort[]) => {
            if (message.type === 'play-notification-sound' && played !== null) ports?.[0].postMessage({ played });
        }),
    });

    async function push(listeners: Record<string, Listener>) {
        const waits: Promise<unknown>[] = [];
        listeners.push({
            data: { json: () => ({ id: 'n-3', title: 'Gizli başlık', body: 'Gizli metin', path: '/notifications' }) },
            waitUntil: (promise: Promise<unknown>) => waits.push(promise),
        });
        await Promise.all(waits);
    }

    it('tells open tabs a notification arrived, without the text', async () => {
        const tab = ringingTab(`${ORIGIN}/notifications`, false);
        const { listeners } = loadWorker([tab]);

        await push(listeners);

        expect(tab.postMessage).toHaveBeenCalledWith({ type: 'notification-received' });
        expect(JSON.stringify(tab.postMessage.mock.calls)).not.toContain('Gizli');
    });

    it('lets an open tab ring the sound and shows the notification silently', async () => {
        const { fakeSelf, listeners } = loadWorker([ringingTab(`${ORIGIN}/menu`, true)]);

        await push(listeners);

        expect(fakeSelf.registration.showNotification).toHaveBeenCalledWith('Gizli başlık', expect.objectContaining({ silent: true }));
    });

    it('keeps the system sound when no tab could play it', async () => {
        const { fakeSelf, listeners } = loadWorker([ringingTab(`${ORIGIN}/menu`, false)]);

        await push(listeners);

        const options = fakeSelf.registration.showNotification.mock.calls[0][1];
        expect(options?.silent).toBeUndefined();
    });

    it('keeps the system sound when a tab does not answer in time', async () => {
        const { fakeSelf, listeners } = loadWorker([ringingTab(`${ORIGIN}/menu`, null)]);

        await push(listeners);

        const options = fakeSelf.registration.showNotification.mock.calls[0][1];
        expect(options?.silent).toBeUndefined();
    });

    it('asks only one tab, the one in front first', async () => {
        const background = ringingTab(`${ORIGIN}/a`, true, { focused: false, visibilityState: 'hidden' });
        const front = ringingTab(`${ORIGIN}/b`, true, { focused: true, visibilityState: 'visible' });
        const { listeners } = loadWorker([background, front]);

        await push(listeners);

        const asked = (tab: typeof front) =>
            tab.postMessage.mock.calls.some(([message]) => (message as { type: string }).type === 'play-notification-sound');
        expect(asked(front)).toBe(true);
        expect(asked(background)).toBe(false);
    });

    it('never sends a push with an unsafe path anywhere but the home page', async () => {
        const { fakeSelf, listeners } = loadWorker();
        const waits: Promise<unknown>[] = [];

        listeners.push({
            data: { json: () => ({ id: 'n-2', title: 'x', body: 'y', path: '//evil.example.com' }) },
            waitUntil: (promise: Promise<unknown>) => waits.push(promise),
        });
        await Promise.all(waits);

        expect(fakeSelf.registration.showNotification).toHaveBeenCalledWith('x', expect.objectContaining({ data: { path: '/' } }));
    });
});
