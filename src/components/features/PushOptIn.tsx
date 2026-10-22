'use client';

import { useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/context/NotificationsContext';

/**
 * The site's own explanation before the browser's permission prompt: the
 * prompt only opens when the customer chooses to turn notifications on.
 * Renders nothing for guests, unsupported browsers or when push is off.
 */
export function PushOptIn({ className = '' }: { className?: string }) {
    const { t, i18n } = useTranslation();
    const { pushState, pushErrorCode, isEnablingPush, enablePush } = useNotifications();
    const [isDismissed, setIsDismissed] = useState(false);

    if (pushState === 'hidden' || pushState === 'enabled' || isDismissed) return null;

    if (pushState === 'denied') {
        return (
            <div className={`flex items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 ${className}`}>
                <BellOff size={18} className="mt-0.5 shrink-0 text-zinc-400" />
                <p>{t('notifications.push.denied')}</p>
            </div>
        );
    }

    const errorKey = `apiErrors.${pushErrorCode}`;
    const errorMessage = pushErrorCode
        ? i18n.exists(errorKey) ? t(errorKey) : t('notifications.push.failed')
        : null;

    return (
        <div className={`rounded-lg border border-primary/20 bg-orange-50/60 p-4 ${className}`} role="region" aria-label={t('notifications.push.title')}>
            <div className="flex items-start gap-3">
                <Bell size={18} className="mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1 space-y-3">
                    <div>
                        <p className="text-sm font-semibold text-zinc-900">{t('notifications.push.title')}</p>
                        <p className="text-sm text-zinc-600">{t('notifications.push.description')}</p>
                    </div>
                    {errorMessage && <p className="text-xs font-medium text-red-600">{errorMessage}</p>}
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => void enablePush()}
                            disabled={isEnablingPush}
                            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
                        >
                            {isEnablingPush && <Loader2 size={14} className="animate-spin" />}
                            {isEnablingPush ? t('notifications.push.enabling') : t('notifications.push.enable')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsDismissed(true)}
                            className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
                        >
                            {t('notifications.push.notNow')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
