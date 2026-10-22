/**
 * A short two-note "ting" for a notification that arrives while the site is
 * open and visible. Browsers give web notifications no custom sound, and
 * hidden tabs already get the system's, so this only covers the open page.
 *
 * Synthesised with Web Audio, so there is no file to load. Browsers only let
 * a page make sound after the visitor has interacted with it; until then the
 * chime is skipped silently.
 */

type AudioContextConstructor = typeof AudioContext;

let context: AudioContext | null = null;
let unlockListening = false;

function getAudioContextConstructor(): AudioContextConstructor | undefined {
    if (typeof window === 'undefined') return undefined;
    return window.AudioContext ?? (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
}

/** Creates (or resumes) the audio context on the first tap or key press, which browsers require. */
export function prepareNotificationChime() {
    if (unlockListening || typeof window === 'undefined') return;
    unlockListening = true;
    const unlock = () => {
        const AudioContextClass = getAudioContextConstructor();
        if (!AudioContextClass) return;
        context ??= new AudioContextClass();
        void context.resume().catch(() => undefined);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
}

/** Plays the chime when the page is visible and allowed to make sound. Never throws. */
export function playNotificationChime() {
    try {
        if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
        if (!context || context.state !== 'running') return;

        const start = context.currentTime;
        const notes: Array<[frequency: number, offset: number]> = [
            [1318.5, 0], // E6
            [1975.5, 0.09], // B6
        ];
        for (const [frequency, offset] of notes) {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;
            // A quick rise and a soft half-second fade: a bell, not a beep.
            gain.gain.setValueAtTime(0.0001, start + offset);
            gain.gain.exponentialRampToValueAtTime(0.12, start + offset + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.5);
            oscillator.connect(gain).connect(context.destination);
            oscillator.start(start + offset);
            oscillator.stop(start + offset + 0.55);
        }
    } catch {
        // Sound is a nicety; a failure must never affect the page.
    }
}

/** For tests. */
export function resetNotificationChimeForTests() {
    context = null;
    unlockListening = false;
}
