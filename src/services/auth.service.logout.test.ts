import Cookies from 'js-cookie';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];

vi.mock('@/lib/web-push', () => ({
    removeWebPushSubscription: vi.fn(async () => {
        // The token must still be there while the subscription is detached.
        calls.push(`remove-push(token=${Cookies.get('accessToken') ?? 'none'})`);
    }),
}));
vi.mock('@/lib/axios', () => ({
    api: { post: vi.fn(async (url: string) => calls.push(`post ${url}`)) },
    authApi: {},
    AUTH_API_URL: '/api',
    AUTH_CLIENT: 'user',
    postSessionRefresh: vi.fn(),
}));

import { removeWebPushSubscription } from '@/lib/web-push';
import { authService } from './auth.service';

beforeEach(() => {
    calls.length = 0;
    Cookies.set('accessToken', 'token-1');
    Cookies.set('user', JSON.stringify({ id: 'u-1' }));
    Object.defineProperty(window, 'location', { configurable: true, value: { href: '/' } });
});

describe('authService.logout', () => {
    it('detaches push before calling /auth/logout and clearing the tokens', async () => {
        await authService.logout();

        expect(calls).toEqual(['remove-push(token=token-1)', 'post /auth/logout']);
        expect(Cookies.get('accessToken')).toBeUndefined();
        expect(window.location.href).toBe('/login');
    });

    it('still signs out when detaching push fails', async () => {
        vi.mocked(removeWebPushSubscription).mockImplementationOnce(async () => {
            calls.push('remove-push(failed)');
            throw new Error('network down');
        });

        await authService.logout();

        expect(calls).toEqual(['remove-push(failed)', 'post /auth/logout']);
        expect(Cookies.get('accessToken')).toBeUndefined();
        expect(window.location.href).toBe('/login');
    });
});
