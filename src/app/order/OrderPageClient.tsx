'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useTable } from '@/context/TableContext';
import { ProductList } from '@/components/features/ProductList';
import { CartSidebar } from '@/components/features/CartSidebar';
import { MobileCartFab } from '@/components/features/MobileCartFab';
import { TableInfoPanel } from '@/components/features/TableInfoPanel';
import { TableCheckPanel } from '@/components/features/TableCheckPanel';
import { TableJourneyError } from '@/components/features/TableJourneyError';

/**
 * The QR landing page: `{FRONTEND_URL}/order?qr=<opaqueQrToken>`.
 *
 * The token stays in the URL on purpose — a reload re-resolves it, which is
 * the only sanctioned way to recover table context. Nothing here ever reads a
 * `tableId` from storage or from a query param.
 */
export function OrderPageClient() {
    const { t } = useTranslation();
    const searchParams = useSearchParams();
    const qrToken = searchParams.get('qr')?.trim() ?? '';
    const { journey, status, error, resolveFromToken } = useTable();
    const { ensureSession } = useAuth();
    const [sessionReady, setSessionReady] = React.useState(false);

    // Re-resolve on every fresh journey, and open the session the branch
    // details and the cart both need. The menu itself is public, so it starts
    // loading in parallel without waiting for either.
    React.useEffect(() => {
        if (!qrToken) {
            setSessionReady(false);
            resolveFromToken('');
            return;
        }

        setSessionReady(false);
        let cancelled = false;
        (async () => {
            const resolved = await resolveFromToken(qrToken);
            if (cancelled || !resolved) return;
            const session = await ensureSession();
            if (!cancelled && session) setSessionReady(true);
        })();

        return () => {
            cancelled = true;
        };
    }, [qrToken, resolveFromToken, ensureSession]);

    if (status === 'error' && error) {
        return <TableJourneyError error={error} />;
    }

    // A journey rehydrated from a previous scan in this tab must not paint the
    // old table's label/branch while the new token is still resolving.
    if (!journey || journey.qrToken !== qrToken) {
        return (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-zinc-500">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-primary" />
                <p className="text-sm">{t('table.resolving')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
                <TableInfoPanel journey={journey} />
                <TableCheckPanel journey={journey} sessionReady={sessionReady} />
                <ProductList />
            </div>

            <aside>
                <CartSidebar />
            </aside>
            <MobileCartFab />
        </div>
    );
}
