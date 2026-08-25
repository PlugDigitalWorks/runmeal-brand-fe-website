import { api } from '@/lib/axios';
import { ApiResponse, PaginatedApiResponse, PaginationMeta } from '@/types/auth';
import {
    CustomerStampTransaction,
    StampCard,
    StampQrResponse,
    StampTransactionType,
} from '@/types/loyalty-stamp';

export interface StampTransactionQuery {
    page?: number;
    limit?: number;
    campaignId?: string;
    categoryId?: string;
    branchId?: string;
    type?: StampTransactionType;
    dateFrom?: string;
    dateTo?: string;
}

export interface StampTransactionPage {
    items: CustomerStampTransaction[];
    meta: PaginationMeta | null;
}

export const loyaltyStampService = {
    /**
     * The member QR. Static per customer, but re-read after sign-in or account
     * changes rather than cached across sessions — the value is signed by the
     * backend and carries no category choice.
     */
    async getQr() {
        const response = await api.get<ApiResponse<StampQrResponse>>('/loyalty/stamps/qr');
        return response.data.data;
    },

    /** One card per category campaign; progress is shared across brand branches. */
    async getCards(brandId: string) {
        const response = await api.get<ApiResponse<StampCard[]>>(`/loyalty/stamps/me/${brandId}`);
        return response.data.data ?? [];
    },

    async getTransactions(brandId: string, query: StampTransactionQuery = {}): Promise<StampTransactionPage> {
        const response = await api.get<PaginatedApiResponse<CustomerStampTransaction>>(
            `/loyalty/stamps/me/${brandId}/transactions`,
            { params: { page: 1, limit: 20, ...query } },
        );

        return {
            items: response.data.data ?? [],
            meta: response.data.meta ?? null,
        };
    },
};
