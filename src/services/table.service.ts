import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import {
    CustomerTableCheck,
    TableCheckItemSelection,
    TableCheckPaymentInitialization,
    TableResolveResponse,
    TableSplitPlan,
} from '@/types/table';

export const tableService = {
    /**
     * Turns a scanned QR token into authoritative branch/table context.
     *
     * Public endpoint — it runs before any session exists. An unknown or
     * deactivated table answers `404 Table not found`; nothing else may be
     * called for that journey afterwards.
     */
    async resolveQr(qrToken: string) {
        const response = await api.get<ApiResponse<TableResolveResponse>>(
            `/tables/resolve/${encodeURIComponent(qrToken)}`,
        );
        return response.data.data;
    },

    /** Reads the one shared open bill derived from the opaque QR token. */
    async getCurrentCheck(qrToken: string) {
        const response = await api.get<ApiResponse<CustomerTableCheck>>(
            `/customer/table-checks/current/${encodeURIComponent(qrToken)}`,
        );
        return response.data.data;
    },

    async initializeItemPayment(qrToken: string, selections: TableCheckItemSelection[]) {
        const response = await api.post<ApiResponse<TableCheckPaymentInitialization>>(
            '/customer/table-checks/payments/initialize',
            { qrToken, mode: 'ITEMS', selections },
        );
        return response.data.data;
    },

    async createSplitPlan(qrToken: string, partCount: number) {
        const response = await api.post<ApiResponse<TableSplitPlan>>(
            '/customer/table-checks/splits',
            { qrToken, partCount },
        );
        return response.data.data;
    },

    async initializeSplitPayment(qrToken: string, splitPlanId: string, partNumber: number) {
        const response = await api.post<ApiResponse<TableCheckPaymentInitialization>>(
            '/customer/table-checks/payments/initialize',
            { qrToken, mode: 'EQUAL_SPLIT', splitPlanId, partNumber },
        );
        return response.data.data;
    },

    async cancelSplitPlan(qrToken: string, splitPlanId: string) {
        const response = await api.post<ApiResponse<TableSplitPlan | null>>(
            `/customer/table-checks/splits/${encodeURIComponent(splitPlanId)}/cancel`,
            { qrToken },
        );
        return response.data.data;
    },
};
