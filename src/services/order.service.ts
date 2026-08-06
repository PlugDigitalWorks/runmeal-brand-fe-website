import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import { TablePayLaterOrder } from '@/types/table';

export interface CreateOrderDto {
    cartId: string;
}

export interface CreateTablePayLaterOrderDto {
    cartId: string;
    tableId: string;
    branchId: string;
    note?: string;
}

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

export const orderService = {
    async getMyOrders() {
        const response = await api.get<ApiResponse<PaginatedResponse<Order>>>('/orders/customer');
        const data = response.data.data;
        if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as PaginatedResponse<Order>).data)) {
            return (data as PaginatedResponse<Order>).data;
        }
        return Array.isArray(data) ? data : [];
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
        const response = await api.post<ApiResponse<TablePayLaterOrder>>(
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

