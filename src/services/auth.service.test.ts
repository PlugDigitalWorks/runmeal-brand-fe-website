import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api, authApi } from '@/lib/axios';
import { setKnownBranches, setSelectedBranchId } from '@/lib/branch-store';
import { rememberReturnPath, resolveAuthTarget } from '@/lib/return-path';
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

describe('authService sign-up branch from a ?to= link', () => {
    const RICHMOND = '1f0e2d3c-4b5a-4968-8776-a5b4c3d2e1f0';
    const headersOf = (call: unknown[]) => (call[2] as { headers?: Record<string, string> } | undefined)?.headers ?? {};

    beforeEach(() => {
        localStorage.clear();
        setSelectedBranchId(BRANCH_ID);
        setKnownBranches([
            { id: BRANCH_ID, slug: 'kew' },
            { id: RICHMOND, slug: 'richmond' },
        ]);
        mockedApi.post.mockResolvedValue({ data: { status: true, data: {} } });
        mockedAuthApi.post.mockResolvedValue({ data: { status: true, data: { redirectUrl: 'https://accounts.example' } } });
    });

    it('records the branch of a /register?to=<slug> QR over the selected one', async () => {
        // What the login/register pages store for `?to=Richmond`.
        rememberReturnPath(resolveAuthTarget('Richmond')!);

        await authService.register({ email: 'a@b.co', firstName: 'Ada', lastName: 'Lovelace', password: 'secret1' });
        await authService.startOAuthLogin('apple');

        expect(headersOf(mockedApi.post.mock.calls[0])).toEqual({ 'x-branch-id': RICHMOND });
        expect(headersOf(mockedAuthApi.post.mock.calls[0])).toEqual({ 'x-branch-id': RICHMOND });
    });

    it.each(['/loyalty', '/checkout', '/', '/order?qr=abc', '/unknown-branch'])(
        'falls back to the selected branch when the return path %s names no branch',
        async (path) => {
            rememberReturnPath(path);

            await authService.startOAuthLogin('google');

            expect(headersOf(mockedAuthApi.post.mock.calls[0])).toEqual({ 'x-branch-id': BRANCH_ID });
        },
    );

    it('sends nothing when neither the link nor a selection names a branch', async () => {
        setSelectedBranchId(null);
        rememberReturnPath('/loyalty');

        await authService.registerWithOtp({ email: 'a@b.co', firstName: 'Ada', lastName: 'Lovelace' });

        expect(headersOf(mockedApi.post.mock.calls[0])).not.toHaveProperty('x-branch-id');
    });

    it('does not consume the return path the customer lands on afterwards', async () => {
        rememberReturnPath('/richmond');

        await authService.startOAuthLogin('google');

        expect(JSON.parse(localStorage.getItem('auth_return_path') ?? '{}').path).toBe('/richmond');
    });
});
