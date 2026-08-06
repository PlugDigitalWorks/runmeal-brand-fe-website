'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { authService } from '@/services/auth.service';
import { tableService } from '@/services/table.service';
import { setSessionRecovery } from '@/lib/axios';
import { getBrandId } from '@/lib/brand-store';
import type { QrOrderContext, TableJourneyError } from '@/types/table';

/**
 * QR table journey state.
 *
 * Everything the customer's table context needs lives in one object here:
 * `{ qrToken, brandId, branchId, tableId, tableLabel, checkoutOptions }`. It is
 * deliberately kept out of the cart — a cart can still be checked out as
 * pickup, and the table is only attached at the final submit.
 *
 * Persisted in sessionStorage so a Stripe round trip and the checkout route
 * keep the journey, but the `/order` page always re-resolves from the URL: a
 * `tableId` must never come from stale storage or an editable query param.
 */

const STORAGE_KEY = 'rm_table_journey';

type TableJourneyStatus = 'idle' | 'resolving' | 'ready' | 'error';

interface TableContextType {
    journey: QrOrderContext | null;
    status: TableJourneyStatus;
    error: TableJourneyError | null;
    /**
     * True on the QR routes. Derived from the pathname rather than from the
     * resolved journey, so cart/branch state can take the table path from the
     * very first render instead of after the resolve round trip.
     */
    isTableMode: boolean;
    resolveFromToken: (qrToken: string) => Promise<QrOrderContext | null>;
    /** Re-reads the effective checkout options after a capability error. */
    refreshOptions: () => Promise<QrOrderContext | null>;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Journey store
//
// The journey lives outside React so it can be read straight out of
// sessionStorage without a hydration-time setState. `useSyncExternalStore`
// gives the server (and the first client render) a null snapshot and swaps in
// the stored journey once subscribed, which is exactly the reload/return-from-
// Stripe case.
// ---------------------------------------------------------------------------

let currentJourney: QrOrderContext | null = null;
let isHydrated = false;
const listeners = new Set<() => void>();

const readStoredJourney = (): QrOrderContext | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as QrOrderContext;
        return parsed?.qrToken && parsed?.tableId && parsed?.branchId ? parsed : null;
    } catch {
        return null;
    }
};

const writeStoredJourney = (journey: QrOrderContext | null) => {
    if (typeof window === 'undefined') return;
    try {
        if (journey) {
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(journey));
        } else {
            window.sessionStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // Storage disabled: the journey simply doesn't survive a reload.
    }
};

const subscribeToJourney = (listener: () => void) => {
    if (!isHydrated) {
        isHydrated = true;
        currentJourney = readStoredJourney();
    }
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const getJourneySnapshot = () => currentJourney;
const getServerJourneySnapshot = (): QrOrderContext | null => null;

const publishJourney = (journey: QrOrderContext | null) => {
    isHydrated = true;
    currentJourney = journey;
    writeStoredJourney(journey);
    listeners.forEach((listener) => listener());
};

const isNotFound = (error: unknown) =>
    (error as { response?: { status?: number } })?.response?.status === 404;

export function TableProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const journey = useSyncExternalStore(
        subscribeToJourney,
        getJourneySnapshot,
        getServerJourneySnapshot,
    );
    const [phase, setPhase] = useState<TableJourneyStatus>('idle');
    const [error, setError] = useState<TableJourneyError | null>(null);

    const isTableMode = pathname === '/order' || pathname.startsWith('/order/');
    // A journey rehydrated from storage is ready even though no resolve ran in
    // this mount.
    const status: TableJourneyStatus = phase === 'idle' && journey ? 'ready' : phase;

    const resolveFromToken = useCallback(async (qrToken: string) => {
        const token = qrToken?.trim();
        if (!token) {
            publishJourney(null);
            setPhase('error');
            setError('MISSING_QR');
            return null;
        }

        setPhase('resolving');
        setError(null);

        try {
            const resolved = await tableService.resolveQr(token);

            // A QR minted for another brand must not be able to drive this
            // storefront's cart: `x-brand-id` is taken from the domain, so the
            // two would disagree on every subsequent call.
            const activeBrandId = getBrandId();
            if (activeBrandId && resolved.brandId && resolved.brandId !== activeBrandId) {
                publishJourney(null);
                setPhase('error');
                setError('BRAND_MISMATCH');
                return null;
            }

            const next: QrOrderContext = { ...resolved, qrToken: token };
            publishJourney(next);
            setPhase('ready');
            return next;
        } catch (err) {
            console.error('Failed to resolve table QR', err);
            publishJourney(null);
            setPhase('error');
            setError(isNotFound(err) ? 'TABLE_NOT_FOUND' : 'UNKNOWN');
            return null;
        }
    }, []);

    /**
     * Settings can change between the scan and the submit, so a capability
     * error re-reads the same token instead of trusting what we rendered.
     */
    const activeQrToken = journey?.qrToken ?? null;
    const refreshOptions = useCallback(async () => {
        if (!activeQrToken) return null;
        return resolveFromToken(activeQrToken);
    }, [activeQrToken, resolveFromToken]);

    /**
     * A guest session dies for good after five hours — refreshing cannot
     * extend it — so a lapsed one is replaced rather than bounced to login.
     * The new guest owns a different (empty) cart, which is why this is
     * announced instead of happening silently.
     *
     * Scoped to the table routes: on the storefront an expired session must
     * still lead to a real sign-in.
     */
    useEffect(() => {
        if (!isTableMode) return;

        setSessionRecovery(async () => {
            const session = await authService.createGuestSession();
            toast.info(i18n.t('table.errors.SESSION_RESTARTED'));
            return session.accessToken;
        });

        return () => setSessionRecovery(null);
    }, [isTableMode]);

    return (
        <TableContext.Provider
            value={{ journey, status, error, isTableMode, resolveFromToken, refreshOptions }}
        >
            {children}
        </TableContext.Provider>
    );
}

export function useTable() {
    const context = useContext(TableContext);
    if (context === undefined) {
        throw new Error('useTable must be used within a TableProvider');
    }
    return context;
}
