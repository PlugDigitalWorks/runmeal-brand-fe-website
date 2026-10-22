'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { CheckCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PushOptIn } from '@/components/features/PushOptIn';
import { formatNotificationDate, useMyNotifications } from '@/hooks/useMyNotifications';

/**
 * The signed-in customer's notifications, newest first. Titles and bodies are
 * rendered as plain text, never HTML. Opening one marks it read.
 */
export function NotificationsScreen() {
    const { t, i18n } = useTranslation();
    const router = useRouter();
    const { isAuthenticated, isGuest, isLoading: isAuthLoading } = useAuth();
    const isSignedIn = isAuthenticated && !isGuest;
    const {
        items,
        hasMore,
        hasUnread,
        isLoading,
        isLoadingMore,
        hasError,
        isMarkingAll,
        reload,
        loadMore,
        markRead,
        markAllRead,
    } = useMyNotifications({ enabled: isSignedIn });

    // Guests and signed-out visitors have no notifications to read.
    useEffect(() => {
        if (!isAuthLoading && !isSignedIn) router.replace('/login');
    }, [isAuthLoading, isSignedIn, router]);

    if (isAuthLoading || !isSignedIn) return null;

    const displayLanguage = i18n.resolvedLanguage || i18n.language || 'tr';

    return (
        <div className="container mx-auto max-w-2xl px-4 py-8">
            <div className="mb-6 flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-zinc-900">{t('notifications.title')}</h1>
                {hasUnread && (
                    <button
                        type="button"
                        onClick={() => void markAllRead()}
                        disabled={isMarkingAll}
                        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-60"
                    >
                        <CheckCheck size={16} />
                        {t('notifications.markAllRead')}
                    </button>
                )}
            </div>

            <PushOptIn className="mb-6" />

            {isLoading ? (
                <p className="flex items-center gap-2 text-sm text-zinc-500">
                    <Loader2 size={16} className="animate-spin" /> {t('notifications.loading')}
                </p>
            ) : hasError ? (
                <div className="space-y-3 text-sm text-zinc-600">
                    <p>{t('notifications.loadFailed')}</p>
                    <button type="button" onClick={() => void reload()} className="font-medium text-primary hover:underline">
                        {t('notifications.retry')}
                    </button>
                </div>
            ) : items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-200 bg-white px-4 py-12 text-center text-sm text-zinc-500">
                    {t('notifications.empty')}
                </p>
            ) : (
                <>
                    <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                        {items.map((item) => (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => void markRead(item)}
                                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-zinc-50 ${item.readAt ? '' : 'bg-orange-50/50'}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <p className={`text-sm text-zinc-900 break-words ${item.readAt ? 'font-medium' : 'font-semibold'}`}>{item.title}</p>
                                        {!item.readAt && (
                                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label={t('notifications.unread')} />
                                        )}
                                    </div>
                                    <p className="mt-1 whitespace-pre-line break-words text-sm text-zinc-600">{item.body}</p>
                                    <p className="mt-1.5 text-xs text-zinc-400">{formatNotificationDate(item.createdAt, displayLanguage)}</p>
                                </button>
                            </li>
                        ))}
                    </ul>
                    {hasMore && (
                        <div className="mt-4 text-center">
                            <button
                                type="button"
                                onClick={() => void loadMore()}
                                disabled={isLoadingMore}
                                className="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                            >
                                {isLoadingMore && <Loader2 size={14} className="animate-spin" />}
                                {t('notifications.loadMore')}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
