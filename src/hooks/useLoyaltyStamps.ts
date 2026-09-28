'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { getApiErrorDetails, resolveApiErrorMessage } from '@/lib/api-errors';
import { AppleWalletPlatform, detectAppleWalletPlatform, parseAppleWalletDownloadUrl } from '@/lib/apple-wallet';
import { getBrandId } from '@/lib/brand-store';
import { STAMP_QR_INVALID_CODE } from '@/lib/loyalty-stamps';
import { loyaltyStampService, StampTransactionQuery } from '@/services/loyalty-stamp.service';
import { CustomerStampTransaction, StampCard, StampQrResponse } from '@/types/loyalty-stamp';

/**
 * Data access for the stamp wallet.
 *
 * Two rules shape everything here: the backend is the only source of stamp
 * counts (profile reads also run lazy expiration, so a full card may reset on
 * a refresh), and a failed refresh keeps the last good payload on screen with
 * a retry rather than blanking the wallet.
 */

/** A 401 that survived the refresh interceptor means the session is really gone. */
const useSignOutOn401 = () => {
    const router = useRouter();

    return React.useCallback(
        (error: unknown) => {
            if (getApiErrorDetails(error).statusCode !== 401) return false;
            router.replace('/login');
            return true;
        },
        [router],
    );
};

export interface StampAvailabilityState {
    /** True only once the backend confirms it; the wallet stays hidden until then. */
    isStampActive: boolean;
    isLoading: boolean;
}

/**
 * Whether this brand runs stamp loyalty.
 *
 * The entry points to the wallet are hidden unless the backend says the program
 * is on — a brand with no stamp campaigns must not advertise one, so anything
 * short of an explicit `true` (still loading, a failed read) keeps them hidden
 * rather than flashing a link to an empty screen.
 */
