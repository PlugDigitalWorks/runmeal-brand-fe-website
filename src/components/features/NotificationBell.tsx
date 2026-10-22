'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/context/NotificationsContext';
import { formatNotificationDate, useMyNotifications } from '@/hooks/useMyNotifications';

/** The panel shows the latest few; the rest are on /notifications. */
const PANEL_LIMIT = 10;

/**
 * The header bell: the unread badge, and a panel with the latest
 * notifications so they can be read without leaving the page. Titles and
 * bodies are plain text, never HTML.
 */
export function NotificationBell() {
    const { t, i18n } = useTranslation();
    const { unreadCount } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const panelId = useId();
    const { items, hasUnread, isLoading, hasError, isMarkingAll, reload, markRead, markAllRead } =
        useMyNotifications({ enabled: isOpen, limit: PANEL_LIMIT });

    // Close on a click outside or Escape.
    useEffect(() => {
        if (!isOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen]);

    const displayLanguage = i18n.resolvedLanguage || i18n.language || 'tr';

    return (
        <div ref={containerRef} className="relative shrink-0">
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                aria-label={unreadCount > 0 ? t('notifications.unreadBadge', { count: unreadCount }) : t('notifications.headerLink')}
                title={t('notifications.headerLink')}
                className="relative rounded-full p-2 text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-primary"
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    id={panelId}
                    role="dialog"
                    aria-label={t('notifications.headerLink')}
                    className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
                >
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
                        <p className="text-sm font-semibold text-zinc-900">{t('notifications.headerLink')}</p>
                        {hasUnread && (
                            <button
                                type="button"
                                onClick={() => void markAllRead()}
                                disabled={isMarkingAll}
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-60"
                            >
                                <CheckCheck size={14} />
                                {t('notifications.markAllRead')}
                            </button>
                        )}
                    </div>

                    <div className="max-h-[min(24rem,calc(100vh-10rem))] overflow-y-auto">
                        {isLoading ? (
                            <p className="flex items-center gap-2 px-4 py-6 text-sm text-zinc-500">
                                <Loader2 size={16} className="animate-spin" /> {t('notifications.loading')}
                            </p>
                        ) : hasError ? (
                            <div className="space-y-2 px-4 py-6 text-sm text-zinc-600">
                                <p>{t('notifications.loadFailed')}</p>
                                <button type="button" onClick={() => void reload()} className="font-medium text-primary hover:underline">
                                    {t('notifications.retry')}
                                </button>
                            </div>
                        ) : items.length === 0 ? (
                            <p className="px-4 py-8 text-center text-sm text-zinc-500">{t('notifications.empty')}</p>
                        ) : (
                            <ul className="divide-y divide-zinc-100">
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
                                            <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-sm text-zinc-600">{item.body}</p>
                                            <p className="mt-1.5 text-xs text-zinc-400">{formatNotificationDate(item.createdAt, displayLanguage)}</p>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <Link
                        href="/notifications"
                        onClick={() => setIsOpen(false)}
                        className="block border-t border-zinc-100 px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-zinc-50"
                    >
                        {t('notifications.viewAll')}
                    </Link>
                </div>
            )}
        </div>
    );
}
