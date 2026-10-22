import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playNotificationChime, prepareNotificationChime, resetNotificationChimeForTests } from './notification-chime';

let allowed: boolean;
let created: FakeAudio[];

class FakeAudio {
    src: string;
    preload = '';
    muted = false;
    currentTime = 3;
    pause = vi.fn();
    play = vi.fn(async () => {
        if (!allowed) throw new DOMException('blocked', 'NotAllowedError');
    });
    constructor(src: string) {
        this.src = src;
        created.push(this);
    }
}

beforeEach(() => {
    allowed = false;
    created = [];
    resetNotificationChimeForTests();
    Object.defineProperty(window, 'Audio', { configurable: true, value: FakeAudio });
});

describe('notification chime', () => {
    it('uses the same sound file as the dashboard', () => {
        prepareNotificationChime();

        expect(created[0].src).toBe('/sounds/notification.mp3');
    });

    it('reports that it could not play before the visitor interacted with the page', async () => {
        prepareNotificationChime();

        expect(await playNotificationChime()).toBe(false);
    });

    it('unlocks with a muted play on the first click, then plays from the start', async () => {
        prepareNotificationChime();
        allowed = true;
        window.dispatchEvent(new Event('click'));
        await vi.waitFor(() => expect(created[0].pause).toHaveBeenCalled());
        expect(created[0].muted).toBe(false);

        expect(await playNotificationChime()).toBe(true);
        expect(created[0].currentTime).toBe(0);
        expect(created[0].muted).toBe(false);
    });

    it('reports false when nothing was prepared', async () => {
        expect(await playNotificationChime()).toBe(false);
    });
});