export function useStampAvailability(enabled: boolean): StampAvailabilityState {
    const [isStampActive, setIsStampActive] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        const brandId = getBrandId();
        if (!enabled || !brandId) {
            setIsStampActive(false);
            return;
        }

        let cancelled = false;
        setIsLoading(true);

        loyaltyStampService
            .getAvailability(brandId)
            .then((result) => {
                if (cancelled) return;
                setIsStampActive(!!result?.isStampActive);
            })
            .catch((error) => {
                if (cancelled) return;
                // Never a blocking error: the wallet entry point just stays hidden.
                console.error('Failed to read stamp availability', error);
                setIsStampActive(false);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [enabled]);

    return { isStampActive, isLoading };
}

export interface StampQrState {
    qr: StampQrResponse | null;
    isLoading: boolean;
    hasError: boolean;
    refresh: () => void;
}

/**
 * The member QR is static, so it is fetched once per signed-in session — but
 * re-requested after sign-in or account changes (`userId` changes) and again
 * whenever the backend rejects the signed value.
 */
export function useStampQr(userId: string | null | undefined): StampQrState {
    const [qr, setQr] = React.useState<StampQrResponse | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);
    const [reloadToken, setReloadToken] = React.useState(0);
    const handle401 = useSignOutOn401();

    React.useEffect(() => {
        if (!userId) {
            setQr(null);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setHasError(false);

        (async () => {
            try {
                let response: StampQrResponse;
                try {
                    response = await loyaltyStampService.getQr();
                } catch (error) {
                    // The signed value went stale; one fresh read is the documented fix.
                    if (getApiErrorDetails(error).code !== STAMP_QR_INVALID_CODE) throw error;
                    response = await loyaltyStampService.getQr();
                }
                if (cancelled) return;
                setQr(response);
            } catch (error) {
                if (cancelled) return;
                if (!handle401(error)) setHasError(true);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userId, reloadToken, handle401]);

    return {
        qr,
        isLoading,
        hasError,
        refresh: React.useCallback(() => setReloadToken((token) => token + 1), []),
    };
}

export interface StampCardsState {
    cards: StampCard[] | null;
    isLoading: boolean;
    /** True only when a refresh failed; `cards` still holds the last good read. */
    hasError: boolean;
    refresh: () => void;
}

export function useStampCards(enabled: boolean): StampCardsState {
    const [cards, setCards] = React.useState<StampCard[] | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);
    const [reloadToken, setReloadToken] = React.useState(0);
    const handle401 = useSignOutOn401();

    const refresh = React.useCallback(() => setReloadToken((token) => token + 1), []);

    React.useEffect(() => {
        const brandId = getBrandId();
        if (!enabled || !brandId) return;

        let cancelled = false;
        setIsLoading(true);
        setHasError(false);

        loyaltyStampService
            .getCards(brandId)
            .then((result) => {
                if (cancelled) return;
                setCards(result);
            })
            .catch((error) => {
                if (cancelled) return;
                // Keep the last successful cards visible behind the retry.
                if (!handle401(error)) setHasError(true);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [enabled, reloadToken, handle401]);

    // A card completed at the counter only shows up on the next read, so refresh
    // whenever the customer comes back to the tab with this screen open.
    React.useEffect(() => {
        if (!enabled) return;

        const onVisible = () => {
            if (document.visibilityState === 'visible') refresh();
        };

        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [enabled, refresh]);

    return { cards, isLoading, hasError, refresh };
}

export interface StampTransactionsState {
    transactions: CustomerStampTransaction[];
    isLoading: boolean;
    isLoadingMore: boolean;
    hasError: boolean;
    hasMore: boolean;
    total: number;
    loadMore: () => void;
    refresh: () => void;
}

const PAGE_SIZE = 20;

/** Stamp activity is its own screen — it is never merged into order history. */
export function useStampTransactions(enabled: boolean, filters: StampTransactionQuery = {}): StampTransactionsState {
    const [transactions, setTransactions] = React.useState<CustomerStampTransaction[]>([]);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [total, setTotal] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isLoadingMore, setIsLoadingMore] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);
    const [reloadToken, setReloadToken] = React.useState(0);
    const handle401 = useSignOutOn401();

    // Filters arrive as a fresh object every render; key the effect on the values.
    const filterKey = JSON.stringify(filters);
    const [appliedFilterKey, setAppliedFilterKey] = React.useState(filterKey);

    // A filter change restarts the list from the first page. Done during render
    // rather than in an effect so no request is fired for the stale page first.
    if (appliedFilterKey !== filterKey) {
        setAppliedFilterKey(filterKey);
        setPage(1);
        setTransactions([]);
    }

    React.useEffect(() => {
        const brandId = getBrandId();
        if (!enabled || !brandId) return;

        let cancelled = false;
        const isFirstPage = page === 1;
        if (isFirstPage) setIsLoading(true);
        else setIsLoadingMore(true);
        setHasError(false);

        loyaltyStampService
            .getTransactions(brandId, { ...(JSON.parse(filterKey) as StampTransactionQuery), page, limit: PAGE_SIZE })
            .then((result) => {
                if (cancelled) return;
                setTransactions((current) => (isFirstPage ? result.items : [...current, ...result.items]));
                setTotalPages(result.meta?.totalPages ?? 1);
                setTotal(result.meta?.total ?? result.items.length);
            })
            .catch((error) => {
                if (cancelled) return;
                if (!handle401(error)) setHasError(true);
            })
            .finally(() => {
                if (cancelled) return;
                setIsLoading(false);
                setIsLoadingMore(false);
            });

        return () => {
            cancelled = true;
        };
    }, [enabled, page, filterKey, reloadToken, handle401]);

    return {
        transactions,
        isLoading,
        isLoadingMore,
        hasError,
        hasMore: page < totalPages,
        total,
        loadMore: React.useCallback(() => setPage((current) => current + 1), []),
        refresh: React.useCallback(() => {
            setPage(1);
            setReloadToken((token) => token + 1);
        }, []),
    };
}

export interface AppleWalletPassState {
    /** `unsupported` until mounted, so server and first client render agree. */
    platform: AppleWalletPlatform;
    isCreating: boolean;
    error: string | null;
    add: () => void;
}

/**
 * How long the button stays locked after handing the browser to the `.pkpass`.
 * iOS shows the pass as a system sheet over the page, so nothing unloads; the
 * pause stops a second tap from spending another single-use link meanwhile.
 */
const APPLE_WALLET_HANDOFF_LOCK_MS = 2500;

/**
 * "Add to Apple Wallet" for one campaign card.
 *
 * Every click asks the backend for a new link: the URL is single-use and dies
 * after five minutes, so it is never stored or reused. The browser is sent to
 * the URL exactly as returned; the frontend never builds the download path.
 */
export function useAppleWalletPass(brandId: string, campaignId: string): AppleWalletPassState {
    const { t } = useTranslation();
    const handle401 = useSignOutOn401();
    const [platform, setPlatform] = React.useState<AppleWalletPlatform>('unsupported');
    const [isCreating, setIsCreating] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const inFlightRef = React.useRef(false);
    const mountedRef = React.useRef(true);

    React.useEffect(() => {
        mountedRef.current = true;
        setPlatform(detectAppleWalletPlatform());
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const add = React.useCallback(async () => {
        // A ref, not state: two taps in the same frame both see stale state.
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        setIsCreating(true);
        setError(null);

        try {
            const result = await loyaltyStampService.createAppleWalletLink(brandId, campaignId);
            const url = parseAppleWalletDownloadUrl(result?.url);
            if (!url) {
                if (mountedRef.current) setError(t('rewards.appleWallet.error'));
                return;
            }

            window.location.assign(url);
            await new Promise((resolve) => setTimeout(resolve, APPLE_WALLET_HANDOFF_LOCK_MS));
        } catch (requestError) {
            if (!mountedRef.current || handle401(requestError)) return;
            setError(resolveApiErrorMessage(requestError, t('rewards.appleWallet.error')));
        } finally {
            inFlightRef.current = false;
            if (mountedRef.current) setIsCreating(false);
        }
    }, [brandId, campaignId, handle401, t]);

    return {
        platform,
        isCreating,
        error,
        add: React.useCallback(() => {
            void add();
        }, [add]),
    };
}
