import { api } from '@/lib/axios';
import { ApiResponse } from '@/types/auth';
import { TableResolveResponse } from '@/types/table';

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
};
