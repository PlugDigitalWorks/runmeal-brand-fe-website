import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';

const auth = { user: { id: 'u-1' }, isAuthenticated: true, isGuest: false, isLoading: false };

vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/context/BrandContext', () => ({ useBrand: () => ({ brand: { language: 'tr' } }) }));
vi.mock('@/services/push.service', () => ({
    pushService: { getPublicKey: vi.fn(), register: vi.fn(), remove: vi.fn() },
}));
vi.mock('@/services/notification.service', () => ({
    notificationService: { unreadCount: vi.fn() },
}));

import { NotificationsProvider, useNotifications } from '@/context/NotificationsContext';
import { pushService } from '@/services/push.service';
import { notificationService } from '@/services/notification.service';
import { PushOptIn } from './PushOptIn';

const SUBSCRIPTION_JSON = { endpoint: 'https://push.example.com/x', expirationTime: null, keys: { p256dh: 'p', auth: 'a' } };
let requestPermission: ReturnType<typeof vi.fn>;
let subscribe: ReturnType<typeof vi.fn>;

function installBrowser({ push = true, permission = 'default' }: { push?: boolean; permission?: NotificationPermission } = {}) {
    subscribe = vi.fn(async () => ({
        endpoint: SUBSCRIPTION_JSON.endpoint,
        options: { applicationServerKey: Uint8Array.from([1, 2, 3]).buffer },
        toJSON: () => SUBSCRIPTION_JSON,
        unsubscribe: vi.fn(),
    }));
    const registration = { pushManager: { getSubscription: vi.fn(async () => null), subscribe } };
    const serviceWorker = Object.assign(new EventTarget(), {
        register: vi.fn(async () => registration),
        ready: Promise.resolve(registration),
        getRegistration: vi.fn(),
    });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
    if (push) Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
    else delete (window as { PushManager?: unknown }).PushManager;
    requestPermission = vi.fn(async () => 'granted');
    Object.defineProperty(window, 'Notification', { configurable: true, value: { permission, requestPermission } });
}

function UnreadBadge() {
    const { unreadCount } = useNotifications();
    return <span data-testid="badge">{unreadCount}</span>;
}

const renderOptIn = () =>
    render(
        <NotificationsProvider>
            <PushOptIn />
            <UnreadBadge />
        </NotificationsProvider>,
    );

beforeEach(async () => {
    Object.assign(auth, { user: { id: 'u-1' }, isAuthenticated: true, isGuest: false, isLoading: false });
    installBrowser();
    vi.mocked(pushService.getPublicKey).mockResolvedValue('AQID');
    vi.mocked(pushService.register).mockResolvedValue(undefined);
    vi.mocked(notificationService.unreadCount).mockResolvedValue(0);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await i18n.changeLanguage('tr');
});

describe('PushOptIn', () => {
    it('explains first and asks the browser only when the customer turns it on', async () => {
        const user = userEvent.setup();
        renderOptIn();

        expect(await screen.findByText('Siparişinin durumunu ve kampanyaları bildirimle öğren.')).toBeInTheDocument();
        expect(requestPermission).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Bildirimleri aç' }));

        await waitFor(() => expect(pushService.register).toHaveBeenCalledWith(SUBSCRIPTION_JSON));
        expect(requestPermission).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByText('Bildirimleri açın')).not.toBeInTheDocument());
    });

    it('never asks a QR guest', async () => {
        auth.isGuest = true;
        renderOptIn();
        await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

        expect(screen.queryByRole('button', { name: 'Bildirimleri aç' })).not.toBeInTheDocument();
        expect(requestPermission).not.toHaveBeenCalled();
        expect(pushService.getPublicKey).not.toHaveBeenCalled();
        expect(pushService.register).not.toHaveBeenCalled();
    });

    it('never asks in a browser without push support', async () => {
        installBrowser({ push: false });
        renderOptIn();
        await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

        expect(screen.queryByRole('button', { name: 'Bildirimleri aç' })).not.toBeInTheDocument();
        expect(requestPermission).not.toHaveBeenCalled();
    });

    it('stays hidden when the API has push switched off', async () => {
        vi.mocked(pushService.getPublicKey).mockRejectedValue({ response: { status: 503, data: { code: 'PUSH_NOT_CONFIGURED' } } });
        renderOptIn();
        await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

        expect(screen.queryByRole('button', { name: 'Bildirimleri aç' })).not.toBeInTheDocument();
    });

    it('re-binds the subscription on every visit once permission is granted, without asking', async () => {
        installBrowser({ permission: 'granted' });
        renderOptIn();

        await waitFor(() => expect(pushService.register).toHaveBeenCalledWith(SUBSCRIPTION_JSON));
        expect(requestPermission).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Bildirimleri aç' })).not.toBeInTheDocument();
    });

    it('does not ask again after a block, only explains the settings', async () => {
        installBrowser({ permission: 'denied' });
        renderOptIn();

        expect(await screen.findByText(/tarayıcı ayarlarında bu siteye bildirim izni verin/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Bildirimleri aç' })).not.toBeInTheDocument();
        expect(requestPermission).not.toHaveBeenCalled();
    });

    it('shows the API error for an unsupported push service', async () => {
        const user = userEvent.setup();
        vi.mocked(pushService.register).mockRejectedValue({ response: { status: 400, data: { code: 'PUSH_ENDPOINT_NOT_ALLOWED' } } });
        renderOptIn();

        await user.click(await screen.findByRole('button', { name: 'Bildirimleri aç' }));

        expect(await screen.findByText('Bu tarayıcının bildirim servisi desteklenmiyor.')).toBeInTheDocument();
    });
});

describe('unread badge', () => {
    it('loads the count for a signed-in customer and refreshes it when the page regains focus', async () => {
        vi.mocked(notificationService.unreadCount).mockResolvedValueOnce(3).mockResolvedValueOnce(1);
        renderOptIn();

        await waitFor(() => expect(screen.getByTestId('badge')).toHaveTextContent('3'));
        act(() => {
            window.dispatchEvent(new Event('focus'));
        });
        await waitFor(() => expect(screen.getByTestId('badge')).toHaveTextContent('1'));
    });

    it('reloads the list when the count rises on focus (customers without push)', async () => {
        function ListVersion() {
            const { listVersion } = useNotifications();
            return <span data-testid="version">{listVersion}</span>;
        }
        vi.mocked(notificationService.unreadCount).mockResolvedValueOnce(0).mockResolvedValueOnce(2);
        render(
            <NotificationsProvider>
                <ListVersion />
            </NotificationsProvider>,
        );
        await waitFor(() => expect(notificationService.unreadCount).toHaveBeenCalledTimes(1));
        expect(screen.getByTestId('version')).toHaveTextContent('0');

        act(() => {
            window.dispatchEvent(new Event('focus'));
        });

        await waitFor(() => expect(screen.getByTestId('version')).toHaveTextContent('1'));
    });

    it('refreshes when the service worker reports a new notification', async () => {
        vi.mocked(notificationService.unreadCount).mockResolvedValueOnce(0).mockResolvedValueOnce(1);
        renderOptIn();
        await waitFor(() => expect(notificationService.unreadCount).toHaveBeenCalledTimes(1));

        act(() => {
            navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'notification-received' } }));
        });

        await waitFor(() => expect(screen.getByTestId('badge')).toHaveTextContent('1'));
    });

    it('is never loaded for a guest', async () => {
        auth.isGuest = true;
        renderOptIn();
        await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

        expect(notificationService.unreadCount).not.toHaveBeenCalled();
        expect(screen.getByTestId('badge')).toHaveTextContent('0');
    });
});
