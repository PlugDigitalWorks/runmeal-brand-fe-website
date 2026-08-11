import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';

export type PaymentMethod = 'ONLINE_CARD' | 'CASH' | 'CARD_ON_DELIVERY';
export type OrderType = 'DELIVERY' | 'SCHEDULED_DELIVERY' | 'PICKUP' | 'SCHEDULED_PICKUP' | 'TABLE_ORDER';

export interface PaymentInitializationResponse {
    paymentId: string;
    orderId?: string;
    checkoutFormContent?: string;
    paymentUrl?: string;
}

export interface PaymentDetailsResponse {
    id: string;
    providerResponse: {
        paymentPageUrl?: string;
        paymentUrl?: string;
        checkoutFormContent?: string;
    } | null;
}

export interface InitializePaymentInput {
    cartId: string;
    /** Part of the protected-request contract; the backend re-derives it from the cart. */
    branchId?: string | null;
    paymentMethod?: PaymentMethod;
    orderType?: OrderType;
    /**
     * Only ever sent for `TABLE_ORDER`. The backend ignores it on every other
     * order type, so a pickup order can never join a table check.
     */
    tableId?: string;
    /** Opaque backend-issued slot value, valid only for scheduled order types. */
    scheduledFor?: string;
    creditUsedAmount?: number;
    note?: string;
}

export const paymentService = {
    async getPaymentById(paymentId: string) {
        const response = await api.get<ApiResponse<PaymentDetailsResponse>>(
            `/payments/${encodeURIComponent(paymentId)}`,
        );
        return response.data.data;
    },

    /**
     * Starts a payment for a cart. `TABLE_ORDER` here means "pay online now"
     * and only accepts `ONLINE_CARD` — an unpaid table order goes through
     * `orderService.createTablePayLaterOrder` instead.
     *
     * The order does not exist yet on the online-card path; the backend creates
     * it after the provider confirms payment.
     */
    async initializePayment({
        cartId,
        branchId,
        paymentMethod = 'ONLINE_CARD',
        orderType = 'DELIVERY',
        tableId,
        scheduledFor,
        creditUsedAmount,
        note,
    }: InitializePaymentInput) {
        const response = await api.post<ApiResponse<PaymentInitializationResponse>>(
            '/payments/initialize',
            {
                cartId,
                paymentMethod,
                orderType,
                ...(orderType === 'TABLE_ORDER' && tableId ? { tableId } : {}),
                ...((orderType === 'SCHEDULED_DELIVERY' || orderType === 'SCHEDULED_PICKUP') && scheduledFor
                    ? { scheduledFor }
                    : {}),
                creditUsedAmount: creditUsedAmount && creditUsedAmount > 0 ? creditUsedAmount : 0,
                ...(note?.trim() ? { note: note.trim() } : {}),
            },
            branchId ? { headers: { 'x-branch-id': branchId } } : {},
        );
        return response.data.data;
    }
};
