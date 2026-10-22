import { EventStreamContentType, fetchEventSource } from '@microsoft/fetch-event-source';
import Cookies from 'js-cookie';
import { api, refreshAccessToken } from '@/lib/axios';
import { getBrandId } from '@/lib/brand-store';
import { getDeviceId } from '@/lib/device-id';

/** One message of `GET /orders/:orderId/events`. */
export interface OrderStatusEvent {
    orderId: string;
    status: string;
    updatedAt: string;
}

/** The server closes the stream once an order reaches one of these. */
export const FINAL_ORDER_STATUSES = ['DELIVERED', 'CANCELLED'];

export interface OrderStatusStreamOptions {
    orderId: string;
    /** The order's branch, sent as `x-branch-id` like `GET /orders/:orderId`. */
    branchId: string;
    onStatus: (event: OrderStatusEvent) => void;
    /** The server sent an `error` event (e.g. the order is gone): the stream stops for good. */
    onStreamError?: (message: string) => void;
    /** Delay before reconnect attempt `attempt` (1, 2, …). */
    backoff?: (attempt: number) => number;
    /** For tests. */
    fetch?: typeof fetch;
}

class RetriableError extends Error {}
class FatalError extends Error {}
class UnauthorizedError extends Error {}

const defaultBackoff = (attempt: number) => Math.min(30_000, 1_000 * 2 ** (attempt - 1));

/**
 * Follows an order's status over server-sent events. The browser's own
 * EventSource cannot send the Authorization header, so this uses a fetch-based
 * client. The first message is the current status, then one per change.
 *
 * - `ping` keeps the connection alive and is ignored.
 * - An `error` event stops the stream; it is not reopened.
 * - After DELIVERED or CANCELLED the server closes it; it is not reopened.
 * - Any other drop reconnects with a growing delay (the first message brings
 *   the current status, so nothing is missed); a 401 refreshes the token first.
 * - While the tab is hidden the connection is closed and reopened on return.
 *
 * Returns a function that closes the stream.
 */
export function watchOrderStatus(options: OrderStatusStreamOptions): () => void {
    const controller = new AbortController();
    const backoff = options.backoff ?? defaultBackoff;
    const url = `${api.defaults.baseURL ?? ''}/orders/${encodeURIComponent(options.orderId)}/events`;
    let finished = false;
    let attempt = 0;
    let refreshedSinceLastMessage = false;

    const buildHeaders = () => {
        const headers: Record<string, string> = {
            Accept: EventStreamContentType,
            'x-branch-id': options.branchId,
        };
        const token = Cookies.get('accessToken');
        if (token) headers.Authorization = `Bearer ${token}`;
        const brandId = getBrandId();
        if (brandId) headers['x-brand-id'] = brandId;
        const deviceId = getDeviceId();
        if (deviceId) headers['x-device-id'] = deviceId;
        return headers;
    };

    const connect = () =>
        fetchEventSource(url, {
            signal: controller.signal,
            headers: buildHeaders(),
            openWhenHidden: false,
            fetch: options.fetch,
            async onopen(response) {
                const contentType = response.headers.get('content-type') ?? '';
                if (response.ok && contentType.startsWith(EventStreamContentType)) return;
                if (response.status === 401) throw new UnauthorizedError();
                // Anything else in the 4xx range will not change by retrying.
                if (response.status >= 400 && response.status < 500 && response.status !== 429) throw new FatalError();
                throw new RetriableError();
            },
            onmessage(message) {
                if (message.event === 'ping') return;
                if (message.event === 'error') {
                    finished = true;
                    options.onStreamError?.(message.data);
                    throw new FatalError();
                }
                if ((message.event && message.event !== 'message') || !message.data) return;

                let event: OrderStatusEvent;
                try {
                    event = JSON.parse(message.data) as OrderStatusEvent;
                } catch {
                    return;
                }
                attempt = 0;
                refreshedSinceLastMessage = false;
                options.onStatus(event);
                if (FINAL_ORDER_STATUSES.includes(event.status)) {
                    finished = true;
                    controller.abort();
                }
            },
            onclose() {
                // A close the server did not announce with a final status: reconnect.
                if (!finished) throw new RetriableError();
            },
            onerror(error) {
                if (error instanceof FatalError || error instanceof UnauthorizedError || finished) throw error;
                attempt += 1;
                return backoff(attempt);
            },
        });

    void (async () => {
        while (!finished && !controller.signal.aborted) {
            try {
                await connect();
                return;
            } catch (error) {
                if (finished || controller.signal.aborted) return;
                // One token refresh per drop: a second 401 in a row means the session is gone.
                if (error instanceof UnauthorizedError && !refreshedSinceLastMessage) {
                    refreshedSinceLastMessage = true;
                    try {
                        await refreshAccessToken();
                        continue;
                    } catch {
                        return;
                    }
                }
                return;
            }
        }
    })();

    return () => {
        finished = true;
        controller.abort();
    };
}
