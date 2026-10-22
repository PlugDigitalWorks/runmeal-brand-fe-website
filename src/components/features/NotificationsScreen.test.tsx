import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';

const auth = { isAuthenticated: true, isGuest: false, isLoading: false };
const notifications = { language: 'tr' as 'tr' | 'en', refreshUnreadCount: vi.fn(async () => undefined), pushState: 'hidden' };
const replace = vi.fn();

vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/context/NotificationsContext', () => ({ useNotifications: () => notifications }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/services/notification.service', () => ({
    notificationService: { listMine: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn(), unreadCount: vi.fn() },
}));

import { toast } from 'sonner';
import { notificationService } from '@/services/notification.service';
import { NotificationsScreen } from './NotificationsScreen';

const page = (data: Array<{ id: string; title: string; body: string; readAt: string | null }>, meta = { page: 1, totalPages: 1 }) => ({
    data: data.map((item) => ({ ...item, createdAt: '2026-10-22T09:30:00Z' })),
    meta: { total: data.length, limit: 20, ...meta },
});

beforeEach(async () => {
    Object.assign(auth, { isAuthenticated: true, isGuest: false, isLoading: false });
    notifications.language = 'tr';
    vi.mocked(notificationService.markRead).mockResolvedValue(undefined);
    vi.mocked(notificationService.markAllRead).mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await i18n.changeLanguage('tr');
});

describe('NotificationsScreen', () => {
    it("lists the customer's notifications in the brand's language, as plain text", async () => {
        notifications.language = 'en';
        vi.mocked(notificationService.listMine).mockResolvedValue(
            page([{ id: 'n-1', title: '<img src=x onerror=alert(1)>', body: 'Kampanya başladı', readAt: null }]),
        );

        render(<NotificationsScreen />);

        expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
        expect(screen.getByText('Kampanya başladı')).toBeInTheDocument();
        expect(document.querySelector('img')).toBeNull();
        expect(notificationService.listMine).toHaveBeenCalledWith('en', 1);
        expect(notifications.refreshUnreadCount).toHaveBeenCalled();
    });

    it('marks an unread notification read when opened and refreshes the badge', async () => {
        const user = userEvent.setup();
        vi.mocked(notificationService.listMine).mockResolvedValue(page([{ id: 'n-1', title: 'Sipariş', body: 'Hazır', readAt: null }]));
        render(<NotificationsScreen />);

        await user.click(await screen.findByText('Sipariş'));

        expect(notificationService.markRead).toHaveBeenCalledWith('n-1');
        await waitFor(() => expect(screen.queryByLabelText('Okunmadı')).not.toBeInTheDocument());
        expect(notifications.refreshUnreadCount).toHaveBeenCalledTimes(2);
    });

    it('marks everything read', async () => {
        const user = userEvent.setup();
        vi.mocked(notificationService.listMine).mockResolvedValue(
            page([
                { id: 'n-1', title: 'Bir', body: 'a', readAt: null },
                { id: 'n-2', title: 'İki', body: 'b', readAt: null },
            ]),
        );
        render(<NotificationsScreen />);

        await user.click(await screen.findByRole('button', { name: 'Tümünü okundu yap' }));

        expect(notificationService.markAllRead).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryAllByLabelText('Okunmadı')).toHaveLength(0));
        expect(screen.queryByRole('button', { name: 'Tümünü okundu yap' })).not.toBeInTheDocument();
    });

    it('shows "not found" and reloads the list when the notification is gone', async () => {
        const user = userEvent.setup();
        vi.mocked(notificationService.listMine)
            .mockResolvedValueOnce(page([{ id: 'n-1', title: 'Eski', body: 'x', readAt: null }]))
            .mockResolvedValueOnce(page([]));
        vi.mocked(notificationService.markRead).mockRejectedValue({
            response: { status: 404, data: { code: 'NOTIFICATION_NOT_FOUND' } },
        });
        render(<NotificationsScreen />);

        await user.click(await screen.findByText('Eski'));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Bildirim bulunamadı.'));
        expect(await screen.findByText('Henüz bildiriminiz yok.')).toBeInTheDocument();
        expect(notificationService.listMine).toHaveBeenCalledTimes(2);
    });

    it('shows an empty state', async () => {
        vi.mocked(notificationService.listMine).mockResolvedValue(page([]));
        render(<NotificationsScreen />);

        expect(await screen.findByText('Henüz bildiriminiz yok.')).toBeInTheDocument();
    });

    it('loads the next page on demand', async () => {
        const user = userEvent.setup();
        vi.mocked(notificationService.listMine)
            .mockResolvedValueOnce(page([{ id: 'n-1', title: 'Birinci', body: 'a', readAt: 'x' }], { page: 1, totalPages: 2 }))
            .mockResolvedValueOnce(page([{ id: 'n-2', title: 'İkinci', body: 'b', readAt: 'x' }], { page: 2, totalPages: 2 }));
        render(<NotificationsScreen />);

        await user.click(await screen.findByRole('button', { name: 'Daha fazla göster' }));

        expect(await screen.findByText('İkinci')).toBeInTheDocument();
        expect(notificationService.listMine).toHaveBeenLastCalledWith('tr', 2);
        expect(screen.queryByRole('button', { name: 'Daha fazla göster' })).not.toBeInTheDocument();
    });

    it('sends guests to the login page and loads nothing', async () => {
        auth.isGuest = true;
        render(<NotificationsScreen />);

        await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
        expect(notificationService.listMine).not.toHaveBeenCalled();
    });
});
