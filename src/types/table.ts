/**
 * QR table-ordering journey types.
 *
 * `GET /tables/resolve/:qrToken` is public and is the only authority for the
 * branch/table a scanned QR points at. The token is opaque — never parse it,
 * never recover `tableId` from anywhere else.
 */

/** Which table checkout buttons the backend currently accepts, already effective. */
export interface TableCheckoutOptions {
    /** Table ordering + the table's pay-now switch + an active online-card provider. */
    payNow: boolean;
    /** Table ordering + the table's pay-later switch. */
    payLater: boolean;
}

/** Raw payload of `GET /tables/resolve/:qrToken`. */
export interface TableResolveResponse {
    brandId: string;
    branchId: string;
    tableId: string;
    tableLabel: string;
    checkoutOptions: TableCheckoutOptions;
}

/** Journey-scoped state: resolution result plus the token it came from. */
export interface QrOrderContext extends TableResolveResponse {
    qrToken: string;
}

/** How a table journey failed, so the UI can show the right dead end. */
export type TableJourneyError =
    | 'MISSING_QR'
    | 'TABLE_NOT_FOUND'
    | 'BRAND_MISMATCH'
    | 'UNKNOWN';

/** What the customer picked on the table checkout screen. */
export type TableFulfillment = 'TABLE' | 'PICKUP';

/** Only meaningful for `TABLE_ORDER`; pickup always pays online. */
export type TablePaymentChoice = 'PAY_NOW' | 'PAY_LATER';

/**
 * `POST /orders/table/pay-later` answers with the raw Order row, so amounts
 * arrive as decimal strings and there is no `items` array.
 */
export interface TablePayLaterOrder {
    id: string;
    orderType: string;
    paymentMethod: string;
    status: string;
    tableId: string | null;
    tableLabel: string | null;
    tableCheckId: string | null;
    totalPrice: string | number;
    currency?: string;
    createdAt?: string;
}
