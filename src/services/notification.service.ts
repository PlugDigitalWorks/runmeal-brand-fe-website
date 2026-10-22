import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types/auth';
import type { NotificationPage } from '@/types/notification';

/** The API caps a page at 50. */
export const NOTIFICATION_PAGE_LIMIT = 20;

export const notificationService = {
    /** Newest first; `lang` is the brand's language (English when a Turkish text was not written). */
    async listMine(lang: string, page = 1, limit = NOTIFICATION_PAGE_LIMIT) {
        const response = await api.get<ApiResponse<NotificationPage>>('/notifications/me', {
            params: { lang, page, limit: Math.min(limit, 50) },
        });
        return response.data.data;
    },

    async unreadCount() {
        const response = await api.get<ApiResponse<{ count: number }>>('/notifications/me/unread-count');
        return response.data.data.count;
    },

    /** 204, no body. */
    async markRead(id: string) {
        await api.post(`/notifications/me/${encodeURIComponent(id)}/read`);
    },

    /** 204, no body. */
    async markAllRead() {
        await api.post('/notifications/me/read-all');
    },
};
