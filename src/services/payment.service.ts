import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';

export type PaymentMethod = 'ONLINE_CARD' | 'CASH' | 'CARD_ON_DELIVERY';
export type OrderType = 'DELIVERY' | 'SCHEDULED_DELIVERY' | 'PICKUP' | 'TABLE_ORDER';

export interface PaymentInitializationResponse {
    paymentId: string;
    orderId?: string;
    checkoutFormContent?: string;
    paymentUrl?: string;
}

export interface InitializePaymentInput {
    cartId: string;
    paymentMethod?: PaymentMethod;
    orderType?: OrderType;
    /**
     * Only ever sent for `TABLE_ORDER`. The backend ignores it on every other
     * order type, so a pickup order can never join a table check.
     */
    tableId?: string;
    creditUsedAmount?: number;
    note?: string;
}

export const paymentService = {
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
        paymentMethod = 'ONLINE_CARD',
        orderType = 'DELIVERY',
        tableId,
        creditUsedAmount,
        note,
    }: InitializePaymentInput) {
        const response = await api.post<ApiResponse<PaymentInitializationResponse>>('/payments/initialize', {
            cartId,
            paymentMethod,
            orderType,
            ...(orderType === 'TABLE_ORDER' && tableId ? { tableId } : {}),
            ...(creditUsedAmount && creditUsedAmount > 0 ? { creditUsedAmount } : {}),
            ...(note?.trim() ? { note: note.trim() } : {}),
        });
        return response.data.data;
    }
};
