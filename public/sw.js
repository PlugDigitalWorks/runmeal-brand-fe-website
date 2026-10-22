/* Runmeal brand site service worker: web push only.
 *
 * Every brand domain is served by the same app, so this one file serves them
 * all. A push carries { id, title, body, path }; title and body are shown as
 * plain text (the Notifications API never renders HTML). `path` is either
 * `/orders/<orderId>` (an order status update) or `/notifications` (an admin
 * announcement), and is only ever followed inside this site.
 */

/** A same-site path to open, or "/" for anything else (absolute or protocol-relative URLs included). */
function safeNotificationPath(path) {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
        return '/';
    }
    return path;
}

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = {};
    }

    const title = typeof payload.title === 'string' && payload.title ? payload.title : self.location.hostname;
    const options = {
        body: typeof payload.body === 'string' ? payload.body : '',
        data: { path: safeNotificationPath(payload.path) },
    };
    if (payload.id) options.tag = String(payload.id);

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
            const tabs = windows.filter((client) => new URL(client.url).origin === self.location.origin);
            // Open tabs refresh their badge and list; they never see the text from here.
            tabs.forEach((client) => client.postMessage({ type: 'notification-received' }));
            // One open tab rings the site's own sound (the one in front first);
            // the notification is then silent, so the system sound does not
            // ring over it. With no tab able to play, the system sound stays.
            const played = await ringInOneTab(tabs);
            return self.registration.showNotification(title, played ? { ...options, silent: true } : options);
        }),
    );
});

/** How long a tab gets to say whether it played the sound. */
const CHIME_REPLY_TIMEOUT_MS = 500;

function askTabToRing(client) {
    return new Promise((resolve) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => resolve(false), CHIME_REPLY_TIMEOUT_MS);
        channel.port1.onmessage = (message) => {
            clearTimeout(timer);
            resolve(Boolean(message.data && message.data.played));
        };
        client.postMessage({ type: 'play-notification-sound' }, [channel.port2]);
    });
}

async function ringInOneTab(tabs) {
    const ordered = [...tabs].sort(
        (a, b) => Number(Boolean(b.focused)) - Number(Boolean(a.focused)) ||
            Number(b.visibilityState === 'visible') - Number(a.visibilityState === 'visible'),
    );
    for (const client of ordered) {
        if (await askTabToRing(client)) return true;
    }
    return false;
}

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const path = safeNotificationPath(event.notification.data && event.notification.data.path);
    const target = new URL(path, self.location.origin).href;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
            const sameSite = windows.find((client) => new URL(client.url).origin === self.location.origin);
            if (sameSite) {
                // navigate() only works on a tab this worker controls; open a new one otherwise.
                return sameSite
                    .focus()
                    .then((client) => (client || sameSite).navigate(target))
                    .catch(() => self.clients.openWindow(target));
            }
            return self.clients.openWindow(target);
        }),
    );
});
