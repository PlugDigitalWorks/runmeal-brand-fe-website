'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useNotifications } from '@/context/NotificationsContext';
import { getApiErrorDetails, resolveApiErrorMessage } from '@/lib/api-errors';
import { NOTIFICATION_PAGE_LIMIT, notificationService } from '@/services/notification.service';
import type { CustomerNotification } from '@/types/notification';

export function formatNotificationDate(value: string, language: string) {
    return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-GB' : 'tr-TR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

/**
 * The customer's notifications in the brand's language, shared by the
 * "My notifications" page and the bell's panel. Loads while `enabled`, and
 * again whenever a push arrives or the bell is pressed (`listVersion`).
 */
export function useMyNotifications({ enabled, limit = NOTIFICATION_PAGE_LIMIT }: { enabled: boolean; limit?: number }) {
    const { t } = useTranslation();
    const { language, refreshUnreadCount, listVersion } = useNotifications();

    const [items, setItems] = useState<CustomerNotification[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isMarkingAll, setIsMarkingAll] = useState(false);

    const loadFirstPage = useCallback(async () => {
        setIsLoading(true);
        setHasError(false);
        try {
            const result = await notificationService.listMine(language, 1, limit);
            setItems(result.data);
            setPage(result.meta.page);
            setTotalPages(result.meta.totalPages);
        } catch (error) {
            console.error('[notifications] Could not load the list', getApiErrorDetails(error).code);
            setHasError(true);
        } finally {
            setIsLoading(false);
        }
    }, [language, limit]);

    useEffect(() => {
        if (!enabled) return;
        const timer = setTimeout(() => {
            void loadFirstPage();
            void refreshUnreadCount();
        }, 0);
        return () => clearTimeout(timer);
    }, [enabled, loadFirstPage, refreshUnreadCount, listVersion]);

    const loadMore = useCallback(async () => {
        setIsLoadingMore(true);
        try {
            const result = await notificationService.listMine(language, page + 1, limit);
            setItems((current) => [...current, ...result.data.filter((item) => !current.some((existing) => existing.id === item.id))]);
            setPage(result.meta.page);
            setTotalPages(result.meta.totalPages);
        } catch (error) {
            toast.error(resolveApiErrorMessage(error, t('notifications.loadFailed')));
        } finally {
            setIsLoadingMore(false);
        }
    }, [language, limit, page, t]);

    const markRead = useCallback(async (item: CustomerNotification) => {
        if (item.readAt) return;
        const readAt = new Date().toISOString();
        setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, readAt } : entry)));
        try {
            await notificationService.markRead(item.id);
        } catch (error) {
            toast.error(resolveApiErrorMessage(error, t('notifications.loadFailed')));
            // Gone (NOTIFICATION_NOT_FOUND) or failed: reload the list as the API has it.
            void loadFirstPage();
        } finally {
            void refreshUnreadCount();
        }
    }, [loadFirstPage, refreshUnreadCount, t]);

    const markAllRead = useCallback(async () => {
        setIsMarkingAll(true);
        try {
            await notificationService.markAllRead();
            const readAt = new Date().toISOString();
            setItems((current) => current.map((entry) => (entry.readAt ? entry : { ...entry, readAt })));
        } catch (error) {
            toast.error(resolveApiErrorMessage(error, t('notifications.loadFailed')));
        } finally {
            setIsMarkingAll(false);
            void refreshUnreadCount();
        }
    }, [refreshUnreadCount, t]);

    return {
        items,
        hasMore: page < totalPages,
        hasUnread: items.some((item) => !item.readAt),
        isLoading,
        isLoadingMore,
        hasError,
        isMarkingAll,
        reload: loadFirstPage,
        loadMore,
        markRead,
        markAllRead,
    };
}
