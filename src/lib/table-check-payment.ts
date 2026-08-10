import type { TableCheckPaymentInitialization } from '@/types/table';

const STORAGE_KEY = 'rm_table_check_payment';

export interface PendingTableCheckPayment {
    qrToken: string;
    paymentId: string;
    tableCheckId: string;
    createdAt: number;
    remainingAmount: number;
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
) {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            qrToken,
            paymentId: payment.paymentId,
            tableCheckId: payment.tableCheckId,
            createdAt: Date.now(),
            remainingAmount,
            confirmation,
        } satisfies PendingTableCheckPayment),
    );
}

export function readTableCheckPayment(): PendingTableCheckPayment | null {
    return parseTableCheckPayment(getTableCheckPaymentSnapshot());
}

/** Stable primitive snapshot for hydration-safe external-store reads. */
export function getTableCheckPaymentSnapshot() {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(STORAGE_KEY);
}

export function parseTableCheckPayment(raw: string | null): PendingTableCheckPayment | null {
    try {
        const parsed = JSON.parse(raw || 'null');
        const isRecent = typeof parsed?.createdAt === 'number' && Date.now() - parsed.createdAt < 40 * 60 * 1000;
        return parsed?.qrToken && parsed?.paymentId && parsed?.tableCheckId && parsed?.confirmation &&
            typeof parsed?.remainingAmount === 'number' && isRecent
            ? parsed
            : null;
    } catch {
        return null;
    }
}

export function forgetTableCheckPayment() {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(STORAGE_KEY);
}
