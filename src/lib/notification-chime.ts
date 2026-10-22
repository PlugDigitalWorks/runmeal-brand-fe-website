/**
 * The notification sound, the same file the dashboard rings for new orders.
 *
 * It plays from any open tab of the site, in the background too, so a push
 * is heard like on the dashboard. Browsers give web notifications no custom
 * sound of their own, so with the site closed only the system sound is left.
 *
 * Browsers only let a page play sound after the visitor has interacted with
 * it, and Safari only after a play() made inside such a gesture: the first
 * tap or key press plays it muted once to unlock it.
 */

const SOUND_URL = '/sounds/notification.mp3';
// iOS counts touchend and click as gestures for audio, but not touchstart/pointerdown.
const UNLOCK_EVENTS = ['click', 'touchend', 'keydown'] as const;

let audio: HTMLAudioElement | null = null;

/** Loads the sound and unlocks it on the first tap or key press. */
export function prepareNotificationChime() {
    if (audio || typeof window === 'undefined' || typeof Audio === 'undefined') return;
    const element = new Audio(SOUND_URL);
    element.preload = 'auto';
    audio = element;

    const removeListeners = () => UNLOCK_EVENTS.forEach((type) => window.removeEventListener(type, unlock));
    function unlock() {
        element.muted = true;
        // Older engines return nothing from play(); treat it as a promise either way.
        Promise.resolve(element.play())
            .then(() => {
                removeListeners();
                element.pause();
                element.currentTime = 0;
            })
            .catch(() => undefined)
            .finally(() => {
                element.muted = false;
            });
    }
    UNLOCK_EVENTS.forEach((type) => window.addEventListener(type, unlock));
}

/** Plays the sound; resolves to whether it actually played. Never throws. */
export async function playNotificationChime(): Promise<boolean> {
    if (!audio) return false;
    try {
        audio.muted = false;
        audio.currentTime = 0;
        await audio.play();
        return true;
    } catch {
        // Not unlocked yet, or the browser blocked it.
        return false;
    }
}

/** For tests. */
export function resetNotificationChimeForTests() {
    audio = null;
}
