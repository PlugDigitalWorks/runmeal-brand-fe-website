import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';

const notifications = {
    language: 'tr' as 'tr' | 'en',
    unreadCount: 2,
    refreshUnreadCount: vi.fn(async () => undefined),
    listVersion: 0,
};

vi.mock('@/context/NotificationsContext', () => ({ useNotifications: () => notifications }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/services/notification.service', () => ({
    NOTIFICATION_PAGE_LIMIT: 20,
    notificationService: { listMine: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn(), unreadCount: vi.fn() },
}));

import { notificationService } from '@/services/notification.service';
import { NotificationBell } from './NotificationBell';

const page = (data: Array<{ id: string; title: string; body: string; readAt: string | null }>) => ({
    data: data.map((item) => ({ ...item, createdAt: '2026-10-22T09:30:00Z' })),
    meta: { total: data.length, page: 1, limit: 10, totalPages: 1 },
});

beforeEach(async () => {
    notifications.unreadCount = 2;
    notifications.listVersion = 0;
    vi.mocked(notificationService.listMine).mockResolvedValue(
        page([
            { id: 'n-1', title: 'Siparişin yolda', body: 'Kuryen çıktı.', readAt: null },
            { id: 'n-2', title: 'Kampanya', body: '%20 indirim', readAt: '2026-10-22T08:00:00Z' },
        ]),
    );
    vi.mocked(notificationService.markRead).mockResolvedValue(undefined);
    vi.mocked(notificationService.markAllRead).mockResolvedValue(undefined);
    await i18n.changeLanguage('tr');
});

describe('NotificationBell', () => {
    it('shows the unread badge and loads nothing until opened', async () => {
        render(<NotificationBell />);

        expect(screen.getByRole('button', { name: '2 okunmamış bildirim' })).toHaveTextContent('2');
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(notificationService.listMine).not.toHaveBeenCalled();
    });

    it('opens a panel with the latest notifications', async () => {
        const user = userEvent.setup();
        render(<NotificationBell />);

        await user.click(screen.getByRole('button', { name: '2 okunmamış bildirim' }));

        expect(await screen.findByText('Siparişin yolda')).toBeInTheDocument();
        expect(screen.getByText('Kuryen çıktı.')).toBeInTheDocument();
        expect(notificationService.listMine).toHaveBeenCalledWith('tr', 1, 10);
        expect(screen.getByRole('link', { name: 'Tüm bildirimleri gör' })).toHaveAttribute('href', '/notifications');
    });

    it('marks a notification read from the panel', async () => {
        const user = userEvent.setup();
        render(<NotificationBell />);
        await user.click(screen.getByRole('button', { name: '2 okunmamış bildirim' }));

        await user.click(await screen.findByText('Siparişin yolda'));

        expect(notificationService.markRead).toHaveBeenCalledWith('n-1');
        await waitFor(() => expect(screen.queryByLabelText('Okunmadı')).not.toBeInTheDocument());
        expect(notifications.refreshUnreadCount).toHaveBeenCalled();
    });

    it('marks everything read from the panel', async () => {
        const user = userEvent.setup();
        render(<NotificationBell />);
        await user.click(screen.getByRole('button', { name: '2 okunmamış bildirim' }));

        await user.click(await screen.findByRole('button', { name: 'Tümünü okundu yap' }));

        expect(notificationService.markAllRead).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape and on a click outside', async () => {
        const user = userEvent.setup();
        render(
            <div>
                <NotificationBell />
                <p>dışarısı</p>
            </div>,
        );
        const bell = screen.getByRole('button', { name: '2 okunmamış bildirim' });

        await user.click(bell);
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await user.click(bell);
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        await user.click(screen.getByText('dışarısı'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows the empty state', async () => {
        const user = userEvent.setup();
        notifications.unreadCount = 0;
        vi.mocked(notificationService.listMine).mockResolvedValue(page([]));
        render(<NotificationBell />);

        await user.click(screen.getByRole('button', { name: 'Bildirimler' }));

        expect(await screen.findByText('Henüz bildiriminiz yok.')).toBeInTheDocument();
    });

    it('reloads while open when a push arrives', async () => {
        const user = userEvent.setup();
        const { rerender } = render(<NotificationBell />);
        await user.click(screen.getByRole('button', { name: '2 okunmamış bildirim' }));
        await screen.findByText('Siparişin yolda');
        vi.mocked(notificationService.listMine).mockResolvedValue(
            page([{ id: 'n-3', title: 'Yepyeni', body: 'x', readAt: null }]),
        );

        notifications.listVersion = 1;
        rerender(<NotificationBell />);

        expect(await screen.findByText('Yepyeni')).toBeInTheDocument();
    });
});
