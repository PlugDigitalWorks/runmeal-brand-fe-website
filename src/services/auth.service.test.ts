import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, authApi } from '@/lib/axios';
import { setSelectedBranchId } from '@/lib/branch-store';
import { authService } from './auth.service';

vi.mock('@/lib/axios', () => ({
    api: { post: vi.fn() },
    authApi: { post: vi.fn() },
    AUTH_API_URL: 'https://api.example.com',
    AUTH_CLIENT: 'user',
    postSessionRefresh: vi.fn(),
}));
vi.mock('@/lib/web-push', () => ({ removeWebPushSubscription: vi.fn() }));

const BRANCH_ID = '5a6c5004-acad-4444-888e-61a6f9f8016b';
const mockedApi = vi.mocked(api);
const mockedAuthApi = vi.mocked(authApi);

const sentHeaders = (call: unknown[]) => (call[2] as { headers?: Record<string, string> } | undefined)?.headers ?? {};

describe('authService sign-up branch', () => {
    beforeEach(() => {
        setSelectedBranchId(null);
        mockedApi.post.mockResolvedValue({ data: { status: true, data: {} } });
        mockedAuthApi.post.mockResolvedValue({ data: { status: true, data: { redirectUrl: 'https://accounts.example' } } });
    });

    it('sends the selected branch with an e-mail sign-up', async () => {
        setSelectedBranchId(BRANCH_ID);

        await authService.register({ email: 'a@b.co', firstName: 'Ada', lastName: 'Lovelace', password: 'secret1' });
        await authService.registerWithOtp({ email: 'a@b.co', firstName: 'Ada', lastName: 'Lovelace' });

        expect(mockedApi.post).toHaveBeenCalledTimes(2);
        mockedApi.post.mock.calls.forEach((call) => {
            expect(call[0]).toBe('/auth/register');
            expect(sentHeaders(call)).toEqual({ 'x-branch-id': BRANCH_ID });
        });
    });

    it.each(['google', 'apple'] as const)('sends the selected branch when starting %s sign-in', async (provider) => {
        setSelectedBranchId(BRANCH_ID);

        await authService.startOAuthLogin(provider);

        const [url, body, config] = mockedAuthApi.post.mock.calls[0];
        expect(url).toBe('/auth/login');
        expect(body).toMatchObject({ method: provider });
        expect(config).toEqual({ headers: { 'x-branch-id': BRANCH_ID } });
    });

    it('sends no branch header at all without a selected branch', async () => {
        await authService.register({ email: 'a@b.co', firstName: 'Ada', lastName: 'Lovelace', password: 'secret1' });
        await authService.startOAuthLogin('google');

        expect(sentHeaders(mockedApi.post.mock.calls[0])).not.toHaveProperty('x-branch-id');
        expect(sentHeaders(mockedAuthApi.post.mock.calls[0])).not.toHaveProperty('x-branch-id');
    });

    it.each(['', 'null', 'undefined', 'not-a-branch'])('never sends %j as the branch', async (value) => {
        setSelectedBranchId(value);

        await authService.startOAuthLogin('apple');

        expect(sentHeaders(mockedAuthApi.post.mock.calls[0])).not.toHaveProperty('x-branch-id');
    });

    it('does not send the branch with a password or code login', async () => {
        setSelectedBranchId(BRANCH_ID);
        mockedAuthApi.post.mockResolvedValue({ data: { status: true, data: { accessToken: 't', user: { id: 'u' } } } });

        await authService.login({ email: 'a@b.co', password: 'secret1' });
        await authService.requestOtpLogin('a@b.co');

        mockedAuthApi.post.mock.calls.forEach((call) => expect(sentHeaders(call)).not.toHaveProperty('x-branch-id'));
    });

    it('sends only the fields the API accepts, never a role', async () => {
        await authService.register({
            email: 'a@b.co',
            firstName: 'Ada',
            lastName: 'Lovelace',
            password: 'secret1',
            country: 'GB',
            ...({ role: 'SUPER_ADMIN', phoneNumber: '+447700900000' } as object),
        });

        expect(mockedApi.post.mock.calls[0][1]).toEqual({
            email: 'a@b.co',
            firstName: 'Ada',
            lastName: 'Lovelace',
            password: 'secret1',
            country: 'GB',
        });
    });
});
