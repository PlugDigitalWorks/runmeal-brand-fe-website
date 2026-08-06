/**
 * Stable per-browser id sent as `x-device-id`.
 *
 * The backend binds a refresh session to it, so it must survive reloads and
 * stay identical across tabs — localStorage, not sessionStorage. It is not a
 * secret and carries no personal data; it only lets one browser keep one
 * guest session instead of collecting a new one on every scan.
 */

const DEVICE_ID_KEY = 'rm_device_id';

const createId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Older Safari/in-app browsers: good enough for a non-secret correlation id.
    return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export function getDeviceId(): string | undefined {
    if (typeof window === 'undefined') return undefined;

    try {
        const existing = window.localStorage.getItem(DEVICE_ID_KEY);
        if (existing) return existing;

        const created = createId();
        window.localStorage.setItem(DEVICE_ID_KEY, created);
        return created;
    } catch {
        // Private mode / storage disabled: the header simply goes out empty.
        return undefined;
    }
}
