'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBrand } from '@/context/BrandContext';
import { useTranslation } from 'react-i18next';
import { getApiErrorDetails } from '@/lib/api-errors';
import { enableWebPush, isWebPushSupported, PushSyncResult, syncWebPushSubscription } from '@/lib/web-push';
import { playNotificationChime, prepareNotificationChime } from '@/lib/notification-chime';
import { pushService } from '@/services/push.service';
import { notificationService } from '@/services/notification.service';

/**
 * - `hidden`: nothing to offer (signed out, a guest, an unsupported browser, or push switched off).
 * - `prompt`: permission not asked yet; the site explains first, then asks.
 * - `denied`: the browser blocked it; only the settings can undo that.
 * - `enabled`: this browser receives the customer's notifications.
 */
export type PushOfferState = 'hidden' | 'prompt' | 'denied' | 'enabled';

/** While the tab is visible, how often the badge is checked: the only signal for customers without push. */
const UNREAD_POLL_MS = 60_000;

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
    /**
     * Opens the browser's own permission prompt as part of a click the
     * customer makes anyway (placing an order, signing in). Call it
     * synchronously from the click handler, before any await: browsers only
     * show the prompt inside a user gesture. Does nothing for guests, when
     * already granted or blocked, or when push is off.
     */
    askForPushOnUserAction: () => void;
    unreadCount: number;
    refreshUnreadCount: () => Promise<void>;
    /** Bumped whenever the list may have changed: a push arrived, or the bell was pressed. */
    listVersion: number;
    /** Reloads the badge and tells an open "My notifications" list to load again. */
    reloadNotifications: () => void;
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
    // Whether the API has push switched on: checked once, signed in or not.
    const [isPushAvailable, setIsPushAvailable] = useState<boolean | null>(null);
    const [isEnablingPush, setIsEnablingPush] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [listVersion, setListVersion] = useState(0);
    const lastUnreadRef = useRef<number | null>(null);

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

    // Push is only offered when the API has it on. Checked once per visit,
    // before sign-in too so the login page can ask; never for QR guests.
    useEffect(() => {
        if (isLoading || isGuest || isPushAvailable !== null) return;
        if (!isWebPushSupported() || Notification.permission !== 'default') return;
        let cancelled = false;
        pushService.getPublicKey().then(
            () => !cancelled && setIsPushAvailable(true),
            (error) => {
                console.error('[push] Push is not available here', getApiErrorDetails(error).code);
                if (!cancelled) setIsPushAvailable(false);
            },
        );
        return () => {
            cancelled = true;
        };
    }, [isLoading, isGuest, isPushAvailable]);

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
            if (!cancelled) setPushState(isPushAvailable ? 'prompt' : 'hidden');
        })();

        return () => {
            cancelled = true;
        };
    }, [userId, applyResult, isPushAvailable]);

    const enablePush = useCallback(async () => {
        setIsEnablingPush(true);
        setPushErrorCode(null);
        try {
            applyResult(await enableWebPush());
        } finally {
            setIsEnablingPush(false);
        }
    }, [applyResult]);

    /** `reloadListOnIncrease`: a higher count means new notifications, so an open list loads them too. */
    const loadUnreadCount = useCallback(async (reloadListOnIncrease: boolean) => {
        if (!userId) return;
        try {
            const count = await notificationService.unreadCount();
            const previous = lastUnreadRef.current;
            lastUnreadRef.current = count;
            setUnreadCount(count);
            if (reloadListOnIncrease && previous !== null && count > previous) {
                setListVersion((version) => version + 1);
                void playNotificationChime();
            }
        } catch (error) {
            console.error('[notifications] Could not load the unread count', getApiErrorDetails(error).code);
        }
    }, [userId]);

    const refreshUnreadCount = useCallback(() => loadUnreadCount(false), [loadUnreadCount]);

    const askForPushOnUserAction = useCallback(() => {
        if (isGuest || !isPushAvailable || !isWebPushSupported() || Notification.permission !== 'default') return;
        // Called inside the click, so the browser shows its prompt. Signed in:
        // subscribe now; on the login page the sign-in that follows does it.
        void Notification.requestPermission().then(async (permission) => {
            if (permission === 'denied') {
                setPushState('denied');
                return;
            }
            if (permission === 'granted' && userId) applyResult(await syncWebPushSubscription());
        });
    }, [isGuest, isPushAvailable, userId, applyResult]);

    const reloadNotifications = useCallback(() => {
        setListVersion((version) => version + 1);
        void loadUnreadCount(false);
    }, [loadUnreadCount]);

    // Browsers only allow sound after the first tap; load and unlock it then.
    useEffect(() => {
        if (userId) prepareNotificationChime();
    }, [userId]);

    // A push that arrives while the site is open: the service worker tells
    // every open tab, which then reloads its badge and list.
    useEffect(() => {
        if (!userId || typeof navigator === 'undefined' || !navigator.serviceWorker) return;
        const onMessage = (event: MessageEvent) => {
            if (event.data?.type === 'notification-received') {
                reloadNotifications();
                return;
            }
            // The service worker picks one tab to ring and silences the
            // notification when it did, so the system sound does not double it.
            if (event.data?.type === 'play-notification-sound') {
                void playNotificationChime().then((played) => event.ports[0]?.postMessage({ played }));
            }
        };
        navigator.serviceWorker.addEventListener('message', onMessage);
        return () => navigator.serviceWorker.removeEventListener('message', onMessage);
    }, [userId, reloadNotifications]);

    // The badge: on sign-in, whenever the page regains focus, and every
    // minute while it is visible. A rise also reloads an open list.
    useEffect(() => {
        lastUnreadRef.current = null;
        if (!userId) {
            const timer = setTimeout(() => setUnreadCount(0), 0);
            return () => clearTimeout(timer);
        }
        const timer = setTimeout(() => void loadUnreadCount(true), 0);
        const onFocus = () => void loadUnreadCount(true);
        const poll = setInterval(() => {
            if (document.visibilityState === 'visible') void loadUnreadCount(true);
        }, UNREAD_POLL_MS);
        window.addEventListener('focus', onFocus);
        return () => {
            clearTimeout(timer);
            clearInterval(poll);
            window.removeEventListener('focus', onFocus);
        };
    }, [userId, loadUnreadCount]);

    return (
        <NotificationsContext.Provider
            value={{
                isAvailable: Boolean(userId),
                language,
                pushState,
                pushErrorCode,
                isEnablingPush,
                enablePush,
                askForPushOnUserAction,
                unreadCount,
                refreshUnreadCount,
                listVersion,
                reloadNotifications,
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
