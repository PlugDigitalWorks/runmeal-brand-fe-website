import type { TableCheckPaymentInitialization, TableCheckPaymentRequest } from '@/types/table';

const STORAGE_KEY = 'rm_table_check_payment';
const listeners = new Set<() => void>();

const publishPaymentChange = () => listeners.forEach((listener) => listener());

export interface PendingTableCheckPayment {
    qrToken: string;
    paymentId: string;
    tableCheckId: string;
    createdAt: number;
    expiresAt: string;
    paymentUrl?: string;
    checkoutFormContent?: string;
    remainingAmount: number;
    request: TableCheckPaymentRequest;
    confirmation:
        | {
            mode: 'ITEMS';
            items: { orderItemId: string; paidQuantity: number }[];
        }
        | {
            mode: 'EQUAL_SPLIT';
            splitPlanId: string;
            partNumber: number;
        };
}

export function rememberTableCheckPayment(
    qrToken: string,
    payment: TableCheckPaymentInitialization,
    confirmation: PendingTableCheckPayment['confirmation'],
    remainingAmount: number,
    request: TableCheckPaymentRequest,
) {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            qrToken,
            paymentId: payment.paymentId,
            tableCheckId: payment.tableCheckId,
            createdAt: Date.now(),
            expiresAt: payment.expiresAt,
            paymentUrl: payment.paymentUrl,
            checkoutFormContent: payment.checkoutFormContent,
            remainingAmount,
            request,
            confirmation,
        } satisfies PendingTableCheckPayment),
    );
    publishPaymentChange();
}

export function readTableCheckPayment(): PendingTableCheckPayment | null {
    return parseTableCheckPayment(getTableCheckPaymentSnapshot());
}

/** Stable primitive snapshot for hydration-safe external-store reads. */
export function getTableCheckPaymentSnapshot() {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(STORAGE_KEY);
}

/** Re-read the pending checkout when a mobile browser restores this page from BFCache. */
export function subscribeToTableCheckPayment(listener: () => void) {
    if (typeof window === 'undefined') return () => undefined;

    const refresh = () => listener();
    const refreshWhenVisible = () => {
        if (document.visibilityState === 'visible') listener();
    };
    listeners.add(listener);
    window.addEventListener('pageshow', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
        listeners.delete(listener);
        window.removeEventListener('pageshow', refresh);
        window.removeEventListener('focus', refresh);
        window.removeEventListener('storage', refresh);
        document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
}

export function parseTableCheckPayment(raw: string | null): PendingTableCheckPayment | null {
    try {
        const parsed = JSON.parse(raw || 'null');
        // Keep callback identity longer than the provider reservation itself;
        // an expired failure return is still a table-check payment, it just
        // must not expose the resume action anymore.
        const isRecent = typeof parsed?.createdAt === 'number' && Date.now() - parsed.createdAt < 2 * 60 * 60 * 1000;
        return parsed?.qrToken && parsed?.paymentId && parsed?.tableCheckId && parsed?.confirmation &&
            typeof parsed?.expiresAt === 'string' && parsed?.request &&
            typeof parsed?.remainingAmount === 'number' && isRecent
            ? parsed
            : null;
    } catch {
        return null;
    }
}

export function isTableCheckPaymentActive(payment: PendingTableCheckPayment) {
    const expiresAt = new Date(payment.expiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function forgetTableCheckPayment() {
    if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(STORAGE_KEY);
        publishPaymentChange();
    }
}
