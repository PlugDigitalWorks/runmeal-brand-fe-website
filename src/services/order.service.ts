import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import { TableOrderView } from '@/types/table';

export interface CreateOrderDto {
    cartId: string;
}

export interface CreateTablePayLaterOrderDto {
    cartId: string;
    tableId: string;
    branchId: string;
    note?: string;
}

/**
 * Raw `Order` row shape. `GET /orders/customer` answers with entities rather
 * than the formatted view, which is why `cartId` is available here (and why
 * the decimal columns arrive as strings).
 */
export interface Order {
    id: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    brandId: string;
    branchId: string;
    userId: string;
    cartId: string;
    totalPrice: string;
    taxAmount: string;
    status: string;
    isActive: boolean;
    userAddressId: string;
    orderType?: string;
    paymentMethod?: string;
    tableId?: string | null;
    tableLabel?: string | null;
    tableCheckId?: string | null;
    currency?: string;
    currencySymbol?: string;
    scheduledFor?: string | null;
    scheduledDate?: string | null;
    scheduledTime?: string | null;
}
export interface OrderItem {
    id: string;
    orderId: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice?: string;
    totalPrice?: string;
    price?: number | string;
}

export interface OrderDetails extends Order {
    items: OrderItem[];
}

export type ReceiptDeliveryStatus = 'sent' | 'already_sent' | 'queued';
export type ReceiptOtpStatus = 'sent' | 'not_required' | 'failed';

export interface ReceiptAccountResponse {
    receiptStatus: ReceiptDeliveryStatus;
    otpStatus: ReceiptOtpStatus;
    otpExpiresInSeconds: number | null;
}

export const orderService = {
    async getMyOrders(branchId?: string | null) {
        const response = await api.get<ApiResponse<PaginatedResponse<Order>>>('/orders/customer', {
            ...(branchId ? { headers: { 'x-branch-id': branchId } } : {}),
        });
        const data = response.data.data;
        if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as PaginatedResponse<Order>).data)) {
            return (data as PaginatedResponse<Order>).data;
        }
        return Array.isArray(data) ? data : [];
    },

    /**
     * Finds the order a cart was already turned into.
     *
     * `CART_ALREADY_SUBMITTED` tells us the cart is spent but not which order
     * consumed it, and the formatted order view drops `cartId` — so the lookup
     * goes through the entity-shaped customer list, newest first.
     */
    async findOrderByCartId(cartId: string, branchId?: string | null) {
        const orders = await orderService.getMyOrders(branchId);
        return orders.find((order) => order.cartId === cartId) ?? null;
    },

    /**
     * Sends an unpaid table order straight to the kitchen; the customer settles
     * at the counter later. No payment provider is involved and the customer
     * never picks cash vs card — staff records that while closing the check.
     *
     * The route is branch-scoped (`@RequireContext('branch')`), so the header
     * is mandatory. Repeating it with the same `cartId` returns the order that
     * was already created rather than a duplicate.
     */
    async createTablePayLaterOrder({ cartId, tableId, branchId, note }: CreateTablePayLaterOrderDto) {
        const response = await api.post<ApiResponse<TableOrderView>>(
            '/orders/table/pay-later',
            {
                cartId,
                tableId,
                ...(note?.trim() ? { note: note.trim() } : {}),
            },
            { headers: { 'x-branch-id': branchId } },
        );
        return response.data.data;
    },

    async getOrderById(orderId: string, branchId: string, brandId: string) {
        const response = await api.get<ApiResponse<OrderDetails>>(`/orders/${orderId}`, {
            headers: {
                'x-branch-id': branchId,
                'x-brand-id': brandId
            }
        });
        return response.data.data;
    },

    async requestReceiptAccount(orderId: string, email: string) {
        const response = await api.post<ApiResponse<ReceiptAccountResponse>>(
            `/customer/orders/${orderId}/receipt-account`,
            { email, acceptReceiptAndAccount: true },
        );
        return response.data.data;
    }
};


interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
