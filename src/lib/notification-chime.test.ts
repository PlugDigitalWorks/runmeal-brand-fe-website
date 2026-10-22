import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playNotificationChime, prepareNotificationChime, resetNotificationChimeForTests } from './notification-chime';

let started: number[];
let state: AudioContextState;

class FakeAudioContext {
    currentTime = 0;
    destination = {};
    get state() {
        return state;
    }
    resume = vi.fn(async () => {
        state = 'running';
    });
    createGain() {
        return {
            gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn((node: unknown) => node),
        };
    }
    createOscillator() {
        return {
            type: 'sine',
            frequency: { value: 0 },
            connect: vi.fn((node: unknown) => node),
            start: vi.fn((at: number) => started.push(at)),
            stop: vi.fn(),
        };
    }
}

const setVisibility = (value: DocumentVisibilityState) =>
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });

beforeEach(() => {
    started = [];
    state = 'suspended';
    resetNotificationChimeForTests();
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: FakeAudioContext });
    setVisibility('visible');
});

afterEach(() => {
    delete (document as { visibilityState?: unknown }).visibilityState;
});

describe('notification chime', () => {
    it('stays silent until the visitor has interacted with the page', () => {
        prepareNotificationChime();

        playNotificationChime();

        expect(started).toHaveLength(0);
    });

    it('plays two notes once a tap has unlocked sound', async () => {
        prepareNotificationChime();
        window.dispatchEvent(new Event('pointerdown'));
        await Promise.resolve();

        playNotificationChime();

        expect(started).toEqual([0, 0.09]);
    });

    it('stays silent while the tab is hidden (the system plays its own sound)', async () => {
        prepareNotificationChime();
        window.dispatchEvent(new Event('pointerdown'));
        await Promise.resolve();
        setVisibility('hidden');

        playNotificationChime();

        expect(started).toHaveLength(0);
    });

    it('never throws without Web Audio', () => {
        delete (window as { AudioContext?: unknown }).AudioContext;
        prepareNotificationChime();
        window.dispatchEvent(new Event('pointerdown'));

        expect(() => playNotificationChime()).not.toThrow();
    });
});
