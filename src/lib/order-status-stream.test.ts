import Cookies from 'js-cookie';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/axios', () => ({
    api: { defaults: { baseURL: '/api' } },
    refreshAccessToken: vi.fn(),
}));
vi.mock('@/lib/brand-store', () => ({ getBrandId: () => 'brand-1' }));
vi.mock('@/lib/device-id', () => ({ getDeviceId: () => undefined }));

import { refreshAccessToken } from '@/lib/axios';
import { watchOrderStatus } from './order-status-stream';

const encoder = new TextEncoder();
const status = (value: string) => `data: ${JSON.stringify({ orderId: 'order-1', status: value, updatedAt: '2026-10-22T10:00:00Z' })}\n\n`;

/** A text/event-stream response that sends `chunks` and then ends (or stays open). */
function sseResponse(chunks: string[], { keepOpen = false } = {}) {
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
            if (!keepOpen) controller.close();
        },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const plainResponse = (statusCode: number) => new Response('', { status: statusCode, headers: { 'content-type': 'application/json' } });

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
    Cookies.set('accessToken', 'token-1');
});

describe('watchOrderStatus', () => {
    it('sends the auth, brand and branch headers', async () => {
        const fetchMock = vi.fn(async () => sseResponse([status('DELIVERED')]));

        watchOrderStatus({ orderId: 'order-1', branchId: 'branch-9', onStatus: vi.fn(), fetch: fetchMock });
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('/api/orders/order-1/events');
        expect(init.headers).toMatchObject({
            Authorization: 'Bearer token-1',
            'x-brand-id': 'brand-1',
            'x-branch-id': 'branch-9',
            Accept: 'text/event-stream',
        });
    });

    it('reports each status, ignores ping and does not reconnect after DELIVERED', async () => {
        const onStatus = vi.fn();
        const fetchMock = vi.fn(async () =>
            sseResponse([status('PREPARING'), 'event: ping\ndata: \n\n', status('ON_THE_WAY'), status('DELIVERED')]),
        );

        watchOrderStatus({ orderId: 'order-1', branchId: 'b', onStatus, fetch: fetchMock, backoff: () => 0 });
        await vi.waitFor(() => expect(onStatus).toHaveBeenCalledTimes(3));
        await flush();

        expect(onStatus.mock.calls.map(([event]) => event.status)).toEqual(['PREPARING', 'ON_THE_WAY', 'DELIVERED']);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not reconnect after CANCELLED', async () => {
        const onStatus = vi.fn();
        const fetchMock = vi.fn(async () => sseResponse([status('CANCELLED')]));

        watchOrderStatus({ orderId: 'order-1', branchId: 'b', onStatus, fetch: fetchMock, backoff: () => 0 });
        await vi.waitFor(() => expect(onStatus).toHaveBeenCalledTimes(1));
        await flush();

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('stops for good on an error event and reports it', async () => {
        const onStatus = vi.fn();
        const onStreamError = vi.fn();
        const fetchMock = vi.fn(async () => sseResponse(['event: error\ndata: Order not found.\n\n']));

        watchOrderStatus({ orderId: 'order-1', branchId: 'b', onStatus, onStreamError, fetch: fetchMock, backoff: () => 0 });
        await vi.waitFor(() => expect(onStreamError).toHaveBeenCalledWith('Order not found.'));
        await flush();

        expect(onStatus).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('reconnects with a growing delay when the connection drops', async () => {
        const onStatus = vi.fn();
        const backoff = vi.fn<(attempt: number) => number>(() => 0);
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(sseResponse([status('PREPARING')]))
            .mockResolvedValueOnce(plainResponse(502))
            .mockResolvedValueOnce(sseResponse([status('ON_THE_WAY'), status('DELIVERED')]));

        watchOrderStatus({ orderId: 'order-1', branchId: 'b', onStatus, fetch: fetchMock, backoff });
        await vi.waitFor(() => expect(onStatus).toHaveBeenCalledTimes(3));

        expect(fetchMock).toHaveBeenCalledTimes(3);
        // Attempt numbers grow while it keeps failing.
        expect(backoff.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2]);
        expect(onStatus.mock.calls.map(([event]) => event.status)).toEqual(['PREPARING', 'ON_THE_WAY', 'DELIVERED']);
    });

    it('refreshes the token on 401 and reconnects with the new one', async () => {
        vi.mocked(refreshAccessToken).mockImplementation(async () => {
            Cookies.set('accessToken', 'token-2');
            return 'token-2';
        });
        const onStatus = vi.fn();
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(plainResponse(401))
            .mockResolvedValueOnce(sseResponse([status('DELIVERED')]));

        watchOrderStatus({ orderId: 'order-1', branchId: 'b', onStatus, fetch: fetchMock, backoff: () => 0 });
        await vi.waitFor(() => expect(onStatus).toHaveBeenCalledTimes(1));

        expect(refreshAccessToken).toHaveBeenCalledTimes(1);
        const secondInit = fetchMock.mock.calls[1][1] as RequestInit;
        expect(secondInit.headers).toMatchObject({ Authorization: 'Bearer token-2' });
    });

    it('gives up on other 4xx answers without retrying', async () => {
        const fetchMock = vi.fn(async () => plainResponse(404));

        watchOrderStatus({ orderId: 'order-1', branchId: 'b', onStatus: vi.fn(), fetch: fetchMock, backoff: () => 0 });
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        await flush();

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('closes the connection when the screen stops watching', async () => {
        const fetchMock = vi.fn<typeof fetch>(async () => sseResponse([status('PREPARING')], { keepOpen: true }));

        const stop = watchOrderStatus({ orderId: 'order-1', branchId: 'b', onStatus: vi.fn(), fetch: fetchMock });
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        stop();

        const init = fetchMock.mock.calls[0][1] as RequestInit;
        expect(init.signal?.aborted).toBe(true);
    });
});
