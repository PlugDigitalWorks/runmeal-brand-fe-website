import i18n from '@/i18n/config';

/**
 * Table checkout failures.
 *
 * Only some of them carry a machine `code` — the backend raises the rest as
 * plain `BadRequestException('...')`, which the global filter flattens into
 * `{ status:false, message }` with no code at all. So a code lookup alone is
 * not enough: the ones that matter for recovery are also matched on message.
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
    | 'ORDER_TYPE_UNAVAILABLE';

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

interface TableApiErrorLike {
    response?: {
        status?: number;
        data?: {
            code?: string;
            message?: string;
            paymentId?: string;
        };
    };
}

const ACTION_BY_CODE: Record<TableOrderErrorCode, TableOrderErrorAction> = {
    TABLE_PAY_NOW_DISABLED: 'REFRESH_QR',
    TABLE_PAY_LATER_DISABLED: 'REFRESH_QR',
    TABLE_ORDER_PAYMENT_METHOD_INVALID: 'REFRESH_QR',
    PAY_AT_COUNTER_REQUIRES_TABLE_ORDER_ENDPOINT: 'REFRESH_QR',
    ORDER_TYPE_UNAVAILABLE: 'REFRESH_QR',
    TABLE_INVALID_FOR_BRANCH: 'REFRESH_QR',
    PAYMENT_CONTEXT_CHANGED: 'KEEP_PAYMENT',
    PAYMENT_ALREADY_IN_PROGRESS: 'KEEP_PAYMENT',
    CART_ALREADY_SUBMITTED: 'RESET_CART',
};

/**
 * Codeless backend messages we still have to react to. Matched on a stable
 * fragment of the English text the service throws — the table/order-type
 * guards never got a machine code, and silently treating them as generic
 * failures would leave the customer staring at a button that can't work.
 */
const MESSAGE_PATTERNS: { pattern: RegExp; code: TableOrderErrorCode }[] = [
    { pattern: /table not found for this branch/i, code: 'TABLE_INVALID_FOR_BRANCH' },
    { pattern: /tableid is required for table orders/i, code: 'TABLE_INVALID_FOR_BRANCH' },
    { pattern: /cannot (initialize payment|place table order)/i, code: 'ORDER_TYPE_UNAVAILABLE' },
];

const isKnownCode = (value: string | undefined): value is TableOrderErrorCode =>
    !!value && value in ACTION_BY_CODE;

/** Localized copy when we have one, otherwise the backend's own message. */
const resolveMessage = (code: TableOrderErrorCode | null, fallback: string | undefined) => {
    if (code) {
        const key = `table.errors.${code}`;
        const translated = i18n.t(key);
        if (translated !== key) return translated;
    }
    return fallback || i18n.t('table.errors.GENERIC');
};

export function resolveTableOrderError(error: unknown): ResolvedTableOrderError {
    const data = (error as TableApiErrorLike)?.response?.data;
    const rawMessage = data?.message;

    let code: TableOrderErrorCode | null = isKnownCode(data?.code) ? data.code : null;

    if (!code && rawMessage) {
        code = MESSAGE_PATTERNS.find(({ pattern }) => pattern.test(rawMessage))?.code ?? null;
    }

    return {
        code,
        action: code ? ACTION_BY_CODE[code] : 'SHOW_MESSAGE',
        message: resolveMessage(code, rawMessage),
        paymentId: data?.paymentId,
    };
}
