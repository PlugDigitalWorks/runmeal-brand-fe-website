import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';

/**
 * Web push subscriptions. The brand is taken from the site the request comes
 * from, so these go through the site's own API client from the browser.
 */
export const pushService = {
    /** The VAPID key (base64url) for `pushManager.subscribe()`; public. */
    async getPublicKey() {
        const response = await api.get<ApiResponse<{ publicKey: string }>>('/push/web-subscriptions/public-key');
        return response.data.data.publicKey;
    },

    /** The body is `subscription.toJSON()`; 204, no body. */
    async register(subscription: PushSubscriptionJSON) {
        await api.post('/push/web-subscriptions', subscription);
    },

    /** Called before signing out; 204, no body. */
    async remove(endpoint: string) {
        await api.delete('/push/web-subscriptions', { data: { endpoint } });
    },
};
