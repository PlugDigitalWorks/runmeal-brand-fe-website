'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBrand } from '@/context/BrandContext';
import { useTranslation } from 'react-i18next';
import { getApiErrorDetails } from '@/lib/api-errors';
import { enableWebPush, isWebPushSupported, PushSyncResult, syncWebPushSubscription } from '@/lib/web-push';
import { pushService } from '@/services/push.service';
import { notificationService } from '@/services/notification.service';

/**
 * - `hidden`: nothing to offer (signed out, a guest, an unsupported browser, or push switched off).
 * - `prompt`: permission not asked yet; the site explains first, then asks.
 * - `denied`: the browser blocked it; only the settings can undo that.
 * - `enabled`: this browser receives the customer's notifications.
 */
export type PushOfferState = 'hidden' | 'prompt' | 'denied' | 'enabled';

interface NotificationsContextType {
    /** Push and "My notifications" are for signed-in customers only, never QR guests. */
    isAvailable: boolean;
    /** The brand's language, which notification texts are requested in. */
    language: 'tr' | 'en';
    pushState: PushOfferState;
    /** Why the last enable attempt failed: the API error code, or `UNKNOWN`. */
    pushErrorCode: string | null;
    isEnablingPush: boolean;
    enablePush: () => Promise<void>;
    unreadCount: number;
    refreshUnreadCount: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
    const { user, isAuthenticated, isGuest, isLoading } = useAuth();
    const { brand } = useBrand();
    const { i18n } = useTranslation();
    const userId = !isLoading && isAuthenticated && !isGuest ? user?.id ?? null : null;
    const language: 'tr' | 'en' =
        brand?.language ?? ((i18n.resolvedLanguage || i18n.language || 'tr').startsWith('en') ? 'en' : 'tr');

    const [pushState, setPushState] = useState<PushOfferState>('hidden');
    const [pushErrorCode, setPushErrorCode] = useState<string | null>(null);
    const [isEnablingPush, setIsEnablingPush] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const applyResult = useCallback((result: PushSyncResult) => {
        switch (result.status) {
            case 'subscribed':
                setPushState('enabled');
                setPushErrorCode(null);
                break;
            case 'unavailable':
                setPushState('hidden');
                break;
            case 'denied':
                setPushState('denied');
                break;
            case 'dismissed':
                setPushState('prompt');
                break;
            case 'error':
                // An unknown brand domain is logged, never shown to the customer.
                if (result.code === 'BRAND_DOMAIN_NOT_FOUND') {
                    setPushState('hidden');
                    break;
                }
                // Keep the offer up so the customer can try again.
                setPushState('prompt');
                setPushErrorCode(result.code ?? 'UNKNOWN');
                break;
        }
    }, []);

    // Work out what to offer once the customer is known. Already granted:
    // re-bind the subscription to this customer on every sign-in and app start.
    useEffect(() => {
        let cancelled = false;

        void (async () => {
            if (!userId || !isWebPushSupported()) {
                if (!cancelled) setPushState('hidden');
                return;
            }
            const permission = Notification.permission;
            if (permission === 'granted') {
                const result = await syncWebPushSubscription();
                if (!cancelled) applyResult(result);
                return;
            }
            if (permission === 'denied') {
                if (!cancelled) setPushState('denied');
                return;
            }
            // Not asked yet: only offer it when the API has push switched on.
            try {
                await pushService.getPublicKey();
                if (!cancelled) setPushState('prompt');
            } catch (error) {
                console.error('[push] Push is not available here', getApiErrorDetails(error).code);
                if (!cancelled) setPushState('hidden');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userId, applyResult]);

    const enablePush = useCallback(async () => {
        setIsEnablingPush(true);
        setPushErrorCode(null);
        try {
            applyResult(await enableWebPush());
        } finally {
            setIsEnablingPush(false);
        }
    }, [applyResult]);

    const refreshUnreadCount = useCallback(async () => {
        if (!userId) return;
        try {
            setUnreadCount(await notificationService.unreadCount());
        } catch (error) {
            console.error('[notifications] Could not load the unread count', getApiErrorDetails(error).code);
        }
    }, [userId]);

    // The badge: on sign-in and whenever the page regains focus.
    useEffect(() => {
        if (!userId) {
            const timer = setTimeout(() => setUnreadCount(0), 0);
            return () => clearTimeout(timer);
        }
        const timer = setTimeout(() => void refreshUnreadCount(), 0);
        const onFocus = () => void refreshUnreadCount();
        window.addEventListener('focus', onFocus);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('focus', onFocus);
        };
    }, [userId, refreshUnreadCount]);

    return (
        <NotificationsContext.Provider
            value={{
                isAvailable: Boolean(userId),
                language,
                pushState,
                pushErrorCode,
                isEnablingPush,
                enablePush,
                unreadCount,
                refreshUnreadCount,
            }}
        >
            {children}
        </NotificationsContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationsContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationsProvider');
    }
    return context;
}
