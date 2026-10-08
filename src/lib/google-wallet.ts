/**
 * Google Wallet helpers for the stamp-card "Add to Google Wallet" button.
 *
 * Unlike Apple, the pass lives on Google's servers: the backend registers the
 * card with the Wallet API and hands back a signed "save" link. These helpers
 * only decide how the button should present itself on the current device and
 * make sure the browser is only ever sent to Google's save page.
 */

/**
 * - `android`: opening the save link shows the Google Wallet "Add" sheet.
 * - `desktop`: Windows / Mac / Linux. The link still works — the pass is saved
 *   to the Google account and shows up on the customer's Android phone — so
 *   the button stays available with a hint.
 * - `unsupported`: iPhone / iPad, which get the Apple Wallet button instead.
 */
export type GoogleWalletPlatform = 'android' | 'desktop' | 'unsupported';

/**
 * Off unless the build sets `NEXT_PUBLIC_GOOGLE_WALLET_ENABLED=true`. Until
 * Google grants publishing access only test accounts can save passes, so the
 * button ships on staging and stays hidden in production.
 */
const isGoogleWalletEnabled = process.env.NEXT_PUBLIC_GOOGLE_WALLET_ENABLED === 'true';

export function detectGoogleWalletPlatform(): GoogleWalletPlatform {
    if (!isGoogleWalletEnabled || typeof navigator === 'undefined') return 'unsupported';

    const userAgent = navigator.userAgent || '';
    if (/Android/i.test(userAgent)) return 'android';
    if (/iPhone|iPod|iPad/i.test(userAgent)) return 'unsupported';

    // iPadOS 13+ reports a desktop Mac user agent; touch support gives it away.
    const isMacLike = /Macintosh|Mac OS X/i.test(userAgent);
    if (isMacLike && navigator.maxTouchPoints > 1) return 'unsupported';

    return 'desktop';
}

const GOOGLE_WALLET_SAVE_ORIGIN = 'https://pay.google.com';
const GOOGLE_WALLET_SAVE_PATH = '/gp/v/save/';

/**
 * Stricter than the Apple check: the link must point at Google's save page.
 * Anything else (missing, relative, another host) is treated as a failed
 * request rather than navigated to.
 */
export function parseGoogleWalletSaveUrl(value: unknown): string | null {
    if (typeof value !== 'string' || !value.trim()) return null;

    try {
        const url = new URL(value);
        return url.origin === GOOGLE_WALLET_SAVE_ORIGIN && url.pathname.startsWith(GOOGLE_WALLET_SAVE_PATH)
            ? url.toString()
            : null;
    } catch {
        return null;
    }
}
