import i18n from '@/i18n/config';
import { getApiErrorDetails, resolveApiErrorMessage } from '@/lib/api-errors';

/**
 * Table checkout failures.
 *
 * The API now returns a registry-backed machine `code` for every failure.
 * Recovery branches on that code only; display copy is resolved centrally.
 */
export type TableOrderErrorCode =
    | 'TABLE_PAY_NOW_DISABLED'
    | 'TABLE_PAY_LATER_DISABLED'
    | 'TABLE_ORDER_PAYMENT_METHOD_INVALID'
    | 'PAY_AT_COUNTER_REQUIRES_TABLE_ORDER_ENDPOINT'
    | 'PAYMENT_CONTEXT_CHANGED'
    | 'PAYMENT_ALREADY_IN_PROGRESS'
    | 'CART_ALREADY_SUBMITTED'
    | 'TABLE_INVALID_FOR_BRANCH'
    | 'ORDER_TYPE_UNAVAILABLE'
    | 'PAYMENT_ORDER_TYPE_INVALID'
    | 'PAYMENT_TABLE_ID_REQUIRED'
    | 'TABLE_NOT_FOUND'
    | 'CART_NOT_FOUND'
    | 'PAYMENT_ALREADY_COMPLETED_FOR_CART'
    | 'ORDER_CART_BRANCH_MISMATCH';

/** What the UI must do next; nothing here retries a checkout on its own. */
export type TableOrderErrorAction =
    /** Capability changed under us — re-resolve the QR and re-render the buttons. */
    | 'REFRESH_QR'
    /** The cart is gone/submitted — drop local cart state and start over. */
    | 'RESET_CART'
    /** A payment owns this cart; stay on the online-payment journey. */
    | 'KEEP_PAYMENT'
    /** Nothing to recover automatically, just show the message. */
    | 'SHOW_MESSAGE';

export interface ResolvedTableOrderError {
    code: TableOrderErrorCode | null;
    action: TableOrderErrorAction;
    message: string;
    /** Present on the 409s that point at the payment holding this cart. */
    paymentId?: string;
}

const ACTION_BY_CODE: Record<TableOrderErrorCode, TableOrderErrorAction> = {
    TABLE_PAY_NOW_DISABLED: 'REFRESH_QR',
    TABLE_PAY_LATER_DISABLED: 'REFRESH_QR',
    TABLE_ORDER_PAYMENT_METHOD_INVALID: 'REFRESH_QR',
    PAY_AT_COUNTER_REQUIRES_TABLE_ORDER_ENDPOINT: 'REFRESH_QR',
    ORDER_TYPE_UNAVAILABLE: 'REFRESH_QR',
    PAYMENT_ORDER_TYPE_INVALID: 'REFRESH_QR',
    PAYMENT_TABLE_ID_REQUIRED: 'REFRESH_QR',
    TABLE_NOT_FOUND: 'REFRESH_QR',
    ORDER_CART_BRANCH_MISMATCH: 'REFRESH_QR',
    TABLE_INVALID_FOR_BRANCH: 'REFRESH_QR',
    PAYMENT_CONTEXT_CHANGED: 'KEEP_PAYMENT',
    PAYMENT_ALREADY_IN_PROGRESS: 'KEEP_PAYMENT',
    CART_ALREADY_SUBMITTED: 'RESET_CART',
    CART_NOT_FOUND: 'RESET_CART',
    PAYMENT_ALREADY_COMPLETED_FOR_CART: 'RESET_CART',
};

const isKnownCode = (value: string | undefined): value is TableOrderErrorCode =>
    !!value && value in ACTION_BY_CODE;

export function resolveTableOrderError(error: unknown): ResolvedTableOrderError {
    const details = getApiErrorDetails(error);
    const rawCode = details.code ?? undefined;
    const code: TableOrderErrorCode | null = isKnownCode(rawCode) ? rawCode : null;
    const paymentId = typeof details.data.paymentId === 'string' ? details.data.paymentId : undefined;

    return {
        code,
        action: code ? ACTION_BY_CODE[code] : 'SHOW_MESSAGE',
        message: resolveApiErrorMessage(error, i18n.t('table.errors.GENERIC')),
        paymentId,
    };
}
